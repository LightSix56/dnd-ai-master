// Запись итогов боя в листы героев.
//
// Пока идёт бой, хиты, ячейки заклинаний и состояния живут в самом бою (это состояние боя,
// а не копия листа). Когда бой завершён, они один раз записываются в лист героя в базе —
// точечно, не заменяя весь лист. Отметка Combat.sheetSyncedAt не даёт записать их повторно:
// иначе второй вызов затёр бы то, что игрок успел изменить на сайте листа (например, отдых).

import { db } from "@/lib/db";
import { applyGameState } from "@/lib/dnd/sheet-store";

/** Состояния, которые знает сайт листа; остальные (служебные эффекты боя) в лист не пишутся */
const SHEET_CONDITIONS = new Set([
  "blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated", "invisible",
  "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious", "exhaustion",
]);

type CombatantRow = {
  id?: string;
  name?: string | null;
  type?: string | null;
  characterId?: string | null;
  hpCurrent?: number | null;
  hpTemp?: number | null;
  conditions?: unknown;
  spells?: unknown;
};

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function count(value: unknown, fallback = 0): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

/** Что из состояния бойца записать в лист героя */
export function combatantToSheetPatch(
  combatant: CombatantRow,
  sheet: Record<string, any>
): Record<string, unknown> {
  const hpMax = Math.max(1, count(sheet?.hpMax, 1));
  const patch: Record<string, unknown> = {
    hpCurrent: Math.max(0, Math.min(hpMax, count(combatant.hpCurrent))),
    hpTemp: Math.max(0, count(combatant.hpTemp)),
  };

  const rawConditions = parseJson(combatant.conditions);
  const conditions = new Set<string>();
  if (Array.isArray(rawConditions)) {
    for (const item of rawConditions) {
      const type = String((item && typeof item === "object" ? (item as { type?: unknown }).type : item) ?? "")
        .trim()
        .toLowerCase();
      if (SHEET_CONDITIONS.has(type)) conditions.add(type);
    }
  }
  patch.conditions = [...conditions];

  // Ячейки: в бою — «потрачено из максимума», в листе — expendedSlots из totalSlots.
  // Число ячеек определяет лист; из боя берём только сколько потрачено.
  const spells = parseJson(combatant.spells) as { slots?: Record<string, { used?: unknown }> } | null;
  const combatSlots = spells && typeof spells === "object" ? spells.slots : null;
  const sheetSlots = sheet?.spellSlots;
  if (combatSlots && typeof combatSlots === "object" && sheetSlots && typeof sheetSlots === "object") {
    const next: Record<string, unknown> = {};
    let touched = false;
    for (const [level, slot] of Object.entries(sheetSlots as Record<string, any>)) {
      const total = Math.max(0, count(slot?.totalSlots));
      const fromCombat = combatSlots[level];
      if (fromCombat && typeof fromCombat === "object") {
        next[level] = { ...slot, totalSlots: total, expendedSlots: Math.max(0, Math.min(total, count(fromCombat.used))) };
        touched = true;
      } else {
        next[level] = slot;
      }
    }
    if (touched) patch.spellSlots = next;
  }

  return patch;
}

/**
 * Записывает итоги завершённого боя в листы героев (и в строки кампании для персонажей без листа).
 * Повторный вызов для того же боя ничего не делает. Если запись хотя бы для одного героя
 * не удалась, отметка не ставится и следующий вызов повторит попытку.
 */
export async function syncCombatToSheets(combatId: string): Promise<{ synced: number; skipped: boolean }> {
  const combat = await db.combat.findUnique({ where: { id: combatId } });
  if (!combat || combat.sheetSyncedAt) return { synced: 0, skipped: true };

  const combatants = (await db.combatant.findMany({ where: { combatId } })).filter(
    (c) => (c.type === "player" || c.type === "companion") && c.characterId
  );
  const heroes = combatants.length
    ? await db.character.findMany({ where: { id: { in: combatants.map((c) => c.characterId as string) } } })
    : [];
  const heroById = new Map(heroes.map((h) => [h.id, h as typeof h & { sheet?: Record<string, any> | null }]));

  let synced = 0;
  let failed = 0;
  for (const combatant of combatants) {
    const hero = heroById.get(combatant.characterId as string);
    if (!hero) continue;
    try {
      if (hero.sheetCharacterId) {
        if (!hero.sheet) throw new Error("лист героя недоступен");
        await applyGameState(hero.sheetCharacterId, combatantToSheetPatch(combatant, hero.sheet));
      } else {
        // Персонаж без листа (спутник, герой одиночной игры без аккаунта): его место хранения — кампания
        const hpMax = Math.max(1, count(hero.hpMax, 1));
        await db.character.update({
          where: { id: hero.id },
          data: {
            hpCurrent: Math.max(0, Math.min(hpMax, count(combatant.hpCurrent))),
            hpTemp: Math.max(0, count(combatant.hpTemp)),
          },
        });
      }
      synced += 1;
    } catch (e) {
      failed += 1;
      console.error(`[combat-sheet-sync] не удалось записать итоги боя для «${hero.name}»:`, e);
    }
  }

  if (failed === 0) {
    await db.combat.update({ where: { id: combatId }, data: { sheetSyncedAt: new Date() } });
  }
  return { synced, skipped: false };
}
