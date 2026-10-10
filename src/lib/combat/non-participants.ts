import { db } from "@/lib/db";

/**
 * Живые герои и спутники кампании, которых не было в бою. Мастеру о них напоминают после боя:
 * они не сражались, остались там, где были по сюжету, и состояние их не менялось.
 * Сбой чтения не мешает завершить бой — тогда список пуст.
 */
export async function findNonParticipants(combatId: string): Promise<string[]> {
  try {
    const combat = await db.combat.findUnique({ where: { id: combatId }, include: { combatants: true } });
    if (!combat?.campaignId) return [];
    const fighters = combat.combatants.filter((c) => c.type === "player" || c.type === "companion");
    const ids = new Set(fighters.map((c) => c.characterId).filter(Boolean) as string[]);
    const names = new Set(fighters.map((c) => c.name.trim().toLowerCase()));
    const party = await db.character.findMany({
      where: { campaignId: combat.campaignId, isAlive: true, type: { in: ["player", "companion"] } },
      select: { id: true, name: true },
    });
    return party.filter((c) => !ids.has(c.id) && !names.has(c.name.trim().toLowerCase())).map((c) => c.name);
  } catch (e) {
    console.error("[combat] не удалось определить героев вне боя:", e);
    return [];
  }
}
