// Сжатие истории кампании дешёвой моделью.
//
// Проблема: история чата растёт линейно и целиком уходит в каждый запрос,
// а каждый шаг с инструментом переотправляет её заново. Решение — «скользящее
// окно»: последние ходы идут дословно, всё что старше сворачивается в сводку.
//
// Сжимает дешёвая модель (claude-opus-4.7 у этого провайдера дешевле haiku),
// рассказчик получает только результат.

import { generateText } from "ai";
import { db } from "@/lib/db";
import { createClient, type AuthMode } from "./client";
import { resolveCheapModel } from "./models";

// Сколько последних сообщений мастер видит дословно. Ровно 3 полных хода
// (3 реплики мастера + 3 ответа игроков = 6 сообщений). Всё что старше —
// сжимается в стабильные блочные сводки для максимального попадания в KV-кэш (Prompt Caching).
export const VERBATIM_MESSAGES = 6;

// Порог запуска свёртки: сворачиваем блоками от 6 сообщений, чтобы кэш-префикс
// оставался стабильным и не пересчитывался каждый ход.
const COMPACT_THRESHOLD = 6;

// Сколько сводок держим в контексте: свежая подробная + более старые.
const MAX_SUMMARIES_IN_CONTEXT = 3;

const COMPACT_INSTRUCTIONS = `Ты — архивариус кампании D&D. Ты сжимаешь протокол игры в плотную сводку для Мастера.
Сохраняй ОБЯЗАТЕЛЬНО: имена персонажей и NPC, принятые решения игрока, полученные и потерянные предметы,
незакрытые квесты и обещания, изменения отношений, текущую локацию, нерешённые угрозы.
Выбрасывай: описания природы, атмосферу, точные числа бросков, реплики без последствий, повторы.
Пиши по-русски, телеграфно, маркированным списком. Без вступлений и заголовков. Максимум 1200 символов.`;

export interface CompactOptions {
  campaignId: string;
  apiKey?: string;
  authMode?: AuthMode;
  cheapModel?: string;
  baseURL?: string;
}

// Сводка на кампанию считается один раз за раз. Два быстрых хода подряд иначе
// запускают свёртку параллельно, обе видят одинаковый alreadyCompacted и создают
// две сводки на один диапазон сообщений.
const inFlight = new Set<string>();

/**
 * Сворачивает сообщения, вышедшие за окно дословной видимости, в запись Summary.
 * Возвращает число сжатых сообщений (0 — если сворачивать было нечего).
 *
 * Ошибку наружу не бросает: свёртка — фоновая оптимизация, её сбой не должен
 * ронять ход игры. Не сжалось — история просто останется длиннее, а следующий
 * ход попробует снова.
 */
export async function compactHistory({
  campaignId,
  apiKey,
  authMode,
  cheapModel,
  baseURL,
}: CompactOptions): Promise<number> {
  if (inFlight.has(campaignId)) return 0;
  inFlight.add(campaignId);
  try {
    const lastSummary = await db.summary.findFirst({
      where: { campaignId },
      orderBy: { toTurn: "desc" },
    });
    const alreadyCompacted = lastSummary?.toTurn ?? 0;

    // Берём всё, что ещё не сжато, в хронологическом порядке.
    const pending = await db.chatMessage.findMany({
      where: {
        campaignId,
        role: { in: ["user", "assistant"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true },
      skip: alreadyCompacted,
    });

    // Хвост длиной VERBATIM_MESSAGES мастер видит дословно — его не трогаем.
    const compactable = pending.slice(0, Math.max(0, pending.length - VERBATIM_MESSAGES));
    if (compactable.length < COMPACT_THRESHOLD) return 0;

    const transcript = compactable
      .map((m) => `${m.role === "user" ? "ИГРОК" : "МАСТЕР"}: ${m.content}`)
      .join("\n\n");

    const previous = lastSummary
      ? `Сводка предыдущего периода (не повторяй её, только дополняй новым):\n${lastSummary.content}\n\n`
      : "";

    const client = createClient(apiKey, authMode, baseURL);
    const model = resolveCheapModel(cheapModel);

    const { text } = await generateText({
      model: client.chat(model),
      system: COMPACT_INSTRUCTIONS,
      prompt: `${previous}Сожми этот фрагмент игры в сводку:\n\n${transcript}`,
      temperature: 0.3,
      // Свёртка не срочная: если провайдер отвечает лимитом или 502, дешевле
      // отступить и повторить на следующем ходу, чем висеть в ретраях.
      maxRetries: 1,
    });

    const content = text.trim();
    if (!content) return 0;

    await db.summary.create({
      data: {
        campaignId,
        content: content.slice(0, 1500),
        fromTurn: alreadyCompacted,
        toTurn: alreadyCompacted + compactable.length,
      },
    });

    console.log(
      `[compact] Кампания ${campaignId}: сжато ${compactable.length} сообщений моделью ${model}`
    );
    return compactable.length;
  } catch (e) {
    console.error("[compact] Свёртка истории не удалась:", e);
    return 0;
  } finally {
    inFlight.delete(campaignId);
  }
}

/**
 * Сводки для контекста запроса: свежая целиком, более старые — усечённые.
 */
export async function loadSummaries(campaignId: string): Promise<string> {
  const summaries = await db.summary.findMany({
    where: { campaignId },
    orderBy: { toTurn: "desc" },
    take: MAX_SUMMARIES_IN_CONTEXT,
  });
  if (summaries.length === 0) return "";

  return summaries
    .map((s, i) => (i === 0 ? s.content : `(ранее) ${s.content.slice(0, 400)}`))
    .reverse()
    .join("\n");
}

/**
 * Сколько сообщений уже свёрнуто — на столько можно укоротить дословную историю.
 */
export async function compactedCount(campaignId: string): Promise<number> {
  const last = await db.summary.findFirst({
    where: { campaignId },
    orderBy: { toTurn: "desc" },
    select: { toTurn: true },
  });
  return last?.toTurn ?? 0;
}
