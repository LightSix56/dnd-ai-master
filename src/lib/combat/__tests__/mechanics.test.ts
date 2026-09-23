import { describe, it, expect } from "vitest";
import { performAttack, castSpell, useAbility, removeCondition, moveCombatant, startTurn } from "../engine";
import { isDifficultTerrain, cellCost } from "../movement";
import { getSpellDefinition } from "../library-data";

describe("D&D 5e Combat Mechanics", () => {
  function createTestState() {
    return {
      combatants: [
        {
          id: "nyx",
          name: "Никс",
          type: "player",
          className: "Плут",
          level: 1,
          hpCurrent: 10,
          hpMax: 10,
          hpTemp: 0,
          ac: 16,
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
          facing: "E",
          conditions: [],
          abilityMods: { STR: -1, DEX: 3, CON: 2, INT: 1, WIS: 1, CHA: 0 },
          profBonus: 2,
          attacks: [
            {
              id: "shortsword",
              name: "Короткий меч",
              kind: "melee",
              range: { normal: 5 },
              attackBonus: 5,
              damage: [{ dice: "1d6", mod: 3, type: "piercing" }],
              finesse: true,
              actionCost: "action",
            },
          ],
          abilities: [
            {
              id: "sneak_attack",
              name: "Скрытая атака",
              usesMax: 1,
              usesUsed: 0,
              refresh: "turn",
              parameters: {
                name: "Скрытая атака",
                type: "ability",
                actionCost: "free",
                damage: [{ dice: "1d6", mod: 0, type: "piercing" }],
              },
            },
          ],
          spells: { slots: {}, known: [] },
        },
        {
          id: "torbor",
          name: "Торбор",
          type: "player",
          className: "Друид",
          level: 3,
          hpCurrent: 24,
          hpMax: 24,
          hpTemp: 0,
          ac: 19,
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
          facing: "E",
          conditions: [],
          abilityMods: { STR: 1, DEX: 0, CON: 2, INT: 0, WIS: 3, CHA: -1 },
          profBonus: 2,
          attacks: [
            {
              id: "quarterstaff",
              name: "Боевой посох",
              kind: "melee",
              range: { normal: 5 },
              attackBonus: 3,
              damage: [{ dice: "1d6", mod: 1, type: "bludgeoning" }],
              actionCost: "action",
            },
          ],
          abilities: [],
          spells: {
            slots: { 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } },
            known: ["Раскаленный металл", "Дубинка"],
            spellSaveDC: 13,
            spellAttackBonus: 5,
            spellcastingAbility: "WIS",
          },
        },
        {
          id: "orc",
          name: "Орк",
          type: "enemy",
          className: "Орк",
          level: 1,
          hpCurrent: 30,
          hpMax: 30,
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
          x: 3,
          y: 2,
          facing: "W",
          conditions: [],
          abilityMods: { STR: 3, DEX: 1, CON: 3, INT: -2, WIS: 0, CHA: -1 },
          profBonus: 2,
          attacks: [],
          abilities: [],
          spells: { slots: {}, known: [] },
        },
      ],
      mapElements: [],
      gridWidth: 20,
      gridHeight: 20,
      round: 1,
      currentTurnIndex: 0,
      turnOrder: ["nyx", "torbor", "orc"],
      log: [] as any[],
      dirtyIds: new Set(),
      isCombatDirty: false,
      require(id: string) {
        const c = this.combatants.find((x: any) => x.id === id);
        if (!c) throw new Error("Not found: " + id);
        return c;
      },
      get(id: string) {
        return this.combatants.find((x: any) => x.id === id);
      },
      mark(id: string) {
        this.dirtyIds.add(id);
      },
      markCombat() {
        this.isCombatDirty = true;
      },
      addLog(text: string, kind: string, actor: string) {
        this.log.push({ round: this.round, text, kind, actor });
      },
    };
  }

  it("Sneak Attack does not trigger when attacking alone without advantage", () => {
    const state: any = createTestState();
    const res = performAttack(state, "nyx", "orc", "shortsword", { skipTurnCheck: true });
    expect(res.text.includes("скрытая атака")).toBe(false);
  });

  it("Sneak Attack triggers when an ally is within 5ft of the target", () => {
    const state: any = createTestState();
    state.get("torbor").x = 4;
    state.get("torbor").y = 2; // Торбор в 5 фт от орка
    const res = performAttack(state, "nyx", "orc", "shortsword", { skipTurnCheck: true, manualAdvantage: false });
    if (res.hit) {
      expect(res.text.includes("скрытая атака")).toBe(true);
    }
  });

  it("Heat Metal applies concentration, target condition and recurring bonus action ability", () => {
    const state: any = createTestState();
    const heatDef = getSpellDefinition("Раскаленный металл");
    expect(heatDef).toBeDefined();

    castSpell(state, "torbor", heatDef as any, { targetIds: ["orc"], skipTurnCheck: true });
    const torbor = state.get("torbor");
    const orc = state.get("orc");

    expect(torbor.concentration?.spellName).toBe("Раскаленный металл");
    expect(orc.conditions.some((c: any) => c.type === "heat_metal")).toBe(true);

    const burnAbility = torbor.abilities.find((a: any) => a.id === "heat_metal_burn");
    expect(burnAbility).toBeDefined();
    expect(burnAbility?.parameters?.actionCost).toBe("bonus");

    // Recurring burn
    orc.hpCurrent = 30;
    torbor.bonusActionUsed = false;
    useAbility(state, "torbor", "heat_metal_burn", { targetIds: ["orc"], skipTurnCheck: true });
    expect(orc.hpCurrent).toBeLessThan(30);
    expect(torbor.bonusActionUsed).toBe(true);
  });

  it("Shillelagh spell adds dynamic Shillelagh attack with Wisdom mod and removes on expiry", () => {
    const state: any = createTestState();
    const shillelaghDef = getSpellDefinition("Дубинка");
    expect(shillelaghDef).toBeDefined();

    castSpell(state, "torbor", shillelaghDef as any, { skipTurnCheck: true });
    const torbor = state.get("torbor");

    expect(torbor.conditions.some((c: any) => c.type === "shillelagh")).toBe(true);
    const shillelaghAtk = torbor.attacks.find((a: any) => a.id === "shillelagh_attack");
    expect(shillelaghAtk).toBeDefined();
    expect(shillelaghAtk?.attackBonus).toBe(5); // +2 prof + 3 WIS
    expect(shillelaghAtk?.damage[0].dice).toBe("1d8");
    expect(shillelaghAtk?.damage[0].mod).toBe(3);

    // Test attack execution
    torbor.x = 4;
    torbor.y = 2; // adjacent to orc (3,2)
    const res = performAttack(state, "torbor", "orc", "shillelagh_attack", { skipTurnCheck: true });
    expect(res.text).toContain("Шиллейла");
    expect(res.text).toContain("+5");

    // Removal of shillelagh condition cleans up attack
    torbor.conditions = torbor.conditions.filter((c: any) => c.type !== "shillelagh");
    removeCondition(state, "torbor", "shillelagh");
    expect(torbor.attacks.some((a: any) => a.id === "shillelagh_attack")).toBe(false);
  });

  it("Rogue Cunning Action abilities work with Bonus Action", () => {
    const state: any = createTestState();
    const nyx = state.get("nyx");
    nyx.abilities.push(
      {
        id: "cunning_action_dash",
        name: "Хитрое действие: Рывок",
        usesMax: 0,
        usesUsed: 0,
        refresh: "none",
        parameters: { name: "Хитрое действие: Рывок", type: "ability", actionCost: "bonus" },
      },
      {
        id: "cunning_action_disengage",
        name: "Хитрое действие: Отход",
        usesMax: 0,
        usesUsed: 0,
        refresh: "none",
        parameters: { name: "Хитрое действие: Отход", type: "ability", actionCost: "bonus" },
      }
    );

    // Use Cunning Action: Dash
    useAbility(state, "nyx", "cunning_action_dash", { skipTurnCheck: true });
    expect(nyx.bonusActionUsed).toBe(true);
    expect(nyx.actionUsed).toBe(false); // Main action is still free!
    expect(nyx.conditions.some((c: any) => c.type === "dashing")).toBe(true);

    // Reset bonus action for Disengage
    nyx.bonusActionUsed = false;
    useAbility(state, "nyx", "cunning_action_disengage", { skipTurnCheck: true });
    expect(nyx.bonusActionUsed).toBe(true);
    expect(nyx.conditions.some((c: any) => c.type === "disengaging")).toBe(true);
  });
  it("Water terrain costs 10 ft for normal walking, but 5 ft for swimmers and water-walkers", () => {
    const state: any = createTestState();
    const waterElement = {
      id: "water-1",
      type: "water",
      x: 3,
      y: 2,
      width: 2,
      height: 2,
      properties: {},
    };
    state.mapElements.push(waterElement);

    // 1. Normal creature (Nyx) without water walk
    const nyx = state.get("nyx");
    expect(nyx.conditions.some((c: any) => c.type === "water_walking")).toBe(false);

    
    expect(isDifficultTerrain({ x: 3, y: 2 }, state.mapElements, nyx)).toBe(true);
    expect(cellCost({ x: 3, y: 2 }, state.mapElements, nyx)).toBe(10);

    // 2. Creature with water walking ability / condition
    nyx.conditions.push({ type: "water_walking" });
    expect(isDifficultTerrain({ x: 3, y: 2 }, state.mapElements, nyx)).toBe(false);
    expect(cellCost({ x: 3, y: 2 }, state.mapElements, nyx)).toBe(5);
  });

  it("Lava terrain is difficult and deals fire damage upon entry and start of turn", () => {
    const state: any = createTestState();
    const lavaElement = {
      id: "lava-1",
      type: "lava",
      x: 5,
      y: 5,
      width: 2,
      height: 2,
      properties: {},
    };
    state.mapElements.push(lavaElement);

    const orc = state.get("orc");
    const initialHp = orc.hpCurrent;

    // Movement into lava
    
    orc.x = 4;
    orc.y = 5;
    moveCombatant(state, "orc", { x: 5, y: 5 }, { skipTurnCheck: true });

    expect(orc.x).toBe(5);
    expect(orc.y).toBe(5);
    expect(orc.hpCurrent).toBeLessThan(initialHp); // Took lava fire damage!
    expect(state.log.some((l: any) => l.text.includes("раскаленную лаву"))).toBe(true);

    // Start turn in lava
    const hpBeforeTurn = orc.hpCurrent;
    state.currentTurnIndex = 2; // orc turn
    state.current = () => orc;
    startTurn(state);
    expect(orc.hpCurrent).toBeLessThan(hpBeforeTurn); // Took start of turn lava fire damage!
  });
});
