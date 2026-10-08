import { describe, it, expect } from "vitest";
import { CombatState, castSpell, performAttack } from "../engine";
import { resolveAttack, computeAttackAdvantage } from "../rules";

describe("D&D 5e Invisibility vs Greater Invisibility", () => {
  function makeState() {
    const raw = {
      id: "combat-invis-1",
      name: "Тестовый бой: Невидимость",
      status: "active" as const,
      round: 1,
      currentTurnIndex: 0,
      turnOrder: ["mage", "target"],
      gridWidth: 20,
      gridHeight: 20,
      cellSize: 50,
      log: [],
      mapElements: [],
      combatants: [
        {
          id: "mage",
          name: "Маг",
          type: "player" as const,
          className: "Волшебник",
          level: 7,
          hpCurrent: 40,
          hpMax: 40,
          hpTemp: 0,
          ac: 12,
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
          abilityMods: { STR: 0, DEX: 2, CON: 2, INT: 4, WIS: 1, CHA: 0 },
          profBonus: 3,
          attacks: [
            {
              id: "dagger",
              name: "Кинжал",
              kind: "melee" as const,
              range: { normal: 5 },
              attackBonus: 5,
              damage: [{ dice: "1d4", mod: 2, type: "piercing" }],
              actionCost: "action" as const,
            },
          ],
          abilities: [],
          spells: {
            slots: { 2: { max: 3, used: 0 }, 4: { max: 2, used: 0 } },
            known: ["spell_142"],
            spellSaveDC: 15,
            spellAttackBonus: 7,
            spellcastingAbility: "INT" as const,
          },
        },
        {
          id: "target",
          name: "Мишень",
          type: "enemy" as const,
          className: "Манекен",
          level: 1,
          hpCurrent: 50,
          hpMax: 50,
          hpTemp: 0,
          ac: 10,
          speed: 0,
          movementUsed: 0,
          actionUsed: false,
          bonusActionUsed: false,
          reactionUsed: false,
          attacksPerAction: 1,
          attacksMadeThisAction: 0,
          extraActions: 0,
          x: 3,
          y: 2,
          facing: "W" as const,
          conditions: [],
          abilityMods: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
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

  it("drops regular invisibility upon making an attack", () => {
    const state = makeState();
    const mage = state.require("mage");

    // Даем магу обычную невидимость
    mage.conditions.push({ type: "invisible" });
    expect(mage.conditions.some((c) => c.type === "invisible")).toBe(true);

    // Маг атакует кинжалом
    performAttack(state, "mage", "target", "dagger");

    // Обычная невидимость должна спасть
    expect(mage.conditions.some((c) => c.type === "invisible")).toBe(false);
  });

  it("does NOT drop Greater Invisibility upon attacking or casting spells", () => {
    const state = makeState();
    const mage = state.require("mage");

    // Маг кастует Высшую невидимость (spell_142) на себя
    castSpell(state, "mage", "spell_142", {
      targetIds: ["mage"],
      slotLevel: 4,
    });

    // Маг находится под эффектом Высшей невидимости
    const hasGreaterInvis = mage.conditions.some(
      (c) => c.type === "greater_invisibility" || (c.type === "invisible" && (c as any).greater)
    );
    expect(hasGreaterInvis).toBe(true);

    // Новый ход: маг атакует кинжалом
    mage.actionUsed = false;
    performAttack(state, "mage", "target", "dagger");

    // Высшая невидимость НЕ должна была спасть после атаки!
    const stillGreaterInvis = mage.conditions.some(
      (c) => c.type === "greater_invisibility" || (c.type === "invisible" && (c as any).greater)
    );
    expect(stillGreaterInvis).toBe(true);
  });

  it("grants advantage on attacks and imposes disadvantage on incoming attacks", () => {
    const state = makeState();
    const mage = state.require("mage");
    const target = state.require("target");

    mage.conditions.push({ type: "greater_invisibility" });

    // Атака мага по мишени должна иметь преимущество
    const mageAdv = computeAttackAdvantage(mage, target, mage.attacks[0], {}, {
      allCombatants: state.combatants,
    });
    expect(mageAdv.advantage).toBe(true);

    // Атака мишени по невидимому магу должна иметь помеху
    const targetAdv = computeAttackAdvantage(target, mage, {
      id: "slam",
      name: "Удар",
      kind: "melee",
      range: { normal: 5 },
      attackBonus: 0,
      damage: [{ dice: "1d4", mod: 0, type: "bludgeoning" }],
      actionCost: "action",
    }, {}, {
      allCombatants: state.combatants,
    });
    expect(targetAdv.disadvantage).toBe(true);

    const targetAtk = resolveAttack(target, mage, {
      id: "slam",
      name: "Удар",
      kind: "melee",
      range: { normal: 5 },
      attackBonus: 0,
      damage: [{ dice: "1d4", mod: 0, type: "bludgeoning" }],
      actionCost: "action",
    }, {
      allCombatants: state.combatants,
    });
    expect(targetAtk.hasDisadvantage).toBe(true);
  });

  it("drops Greater Invisibility when concentration is lost or switched", () => {
    const state = makeState();
    const mage = state.require("mage");

    castSpell(state, "mage", "spell_142", {
      targetIds: ["mage"],
      slotLevel: 4,
    });
    expect(mage.conditions.some((c) => c.type === "greater_invisibility")).toBe(true);

    // Добавляем заклинателю другое концентрационное заклинание (или кастуем заново)
    mage.actionUsed = false;
    castSpell(state, "mage", "spell_142", {
      targetIds: ["mage"],
      slotLevel: 4,
    });

    // Предыдущая концентрация заменилась новой
    const greaterInvisCount = mage.conditions.filter((c) => c.type === "greater_invisibility").length;
    expect(greaterInvisCount).toBe(1);
  });
});
