import { describe, it, expect, vi } from "vitest";
import { CombatState, moveCombatant } from "../engine";
import { decideBotTurn } from "../bot";
import type { Combatant, Attack } from "../types";

function createMockCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: overrides.id || "c-" + Math.random().toString(36).slice(2, 7),
    name: overrides.name || "Test Combatant",
    type: overrides.type || "player",
    color: overrides.color || "#3b82f6",
    x: overrides.x ?? 2,
    y: overrides.y ?? 2,
    facing: overrides.facing || "E",
    hpCurrent: overrides.hpCurrent ?? 20,
    hpMax: overrides.hpMax ?? 20,
    hpTemp: 0,
    ac: overrides.ac ?? 12,
    speed: overrides.speed ?? 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 2,
    conditions: overrides.conditions ? [...overrides.conditions] : [],
    isHidden: false,
    hasActed: false,
    className: overrides.className || "Fighter",
    level: 3,
    size: "medium",
    movementUsed: overrides.movementUsed ?? 0,
    actionUsed: overrides.actionUsed ?? false,
    bonusActionUsed: overrides.bonusActionUsed ?? false,
    reactionUsed: overrides.reactionUsed ?? false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: overrides.attacks ? [...overrides.attacks] : [],
    spells: overrides.spells || { slots: {}, known: [], prepared: [], spellSaveDC: 12, spellAttackBonus: 4 },
    abilities: overrides.abilities ? [...overrides.abilities] : [],
    concentration: null,
    wildShape: null,
    saves: {
      STR: { prof: true, mod: 3 },
      DEX: { prof: false, mod: 2 },
      CON: { prof: true, mod: 2 },
      INT: { prof: false, mod: 0 },
      WIS: { prof: false, mod: 1 },
      CHA: { prof: false, mod: 0 },
    },
    abilityMods: { STR: 3, DEX: 2, CON: 2, INT: 0, WIS: 1, CHA: 0 },
    profBonus: 2,
    isAIControlled: overrides.isAIControlled ?? false,
    damageResistances: [],
    damageImmunities: [],
    damageVulnerabilities: [],
    conditionImmunities: [],
    monsterTraits: overrides.monsterTraits ? [...overrides.monsterTraits] : [],
    multiattack: null,
    rechargeAbilities: [],
    tacticalRole: overrides.tacticalRole,
  };
}

const mockMeleeAttack: Attack = {
  id: "atk-sword",
  name: "Длинный меч",
  attackBonus: 10,
  damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
  kind: "melee",
  range: { normal: 5 },
  actionCost: "action",
};

const mockRangedAttack: Attack = {
  id: "atk-bow",
  name: "Длинный лук",
  attackBonus: 6,
  damage: [{ dice: "1d8", mod: 3, type: "piercing" }],
  kind: "ranged",
  range: { normal: 150, long: 600 },
  actionCost: "action",
};

function createTestCombatState(combatants: Combatant[]): CombatState {
  return new CombatState({
    id: "test-combat",
    name: "Opportunity Attack Test",
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

describe("Opportunity Attacks & Reactions Enhancement", () => {
  it("Test 1: Moving out of reach of a melee enemy provokes opportunity attack; reaction is consumed (reactionUsed: true)", () => {
    const mover = createMockCombatant({
      id: "mover",
      name: "Беглец",
      type: "player",
      x: 2,
      y: 2,
      hpCurrent: 30,
      hpMax: 30,
    });
    const enemy = createMockCombatant({
      id: "enemy",
      name: "Стражник",
      type: "enemy",
      x: 3,
      y: 2,
      hpCurrent: 30,
      hpMax: 30,
      reactionUsed: false,
      attacks: [mockMeleeAttack],
    });

    const state = createTestCombatState([mover, enemy]);

    // Move mover from (2,2) to (2,4) - out of reach of enemy at (3,2)
    const result = moveCombatant(state, mover.id, { x: 2, y: 4 }, { skipTurnCheck: true });

    expect(result.opportunityAttacks.length).toBeGreaterThanOrEqual(1);
    expect(result.opportunityAttacks[0].attackerId).toBe("enemy");
    const updatedEnemy = state.require("enemy");
    expect(updatedEnemy.reactionUsed).toBe(true);

    const updatedMover = state.require("mover");
    expect(updatedMover.x).toBe(2);
    expect(updatedMover.y).toBe(4);
  });

  it("Test 2: Moving with condition disengaging does NOT provoke opportunity attack", () => {
    const mover = createMockCombatant({
      id: "mover",
      name: "Плут в отходе",
      type: "player",
      x: 2,
      y: 2,
      hpCurrent: 30,
      hpMax: 30,
      conditions: [{ type: "disengaging", duration: 1 }],
    });
    const enemy = createMockCombatant({
      id: "enemy",
      name: "Стражник",
      type: "enemy",
      x: 3,
      y: 2,
      reactionUsed: false,
      attacks: [mockMeleeAttack],
    });

    const state = createTestCombatState([mover, enemy]);

    const result = moveCombatant(state, mover.id, { x: 2, y: 4 }, { skipTurnCheck: true });

    expect(result.opportunityAttacks.length).toBe(0);
    const updatedEnemy = state.require("enemy");
    expect(updatedEnemy.reactionUsed).toBe(false);

    const updatedMover = state.require("mover");
    expect(updatedMover.x).toBe(2);
    expect(updatedMover.y).toBe(4);
  });

  it("Test 3: If opportunity attack knocks mover to 0 HP, mover does not reach target cell and movement stops", () => {
    const mover = createMockCombatant({
      id: "mover",
      name: "Слабый беглец",
      type: "player",
      x: 2,
      y: 2,
      hpCurrent: 2,
      hpMax: 20,
      ac: 1, // Guaranteed hit
    });
    const deadlyAttack: Attack = {
      ...mockMeleeAttack,
      attackBonus: 30,
      damage: [{ dice: "", mod: 15, type: "slashing" }],
    };
    const enemy = createMockCombatant({
      id: "enemy",
      name: "Грозный стражник",
      type: "enemy",
      x: 3,
      y: 2,
      reactionUsed: false,
      attacks: [deadlyAttack],
    });

    const state = createTestCombatState([mover, enemy]);

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      moveCombatant(state, mover.id, { x: 2, y: 4 }, { skipTurnCheck: true });
    } finally {
      randomSpy.mockRestore();
    }

    const updatedMover = state.require("mover");
    expect(updatedMover.hpCurrent).toBeLessThanOrEqual(0);
    // Mover must NOT complete movement to (2, 4)
    expect(updatedMover.x).toBe(2);
    expect(updatedMover.y).toBe(2);
    // Mover must fall prone
    expect(updatedMover.conditions.some((c) => c.type === "prone")).toBe(true);

    // Interruption log message
    const log = state.log.find((l) =>
      l.text.includes("падает без сознания от провоцированной атаки и прерывает движение!")
    );
    expect(log).toBeDefined();

    const updatedEnemy = state.require("enemy");
    expect(updatedEnemy.reactionUsed).toBe(true);
  });

  it("Test 4: Enemy who already used reaction (reactionUsed: true) or is incapacitated/stunned does NOT provoke", () => {
    // Subcase 4a: reactionUsed is true
    const mover = createMockCombatant({
      id: "mover",
      name: "Беглец",
      type: "player",
      x: 2,
      y: 2,
      hpCurrent: 30,
    });
    const enemyReactionUsed = createMockCombatant({
      id: "enemy1",
      name: "Уставший враг",
      type: "enemy",
      x: 3,
      y: 2,
      reactionUsed: true,
      attacks: [mockMeleeAttack],
    });

    const state1 = createTestCombatState([mover, enemyReactionUsed]);
    const res1 = moveCombatant(state1, mover.id, { x: 2, y: 4 }, { skipTurnCheck: true });
    expect(res1.opportunityAttacks.length).toBe(0);

    // Subcase 4b: enemy is stunned
    const mover2 = createMockCombatant({
      id: "mover2",
      name: "Беглец 2",
      type: "player",
      x: 2,
      y: 2,
      hpCurrent: 30,
    });
    const enemyStunned = createMockCombatant({
      id: "enemy2",
      name: "Оглушённый враг",
      type: "enemy",
      x: 3,
      y: 2,
      reactionUsed: false,
      conditions: [{ type: "stunned" }],
      attacks: [mockMeleeAttack],
    });

    const state2 = createTestCombatState([mover2, enemyStunned]);
    const res2 = moveCombatant(state2, mover2.id, { x: 2, y: 4 }, { skipTurnCheck: true });
    expect(res2.opportunityAttacks.length).toBe(0);
    expect(state2.require("enemy2").reactionUsed).toBe(false);
  });

  it("Test 5: Bot with low HP disengages before retreating from melee enemy", () => {
    // Enemy caster / ranged fighter with low HP in melee reach of player
    const bot = createMockCombatant({
      id: "bot-archer",
      name: "Гоблин-Лучник",
      type: "enemy",
      x: 2,
      y: 2,
      hpCurrent: 8,
      hpMax: 20, // 8/20 = 40% <= 50% (low HP)
      actionUsed: false,
      isAIControlled: true,
      attacks: [mockRangedAttack],
      tacticalRole: "backline",
    });
    const player = createMockCombatant({
      id: "player",
      name: "Паладин",
      type: "player",
      x: 3,
      y: 2, // Melee adjacent (5 ft)
      hpCurrent: 30,
      hpMax: 30,
      reactionUsed: false,
      attacks: [mockMeleeAttack],
    });

    const state = createTestCombatState([bot, player]);

    const turnResult = decideBotTurn(state, bot.id);

    const updatedBot = state.require("bot-archer");
    const updatedPlayer = state.require("player");

    // Bot used Action to Disengage
    expect(updatedBot.actionUsed).toBe(true);

    // Bot moved away safely (distance > 5 ft)
    const distToPlayer = Math.max(Math.abs(updatedBot.x - updatedPlayer.x), Math.abs(updatedBot.y - updatedPlayer.y)) * 5;
    expect(distToPlayer).toBeGreaterThan(5);

    // Player reaction NOT used (no opportunity attack provoked)
    expect(updatedPlayer.reactionUsed).toBe(false);

    // Disengage log or step is present
    const hasDisengageLog = state.log.some((l) =>
      l.text.includes("осторожно отступает (Отход), избегая провоцированных атак")
    );
    const hasDisengageStep = turnResult.steps.some((s) =>
      s.text.includes("осторожно отступает (Отход), избегая провоцированных атак")
    );
    expect(hasDisengageLog || hasDisengageStep).toBe(true);
  });

  it("Test 6 (Sentinel): Attacker with Sentinel trait stops mover's speed and halts movement", () => {
    const mover = createMockCombatant({
      id: "mover",
      name: "Бегущий рыцарь",
      type: "player",
      x: 2,
      y: 2,
      hpCurrent: 50,
      hpMax: 50,
      speed: 30,
    });
    const sentinelAttack: Attack = {
      ...mockMeleeAttack,
      attackBonus: 30, // Guaranteed hit
      damage: [{ dice: "", mod: 5, type: "slashing" }],
    };
    const sentinelEnemy = createMockCombatant({
      id: "sentinel",
      name: "Страж Ворот",
      type: "enemy",
      x: 3,
      y: 2,
      reactionUsed: false,
      attacks: [sentinelAttack],
      monsterTraits: [{ name: "Страж (Sentinel)", description: "Попадание провоцированной атакой снижает скорость цели до 0." }],
    });

    const state = createTestCombatState([mover, sentinelEnemy]);

    moveCombatant(state, mover.id, { x: 2, y: 4 }, { skipTurnCheck: true });

    const updatedMover = state.require("mover");
    expect(updatedMover.hpCurrent).toBe(45);
    // Mover halted at start position (2, 2)
    expect(updatedMover.x).toBe(2);
    expect(updatedMover.y).toBe(2);
    // Movement used set to effective speed (remaining movement = 0)
    expect(updatedMover.movementUsed).toBe(30);

    const updatedSentinel = state.require("sentinel");
    expect(updatedSentinel.reactionUsed).toBe(true);
  });
});
