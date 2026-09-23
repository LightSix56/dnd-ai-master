import { describe, it, expect } from "vitest";
import {
  mapRegistry,
  getPresetById,
  assignTacticalSpawns,
  parseUniversalVTT,
  toggleDoor,
  type TacticalMapPreset,
} from "../index";
import { CombatState, moveCombatant } from "../../engine";
import type { Combat, Combatant } from "../../types";

function createHero(id: string, name: string, overrides: Partial<Combatant> = {}): Combatant {
  return {
    id,
    name,
    type: "player",
    color: "#3b82f6",
    x: 0,
    y: 0,
    hpCurrent: 40,
    hpMax: 40,
    hpTemp: 0,
    ac: 16,
    speed: 30,
    initiative: 12,
    initiativeTiebreak: 12,
    dexMod: 2,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "Paladin",
    level: 4,
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
    spells: { slots: {}, known: [], prepared: [], cantrips: [] } as any,
    abilities: [],
    concentration: null,
    saves: {},
    abilityMods: {},
    profBonus: 2,
    isAIControlled: false,
    ...overrides,
  };
}

describe("End-to-End Tactical Maps Integration", () => {
  it("should perform complete lifecycle: search -> preset -> spawn director -> combat engine execution", () => {
    // 1. Поиск карты по запросу от ИИ Мастера
    const searchResults = mapRegistry.search({
      tags: ["ship", "naval", "water"],
      indoor: false,
    });

    expect(searchResults.length).toBeGreaterThan(0);
    const chosenManifest = searchResults[0];
    expect(chosenManifest.biome).toBe("ship_battle");

    // 2. Загрузка пресета
    const preset = getPresetById(chosenManifest.id);
    expect(preset).toBeDefined();

    // 3. Формирование отряда и врагов
    const party = [
      createHero("hero-paladin", "Сэр Галахад"),
      createHero("hero-cleric", "Сестра Беатрис", { className: "Cleric" }),
    ];
    const enemies = [
      createHero("pirate-captain", "Капитан Кровавый Клык", {
        type: "enemy",
        color: "#ef4444",
        hpMax: 85,
        hpCurrent: 85,
      }),
      createHero("pirate-corsair-1", "Пират-рукопашник 1", { type: "enemy", color: "#ef4444" }),
      createHero("pirate-sniper", "Пиратский снайпер", {
        type: "enemy",
        color: "#ef4444",
        className: "Ranger",
      }),
    ];

    // 4. Интеллектуальная расстановка по ролям
    const positioned = assignTacticalSpawns(preset!, [...party, ...enemies]);
    expect(positioned).toHaveLength(5);

    // Паладины на союзном корабле (x <= 6)
    const paladin = positioned.find((c) => c.id === "hero-paladin")!;
    expect(paladin.x).toBeLessThanOrEqual(6);

    // Босс на капитанском мостике вражеского корабля (x >= 18)
    const boss = positioned.find((c) => c.id === "pirate-captain")!;
    expect(boss.x).toBeGreaterThanOrEqual(18);

    // 5. Инициализация боя в движке
    const combat: Combat = {
      id: "ship-clash-1",
      name: "Абордажная схватка",
      status: "active",
      round: 1,
      currentTurnIndex: 0,
      turnOrder: positioned.map((c) => c.id),
      gridWidth: preset!.gridWidth,
      gridHeight: preset!.gridHeight,
      cellSize: 5,
      log: [],
      combatants: positioned,
      mapElements: preset!.elements,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const state = new CombatState(combat);
    expect(state.combatants).toHaveLength(5);

    // Проверка перемещения по абордажному трапу (y=5, x=10 -> 11)
    const corsair = state.require("pirate-corsair-1");
    corsair.x = 10;
    corsair.y = 5;

    // Перемещение через трап (клетка 11, 5)
    moveCombatant(state, corsair.id, { x: 11, y: 5 }, { skipTurnCheck: true });
    expect(state.require(corsair.id).x).toBe(11);
  });

  it("should parse Universal VTT, register it and toggle its doors dynamically", () => {
    const rawVtt = JSON.stringify({
      format: 0.2,
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: 12, y: 12 },
        pixels_per_grid: 100,
      },
      line_of_sight: [
        [
          { x: 1, y: 1 },
          { x: 10, y: 1 },
        ],
      ],
      portals: [
        {
          position: { x: 5, y: 1 },
          bounds: [
            { x: 5, y: 1 },
            { x: 6, y: 1 },
          ],
          closed: true,
        },
      ],
    });

    const parsedPreset = parseUniversalVTT(rawVtt, {
      id: "custom-dungeon-vtt",
      name: "Пользовательское подземелье",
      nameEn: "Custom Dungeon",
      biome: "dungeon_prison",
      tags: ["custom", "dungeon"],
    });

    mapRegistry.registerPreset(parsedPreset);

    const retrieved = mapRegistry.getPreset("custom-dungeon-vtt");
    expect(retrieved).toBeDefined();
    expect(retrieved?.elements.length).toBeGreaterThan(0);

    const door = retrieved?.elements.find((e) => e.type === "door");
    expect(door).toBeDefined();
    expect(door?.properties.isOpen).toBe(false);

    // Загрузка в CombatState и интерактивное открытие двери
    const combat: Combat = {
      id: "vtt-combat-test",
      name: "VTT Test",
      status: "active",
      round: 1,
      currentTurnIndex: 0,
      turnOrder: ["hero-1"],
      gridWidth: parsedPreset.gridWidth,
      gridHeight: parsedPreset.gridHeight,
      cellSize: 5,
      log: [],
      combatants: [createHero("hero-1", "Герой", { x: 5, y: 0 })],
      mapElements: parsedPreset.elements,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const state = new CombatState(combat);
    const toggleResult = toggleDoor(state, door!.id, { actorId: "hero-1" });
    expect(toggleResult.isOpen).toBe(true);
    expect(state.mapElements.find((e) => e.id === door!.id)?.properties.isOpen).toBe(true);
  });
});
