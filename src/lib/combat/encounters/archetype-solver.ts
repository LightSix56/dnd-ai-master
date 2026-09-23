import type { MonsterManifestEntry } from "../monsters/types";
import type { SquadArchetype, SquadPlan, SquadMonsterSlot } from "./types";
import { calculateAdjustedXP, getMonsterCountMultiplier } from "./xp-calculator";

const SUPPORT_KEYWORDS = [
  "mage",
  "wizard",
  "sorcerer",
  "cleric",
  "priest",
  "druid",
  "acolyte",
  "cultist",
  "shaman",
  "witch",
  "bard",
  "заклинатель",
  "маг",
  "жрец",
  "шаман",
  "друид",
  "культист",
  "ведьма",
  "фанатик",
];

const RANGED_KEYWORDS = [
  "archer",
  "scout",
  "ranger",
  "hunter",
  "bow",
  "crossbow",
  "sniper",
  "лучник",
  "разведчик",
  "стрелок",
  "охотник",
];

export function isFrontlineCandidate(m: MonsterManifestEntry): boolean {
  if (m.ac >= 13 || m.hpAverage >= 20) return true;
  const isRanged = RANGED_KEYWORDS.some(
    (kw) => m.slug.includes(kw) || m.nameEn.toLowerCase().includes(kw)
  );
  const isSupport = SUPPORT_KEYWORDS.some(
    (kw) => m.slug.includes(kw) || m.nameEn.toLowerCase().includes(kw)
  );
  return !isRanged && !isSupport;
}

export function inferBacklineRole(m: MonsterManifestEntry): "ranged" | "support" {
  const text = `${m.slug} ${m.name} ${m.nameEn}`.toLowerCase();
  if (SUPPORT_KEYWORDS.some((kw) => text.includes(kw)) || m.type === "fey" || m.type === "celestial") {
    return "support";
  }
  return "ranged";
}

export function resolveArchetype(pool: MonsterManifestEntry[]): SquadArchetype {
  if (pool.length === 0) return "tactical_squad";

  // If beasts dominant (>= 50% of pool) -> 'pack'
  const beastCount = pool.filter((m) => m.type === "beast").length;
  if (beastCount / pool.length >= 0.5) {
    return "pack";
  }

  // If mix of high and low CR -> 'boss_minions'
  const crs = pool.map((m) => m.challengeRating);
  const minCR = Math.min(...crs);
  const maxCR = Math.max(...crs);
  const xps = pool.map((m) => m.xp);
  const minXP = Math.min(...xps);
  const maxXP = Math.max(...xps);

  if (maxCR >= 2 && minCR <= 0.5 && maxXP / minXP >= 4) {
    return "boss_minions";
  }

  return "tactical_squad";
}

function solveSoloBoss(
  pool: MonsterManifestEntry[],
  targetAdjustedXP: number,
  partySize: number
): SquadPlan | null {
  const mult = getMonsterCountMultiplier(1, partySize);
  const targetRawXP = targetAdjustedXP / mult;
  const minRaw = targetRawXP * 0.65;
  const maxRaw = targetRawXP * 1.35;

  const inTolerance = pool.filter((m) => m.xp >= minRaw && m.xp <= maxRaw);
  if (inTolerance.length === 0) {
    return null;
  }

  const namedCandidates = inTolerance.filter((m) => m.isNamed);
  const searchList = namedCandidates.length > 0 ? namedCandidates : inTolerance;

  searchList.sort((a, b) => {
    const distA = Math.abs(a.xp - targetRawXP);
    const distB = Math.abs(b.xp - targetRawXP);
    if (distA !== distB) return distA - distB;
    if (a.isNamed && !b.isNamed) return -1;
    if (!a.isNamed && b.isNamed) return 1;
    return b.hpAverage - a.hpAverage;
  });

  const best = searchList[0];
  const adjustedXP = calculateAdjustedXP([best.xp], partySize);

  return {
    archetype: "solo_boss",
    slots: [{ monsterSlug: best.slug, role: "boss", count: 1 }],
    targetAdjustedXP,
    estimatedRawXP: best.xp,
    estimatedAdjustedXP: adjustedXP,
  };
}

interface BossMinionsCandidate {
  boss: MonsterManifestEntry;
  minion: MonsterManifestEntry;
  minionCount: number;
  rawXP: number;
  adjustedXP: number;
  score: number;
}

function solveBossMinions(
  pool: MonsterManifestEntry[],
  targetAdjustedXP: number,
  partySize: number
): SquadPlan | null {
  const candidates: BossMinionsCandidate[] = [];

  for (const boss of pool) {
    for (const minion of pool) {
      if (boss.slug === minion.slug) continue;
      if (boss.xp <= minion.xp) continue;
      if (boss.challengeRating < minion.challengeRating) continue;

      for (let count = 2; count <= 5; count++) {
        const allXPs = [boss.xp, ...Array(count).fill(minion.xp)];
        const rawXP = boss.xp + count * minion.xp;
        const adjustedXP = calculateAdjustedXP(allXPs, partySize);

        // Check +-40% tolerance
        if (adjustedXP < targetAdjustedXP * 0.60 || adjustedXP > targetAdjustedXP * 1.40) {
          continue;
        }

        const bossRatio = boss.xp / rawXP;
        // Boss should consume roughly 45% - 85% of raw budget
        if (bossRatio < 0.45 || bossRatio > 0.85) {
          continue;
        }

        const xpDiffRel = Math.abs(adjustedXP - targetAdjustedXP) / targetAdjustedXP;
        const ratioDiff = Math.abs(bossRatio - 0.625);
        const sameTypeBonus = boss.type === minion.type ? 0 : 0.25;
        const bossKeywordBonus =
          boss.isNamed ||
          boss.slug.includes("boss") ||
          boss.nameEn.toLowerCase().includes("boss") ||
          boss.name.toLowerCase().includes("главарь")
            ? -0.15
            : 0;

        const poolIndex = Math.min(pool.indexOf(boss), pool.indexOf(minion));
        const poolPriority = poolIndex * 0.05;
        const score = xpDiffRel * 2.0 + ratioDiff + sameTypeBonus + bossKeywordBonus + poolPriority;

        candidates.push({
          boss,
          minion,
          minionCount: count,
          rawXP,
          adjustedXP,
          score,
        });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];

  return {
    archetype: "boss_minions",
    slots: [
      { monsterSlug: best.boss.slug, role: "boss", count: 1 },
      { monsterSlug: best.minion.slug, role: "minion", count: best.minionCount },
    ],
    targetAdjustedXP,
    estimatedRawXP: best.rawXP,
    estimatedAdjustedXP: best.adjustedXP,
  };
}

interface TacticalCandidate {
  frontline: MonsterManifestEntry;
  frontlineCount: number;
  backline: MonsterManifestEntry;
  backlineCount: number;
  backlineRole: "ranged" | "support";
  rawXP: number;
  adjustedXP: number;
  score: number;
}

function solveTacticalSquad(
  pool: MonsterManifestEntry[],
  targetAdjustedXP: number,
  partySize: number
): SquadPlan | null {
  const frontlinePool = pool.filter(isFrontlineCandidate);
  if (frontlinePool.length === 0) return null;

  const dedicatedBackline = pool.filter(
    (m) =>
      m.ac < 14 ||
      inferBacklineRole(m) === "support" ||
      RANGED_KEYWORDS.some((kw) => m.slug.includes(kw) || m.nameEn.toLowerCase().includes(kw))
  );
  const backlinePool = dedicatedBackline.length > 0 ? dedicatedBackline : pool;

  const candidates: TacticalCandidate[] = [];

  for (const fMon of frontlinePool) {
    for (const bMon of backlinePool) {
      if (fMon.slug === bMon.slug && pool.length > 1) continue;

      for (let fCount = 1; fCount <= 2; fCount++) {
        for (let bCount = 2; bCount <= 3; bCount++) {
          if (fCount + bCount > 5) continue;

          const allXPs = [
            ...Array(fCount).fill(fMon.xp),
            ...Array(bCount).fill(bMon.xp),
          ];
          const rawXP = fCount * fMon.xp + bCount * bMon.xp;
          const adjustedXP = calculateAdjustedXP(allXPs, partySize);

          if (adjustedXP < targetAdjustedXP * 0.65 || adjustedXP > targetAdjustedXP * 1.35) {
            continue;
          }

          const fRatio = (fCount * fMon.xp) / rawXP;
          if (fRatio < 0.30 || fRatio > 0.60) continue;

          const xpDiffRel = Math.abs(adjustedXP - targetAdjustedXP) / targetAdjustedXP;
          const fRatioDiff = Math.abs(fRatio - 0.45);
          const sameTypeBonus = fMon.type === bMon.type ? 0 : 0.1;
          const backlineBonus =
            bMon.ac < 14 || inferBacklineRole(bMon) === "support" ? -0.1 : 0;

          const poolIndex = Math.min(pool.indexOf(fMon), pool.indexOf(bMon));
          const poolPriority = poolIndex * 0.05;
          const score = xpDiffRel * 2.0 + fRatioDiff + sameTypeBonus + backlineBonus + poolPriority;

          candidates.push({
            frontline: fMon,
            frontlineCount: fCount,
            backline: bMon,
            backlineCount: bCount,
            backlineRole: inferBacklineRole(bMon),
            rawXP,
            adjustedXP,
            score,
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];

  return {
    archetype: "tactical_squad",
    slots: [
      { monsterSlug: best.frontline.slug, role: "frontline", count: best.frontlineCount },
      { monsterSlug: best.backline.slug, role: best.backlineRole, count: best.backlineCount },
    ],
    targetAdjustedXP,
    estimatedRawXP: best.rawXP,
    estimatedAdjustedXP: best.adjustedXP,
  };
}

interface PackCandidate {
  monster: MonsterManifestEntry;
  count: number;
  role: "minion" | "frontline";
  rawXP: number;
  adjustedXP: number;
  score: number;
}

function solvePack(
  pool: MonsterManifestEntry[],
  targetAdjustedXP: number,
  partySize: number
): SquadPlan | null {
  const candidates: PackCandidate[] = [];

  for (let count = 3; count <= 6; count++) {
    const mult = getMonsterCountMultiplier(count, partySize);
    const targetPerMonster = targetAdjustedXP / (count * mult);

    for (const m of pool) {
      const allXPs = Array(count).fill(m.xp);
      const rawXP = count * m.xp;
      const adjustedXP = calculateAdjustedXP(allXPs, partySize);

      if (adjustedXP < targetAdjustedXP * 0.65 || adjustedXP > targetAdjustedXP * 1.35) {
        continue;
      }

      const xpDiffRel = Math.abs(adjustedXP - targetAdjustedXP) / targetAdjustedXP;
      const beastBonus = m.type === "beast" ? -0.1 : 0;
      const score = xpDiffRel + beastBonus;

      const role: "minion" | "frontline" =
        m.ac >= 14 && m.hpAverage >= 35 ? "frontline" : "minion";

      candidates.push({
        monster: m,
        count,
        role,
        rawXP,
        adjustedXP,
        score,
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];

  return {
    archetype: "pack",
    slots: [{ monsterSlug: best.monster.slug, role: best.role, count: best.count }],
    targetAdjustedXP,
    estimatedRawXP: best.rawXP,
    estimatedAdjustedXP: best.adjustedXP,
  };
}

function solveGreedyFallback(
  pool: MonsterManifestEntry[],
  targetAdjustedXP: number,
  archetype: SquadArchetype,
  partySize: number
): SquadPlan {
  if (pool.length === 0) {
    return {
      archetype,
      slots: [],
      targetAdjustedXP,
      estimatedRawXP: 0,
      estimatedAdjustedXP: 0,
    };
  }

  const sorted = [...pool].sort(
    (a, b) => b.challengeRating - a.challengeRating || b.xp - a.xp
  );

  let first = sorted.find((m) => m.xp <= targetAdjustedXP);
  if (!first) {
    first = sorted[sorted.length - 1];
  }

  const chosen: MonsterManifestEntry[] = [first];

  while (chosen.length < 8) {
    const currentAdj = calculateAdjustedXP(
      chosen.map((m) => m.xp),
      partySize
    );
    if (currentAdj >= targetAdjustedXP * 0.9) {
      break;
    }
    const remainingAdj = targetAdjustedXP - currentAdj;
    const next =
      sorted.find((m) => m.xp <= remainingAdj) || sorted[sorted.length - 1];
    chosen.push(next);
  }

  const slotGroups = new Map<string, SquadMonsterSlot>();

  chosen.forEach((m, idx) => {
    let role: SquadMonsterSlot["role"];
    if (archetype === "solo_boss") {
      role = idx === 0 ? "boss" : "minion";
    } else if (archetype === "boss_minions") {
      role = idx === 0 ? "boss" : "minion";
    } else if (archetype === "tactical_squad") {
      role = isFrontlineCandidate(m) ? "frontline" : inferBacklineRole(m);
    } else {
      role = isFrontlineCandidate(m) ? "frontline" : "minion";
    }

    const key = `${m.slug}__${role}`;
    const existing = slotGroups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      slotGroups.set(key, { monsterSlug: m.slug, role, count: 1 });
    }
  });

  const slots = Array.from(slotGroups.values());
  const allXPs = chosen.map((m) => m.xp);
  const estimatedRawXP = allXPs.reduce((a, b) => a + b, 0);
  const estimatedAdjustedXP = calculateAdjustedXP(allXPs, partySize);

  return {
    archetype,
    slots,
    targetAdjustedXP,
    estimatedRawXP,
    estimatedAdjustedXP,
  };
}

/**
 * Solves a tactical squad plan based on monster pool, target XP, squad archetype, and party size.
 */
export function solveSquad(
  pool: MonsterManifestEntry[],
  targetAdjustedXP: number,
  archetype: SquadArchetype,
  partySize: number,
  isActClimax?: boolean
): SquadPlan {
  if (!pool || pool.length === 0 || targetAdjustedXP <= 0) {
    const resolved = archetype === "any" ? "tactical_squad" : archetype;
    return {
      archetype: resolved,
      slots: [],
      targetAdjustedXP: Math.max(0, targetAdjustedXP),
      estimatedRawXP: 0,
      estimatedAdjustedXP: 0,
    };
  }

  // 1. Climax override
  if (isActClimax) {
    const soloPlan = solveSoloBoss(pool, targetAdjustedXP, partySize);
    if (soloPlan) {
      return soloPlan;
    }
    const bossMinionsPlan = solveBossMinions(pool, targetAdjustedXP, partySize);
    if (bossMinionsPlan) {
      return bossMinionsPlan;
    }
    return solveGreedyFallback(pool, targetAdjustedXP, "boss_minions", partySize);
  }

  // 2. Resolve 'any' archetype
  let targetArchetype: SquadArchetype = archetype;
  if (archetype === "any") {
    targetArchetype = resolveArchetype(pool);
  }

  // 3. Archetype solver helper
  const trySolve = (arch: SquadArchetype): SquadPlan | null => {
    switch (arch) {
      case "solo_boss":
        return solveSoloBoss(pool, targetAdjustedXP, partySize);
      case "boss_minions":
        return solveBossMinions(pool, targetAdjustedXP, partySize);
      case "tactical_squad":
        return solveTacticalSquad(pool, targetAdjustedXP, partySize);
      case "pack":
        return solvePack(pool, targetAdjustedXP, partySize);
      default:
        return null;
    }
  };

  let plan: SquadPlan | null = trySolve(targetArchetype);

  // If archetype was 'any', ensure preferred plan uses top-priority candidates if available
  if (archetype === "any") {
    const usesTopCandidates =
      plan &&
      plan.slots.some((s) => {
        const idx = pool.findIndex((m) => m.slug === s.monsterSlug);
        return idx >= 0 && idx < 4;
      });

    if (!plan || !usesTopCandidates) {
      const alternates: SquadArchetype[] = (
        ["tactical_squad", "boss_minions", "pack", "solo_boss"] as SquadArchetype[]
      ).filter((a) => a !== targetArchetype);

      for (const alt of alternates) {
        const altPlan = trySolve(alt);
        if (altPlan && altPlan.slots.length > 0) {
          const altUsesTop = altPlan.slots.some((s) => {
            const idx = pool.findIndex((m) => m.slug === s.monsterSlug);
            return idx >= 0 && idx < 4;
          });
          if (altUsesTop) {
            plan = altPlan;
            break;
          }
        }
      }
    }
  }

  // 4. Fallback guarantee
  if (!plan) {
    plan = solveGreedyFallback(pool, targetAdjustedXP, targetArchetype, partySize);
  }

  return plan;
}
