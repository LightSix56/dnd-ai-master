import { describe, it, expect } from "vitest";
import { CombatState, castSpell, useAbility, endTurn, applyEffect } from "../engine";

describe("Escape Action (Освобождение из пут/паутины) D&D 5e mechanics", () => {
  function makeState() {
    const raw = {
      id: "combat-escape-1",
      name: "Тестовый бой: Освобождение",
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
            slots: { 1: { max: 4, used: 0 } },
            known: ["spell_99"],
            spellSaveDC: 15,
            spellAttackBonus: 7,
            spellcastingAbility: "WIS" as const,
          },
        },
        {
          id: "enemy",
          name: "Орк",
          type: "enemy" as const,
          className: "Воин",
          level: 3,
          hpCurrent: 30,
          hpMax: 30,
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
          x: 5,
          y: 5,
          facing: "W" as const,
          conditions: [],
          abilityMods: { STR: 4, DEX: 1, CON: 2, INT: -1, WIS: 0, CHA: -1 },
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

  it("does not automatically grant free end-of-turn save to remove restrained from Web/Entangle", () => {
    const state = makeState();
    const enemy = state.require("enemy");

    // Накладываем restrained от Entangle с DC 15
    applyEffect(state, "enemy", {
      condition: "restrained",
      saveType: "STR",
      saveDC: 15,
      concentration: true,
    }, "caster");

    expect(enemy.conditions.some((c) => c.type === "restrained")).toBe(true);

    // Завершаем ход орка (текущий ход - врага)
    state.currentTurnIndex = 1;
    endTurn(state);

    // В 5e орк НЕ должен был получить бесплатный автоматический сброс в конце хода
    expect(enemy.conditions.some((c) => c.type === "restrained")).toBe(true);
  });

  it("allows spending an Action to attempt escape via Strength check against spell DC", () => {
    const state = makeState();
    const enemy = state.require("enemy");

    // Накладываем restrained с высоким DC (30), чтобы проверить провал
    applyEffect(state, "enemy", {
      condition: "restrained",
      saveType: "STR",
      saveDC: 30,
      concentration: true,
    }, "caster");

    state.currentTurnIndex = 1; // Ход орка
    enemy.actionUsed = false;

    // Способность escape_restrained должна быть доступна
    const escapeAbility = enemy.abilities.find((a) => a.id === "escape_restrained");
    expect(escapeAbility).toBeDefined();
    expect(escapeAbility?.parameters?.actionCost).toBe("action");

    // Орк пытается освободиться и терпит неудачу из-за DC 30
    useAbility(state, "enemy", "escape_restrained");

    expect(enemy.actionUsed).toBe(true);
    // Остался restrained
    expect(enemy.conditions.some((c) => c.type === "restrained")).toBe(true);

    // Новый ход: сбрасываем actionUsed и понижаем DC до 1 (чтобы гарантированно преуспеть)
    enemy.actionUsed = false;
    const cond = enemy.conditions.find((c) => c.type === "restrained");
    cond!.saveDC = 1;

    useAbility(state, "enemy", "escape_restrained");

    expect(enemy.actionUsed).toBe(true);
    // Теперь свободен!
    expect(enemy.conditions.some((c) => c.type === "restrained")).toBe(false);
    // Способность освобождения удалена, так как цель больше не опутана
    expect(enemy.abilities.some((a) => a.id === "escape_restrained")).toBe(false);
  });
});
