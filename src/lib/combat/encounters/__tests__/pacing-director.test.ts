import { describe, it, expect } from "vitest";
import {
  evaluateCombatPacing,
  shouldTriggerEncounterRelief,
  type PacingEvaluation,
  type PacingThreatLevel,
  type DMAssistAction,
} from "../pacing-director";
import { CombatState } from "../../engine";
import type { Combatant } from "../../types";

function createMockCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: overrides.id || "c-" + Math.random().toString(36).slice(2, 7),
    name: overrides.name || "Боец",
    type: overrides.type || "player",
    color: overrides.color || "#3b82f6",
    x: overrides.x ?? 5,
    y: overrides.y ?? 5,
    hpCurrent: overrides.hpCurrent ?? 30,
    hpMax: overrides.hpMax ?? 30,
    hpTemp: 0,
    ac: overrides.ac ?? 14,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 2,
    conditions: overrides.conditions || [],
    isHidden: false,
    hasActed: false,
    className: overrides.className || "Воин",
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
    spells: { slots: {}, known: [] },
    abilities: [],
    concentration: null,
    saves: { STR: { prof: true, mod: 4 } },
    abilityMods: { STR: 2, DEX: 2, CON: 2, INT: 0, WIS: 0, CHA: 0 },
    profBonus: 2,
    isAIControlled: overrides.isAIControlled ?? false,
    tacticalRole: overrides.tacticalRole,
  };
}

function createMockState(combatants: Combatant[], round = 1): CombatState {
  return new CombatState({
    id: "test-pacing-combat",
    name: "Тестовый бой",
    status: "active",
    round,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    combatants,
    mapElements: [],
    log: [],
    gridWidth: 20,
    gridHeight: 20,
    cellSize: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe("Pacing Director & Dynamic Combat Scaling", () => {
  describe("Healthy Party Evaluation", () => {
    it("should evaluate a healthy party with healthy enemies as balanced", () => {
      const heroes = [
        createMockCombatant({ id: "h1", name: "Паладин", type: "player", hpCurrent: 30, hpMax: 30 }),
        createMockCombatant({ id: "h2", name: "Жрец", type: "player", hpCurrent: 25, hpMax: 25 }),
      ];
      const enemies = [
        createMockCombatant({ id: "e1", name: "Орк-вожак", type: "enemy", hpCurrent: 45, hpMax: 45, tacticalRole: "boss" }),
        createMockCombatant({ id: "e2", name: "Орк-берсерк", type: "enemy", hpCurrent: 30, hpMax: 30 }),
      ];

      const state = createMockState([...heroes, ...enemies], 1);
      const evalResult = evaluateCombatPacing(state);

      expect(evalResult.threatLevel).toBe("balanced");
      expect(evalResult.partyHpPercent).toBe(100);
      expect(evalResult.aliveHeroesCount).toBe(2);
      expect(evalResult.unconsciousHeroesCount).toBe(0);
      expect(evalResult.enemyCount).toBe(2);
      expect(evalResult.suggestedAction).toBe("none");
      expect(evalResult.narrativePrompt).toMatch(/[а-яА-ЯёЁ]/);
    });

    it("should evaluate a healthy party (>80% HP) with enemies losing fast as safe", () => {
      const heroes = [
        createMockCombatant({ id: "h1", name: "Следопыт", type: "player", hpCurrent: 28, hpMax: 30 }),
        createMockCombatant({ id: "h2", name: "Плут", type: "player", hpCurrent: 24, hpMax: 25 }),
      ];
      // Boss is dead and all enemies defeated
      const enemies = [
        createMockCombatant({ id: "e1", name: "Гоблин-босс", type: "enemy", hpCurrent: 0, hpMax: 30, tacticalRole: "boss" }),
        createMockCombatant({ id: "e2", name: "Гоблин-миньон", type: "enemy", hpCurrent: 0, hpMax: 10 }),
      ];

      const state = createMockState([...heroes, ...enemies], 2);
      const evalResult = evaluateCombatPacing(state);

      expect(evalResult.threatLevel).toBe("safe");
      expect(evalResult.partyHpPercent).toBeGreaterThan(80);
      expect(evalResult.aliveHeroesCount).toBe(2);
      expect(evalResult.unconsciousHeroesCount).toBe(0);
      expect(evalResult.enemyCount).toBe(0);
    });

    it("should suggest reinforcements if boss died early (round <= 2)", () => {
      const heroes = [
        createMockCombatant({ id: "h1", name: "Варвар", type: "player", hpCurrent: 50, hpMax: 50 }),
      ];
      const enemies = [
        createMockCombatant({ id: "e1", name: "Главарь бандитов", type: "enemy", hpCurrent: 0, hpMax: 40, tacticalRole: "boss" }),
        createMockCombatant({ id: "e2", name: "Бандит", type: "enemy", hpCurrent: 10, hpMax: 15 }),
      ];

      const state = createMockState([...heroes, ...enemies], 1);
      const evalResult = evaluateCombatPacing(state);

      expect(evalResult.threatLevel).toBe("safe");
      expect(evalResult.suggestedAction).toBe("reinforcements");
      expect(evalResult.narrativePrompt).toContain("подкреплен");
    });
  });

  describe("Party Casualties & TPK Risk Evaluation", () => {
    it("should evaluate party with 2 of 3 heroes down as tpk_risk with narrative_mercy", () => {
      const heroes = [
        createMockCombatant({ id: "h1", name: "Воин", type: "player", hpCurrent: 0, hpMax: 35 }),
        createMockCombatant({ id: "h2", name: "Маг", type: "player", hpCurrent: 0, hpMax: 20 }),
        createMockCombatant({ id: "h3", name: "Клерик", type: "player", hpCurrent: 15, hpMax: 28 }),
      ];
      const enemies = [
        createMockCombatant({ id: "e1", name: "Вампир", type: "enemy", hpCurrent: 80, hpMax: 100, tacticalRole: "boss" }),
      ];

      const state = createMockState([...heroes, ...enemies], 3);
      const evalResult = evaluateCombatPacing(state);

      expect(evalResult.threatLevel).toBe("tpk_risk");
      expect(evalResult.aliveHeroesCount).toBe(1);
      expect(evalResult.unconsciousHeroesCount).toBe(2);
      expect(evalResult.suggestedAction).toBe("narrative_mercy");
      expect(evalResult.narrativePrompt).toMatch(/грани гибели|сюжетн|бегств|помощ/i);
    });

    it("should evaluate party with <= 25% HP as tpk_risk with narrative_mercy even if only 1 hero is down", () => {
      const heroes = [
        createMockCombatant({ id: "h1", name: "Воин", type: "player", hpCurrent: 0, hpMax: 40 }),
        createMockCombatant({ id: "h2", name: "Маг", type: "player", hpCurrent: 5, hpMax: 30 }),
        createMockCombatant({ id: "h3", name: "Друид", type: "player", hpCurrent: 5, hpMax: 30 }),
      ]; // total HP = 10 / 100 = 10% <= 25%
      const enemies = [
        createMockCombatant({ id: "e1", name: "Дракон", type: "enemy", hpCurrent: 150, hpMax: 200, tacticalRole: "boss" }),
      ];

      const state = createMockState([...heroes, ...enemies], 3);
      const evalResult = evaluateCombatPacing(state);

      expect(evalResult.threatLevel).toBe("tpk_risk");
      expect(evalResult.partyHpPercent).toBe(10);
      expect(evalResult.suggestedAction).toBe("narrative_mercy");
    });
  });

  describe("Intense Threat Level Evaluation", () => {
    it("should evaluate as intense when party HP is between 26% and 50%", () => {
      const heroes = [
        createMockCombatant({ id: "h1", name: "Воин", type: "player", hpCurrent: 20, hpMax: 40 }),
        createMockCombatant({ id: "h2", name: "Бард", type: "player", hpCurrent: 15, hpMax: 40 }),
      ]; // total HP = 35 / 80 = 43.75% -> ~44% (<= 50% and > 25%)
      const enemies = [
        createMockCombatant({ id: "e1", name: "Тролль", type: "enemy", hpCurrent: 60, hpMax: 84 }),
      ];

      const state = createMockState([...heroes, ...enemies], 2);
      const evalResult = evaluateCombatPacing(state);

      expect(evalResult.threatLevel).toBe("intense");
      expect(evalResult.suggestedAction).toBe("none");
      expect(evalResult.unconsciousHeroesCount).toBe(0);
    });

    it("should evaluate as intense when exactly 1 hero is down in a party of 3+ (unconscious < 50%)", () => {
      const heroes = [
        createMockCombatant({ id: "h1", name: "Воин", type: "player", hpCurrent: 0, hpMax: 30 }),
        createMockCombatant({ id: "h2", name: "Жрец", type: "player", hpCurrent: 30, hpMax: 30 }),
        createMockCombatant({ id: "h3", name: "Маг", type: "player", hpCurrent: 30, hpMax: 30 }),
      ]; // 1 down out of 3 = 33% down (< 50%), HP = 60 / 90 = 67% (> 50%)
      const enemies = [
        createMockCombatant({ id: "e1", name: "Людоед", type: "enemy", hpCurrent: 40, hpMax: 50 }),
      ];

      const state = createMockState([...heroes, ...enemies], 2);
      const evalResult = evaluateCombatPacing(state);

      expect(evalResult.threatLevel).toBe("intense");
      expect(evalResult.aliveHeroesCount).toBe(2);
      expect(evalResult.unconsciousHeroesCount).toBe(1);
      expect(evalResult.suggestedAction).toBe("none");
    });
  });

  describe("Encounter Relief Trigger (shouldTriggerEncounterRelief)", () => {
    it("should return false if party is at TPK risk but it is only round 1", () => {
      const heroes = [
        createMockCombatant({ id: "h1", name: "Воин", type: "player", hpCurrent: 0, hpMax: 30 }),
        createMockCombatant({ id: "h2", name: "Жрец", type: "player", hpCurrent: 0, hpMax: 30 }),
      ];
      const enemies = [
        createMockCombatant({ id: "e1", name: "Дракон", type: "enemy", hpCurrent: 100, hpMax: 100 }),
      ];

      const state = createMockState([...heroes, ...enemies], 1);
      expect(shouldTriggerEncounterRelief(state)).toBe(false);
    });

    it("should return true if party is at TPK risk and round >= 2", () => {
      const heroes = [
        createMockCombatant({ id: "h1", name: "Воин", type: "player", hpCurrent: 0, hpMax: 30 }),
        createMockCombatant({ id: "h2", name: "Жрец", type: "player", hpCurrent: 0, hpMax: 30 }),
      ];
      const enemies = [
        createMockCombatant({ id: "e1", name: "Дракон", type: "enemy", hpCurrent: 100, hpMax: 100 }),
      ];

      const state = createMockState([...heroes, ...enemies], 2);
      expect(shouldTriggerEncounterRelief(state)).toBe(true);
    });

    it("should return false if party is safe or balanced even at round 5", () => {
      const heroes = [
        createMockCombatant({ id: "h1", name: "Воин", type: "player", hpCurrent: 30, hpMax: 30 }),
        createMockCombatant({ id: "h2", name: "Жрец", type: "player", hpCurrent: 30, hpMax: 30 }),
      ];
      const enemies = [
        createMockCombatant({ id: "e1", name: "Орк", type: "enemy", hpCurrent: 10, hpMax: 30 }),
      ];

      const state = createMockState([...heroes, ...enemies], 5);
      expect(shouldTriggerEncounterRelief(state)).toBe(false);
    });
  });

  describe("Russian Flavor Narrative Prompts", () => {
    it("should produce non-empty Russian narrative texts across all threat levels", () => {
      const heroesSafe = [
        createMockCombatant({ id: "h1", name: "Воин", type: "player", hpCurrent: 30, hpMax: 30 }),
      ];
      const enemiesDead = [
        createMockCombatant({ id: "e1", name: "Гоблин", type: "enemy", hpCurrent: 0, hpMax: 10 }),
      ];
      const safeState = createMockState([...heroesSafe, ...enemiesDead], 3);
      const safeEval = evaluateCombatPacing(safeState);
      expect(safeEval.narrativePrompt).toMatch(/[а-яА-ЯёЁ]/);

      const heroesTpk = [
        createMockCombatant({ id: "h1", name: "Воин", type: "player", hpCurrent: 0, hpMax: 30 }),
      ];
      const tpkState = createMockState([...heroesTpk, ...enemiesDead], 2);
      const tpkEval = evaluateCombatPacing(tpkState);
      expect(tpkEval.narrativePrompt).toMatch(/[а-яА-ЯёЁ]/);
    });
  });
});
