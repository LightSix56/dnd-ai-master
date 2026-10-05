// Перехват обращений к модели Character в базе кампании (подключается в @/lib/db).
//
// Лист героя существует только в public.characters. Чтобы ни одно место кода не прочитало
// и не записало его «копию» в колонках строки кампании, правило вынесено сюда:
//   * чтение — на строки со ссылкой на лист накладываются значения листа;
//   * запись — хиты и опыт привязанного героя уходят в лист, а поля, которыми владеет
//     лист (уровень, характеристики, максимум хитов, КД), в базу кампании не пишутся вовсе.

import type { SupabaseClient } from "@supabase/supabase-js";
import { withSheets } from "./hero-overlay";
import { addExperience, applyGameState, loadSheet, SheetUnavailableError } from "./sheet-store";

type NumberOp = number | { increment?: number; decrement?: number; set?: number };

/** Игровое состояние: пишется в лист */
const SHEET_STATE_FIELDS = ["hpCurrent", "hpTemp", "experiencePoints"] as const;
/** Сборка героя: меняется только на сайте листа, из кампании не пишется */
const SHEET_BUILD_FIELDS = [
  "level", "profBonus", "hpMax", "ac", "speed",
  "str", "dex", "con", "int", "wis", "cha",
  "race", "class", "subclass", "background",
] as const;

export interface HeroWriteSplit {
  prismaData: Record<string, unknown>;
  sheetOps: Partial<Record<(typeof SHEET_STATE_FIELDS)[number], NumberOp>>;
  dropped: string[];
}

/** Делит данные обновления привязанного героя на «в базу кампании», «в лист» и «не писать» */
export function splitHeroWrite(data: Record<string, unknown>): HeroWriteSplit {
  const prismaData: Record<string, unknown> = {};
  const sheetOps: HeroWriteSplit["sheetOps"] = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(data || {})) {
    if ((SHEET_STATE_FIELDS as readonly string[]).includes(key)) {
      if (value !== undefined) sheetOps[key as (typeof SHEET_STATE_FIELDS)[number]] = value as NumberOp;
    } else if ((SHEET_BUILD_FIELDS as readonly string[]).includes(key)) {
      dropped.push(key);
    } else {
      prismaData[key] = value;
    }
  }
  return { prismaData, sheetOps, dropped };
}

function resolve(current: number, op: NumberOp): number {
  if (typeof op === "number") return op;
  if (typeof op?.set === "number") return op.set;
  if (typeof op?.increment === "number") return current + op.increment;
  if (typeof op?.decrement === "number") return current - op.decrement;
  return current;
}

function num(value: unknown, fallback = 0): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

/** Записывает игровое состояние привязанного героя в его лист */
export async function applyHeroSheetWrite(
  sheetCharacterId: string,
  ops: HeroWriteSplit["sheetOps"],
  client?: SupabaseClient
): Promise<void> {
  const patch: Record<string, unknown> = {};
  const needsSheet = ops.hpCurrent !== undefined || ops.hpTemp !== undefined;

  if (needsSheet) {
    const row = await loadSheet(sheetCharacterId, client);
    if (!row) throw new SheetUnavailableError("Лист персонажа не найден. Выберите героя заново.");
    const hpMax = Math.max(1, num(row.sheet.hpMax, 1));
    if (ops.hpCurrent !== undefined) {
      const current = num(row.sheet.hpCurrent, hpMax);
      patch.hpCurrent = Math.max(0, Math.min(hpMax, resolve(current, ops.hpCurrent)));
    }
    if (ops.hpTemp !== undefined) {
      patch.hpTemp = Math.max(0, resolve(num(row.sheet.hpTemp), ops.hpTemp));
    }
  }

  const xp = ops.experiencePoints;
  if (xp !== undefined) {
    if (typeof xp === "object" && xp !== null && (typeof xp.increment === "number" || typeof xp.decrement === "number")) {
      const delta = typeof xp.increment === "number" ? xp.increment : -(xp.decrement as number);
      await addExperience(sheetCharacterId, delta, client);
    } else {
      patch.experiencePoints = Math.max(0, resolve(0, xp));
    }
  }

  if (Object.keys(patch).length > 0) await applyGameState(sheetCharacterId, patch, client);
}

/** Накладывает листы на результат запроса к Character (строка, массив строк или что-то иное) */
export async function liveHeroRows<T>(result: T, client?: SupabaseClient): Promise<T> {
  if (!result || typeof result !== "object") return result;
  const isArray = Array.isArray(result);
  const rows = (isArray ? result : [result]) as Array<Record<string, any>>;
  // Запрос с select без ссылки на лист накладывать не на что — отдаём как есть
  const linkable = rows.filter((r) => r && typeof r === "object" && "sheetCharacterId" in r);
  if (linkable.length === 0) return result;
  const overlaid = await withSheets(linkable, client);
  const byRow = new Map(linkable.map((r, i) => [r, overlaid[i]]));
  const mapped = rows.map((r) => byRow.get(r) ?? r);
  return (isArray ? mapped : mapped[0]) as T;
}
