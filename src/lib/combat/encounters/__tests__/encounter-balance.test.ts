import { describe, it, expect } from "vitest";
import { applyLeaderName, resolveEncounterDifficulty } from "../encounter-request";
import { generateEncounter } from "../encounter-generator";
import { XP_THRESHOLDS_BY_LEVEL } from "../xp-calculator";
import type { SpawnedEnemy } from "../types";

function spawn(name: string, role: SpawnedEnemy["role"], xp: number): SpawnedEnemy {
  return {
    monster: { name, xp } as SpawnedEnemy["monster"],
    role,
    position: { x: 0, y: 0 },
    combatant: { name } as SpawnedEnemy["combatant"],
  };
}

describe("resolveEncounterDifficulty", () => {
  it("берёт сложность, которую назвал мастер", () => {
    expect(resolveEncounterDifficulty("hard", "easy")).toBe("hard");
  });

  it("без сложности от мастера берёт сложность кампании", () => {
    expect(resolveEncounterDifficulty(undefined, "easy")).toBe("easy");
    expect(resolveEncounterDifficulty(undefined, "normal")).toBe("medium");
    expect(resolveEncounterDifficulty(undefined, "hard")).toBe("hard");
    expect(resolveEncounterDifficulty(undefined, "brutal")).toBe("deadly");
  });

  it("без обеих сложностей — средняя", () => {
    expect(resolveEncounterDifficulty(undefined, undefined)).toBe("medium");
    expect(resolveEncounterDifficulty(undefined, "неизвестно")).toBe("medium");
  });
});

describe("applyLeaderName", () => {
  it("переименовывает босса отряда", () => {
    const enemies = [spawn("Бандит", "minion", 25), spawn("Капитан бандитов", "boss", 450), spawn("Бандит", "minion", 25)];
    applyLeaderName(enemies, "Человек в сером капюшоне");
    expect(enemies.map((e) => e.combatant?.name)).toEqual(["Бандит", "Человек в сером капюшоне", "Бандит"]);
  });

  it("без босса переименовывает самого сильного врага", () => {
    const enemies = [spawn("Бандит", "frontline", 25), spawn("Головорез", "frontline", 100)];
    applyLeaderName(enemies, "Одноглазый Вик");
    expect(enemies.map((e) => e.combatant?.name)).toEqual(["Бандит", "Одноглазый Вик"]);
  });

  it("пустое имя ничего не меняет", () => {
    const enemies = [spawn("Бандит", "boss", 25)];
    applyLeaderName(enemies, "  ");
    expect(enemies[0].combatant?.name).toBe("Бандит");
  });
});

describe("баланс для маленькой партии", () => {
  it("один герой 1-го уровня не получает отряд выше смертельного порога", async () => {
    for (const faction of ["бандиты", "городская стража", "головорезы"]) {
      const encounter = await generateEncounter({
        party: [{ id: "p1", name: "Пятно", level: 1 }],
        difficulty: "medium",
        biome: "urban",
        storyFaction: { name: faction },
        mapPresetId: "",
      });
      expect(encounter.enemies.length).toBeGreaterThan(0);
      expect(encounter.adjustedXP, faction).toBeLessThanOrEqual(XP_THRESHOLDS_BY_LEVEL[1].deadly);
    }
  }, 30000);
});

describe("враги из сюжетной фракции", () => {
  const party = [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `Герой ${i}`, level: 1 }));

  it("по английским названиям выходят именно эти существа, а не местные звери", async () => {
    for (let i = 0; i < 5; i++) {
      const encounter = await generateEncounter({
        party,
        difficulty: "medium",
        biome: "swamp",
        storyFaction: { name: "ящеролюды и мертвецы", tags: ["lizardfolk", "zombie"] },
        mapPresetId: "",
      });
      expect(encounter.enemies.length).toBeGreaterThan(0);
      for (const e of encounter.enemies) expect(e.monster.nameEn ?? e.monster.name).toMatch(/lizardfolk|zombie/i);
    }
  }, 60000);

  it("русское слово во множественном числе находит существо", async () => {
    const encounter = await generateEncounter({
      party,
      difficulty: "medium",
      biome: "forest",
      storyFaction: { name: "разбойники" },
      mapPresetId: "",
    });
    for (const e of encounter.enemies) expect(`${e.monster.name}`).toMatch(/разбойник/i);
  }, 30000);
});
