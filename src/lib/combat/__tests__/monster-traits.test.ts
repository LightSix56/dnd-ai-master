import { describe, it, expect } from "vitest";
import { computeAttackAdvantage, rollSave } from "../rules";
import { dealDamage, startTurn, CombatState } from "../engine";
import type { Combatant, Attack } from "../types";

function createMockCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: overrides.id || "c-" + Math.random().toString(36).slice(2, 7),
    name: overrides.name || "Test Combatant",
    type: overrides.type || "enemy",
    color: "#ef4444",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    hpCurrent: overrides.hpCurrent ?? 20,
    hpMax: overrides.hpMax ?? 20,
    hpTemp: 0,
    ac: overrides.ac ?? 13,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 2,
    conditions: overrides.conditions || [],
    isHidden: false,
    hasActed: false,
    className: "Monster",
    level: 2,
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
    spells: { slots: {}, known: [], prepared: [], spellSaveDC: 12, spellAttackBonus: 4 },
    abilities: [],
    concentration: null,
    wildShape: null,
    saves: {
      STR: { prof: false, mod: 1 },
      DEX: { prof: false, mod: 2 },
      CON: { prof: true, mod: 4 },
      INT: { prof: false, mod: 0 },
      WIS: { prof: false, mod: 1 },
      CHA: { prof: false, mod: 0 },
    },
    abilityMods: { STR: 1, DEX: 2, CON: 2, INT: 0, WIS: 1, CHA: 0 },
    profBonus: 2,
    isAIControlled: true,
    damageResistances: overrides.damageResistances || [],
    damageImmunities: overrides.damageImmunities || [],
    damageVulnerabilities: overrides.damageVulnerabilities || [],
    conditionImmunities: overrides.conditionImmunities || [],
    monsterTraits: overrides.monsterTraits || [],
    suppressRegenerationUntilRound: overrides.suppressRegenerationUntilRound || 0,
  };
}

function createTestCombatState(combatants: Combatant[] = []): CombatState {
  return new CombatState({
    id: "test-combat",
    name: "Test Combat",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    combatants,
    mapElements: [],
    log: [],
    gridWidth: 20,
    gridHeight: 20,
  } as any);
}

const mockMeleeAttack: Attack = {
  id: "atk-bite",
  name: "Укус",
  attackBonus: 4,
  damage: [{ dice: "1d6", mod: 2, type: "piercing" }],
  kind: "melee",
  range: { normal: 5 },
  actionCost: "action",
};

describe("Monster Passive Traits & Rules (Task 3)", () => {
  describe("Pack Tactics (Тактика стаи)", () => {
    it("grants advantage when an active ally is within 5 ft of the target", () => {
      const attacker = createMockCombatant({
        id: "wolf-1",
        name: "Волк 1",
        x: 0,
        y: 0,
        monsterTraits: [{ name: "Тактика стаи", description: "Преимущество если союзник в 5 фт" }],
      });

      const target = createMockCombatant({
        id: "player-1",
        name: "Игрок",
        type: "player",
        x: 1,
        y: 0,
      });

      const ally = createMockCombatant({
        id: "wolf-2",
        name: "Волк 2",
        type: "enemy",
        x: 1,
        y: 1, // 5 ft from player at (1, 0)
        hpCurrent: 10,
      });

      const resWithAlly = computeAttackAdvantage(
        attacker,
        target,
        mockMeleeAttack,
        {},
        { distanceFt: 5, allCombatants: [attacker, target, ally] }
      );

      expect(resWithAlly.advantage).toBe(true);
      expect(resWithAlly.reasons.some((r) => r.includes("Тактика стаи"))).toBe(true);
    });

    it("does NOT grant advantage when ally is incapacitated or too far", () => {
      const attacker = createMockCombatant({
        id: "wolf-1",
        x: 0,
        y: 0,
        monsterTraits: [{ name: "Тактика стаи", description: "Преимущество если союзник в 5 фт" }],
      });

      const target = createMockCombatant({
        id: "player-1",
        type: "player",
        x: 1,
        y: 0,
      });

      const deadAlly = createMockCombatant({
        id: "wolf-2",
        type: "enemy",
        x: 1,
        y: 1,
        hpCurrent: 0, // dead / incapacitated
      });

      const farAlly = createMockCombatant({
        id: "wolf-3",
        type: "enemy",
        x: 4,
        y: 4, // 20 ft away
        hpCurrent: 10,
      });

      const resDead = computeAttackAdvantage(
        attacker,
        target,
        mockMeleeAttack,
        {},
        { distanceFt: 5, allCombatants: [attacker, target, deadAlly] }
      );
      expect(resDead.advantage).toBe(false);

      const resFar = computeAttackAdvantage(
        attacker,
        target,
        mockMeleeAttack,
        {},
        { distanceFt: 5, allCombatants: [attacker, target, farAlly] }
      );
      expect(resFar.advantage).toBe(false);
    });
  });

  describe("Magic Resistance (Магическое сопротивление)", () => {
    it("grants advantage on saving throws against spells", () => {
      const monster = createMockCombatant({
        monsterTraits: [{ name: "Магическое сопротивление", description: "Преимущество на спасброски от заклинаний" }],
      });

      const spellSave = rollSave(monster, "DEX", 15, { isSpell: true });
      expect(spellSave.advantage).toBe(true);

      const trapSave = rollSave(monster, "DEX", 15, { isSpell: false });
      expect(trapSave.advantage).toBe(false);
    });
  });

  describe("Nonmagical Physical Damage Resistance", () => {
    it("halves damage from nonmagical attacks when monster has nonmagical resistance", () => {
      const state = createTestCombatState([
        createMockCombatant({
          id: "gargoyle",
          name: "Гаргулья",
          hpCurrent: 50,
          hpMax: 50,
          damageResistances: ["дробящий, колющий и рубящий от немагических атак"],
        }),
      ]);

      const gargoyle = state.require("gargoyle");

      // Nonmagical attack
      dealDamage(state, "gargoyle", 20, {
        damageType: "slashing",
        isAttack: true,
        isMagicalAttack: false,
      });
      expect(gargoyle.hpCurrent).toBe(40); // took 10 damage

      // Magical attack
      dealDamage(state, "gargoyle", 20, {
        damageType: "slashing",
        isAttack: true,
        isMagicalAttack: true,
      });
      expect(gargoyle.hpCurrent).toBe(20); // took full 20 damage
    });
  });

  describe("Undead Fortitude (Стойкость нежити)", () => {
    it("allows dropping to 1 HP instead of 0 on non-radiant, non-critical lethal damage", () => {
      const zombieInit = createMockCombatant({
        id: "zombie",
        name: "Зомби",
        hpCurrent: 10,
        hpMax: 22,
        monsterTraits: [{ name: "Стойкость нежити", description: "Спасбросок ТЕЛ при 0 HP" }],
      });
      // High CON save to guarantee pass in test (mod +40)
      zombieInit.saves.CON = { prof: true, mod: 40 };
      const state = createTestCombatState([zombieInit]);
      const zombie = state.require("zombie");

      // Takes 15 slashing damage (lethal)
      dealDamage(state, "zombie", 15, { damageType: "slashing", isAttack: true });
      expect(zombie.hpCurrent).toBe(1);

      // Radiant damage bypasses Undead Fortitude
      dealDamage(state, "zombie", 10, { damageType: "radiant", isAttack: true });
      expect(zombie.hpCurrent).toBe(0);
    });
  });

  describe("Regeneration (Регенерация)", () => {
    it("restores HP on start of turn unless suppressed by fire/acid", () => {
      const state = createTestCombatState([
        createMockCombatant({
          id: "troll",
          name: "Тролль",
          hpCurrent: 40,
          hpMax: 84,
          monsterTraits: [{ name: "Регенерация", description: "Тролль восстанавливает 10 хитов в начале своего хода." }],
        }),
      ]);
      const troll = state.require("troll");

      // Turn start -> heals 10 HP
      startTurn(state);
      expect(troll.hpCurrent).toBe(50);

      // Takes fire damage -> regeneration suppressed
      dealDamage(state, "troll", 15, { damageType: "fire", isAttack: true });
      expect(troll.hpCurrent).toBe(35);
      expect(troll.suppressRegenerationUntilRound).toBe(2);

      // Next startTurn in round 1 -> regeneration is suppressed
      startTurn(state);
      expect(troll.hpCurrent).toBe(35); // no heal
    });
  });
});
