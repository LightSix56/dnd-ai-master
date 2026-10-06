// Спутники, которых мастер ввёл в том же ответе, что и бой: фоновый помощник заносит
// их в кампанию только после ответа, и без этого шага они не попали бы ни на карту,
// ни в расчёт баланса.

import { db } from "@/lib/db";
import { proficiencyBonus } from "@/lib/dnd/dice";

export interface CompanionRequest {
  name: string;
  class?: string;
  race?: string;
}

/** Заводит недостающих спутников и делает спутниками уже известных NPC с теми же именами */
export async function ensureCompanions(campaignId: string, companions: CompanionRequest[] | undefined): Promise<void> {
  const wanted = (companions ?? []).filter((c) => c.name && c.name.trim());
  if (wanted.length === 0) return;

  const existing = await db.character.findMany({
    where: { campaignId },
    select: { id: true, name: true, type: true, level: true, isAlive: true },
  });
  // Спутник растёт вместе с партией: новый получает уровень сильнейшего героя
  const heroLevel = Math.max(1, ...existing.filter((c) => c.type === "player").map((c) => c.level || 1));

  for (const companion of wanted) {
    const name = companion.name.trim();
    const known = existing.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (known) {
      // Игрока и врага не трогаем; мёртвый спутник в бой не возвращается
      if (known.type === "npc") await db.character.update({ where: { id: known.id }, data: { type: "companion" } });
      continue;
    }
    const hp = 10 + (heroLevel - 1) * 6;
    const created = await db.character.create({
      data: {
        campaignId,
        name,
        type: "companion",
        race: companion.race || null,
        class: companion.class || null,
        level: heroLevel,
        hpCurrent: hp,
        hpMax: hp,
        ac: 14,
        speed: 30,
        profBonus: proficiencyBonus(heroLevel),
        inScene: true,
      },
    });
    existing.push({ id: created.id, name: created.name, type: "companion", level: heroLevel, isAlive: true });
  }
}
