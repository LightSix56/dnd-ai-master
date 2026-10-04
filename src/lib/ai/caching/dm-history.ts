// История диалога для мастера (Зона 2 кэширования LLM) — собирается на сервере из БД.
//
// Состав: [хроника кампании] + [последние сообщения дословно].
//
// Почему из БД, а не из того, что прислал клиент:
//  - клиент после перезагрузки держит только последние 200 сообщений, и окно ползёт
//    каждый ход — префикс меняется и кэш истории сбрасывается;
//  - в комнатах клиент историю не присылает вовсе;
//  - граница «что уже в хронике» хранится на сервере (Summary.toTurn), и только сервер
//    может совместить её с сообщениями без гадания.
//
// Почему это дёшево: граница хроники двигается блоками (см. compact.ts). Между сдвигами
// история строго дописывается в конец, поэтому всё, что было в прошлом запросе,
// провайдер читает из кэша. Дословных сообщений в окне от MIN_VERBATIM до
// MIN_VERBATIM + COMPACT_BLOCK.

import type { ModelMessage } from "ai";
import { db } from "@/lib/db";

/** Столько последних сообщений мастер всегда видит дословно */
export const MIN_VERBATIM = 16;

/** Хроника дополняется, когда за пределами MIN_VERBATIM накопился такой блок сообщений */
export const COMPACT_BLOCK = 24;

/**
 * Страховка на случай, если сжатие долго не срабатывает (сбой провайдера):
 * больше этого дословно не отправляем.
 */
export const MAX_VERBATIM_SAFETY = 120;

/** Потолок суммарного размера старых (до-хроникальных) сводок в контексте */
const LEGACY_SUMMARY_CHAR_CAP = 12_000;

export const CHRONICLE_HEADER = "[ХРОНИКА КАМПАНИИ — что было раньше]";

export interface SummaryRow {
  content: string;
  fromTurn: number;
  toTurn: number;
}

/**
 * Текст хроники из записей Summary.
 * Новые записи — «скользящие»: каждая покрывает кампанию с начала (fromTurn = 0),
 * поэтому достаточно последней. Старые записи (до этой схемы) были цепочкой
 * отдельных сводок по 6 сообщений — их склеиваем по порядку.
 */
export function chronicleFromSummaries(rows: SummaryRow[]): string {
  if (rows.length === 0) return "";
  const sorted = [...rows].sort((a, b) => a.toTurn - b.toTurn);
  const latest = sorted[sorted.length - 1];
  if (latest.fromTurn === 0) return latest.content.trim();

  const joined = sorted.map((s) => s.content.trim()).filter(Boolean).join("\n");
  return joined.length > LEGACY_SUMMARY_CHAR_CAP ? joined.slice(-LEGACY_SUMMARY_CHAR_CAP) : joined;
}

export function formatChronicleMessage(chronicle: string): string {
  return `${CHRONICLE_HEADER}\n${chronicle.trim()}`;
}

/** Служебные заглушки об ошибках связи в историю для модели не идут */
function isServiceStub(role: string, content: string): boolean {
  return role === "assistant" && content.trimStart().startsWith("⚠️");
}

export interface DmHistory {
  /** Сообщения для модели: хроника (если есть) + дословный хвост. Без текущего хода игрока. */
  messages: ModelMessage[];
  /** Сколько сообщений кампании уже свёрнуто в хронику */
  compactedCount: number;
  /** Сколько сообщений ушло дословно */
  verbatimCount: number;
  /** Текст и роль последнего сообщения в БД — чтобы не сохранять повтор при регенерации */
  lastStored: { id: string; role: string; content: string } | null;
}

/**
 * Собирает историю кампании для запроса к мастеру.
 * Ошибку БД наружу не бросает: без истории ход всё равно должен состояться.
 */
export async function buildDmHistory(campaignId: string): Promise<DmHistory> {
  const empty: DmHistory = { messages: [], compactedCount: 0, verbatimCount: 0, lastStored: null };
  try {
    const summaries = ((await db.summary.findMany({
      where: { campaignId },
      orderBy: { toTurn: "asc" },
      select: { content: true, fromTurn: true, toTurn: true },
    })) ?? []) as SummaryRow[];

    const compactedCount = summaries.length > 0 ? Math.max(...summaries.map((s) => s.toTurn)) : 0;

    const rows =
      (await db.chatMessage.findMany({
        where: { campaignId, role: { in: ["user", "assistant"] } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: compactedCount,
        select: { id: true, role: true, content: true },
      })) ?? [];

    const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
    const usable = rows.filter((r) => r.content && r.content.trim() && !isServiceStub(r.role, r.content));
    const verbatim = usable.length > MAX_VERBATIM_SAFETY ? usable.slice(-MAX_VERBATIM_SAFETY) : usable;

    const messages: ModelMessage[] = [];
    const chronicle = chronicleFromSummaries(summaries);
    if (chronicle) {
      messages.push({ role: "user", content: formatChronicleMessage(chronicle) });
    }
    for (const r of verbatim) {
      messages.push({ role: r.role === "assistant" ? "assistant" : "user", content: r.content });
    }

    return {
      messages,
      compactedCount,
      verbatimCount: verbatim.length,
      lastStored: lastRow ? { id: lastRow.id, role: lastRow.role, content: lastRow.content } : null,
    };
  } catch (e) {
    console.error("[dm-history] Не удалось собрать историю кампании:", e);
    return empty;
  }
}
