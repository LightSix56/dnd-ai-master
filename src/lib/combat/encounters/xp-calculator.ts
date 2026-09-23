import type { PartyMember, EncounterDifficulty } from "./types";

/**
 * D&D 5e XP Thresholds by Character Level (DMG p. 82)
 */
export const XP_THRESHOLDS_BY_LEVEL: Record<number, Record<EncounterDifficulty, number>> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

/**
 * Calculates party XP budget for a given difficulty threshold.
 * Clamps player levels between 1 and 20.
 */
export function calculatePartyXPBudget(party: PartyMember[], difficulty: EncounterDifficulty): number {
  if (!party || party.length === 0) return 0;

  return party.reduce((sum, member) => {
    const clampedLevel = Math.min(20, Math.max(1, Math.floor(member.level)));
    const thresholds = XP_THRESHOLDS_BY_LEVEL[clampedLevel];
    return sum + (thresholds ? thresholds[difficulty] : 0);
  }, 0);
}

const MULTIPLIER_TIERS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];

/**
 * Gets the XP multiplier based on monster count and party size according to DMG p. 82.
 * - Party size < 3: shifts 1 tier higher
 * - Party size >= 6: shifts 1 tier lower
 */
export function getMonsterCountMultiplier(monsterCount: number, partySize: number): number {
  if (monsterCount <= 0) return 1.0;

  let baseIndex: number;
  if (monsterCount === 1) {
    baseIndex = 1; // 1.0
  } else if (monsterCount === 2) {
    baseIndex = 2; // 1.5
  } else if (monsterCount <= 6) {
    baseIndex = 3; // 2.0
  } else if (monsterCount <= 10) {
    baseIndex = 4; // 2.5
  } else if (monsterCount <= 14) {
    baseIndex = 5; // 3.0
  } else {
    baseIndex = 6; // 4.0
  }

  if (partySize < 3) {
    baseIndex += 1;
  } else if (partySize >= 6) {
    baseIndex -= 1;
  }

  const clampedIndex = Math.min(MULTIPLIER_TIERS.length - 1, Math.max(0, baseIndex));
  return MULTIPLIER_TIERS[clampedIndex];
}

/**
 * Calculates the adjusted XP for an encounter considering party size and monster count.
 */
export function calculateAdjustedXP(monstersXP: number[], partySize: number): number {
  if (!monstersXP || monstersXP.length === 0) return 0;
  const rawXP = monstersXP.reduce((sum, xp) => sum + xp, 0);
  const multiplier = getMonsterCountMultiplier(monstersXP.length, partySize);
  return Math.round(rawXP * multiplier);
}

/**
 * Calculates raw awarded XP and split per player.
 */
export function calculateAwardedXP(
  monstersXP: number[],
  partySize: number
): { totalXP: number; xpPerPlayer: number } {
  if (!monstersXP || monstersXP.length === 0) {
    return { totalXP: 0, xpPerPlayer: 0 };
  }
  const totalXP = monstersXP.reduce((sum, xp) => sum + xp, 0);
  const effectivePartySize = Math.max(1, partySize);
  const xpPerPlayer = Math.floor(totalXP / effectivePartySize);
  return { totalXP, xpPerPlayer };
}
