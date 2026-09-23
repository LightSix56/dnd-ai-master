import { db } from "@/lib/db";
import { calculateAwardedXP } from "./encounters/xp-calculator";

export const CR_TO_XP_TABLE: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "0.125": 25,
  "1/4": 50,
  "0.25": 50,
  "1/2": 100,
  "0.5": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
};

export interface AwardCombatXPResult {
  combatId: string;
  totalXP: number;
  xpPerPlayer: number;
  awardedCharacters: Array<{ id: string; name: string; oldXP: number; newXP: number }>;
  gameEventId?: string;
}

/**
 * Рассчитывает боевой опыт (XP) за поверженных противников по правилам DMG p. 82
 * и начисляет его всем живым персонажам игрока и спутникам в БД.
 */
export async function awardCombatVictoryXP(combatId: string): Promise<AwardCombatXPResult> {
  const combat = await db.combat.findUnique({
    where: { id: combatId },
    include: { combatants: true },
  });

  if (!combat) {
    throw new Error(`Бой с ID '${combatId}' не найден`);
  }

  // 1. Собираем всех врагов
  const enemies = combat.combatants.filter((c) => c.type === "enemy");
  const monstersXP: number[] = enemies.map((e) => {
    const key = String(e.level ?? 1);
    return CR_TO_XP_TABLE[key] ?? Math.max(10, (e.level ?? 1) * 200);
  });

  // 2. Считаем количество игроков в бою
  const combatPlayers = combat.combatants.filter(
    (c) => c.type === "player" || c.type === "companion"
  );
  const partySize = Math.max(1, combatPlayers.length);

  const { totalXP, xpPerPlayer } = calculateAwardedXP(monstersXP, partySize);

  const awardedCharacters: Array<{ id: string; name: string; oldXP: number; newXP: number }> = [];

  if (combat.campaignId && xpPerPlayer > 0) {
    const livingCharacters = await db.character.findMany({
      where: {
        campaignId: combat.campaignId,
        isAlive: true,
        type: { in: ["player", "companion"] },
      },
    });

    for (const char of livingCharacters) {
      const oldXP = char.experiencePoints || 0;
      const updated = await db.character.update({
        where: { id: char.id },
        data: { experiencePoints: { increment: xpPerPlayer } },
      });

      awardedCharacters.push({
        id: char.id,
        name: char.name,
        oldXP,
        newXP: updated.experiencePoints,
      });
    }

    // Фиксируем системное игровое событие в логе кампании
    const gameEvent = await db.gameEvent.create({
      data: {
        campaignId: combat.campaignId,
        type: "combat",
        description: `🏁 Победа в тактическом бою «${combat.name}»! Каждый участник отряда получает ${xpPerPlayer} XP (всего ${totalXP} XP за поверженных врагов).`,
        participants: JSON.stringify(livingCharacters.map((c) => c.id)),
      },
    });

    return {
      combatId,
      totalXP,
      xpPerPlayer,
      awardedCharacters,
      gameEventId: gameEvent.id,
    };
  }

  return {
    combatId,
    totalXP,
    xpPerPlayer,
    awardedCharacters,
  };
}
