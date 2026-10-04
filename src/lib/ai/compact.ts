// Хроника кампании: сжатие старой истории в одну «скользящую» сводку.
//
// Мастер видит дословно последние MIN_VERBATIM..MIN_VERBATIM+COMPACT_BLOCK сообщений
// (см. caching/dm-history.ts). Всё, что старше, живёт в хронике.
//
// Сжатие срабатывает редко и блоками: когда за пределами дословного хвоста накопилось
// COMPACT_BLOCK сообщений, они вливаются в хронику одним вызовом. Между срабатываниями
// хроника не меняется, поэтому префикс запроса стабилен и читается из кэша.
//
// Хроника — основная долгая память мастера, поэтому пишет её не служебная, а основная
// модель рассказчика: вызов один на ~12 ходов, а от его качества зависит связность сюжета.

import { generateText } from "ai";
import { db } from "@/lib/db";
import { createClient, type AuthMode } from "./client";
import { resolveDmModel } from "./models";
import { extractTokenUsage } from "./cost";
import {
  COMPACT_BLOCK,
  MIN_VERBATIM,
  chronicleFromSummaries,
  type SummaryRow,
} from "./caching/dm-history";

// Обратная совместимость: раньше константа жила здесь
export const VERBATIM_MESSAGES = MIN_VERBATIM;

/** Потолок размера хроники в символах (~1500 токенов) */
export const CHRONICLE_CHAR_LIMIT = 4500;

/** Сколько символов протокола отдаём модели за один вызов (длинные старые кампании режем на части) */
const TRANSCRIPT_CHAR_CAP = 80_000;

const COMPACT_INSTRUCTIONS = `Ты — летописец кампании D&D. Ты ведёшь ХРОНИКУ — единственную долгую память Мастера о том, что было раньше.
Тебе дают текущую хронику и новый фрагмент игры. Верни ОБНОВЛЁННУЮ хронику целиком.

Структура (строго эти разделы, маркированные списки, телеграфный стиль):
## Хроника
События по порядку. Новое дописывай в конец. Старые пункты не выбрасывай, а уплотняй: чем давнее событие, тем короче запись.
## Открытые нити
Незакрытые квесты, обещания, долги, загадки, нависшие угрозы. Закрытое — убирай отсюда (оно остаётся в Хронике).
## Персонажи мира
Именные NPC: кто это, отношение к героям, что знает или скрывает, где остался.
## Отряд
Важные решения героев, полученные и потерянные предметы, клятвы, раны и проклятия, которые ещё действуют.
## Сейчас
Где находится отряд и что происходило в самом конце фрагмента.

Правила:
- Сохраняй ИМЕНА, названия мест и предметов дословно. Не выдумывай того, чего не было в тексте.
- Решения игроков и их последствия важнее описаний. Атмосферу, погоду, точные числа бросков, реплики без последствий — выбрасывай.
- Пиши по-русски. Без вступлений и пояснений. Не более ${CHRONICLE_CHAR_LIMIT} символов на всё.`;

export interface CompactOptions {
  campaignId: string;
  apiKey?: string;
  authMode?: AuthMode;
  /** Модель рассказчика — ею пишется хроника */
  model?: string;
  /** Оставлено для совместимости вызовов; хронику пишет основная модель */
  cheapModel?: string;
  baseURL?: string;
}

// Защита от параллельного запуска в пределах одного процесса. Между экземплярами
// (serverless) она не действует — там дубль отсекает повторная проверка перед записью.
const inFlight = new Set<string>();

/**
 * Вливает в хронику сообщения, вышедшие за окно дословной видимости.
 * Возвращает число свёрнутых сообщений (0 — если сворачивать было нечего).
 *
 * Ошибку наружу не бросает: сжатие — фоновая работа, её сбой не должен ронять ход игры.
 * Не сжалось — история просто останется длиннее, а следующий ход попробует снова.
 */
export async function compactHistory({
  campaignId,
  apiKey,
  authMode,
  model,
  baseURL,
}: CompactOptions): Promise<number> {
  if (inFlight.has(campaignId)) return 0;
  inFlight.add(campaignId);
  try {
    const summaries = (await db.summary.findMany({
      where: { campaignId },
      orderBy: { toTurn: "asc" },
      select: { content: true, fromTurn: true, toTurn: true },
    })) as SummaryRow[];
    const alreadyCompacted = summaries.length > 0 ? Math.max(...summaries.map((s) => s.toTurn)) : 0;

    // Всё, что ещё не в хронике, в хронологическом порядке (тот же порядок, что в dm-history).
    const pending = await db.chatMessage.findMany({
      where: { campaignId, role: { in: ["user", "assistant"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, role: true, content: true },
      skip: alreadyCompacted,
    });

    // Хвост длиной MIN_VERBATIM мастер видит дословно — его не трогаем.
    let compactable = pending.slice(0, Math.max(0, pending.length - MIN_VERBATIM));
    if (compactable.length < COMPACT_BLOCK) return 0;

    // Очень длинный несжатый хвост (кампания, начатая до этой схемы) режем по размеру:
    // остаток доберёт следующий ход.
    let size = 0;
    let cut = compactable.length;
    for (let i = 0; i < compactable.length; i++) {
      size += compactable[i].content.length + 12;
      if (size > TRANSCRIPT_CHAR_CAP) {
        cut = Math.max(1, i);
        break;
      }
    }
    compactable = compactable.slice(0, cut);

    const transcript = compactable
      .filter((m) => !(m.role === "assistant" && m.content.trimStart().startsWith("⚠️")))
      .map((m) => `${m.role === "user" ? "ИГРОК" : "МАСТЕР"}: ${m.content}`)
      .join("\n\n");

    const previous = chronicleFromSummaries(summaries);
    const prompt =
      (previous
        ? `ТЕКУЩАЯ ХРОНИКА:\n${previous}\n\n`
        : "ТЕКУЩАЯ ХРОНИКА: (пусто — это начало кампании)\n\n") +
      `НОВЫЙ ФРАГМЕНТ ИГРЫ:\n\n${transcript}\n\nВерни обновлённую хронику целиком.`;

    const client = createClient(apiKey, authMode, baseURL);
    const modelName = resolveDmModel(model);

    const { text, usage } = await generateText({
      model: client.chat(modelName),
      system: COMPACT_INSTRUCTIONS,
      prompt,
      temperature: 0.2,
      // Сжатие не срочное: если провайдер отвечает лимитом или 502, дешевле
      // отступить и повторить на следующем ходу, чем висеть в ретраях.
      maxRetries: 1,
    });

    const content = text.trim();
    // Слишком короткий ответ — модель сбилась; старую хронику таким не затираем
    if (content.length < 80) return 0;

    // Пока модель писала, другой экземпляр мог уже сдвинуть границу — тогда наш результат лишний
    const latest = await db.summary.findFirst({
      where: { campaignId },
      orderBy: { toTurn: "desc" },
      select: { toTurn: true },
    });
    if ((latest?.toTurn ?? 0) !== alreadyCompacted) return 0;

    await db.summary.create({
      data: {
        campaignId,
        content: content.slice(0, CHRONICLE_CHAR_LIMIT + 1500),
        // fromTurn = 0: запись покрывает кампанию с самого начала (скользящая хроника)
        fromTurn: 0,
        toTurn: alreadyCompacted + compactable.length,
      },
    });

    const u = extractTokenUsage(usage);
    console.log(
      `[compact] Кампания ${campaignId}: в хронику влито ${compactable.length} сообщений моделью ${modelName} (вход ${u.inputTokens}, выход ${u.outputTokens})`
    );
    return compactable.length;
  } catch (e) {
    console.error("[compact] Обновление хроники не удалось:", e);
    return 0;
  } finally {
    inFlight.delete(campaignId);
  }
}

/** Текущая хроника кампании (пустая строка, если её ещё нет) */
export async function loadSummaries(campaignId: string): Promise<string> {
  const summaries = (await db.summary.findMany({
    where: { campaignId },
    orderBy: { toTurn: "asc" },
    select: { content: true, fromTurn: true, toTurn: true },
  })) as SummaryRow[];
  return chronicleFromSummaries(summaries);
}

/** Сколько сообщений уже в хронике */
export async function compactedCount(campaignId: string): Promise<number> {
  const last = await db.summary.findFirst({
    where: { campaignId },
    orderBy: { toTurn: "desc" },
    select: { toTurn: true },
  });
  return last?.toTurn ?? 0;
}
