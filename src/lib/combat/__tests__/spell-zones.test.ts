import { describe, it, expect } from "vitest";
import { CombatState, castSpell, moveCombatant, startTurn, endTurn, dealDamage } from "../engine";
import { getSpellDefinition } from "../library-data";

describe("D&D 5e Spell Zones on Grid (Entangle, Web, Spike Growth, Grease)", () => {
  function makeState() {
    const raw = {
      id: "combat-zones-1",
      name: "Тестовый бой с зонами",
      status: "active" as const,
      round: 1,
      currentTurnIndex: 0,
      turnOrder: ["caster", "enemy"],
      gridWidth: 20,
      gridHeight: 20,
      cellSize: 50,
      log: [],
      mapElements: [],
      combatants: [
        {
          id: "caster",
          name: "Заклинатель",
          type: "player" as const,
          className: "Друид",
          level: 5,
          hpCurrent: 35,
          hpMax: 35,
          hpTemp: 0,
          ac: 14,
          speed: 30,
          movementUsed: 0,
          actionUsed: false,
          bonusActionUsed: false,
          reactionUsed: false,
          attacksPerAction: 1,
          attacksMadeThisAction: 0,
          extraActions: 0,
          x: 2,
          y: 2,
          facing: "E" as const,
          conditions: [],
          abilityMods: { STR: 0, DEX: 2, CON: 2, INT: 2, WIS: 4, CHA: 0 },
          profBonus: 3,
          attacks: [],
          abilities: [],
          spells: {
            slots: { 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 } },
            known: ["spell_99", "spell_141", "spell_276", "spell_313"],
            spellSaveDC: 15,
            spellAttackBonus: 7,
            spellcastingAbility: "WIS" as const,
          },
        },
        {
          id: "enemy",
          name: "Гоблин",
          type: "enemy" as const,
          className: "Гоблин",
          level: 2,
          hpCurrent: 25,
          hpMax: 25,
          hpTemp: 0,
          ac: 13,
          speed: 30,
          movementUsed: 0,
          actionUsed: false,
          bonusActionUsed: false,
          reactionUsed: false,
          attacksPerAction: 1,
          attacksMadeThisAction: 0,
          extraActions: 0,
          x: 10,
          y: 10,
          facing: "W" as const,
          conditions: [],
          abilityMods: { STR: -1, DEX: 2, CON: 0, INT: 0, WIS: 0, CHA: -1 },
          profBonus: 2,
          attacks: [],
          abilities: [],
          spells: { slots: {}, known: [] },
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return new CombatState(raw as any);
  }

  it("Task 3.1: Entangle creates difficult terrain spell zone and removes it when concentration drops", () => {
    const state = makeState();
    const caster = state.require("caster");
    const enemy = state.require("enemy");
    // Переставим врага в область каста (x: 5, y: 5)
    enemy.x = 5;
    enemy.y = 5;

    // Сотворяем Entangle на клетку (5, 5)
    castSpell(state, "caster", "spell_99", {
      center: { x: 5, y: 5 },
      slotLevel: 1,
    });

    // 1. Концентрация установлена
    expect(caster.concentration).toBeDefined();

    // 2. В mapElements появились клетки зоны с свойствами заклинания
    const zoneElements = state.mapElements.filter(
      (el) => el.properties?.isSpellZone && el.properties.zoneType === "entangle"
    );
    expect(zoneElements.length).toBeGreaterThan(0);
    expect(zoneElements.every((el) => el.properties.difficultTerrain)).toBe(true);
    expect(zoneElements.every((el) => el.properties.casterId === "caster")).toBe(true);
    expect(zoneElements.every((el) => el.properties.concentration)).toBe(true);

    // 3. При касте нового концентрационного заклинания старая концентрация и её зоны сбрасываются
    caster.actionUsed = false;
    castSpell(state, "caster", "spell_99", {
      center: { x: 8, y: 8 },
      slotLevel: 1,
      skipTurnCheck: true,
    });

    // Старые элементы в (5, 5) должны быть удалены
    const oldZoneElements = state.mapElements.filter(
      (el) => el.properties?.isSpellZone && el.x === 5 && el.y === 5
    );
    expect(oldZoneElements.length).toBe(0);
  });

  it("Task 4.1: Web zone causes DEX save upon entry and restrains on failure", () => {
    const state = makeState();
    const enemy = state.require("enemy");
    enemy.x = 2;
    enemy.y = 5; // Вне паутины

    // Кастуем Паутину (Web) с центром в (5, 5)
    castSpell(state, "caster", "spell_313", {
      center: { x: 5, y: 5 },
      slotLevel: 2,
    });

    // Проверяем, что зона создана с flammable: true и saveType: "DEX"
    const webElements = state.mapElements.filter(
      (el) => el.properties?.isSpellZone && el.properties.zoneType === "web"
    );
    expect(webElements.length).toBeGreaterThan(0);
    expect(webElements[0].properties.flammable).toBe(true);

    // Заставим врага походить в зону паутины (в клетку 5, 5)
    state.currentTurnIndex = 1; // Ход врага
    // Поставим DC 30, чтобы враг гарантированно провалил спасбросок
    webElements.forEach((el) => {
      el.properties.saveDC = 30;
    });

    moveCombatant(state, "enemy", { x: 5, y: 5 });

    // Враг должен стать restrained, а его скорость исчерпана / движение остановлено
    expect(enemy.conditions.some((c) => c.type === "restrained")).toBe(true);
  });

  it("Task 4.2: Spike Growth deals 2d4 piercing damage for every 5 feet traveled in the area", () => {
    const state = makeState();
    const enemy = state.require("enemy");
    enemy.x = 4;
    enemy.y = 5;
    const initialHp = enemy.hpCurrent;

    // Сотворяем Spike Growth с центром в (5, 5)
    castSpell(state, "caster", "spell_276", {
      center: { x: 5, y: 5 },
      slotLevel: 2,
    });

    const spikeZones = state.mapElements.filter(
      (el) => el.properties?.isSpellZone && el.properties.zoneType === "spike_growth"
    );
    expect(spikeZones.length).toBeGreaterThan(0);

    // Ход врага
    state.currentTurnIndex = 1;
    // Враг идет сквозь шипы: из (4, 5) в (6, 5) — это 2 клетки по 5 фт (10 фт в шипах)
    moveCombatant(state, "enemy", { x: 6, y: 5 });

    // За каждые 5 фт он должен был получить 2к4 урона (минимум 2x2 = 4 урона)
    expect(enemy.hpCurrent).toBeLessThanOrEqual(initialHp - 4);
  });

  it("Task 4.3: Grease causes prone on failed DEX save", () => {
    const state = makeState();
    const enemy = state.require("enemy");
    enemy.x = 2;
    enemy.y = 5;

    // Кастуем Grease (Скольжение, 1 круг, без концентрации) в (4, 5)
    castSpell(state, "caster", "spell_141", {
      center: { x: 4, y: 5 },
      slotLevel: 1,
    });

    const greaseZones = state.mapElements.filter(
      (el) => el.properties?.isSpellZone && el.properties.zoneType === "grease"
    );
    expect(greaseZones.length).toBeGreaterThan(0);
    expect(greaseZones[0].properties.concentration).toBe(false);

    // Устанавливаем высокий DC для проверки
    greaseZones.forEach((el) => {
      el.properties.saveDC = 30;
    });

    state.currentTurnIndex = 1;
    moveCombatant(state, "enemy", { x: 4, y: 5 });

    // При входе враг должен упасть ничком (prone)
    expect(enemy.conditions.some((c) => c.type === "prone")).toBe(true);
  });

  it("Task 4.4: Fire damage burns away Web and deals 2d4 fire damage", () => {
    const state = makeState();
    const enemy = state.require("enemy");
    enemy.x = 5;
    enemy.y = 5;

    // Кастуем Паутину на (5, 5)
    castSpell(state, "caster", "spell_313", {
      center: { x: 5, y: 5 },
      slotLevel: 2,
    });

    const webCountBefore = state.mapElements.filter(
      (el) => el.properties?.isSpellZone && el.properties.zoneType === "web"
    ).length;
    expect(webCountBefore).toBeGreaterThan(0);

    const hpBeforeFire = enemy.hpCurrent;

    // Наносим урон огнем по цели в паутине (или в клетку)
    dealDamage(state, "enemy", 5, {
      damageType: "fire",
    });

    // Клетка паутины под целью сгорела и удалилась
    const webAtTarget = state.mapElements.filter(
      (el) => el.properties?.isSpellZone && el.properties.zoneType === "web" && el.x === 5 && el.y === 5
    );
    expect(webAtTarget.length).toBe(0);

    // Цель получила дополнительный урон огнем от сгорающей паутины (2d4, минимум 2)
    // Общий урон >= 5 + 2 = 7
    expect(enemy.hpCurrent).toBeLessThanOrEqual(hpBeforeFire - 7);
  });
});
