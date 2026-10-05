// Наложение живого листа на строку героя из базы кампании.
//
// У героя со ссылкой на лист (sheetCharacterId) всё, что относится к листу — имя, класс,
// уровень, характеристики, хиты, КД, опыт — берётся из листа при каждом чтении.
// Одноимённые колонки строки кампании для него не используются: это были бы копии.
// Персонажи без листа (NPC, спутники, герои одиночной игры без аккаунта) возвращаются как есть.
//
// Модуль не импортирует клиент базы кампании: им пользуется сам @/lib/db.

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractCharacterStats } from "./import-character";
import { loadSheets, type SheetRow } from "./sheet-store";

export type HeroView<T> = T & {
  /** Живой лист героя; null — листа нет (NPC) или он недоступен (см. sheetMissing) */
  sheet: Record<string, any> | null;
  sheetRevision: number | null;
  /** Герой привязан к листу, но строки листа в базе нет */
  sheetMissing: boolean;
};

type Linkable = { sheetCharacterId?: string | null };

function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function count(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Накладывает значения листа на строку героя. Исходный объект не меняется. */
export function overlaySheet<T extends Linkable>(character: T, row: SheetRow | null | undefined): HeroView<T> {
  if (!character.sheetCharacterId) {
    return { ...character, sheet: null, sheetRevision: null, sheetMissing: false };
  }
  if (!row) {
    return { ...character, sheet: null, sheetRevision: null, sheetMissing: true };
  }

  const sheet = row.sheet;
  const stats = extractCharacterStats(sheet);
  const level = Math.max(1, Math.min(20, count(sheet.level) || 1));
  // extractCharacterStats считает 0 хитов «не задано»; для героя без сознания 0 — настоящее значение
  const rawHp = count(sheet.hpCurrent);
  const hpCurrent = rawHp === null ? stats.hpMax : Math.min(rawHp, stats.hpMax);
  const base = character as Record<string, any>;

  return {
    ...character,
    name: text(sheet.name) ?? base.name,
    race: text(sheet.race) ?? base.race ?? null,
    class: text(sheet.className) ?? text(sheet.class) ?? base.class ?? null,
    subclass: text(sheet.subclass) ?? null,
    background: text(sheet.background) ?? base.background ?? null,
    level,
    experiencePoints: count(sheet.experiencePoints) ?? 0,
    str: stats.str,
    dex: stats.dex,
    con: stats.con,
    int: stats.int,
    wis: stats.wis,
    cha: stats.cha,
    hpMax: stats.hpMax,
    hpCurrent,
    hpTemp: count(sheet.hpTemp) ?? 0,
    ac: stats.ac,
    speed: stats.speed,
    profBonus: proficiencyBonus(level),
    sheet,
    sheetRevision: row.revision,
    sheetMissing: false,
  } as HeroView<T>;
}

/** Листы для набора героев одним запросом к базе (без запроса, если привязанных нет) */
export async function withSheets<T extends Linkable>(
  characters: T[],
  client?: SupabaseClient
): Promise<HeroView<T>[]> {
  const ids = characters.map((c) => c.sheetCharacterId).filter((id): id is string => Boolean(id));
  const sheets = ids.length > 0 ? await loadSheets(ids, client) : new Map<string, SheetRow>();
  return characters.map((c) => overlaySheet(c, c.sheetCharacterId ? sheets.get(c.sheetCharacterId) : null));
}
