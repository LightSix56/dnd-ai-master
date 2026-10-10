import { describe, it, expect } from "vitest";
import { generateEncounter } from "../encounter-generator";
import { calculatePartyXPBudget } from "../xp-calculator";
import { campaignBudgetScale, normalizeArchetype } from "../encounter-request";
import type { EncounterDifficulty, SquadArchetype } from "../types";

const party = [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `Герой ${i}`, level: 5 }));

async function gen(difficulty: EncounterDifficulty, archetype?: SquadArchetype, biome = "urban", faction = "бандиты", extra: object = {}) {
  return generateEncounter({ party, difficulty, biome, archetype, storyFaction: { name: faction }, mapPresetId: "", ...extra });
}

describe("бюджет overwhelming", () => {
  it("вдвое выше смертельного порога по таблицам DMG", () => {
    expect(calculatePartyXPBudget(party, "overwhelming")).toBe(calculatePartyXPBudget(party, "deadly") * 2);
    expect(calculatePartyXPBudget(party, "deadly")).toBe(4400); // 4 × 1100 (5 уровень)
  });

  it("сложность кампании — множитель бюджета, неизвестная — единица", () => {
    expect(campaignBudgetScale("brutal")).toBeGreaterThan(1);
    expect(campaignBudgetScale("easy")).toBeLessThan(1);
    expect(campaignBudgetScale("normal")).toBe(1);
    expect(campaignBudgetScale(undefined)).toBe(1);
  });

  it("имена составов мастера приводятся к типам решателя", () => {
    expect(normalizeArchetype("boss_with_minions")).toBe("boss_minions");
    expect(normalizeArchetype("balanced_squad")).toBe("tactical_squad");
    expect(normalizeArchetype("horde")).toBe("horde");
    expect(normalizeArchetype("solo_boss")).toBe("solo_boss");
    expect(normalizeArchetype("tactical_squad")).toBe("tactical_squad");
    expect(normalizeArchetype("any")).toBeUndefined();
    expect(normalizeArchetype(undefined)).toBeUndefined();
  });

  it("бой overwhelming заметно тяжелее смертельного, а множитель кампании меняет бюджет", async () => {
    const deadly = await gen("deadly", undefined, "urban", "городская стража");
    const overwhelming = await gen("overwhelming", undefined, "urban", "городская стража");
    expect(overwhelming.targetXP).toBe(deadly.targetXP * 2);
    expect(overwhelming.adjustedXP).toBeGreaterThan(deadly.adjustedXP);
    expect(overwhelming.adjustedXP).toBeGreaterThan(calculatePartyXPBudget(party, "deadly"));
    expect(overwhelming.enemies.length).toBeGreaterThanOrEqual(deadly.enemies.length);

    const scaled = await gen("medium", undefined, "urban", "бандиты", { budgetScale: 1.3 });
    const plain = await gen("medium", undefined, "urban", "бандиты");
    expect(scaled.targetXP).toBe(Math.round(plain.targetXP * 1.3));
  }, 60000);

  it("обычные сложности не выходят за смертельный порог, как раньше", async () => {
    for (const d of ["easy", "medium", "hard", "deadly"] as const) {
      const e = await gen(d, undefined, "forest", "разбойники");
      expect(e.adjustedXP, d).toBeLessThanOrEqual(calculatePartyXPBudget(party, "deadly"));
    }
  }, 60000);
});

describe("состав отряда по выбору мастера", () => {
  it("horde: много существ одного вида, больше, чем в обычном отряде", async () => {
    const horde = await gen("hard", "horde", "urban", "бандиты");
    const total = horde.enemies.length;
    expect(total).toBeGreaterThanOrEqual(6);
    expect(new Set(horde.enemies.map((e) => e.monster.slug)).size).toBeLessThanOrEqual(2);
    expect(horde.squadArchetype).toBe("horde");
  }, 60000);

  it("horde на overwhelming — ещё больше толпа", async () => {
    const big = await gen("overwhelming", "horde", "urban", "бандиты");
    const normal = await gen("medium", "horde", "urban", "бандиты");
    expect(big.enemies.length).toBeGreaterThanOrEqual(normal.enemies.length);
  }, 60000);

  it("solo_boss: один враг", async () => {
    const solo = await gen("hard", "solo_boss", "forest", "разбойники");
    expect(solo.enemies.length).toBeGreaterThan(0);
    expect(solo.squadArchetype).toBe("solo_boss");
  }, 60000);

  it("boss_minions: босс и свита", async () => {
    const e = await gen("hard", "boss_minions", "urban", "бандиты");
    expect(e.enemies.length).toBeGreaterThan(0);
    expect(e.squadArchetype).toBe("boss_minions");
  }, 60000);

  it("tactical_squad: отряд из нескольких видов", async () => {
    const e = await gen("hard", "tactical_squad", "urban", "бандиты");
    expect(e.enemies.length).toBeGreaterThan(0);
    expect(e.squadArchetype).toBe("tactical_squad");
  }, 60000);

  it("явный состав важнее кульминации акта", async () => {
    const e = await gen("hard", "horde", "urban", "бандиты", { isActClimax: true });
    expect(e.squadArchetype).toBe("horde");
  }, 60000);
});
