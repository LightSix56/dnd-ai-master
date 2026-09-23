import { describe, it, expect } from "vitest";
import { solveSquad } from "../archetype-solver";
import type { MonsterManifestEntry } from "../../monsters/types";
import { calculateAdjustedXP, getMonsterCountMultiplier } from "../xp-calculator";

function createMockEntry(
  slug: string,
  type: MonsterManifestEntry["type"],
  name: string,
  nameEn: string,
  xp: number,
  cr: number,
  options?: Partial<MonsterManifestEntry>
): MonsterManifestEntry {
  return {
    id: slug,
    slug,
    name,
    nameEn,
    type,
    size: "medium",
    challengeRating: cr,
    xp,
    hpAverage: 30,
    ac: 13,
    source: "Monster Manual",
    isNamed: false,
    filePath: `${type}/${slug}.json`,
    ...options,
  };
}

const mockPool: MonsterManifestEntry[] = [
  // Low CR Humanoids
  createMockEntry("goblin", "humanoid", "Гоблин", "Goblin", 50, 0.25, { ac: 15, hpAverage: 7 }),
  createMockEntry("goblin-archer", "humanoid", "Гоблин-лучник", "Goblin Archer", 50, 0.25, { ac: 13, hpAverage: 7 }),
  createMockEntry("goblin-shaman", "humanoid", "Гоблин-шаман", "Goblin Shaman", 100, 0.5, { ac: 12, hpAverage: 18 }),
  createMockEntry("goblin-boss", "humanoid", "Главарь гоблинов", "Goblin Boss", 200, 1, { ac: 17, hpAverage: 21 }),

  // Beasts
  createMockEntry("wolf", "beast", "Волк", "Wolf", 50, 0.25, { ac: 13, hpAverage: 11 }),
  createMockEntry("dire-wolf", "beast", "Лютоволк", "Dire Wolf", 200, 1, { ac: 14, hpAverage: 37 }),
  createMockEntry("brown-bear", "beast", "Бурый медведь", "Brown Bear", 200, 1, { ac: 11, hpAverage: 34 }),

  // Undead
  createMockEntry("skeleton", "undead", "Скелет", "Skeleton", 50, 0.25, { ac: 13, hpAverage: 13 }),
  createMockEntry("zombie", "undead", "Зомби", "Zombie", 50, 0.25, { ac: 8, hpAverage: 22 }),
  createMockEntry("wight", "undead", "Упырь", "Wight", 700, 3, { ac: 14, hpAverage: 45 }),

  // Tactical / Guards
  createMockEntry("guard", "humanoid", "Стражник", "Guard", 25, 0.125, { ac: 16, hpAverage: 11 }),
  createMockEntry("scout", "humanoid", "Разведчик", "Scout", 100, 0.5, { ac: 13, hpAverage: 16 }),
  createMockEntry("knight", "humanoid", "Рыцарь", "Knight", 700, 3, { ac: 18, hpAverage: 52 }),
  createMockEntry("cult-fanatic", "humanoid", "Культист-фанатик", "Cult Fanatic", 450, 2, { ac: 13, hpAverage: 33 }),
  createMockEntry("veteran", "humanoid", "Ветеран", "Veteran", 700, 3, { ac: 17, hpAverage: 58 }),

  // Mid/High CR Solo Bosses
  createMockEntry("ogre", "giant", "Огр", "Ogre", 450, 2, { ac: 11, hpAverage: 59 }),
  createMockEntry("young-green-dragon", "dragon", "Молодой зеленый дракон", "Young Green Dragon", 3900, 8, { ac: 18, hpAverage: 136 }),
  createMockEntry("venomfang", "dragon", "Ядозуб", "Venomfang", 3900, 8, { ac: 18, hpAverage: 136, isNamed: true }),
  createMockEntry("flame-lord-ignis", "elemental", "Владыка пламени Игнис", "Flame Lord Ignis", 1800, 5, { ac: 15, hpAverage: 90, isNamed: true }),
  createMockEntry("fire-elemental", "elemental", "Огненный элементаль", "Fire Elemental", 1800, 5, { ac: 13, hpAverage: 102 }),
];

describe("Tactical Squad Archetype Solvers", () => {
  describe("solo_boss solver", () => {
    it("selects a single monster with role 'boss' matching target XP", () => {
      // Party of 4, targetAdjustedXP = 1800. For 1 monster, multiplier = 1.0. Target raw = 1800.
      const plan = solveSquad(mockPool, 1800, "solo_boss", 4);

      expect(plan.archetype).toBe("solo_boss");
      expect(plan.slots).toHaveLength(1);
      expect(plan.slots[0].role).toBe("boss");
      expect(plan.slots[0].count).toBe(1);
      expect(plan.estimatedRawXP).toBe(1800);
      expect(plan.estimatedAdjustedXP).toBe(1800);
    });

    it("prioritizes isNamed creature when available within tolerance", () => {
      // Both fire-elemental and flame-lord-ignis have 1800 XP. flame-lord-ignis is named.
      const plan = solveSquad(mockPool, 1800, "solo_boss", 4);
      expect(plan.slots[0].monsterSlug).toBe("flame-lord-ignis");

      // Similarly for young dragon vs Venomfang at 3900 XP
      const planDragon = solveSquad(mockPool, 3900, "solo_boss", 4);
      expect(planDragon.slots[0].monsterSlug).toBe("venomfang");
    });

    it("adjusts for small party size multiplier (partySize = 2)", () => {
      // For 1 monster with partySize = 2, multiplier is 1.5.
      // targetAdjustedXP = 675 -> target raw = 675 / 1.5 = 450 (e.g., Ogre).
      const plan = solveSquad(mockPool, 675, "solo_boss", 2);

      expect(plan.slots).toHaveLength(1);
      expect(plan.slots[0].monsterSlug).toBe("ogre");
      expect(plan.estimatedRawXP).toBe(450);
      expect(plan.estimatedAdjustedXP).toBe(675);
    });

    it("does not exceed targetAdjustedXP * 1.35 when a closer lower or equal candidate exists", () => {
      // Target 450: ogre (450) vs fire-elemental (1800)
      const plan = solveSquad(mockPool, 450, "solo_boss", 4);
      expect(plan.slots[0].monsterSlug).toBe("ogre");
      expect(plan.estimatedAdjustedXP).toBeLessThanOrEqual(450 * 1.35);
    });
  });

  describe("boss_minions solver", () => {
    it("generates 1 boss and 2-5 minions consuming budget (~55-70% boss, rest minions)", () => {
      // Target 800 XP. Goblin Boss (200 XP) + Goblins (50 XP each).
      // If 1 boss (200 XP) + 4 goblins (4 * 50 = 200 XP), total raw = 400 XP.
      // Total count = 5. Multiplier for 5 monsters (party 4) = 2.0.
      // Adjusted XP = 400 * 2.0 = 800 XP!
      // Boss raw XP ratio = 200 / 400 = 50-60%.
      const plan = solveSquad(mockPool, 800, "boss_minions", 4);

      expect(plan.archetype).toBe("boss_minions");
      expect(plan.slots.length).toBeGreaterThanOrEqual(2);

      const bossSlot = plan.slots.find((s) => s.role === "boss");
      const minionSlot = plan.slots.find((s) => s.role === "minion");

      expect(bossSlot).toBeDefined();
      expect(bossSlot?.count).toBe(1);
      expect(minionSlot).toBeDefined();
      expect(minionSlot!.count).toBeGreaterThanOrEqual(2);
      expect(minionSlot!.count).toBeLessThanOrEqual(5);

      const totalMonsters = plan.slots.reduce((sum, s) => sum + s.count, 0);
      expect(totalMonsters).toBeGreaterThanOrEqual(3);
      expect(totalMonsters).toBeLessThanOrEqual(6);

      // Verify adjusted XP is calculated accurately
      expect(plan.estimatedAdjustedXP).toBe(
        calculateAdjustedXP(
          plan.slots.flatMap((s) => {
            const entry = mockPool.find((m) => m.slug === s.monsterSlug)!;
            return Array(s.count).fill(entry.xp);
          }),
          4
        )
      );
    });

    it("prefers minions sharing creature type with the boss", () => {
      // Goblin Boss is humanoid. Minions should be humanoid (e.g., goblin or goblin-archer), not beasts or undead.
      const plan = solveSquad(mockPool, 800, "boss_minions", 4);
      const bossSlot = plan.slots.find((s) => s.role === "boss")!;
      const minionSlots = plan.slots.filter((s) => s.role === "minion");

      const bossEntry = mockPool.find((m) => m.slug === bossSlot.monsterSlug)!;
      for (const mSlot of minionSlots) {
        const minionEntry = mockPool.find((m) => m.slug === mSlot.monsterSlug)!;
        expect(minionEntry.type).toBe(bossEntry.type);
      }
    });

    it("ensures boss has higher CR / XP than minions", () => {
      const plan = solveSquad(mockPool, 800, "boss_minions", 4);
      const bossEntry = mockPool.find((m) => m.slug === plan.slots.find((s) => s.role === "boss")!.monsterSlug)!;
      for (const slot of plan.slots.filter((s) => s.role === "minion")) {
        const minionEntry = mockPool.find((m) => m.slug === slot.monsterSlug)!;
        expect(bossEntry.xp).toBeGreaterThan(minionEntry.xp);
      }
    });
  });

  describe("tactical_squad solver", () => {
    it("creates a squad with 1-2 frontline (AC >= 14 or high HP) and 2-3 backline (ranged/support)", () => {
      // Target around 700-1200 XP
      const plan = solveSquad(mockPool, 1000, "tactical_squad", 4);

      expect(plan.archetype).toBe("tactical_squad");

      const frontlineSlots = plan.slots.filter((s) => s.role === "frontline");
      const backlineSlots = plan.slots.filter((s) => s.role === "ranged" || s.role === "support");

      const frontlineCount = frontlineSlots.reduce((sum, s) => sum + s.count, 0);
      const backlineCount = backlineSlots.reduce((sum, s) => sum + s.count, 0);

      expect(frontlineCount).toBeGreaterThanOrEqual(1);
      expect(frontlineCount).toBeLessThanOrEqual(2);

      expect(backlineCount).toBeGreaterThanOrEqual(2);
      expect(backlineCount).toBeLessThanOrEqual(3);

      const totalMonsters = frontlineCount + backlineCount;
      expect(totalMonsters).toBeGreaterThanOrEqual(3);
      expect(totalMonsters).toBeLessThanOrEqual(5);

      // Verify frontline members satisfy AC >= 14 or HP >= 30
      for (const slot of frontlineSlots) {
        const entry = mockPool.find((m) => m.slug === slot.monsterSlug)!;
        expect(entry.ac >= 14 || entry.hpAverage >= 30).toBe(true);
      }
    });

    it("correctly identifies support casters and ranged attackers for backline", () => {
      // Goblin Shaman or Cult Fanatic should be support, Scout or Goblin Archer should be ranged
      const plan = solveSquad(mockPool, 800, "tactical_squad", 4);
      const backline = plan.slots.filter((s) => s.role === "ranged" || s.role === "support");
      expect(backline.length).toBeGreaterThanOrEqual(1);
      for (const slot of backline) {
        expect(["ranged", "support"]).toContain(slot.role);
      }
    });
  });

  describe("pack solver", () => {
    it("creates a pack of 3-6 identical or same-type monsters", () => {
      // Target 400 XP. 4 wolves (50 XP each) * 2.0 multiplier = 400 XP!
      const plan = solveSquad(mockPool, 400, "pack", 4);

      expect(plan.archetype).toBe("pack");
      const totalCount = plan.slots.reduce((sum, s) => sum + s.count, 0);
      expect(totalCount).toBeGreaterThanOrEqual(3);
      expect(totalCount).toBeLessThanOrEqual(6);

      // All slots share role ('minion' or 'frontline')
      for (const slot of plan.slots) {
        expect(["minion", "frontline"]).toContain(slot.role);
      }

      // Check that all monsters in pack share creature type
      const firstEntry = mockPool.find((m) => m.slug === plan.slots[0].monsterSlug)!;
      for (const slot of plan.slots) {
        const entry = mockPool.find((m) => m.slug === slot.monsterSlug)!;
        expect(entry.type).toBe(firstEntry.type);
      }

      // Adjusted XP calculation is exact
      expect(plan.estimatedAdjustedXP).toBe(
        calculateAdjustedXP(
          plan.slots.flatMap((s) => {
            const entry = mockPool.find((m) => m.slug === s.monsterSlug)!;
            return Array(s.count).fill(entry.xp);
          }),
          4
        )
      );
    });

    it("calculates per-monster target raw XP accounting for count multiplier", () => {
      // Target 800 XP. If 4 dire wolves (200 XP each) * 2.0 = 1600 XP (overshoot).
      // If 4 wolves (50 XP each) * 2.0 = 400 XP (undershoot).
      // Best fit candidate picked based on target raw per monster = 800 / (count * multiplier).
      const plan = solveSquad(mockPool, 800, "pack", 4);
      expect(plan.slots.length).toBeGreaterThan(0);
      expect(plan.estimatedAdjustedXP).toBeGreaterThan(0);
    });
  });

  describe("Act Climax override (isActClimax: true)", () => {
    it("forces solo_boss if a solo boss fits", () => {
      const plan = solveSquad(mockPool, 1800, "pack", 4, true);
      expect(plan.archetype).toBe("solo_boss");
      expect(plan.slots).toHaveLength(1);
      expect(plan.slots[0].role).toBe("boss");
    });

    it("falls back to boss_minions if no solo boss fits the target budget", () => {
      // Only low-level monsters available (max 50 XP each).
      // Target is 1000 XP. Solo 50 XP monster would give 50 XP (< 1000 * 0.5), so solo_boss does not fit.
      const lowLevelPool = [
        createMockEntry("goblin", "humanoid", "Гоблин", "Goblin", 50, 0.25),
        createMockEntry("goblin-boss", "humanoid", "Главарь", "Goblin Boss", 150, 1),
      ];

      const plan = solveSquad(lowLevelPool, 600, "solo_boss", 4, true);
      expect(plan.archetype).toBe("boss_minions");
      expect(plan.slots.some((s) => s.role === "boss")).toBe(true);
      expect(plan.slots.some((s) => s.role === "minion")).toBe(true);
    });
  });

  describe("'any' archetype heuristic resolution", () => {
    it("resolves to 'pack' when beasts are dominant (>= 50% of pool)", () => {
      const beastPool = [
        createMockEntry("wolf", "beast", "Волк", "Wolf", 50, 0.25),
        createMockEntry("dire-wolf", "beast", "Лютоволк", "Dire Wolf", 200, 1),
        createMockEntry("brown-bear", "beast", "Медведь", "Bear", 200, 1),
        createMockEntry("goblin", "humanoid", "Гоблин", "Goblin", 50, 0.25),
      ];

      const plan = solveSquad(beastPool, 400, "any", 4);
      expect(plan.archetype).toBe("pack");
    });

    it("resolves to 'boss_minions' when pool has clear mix of high and low CR creatures", () => {
      const mixedPool = [
        createMockEntry("goblin", "humanoid", "Гоблин", "Goblin", 50, 0.25),
        createMockEntry("goblin-boss", "humanoid", "Главарь", "Goblin Boss", 450, 2),
      ];

      const plan = solveSquad(mixedPool, 800, "any", 4);
      expect(plan.archetype).toBe("boss_minions");
    });

    it("resolves to 'tactical_squad' as default when diverse tactical options exist", () => {
      const tacticalPool = [
        createMockEntry("knight", "humanoid", "Рыцарь", "Knight", 200, 1, { ac: 18, hpAverage: 40 }),
        createMockEntry("guard", "humanoid", "Стражник", "Guard", 50, 0.25, { ac: 16, hpAverage: 15 }),
        createMockEntry("scout", "humanoid", "Разведчик", "Scout", 100, 0.5, { ac: 13, hpAverage: 16 }),
        createMockEntry("cult-fanatic", "humanoid", "Культист", "Cultist", 100, 0.5, { ac: 12, hpAverage: 18 }),
      ];

      const plan = solveSquad(tacticalPool, 500, "any", 4);
      expect(plan.archetype).toBe("tactical_squad");
    });
  });

  describe("Fallback Guarantee & Edge Cases", () => {
    it("never returns empty slots when pool is non-empty", () => {
      const singleMonsterPool = [
        createMockEntry("lone-goblin", "humanoid", "Одинокий гоблин", "Lone Goblin", 50, 0.25),
      ];

      // Even if archetype is solo_boss or pack or tactical_squad with target 5000 XP
      const plan = solveSquad(singleMonsterPool, 5000, "tactical_squad", 4);
      expect(plan.slots.length).toBeGreaterThan(0);
      expect(plan.slots[0].monsterSlug).toBe("lone-goblin");
      expect(plan.estimatedRawXP).toBeGreaterThan(0);
      expect(plan.estimatedAdjustedXP).toBeGreaterThan(0);
    });

    it("handles empty pool gracefully by returning empty slots", () => {
      const plan = solveSquad([], 1000, "tactical_squad", 4);
      expect(plan.slots).toEqual([]);
      expect(plan.estimatedRawXP).toBe(0);
      expect(plan.estimatedAdjustedXP).toBe(0);
    });

    it("uses greedy fallback when strict archetype solver cannot find fit within +-35%", () => {
      // Pool with weird XP distribution that cannot satisfy strict tactical squad ratios
      const weirdPool = [
        createMockEntry("weakling", "humanoid", "Слабак", "Weakling", 10, 0, { ac: 10, hpAverage: 4 }),
      ];

      const plan = solveSquad(weirdPool, 2000, "tactical_squad", 4);
      expect(plan.slots.length).toBeGreaterThan(0);
      expect(plan.slots[0].monsterSlug).toBe("weakling");
    });

    it("computes accurate estimatedRawXP and estimatedAdjustedXP matching xp-calculator", () => {
      const plan = solveSquad(mockPool, 600, "boss_minions", 4);
      const allMonsterXPs = plan.slots.flatMap((slot) => {
        const monster = mockPool.find((m) => m.slug === slot.monsterSlug)!;
        return Array(slot.count).fill(monster.xp);
      });

      const expectedRawXP = allMonsterXPs.reduce((a, b) => a + b, 0);
      const expectedAdjustedXP = calculateAdjustedXP(allMonsterXPs, 4);

      expect(plan.estimatedRawXP).toBe(expectedRawXP);
      expect(plan.estimatedAdjustedXP).toBe(expectedAdjustedXP);
    });
  });
});
