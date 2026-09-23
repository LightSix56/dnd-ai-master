import { describe, it, expect } from "vitest";
import { assignTacticalSpawns, inferCombatantRole } from "../spawn-director";
import { templePreset } from "../presets/temple";
import { forestAmbushPreset } from "../presets/forest-ambush";
import type { Combatant } from "../../types";

function createMockCombatant(
  id: string,
  name: string,
  type: "player" | "enemy",
  overrides: Partial<Combatant> = {}
): Combatant {
  return {
    id,
    name,
    type,
    color: type === "player" ? "#3b82f6" : "#ef4444",
    x: 0,
    y: 0,
    hpCurrent: 30,
    hpMax: 30,
    hpTemp: 0,
    ac: 15,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 2,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "Fighter",
    level: 3,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: [],
    spells: {
      slots: { 1: { total: 0, current: 0 }, 2: { total: 0, current: 0 } },
      known: [],
      prepared: [],
      cantrips: [],
    } as any,
    abilities: [],
    concentration: null,
    saves: {},
    abilityMods: {},
    profBonus: 2,
    isAIControlled: false,
    ...overrides,
  };
}

describe("Tactical Spawn Director (spawn-director)", () => {
  it("should infer tactical roles accurately from combatant properties", () => {
    const boss = createMockCombatant("b1", "Главарь культистов", "enemy", { hpMax: 80 });
    expect(inferCombatantRole(boss)).toBe("boss");

    const caster = createMockCombatant("c1", "Аколит", "enemy", {
      className: "Wizard",
      spells: {
        slots: { 1: { total: 4, current: 4 } },
        known: ["fireball"],
      } as any,
    });
    expect(inferCombatantRole(caster)).toBe("backline");

    const vanguard = createMockCombatant("v1", "Культист-рукопашник", "enemy");
    expect(inferCombatantRole(vanguard)).toBe("vanguard");
  });

  it("should assign distinct, unblocked spawn positions according to tactical roles", () => {
    const players = [
      createMockCombatant("p1", "Воин", "player"),
      createMockCombatant("p2", "Плут", "player"),
      createMockCombatant("p3", "Жрец", "player"),
    ];

    const enemies = [
      createMockCombatant("e-boss", "Верховный жрец", "enemy", { hpMax: 90 }),
      createMockCombatant("e-mage", "Маг культа", "enemy", { className: "Wizard" }),
      createMockCombatant("e-melee1", "Страж алтаря 1", "enemy"),
      createMockCombatant("e-melee2", "Страж алтаря 2", "enemy"),
    ];

    const assigned = assignTacticalSpawns(templePreset, [...players, ...enemies]);

    expect(assigned).toHaveLength(7);

    // 1. All positions must be unique
    const positions = new Set(assigned.map((c) => `${c.x},${c.y}`));
    expect(positions.size).toBe(7);

    // 2. No combatant should be inside a wall
    const wallKeys = new Set(
      templePreset.elements
        .filter((e) => e.type === "wall")
        .map((e) => `${e.x},${e.y}`)
    );
    for (const c of assigned) {
      expect(wallKeys.has(`${c.x},${c.y}`)).toBe(false);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(templePreset.gridWidth);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(templePreset.gridHeight);
    }

    // 3. Players should be in or near the party zone (southern side of temple)
    const p1 = assigned.find((c) => c.id === "p1")!;
    expect(p1.y).toBeGreaterThan(18);

    // 4. Boss should be near the altar (northern side of temple)
    const boss = assigned.find((c) => c.id === "e-boss")!;
    expect(boss.y).toBeLessThan(10);
  });

  it("should place flankers in ambush zone if preset has ambush_flank", () => {
    const players = [createMockCombatant("p1", "Следопыт", "player")];
    const flanker = createMockCombatant("f1", "Разбойник в засаде", "enemy");

    const assigned = assignTacticalSpawns(
      forestAmbushPreset,
      [...players, flanker],
      { roleOverrides: { f1: "flanker" } }
    );

    const f1Result = assigned.find((c) => c.id === "f1")!;
    // In forest ambush, ambush flank zone is at y >= 11
    expect(f1Result.y).toBeGreaterThanOrEqual(10);
  });

  it("should generate safe default spawn zones when preset.spawnZones is empty", () => {
    const mapWithoutZones = {
      id: "custom-empty-zones",
      name: "Кастомная карта",
      nameEn: "Custom Map",
      biome: "dungeon_prison" as const,
      tags: [],
      gridWidth: 20,
      gridHeight: 15,
      cellSizeFt: 5,
      elements: [
        // Walls around the perimeter and void on columns 17-19
        ...Array.from({ length: 15 }, (_, y) => ({
          id: `wall-e17-${y}`,
          type: "wall" as const,
          x: 17,
          y,
          width: 1,
          height: 1,
          properties: {},
        })),
      ],
      spawnZones: [],
    };

    const players = [
      createMockCombatant("p1", "Воин", "player"),
      createMockCombatant("p2", "Маг", "player"),
    ];
    const enemies = [
      createMockCombatant("e1", "Гоблин 1", "enemy"),
      createMockCombatant("e2", "Гоблин 2", "enemy"),
      createMockCombatant("e3", "Гоблин 3", "enemy"),
    ];

    const assigned = assignTacticalSpawns(mapWithoutZones, [...players, ...enemies]);

    expect(assigned).toHaveLength(5);
    // None should be at x >= 17 (behind the wall)
    for (const c of assigned) {
      expect(c.x).toBeLessThan(17);
      expect(c.x).toBeGreaterThanOrEqual(1);
      expect(c.y).toBeGreaterThanOrEqual(1);
      expect(c.y).toBeLessThan(14);
    }

    // Players should spawn in the western zone
    const p1 = assigned.find((c) => c.id === "p1")!;
    expect(p1.x).toBeLessThanOrEqual(5);

    // Enemies should spawn in the eastern playable zone
    const e1 = assigned.find((c) => c.id === "e1")!;
    expect(e1.x).toBeGreaterThanOrEqual(6);
    expect(e1.x).toBeLessThan(17);
  });
});

