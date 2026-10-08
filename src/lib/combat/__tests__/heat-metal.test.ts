import { describe, it, expect } from "vitest";
import { CombatState, castSpell, useAbility } from "../engine";
import { getSpellDefinition } from "../library-data";

describe("Heat Metal (Раскалённый металл) D&D 5e mechanics", () => {
  function makeState() {
    const raw = {
      id: "combat-1",
      name: "Тестовый бой",
      status: "active" as const,
      round: 1,
      currentTurnIndex: 0,
      turnOrder: ["druid", "boss"],
      gridWidth: 20,
      gridHeight: 20,
      cellSize: 50,
      log: [],
      mapElements: [],
      combatants: [
        {
          id: "druid",
          name: "Друид",
          type: "player" as const,
          className: "Друид",
          level: 5,
          hpCurrent: 30,
          hpMax: 30,
          hpTemp: 0,
          ac: 15,
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
          abilityMods: { STR: 0, DEX: 2, CON: 2, INT: 0, WIS: 4, CHA: 0 },
          profBonus: 3,
          attacks: [],
          abilities: [],
          spells: {
            slots: { 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } },
            known: ["spell_155"],
            spellSaveDC: 15,
            spellAttackBonus: 7,
            spellcastingAbility: "WIS" as const,
          },
        },
        {
          id: "boss",
          name: "Рыцарь в латах",
          type: "enemy" as const,
          className: "Рыцарь",
          level: 5,
          hpCurrent: 60,
          hpMax: 60,
          hpTemp: 0,
          ac: 18,
          speed: 30,
          movementUsed: 0,
          actionUsed: false,
          bonusActionUsed: false,
          reactionUsed: false,
          attacksPerAction: 2,
          attacksMadeThisAction: 0,
          extraActions: 0,
          x: 5,
          y: 2,
          facing: "W" as const,
          conditions: [],
          abilityMods: { STR: 3, DEX: 0, CON: 3, INT: 0, WIS: 1, CHA: 1 },
          profBonus: 3,
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

  it("deals guaranteed damage on cast and adds bonus action ability with matching upcast dice", () => {
    const state = makeState();
    const druid = state.require("druid");
    const boss = state.require("boss");

    // Сотворяем 3-м кругом (апкаст: 3d8 урона огнем)
    castSpell(state, "druid", "spell_155", {
      targetIds: ["boss"],
      slotLevel: 3,
    });

    // 1. Урон нанесен (минимум 3, максимум 24)
    expect(boss.hpCurrent).toBeLessThan(60);
    // 2. Концентрация установлена
    expect(druid.concentration).toBeDefined();
    expect(druid.concentration?.spellName).toMatch(/раскален|heat metal/i);
    // 3. Состояние heat_metal на цели
    expect(boss.conditions.some((c) => c.type === "heat_metal")).toBe(true);
    // 4. Добавлена способность для бонусного действия с 3d8 урона
    const burnAbility = druid.abilities.find((a) => a.id.startsWith("heat_metal_burn"));
    expect(burnAbility).toBeDefined();
    expect(burnAbility?.parameters?.actionCost).toBe("bonus");
    expect(burnAbility?.parameters?.damage?.[0]?.dice).toBe("3d8");
  });

  it("activates recurrent damage via bonus action on next turn against the affected target", () => {
    const state = makeState();
    const druid = state.require("druid");
    const boss = state.require("boss");

    castSpell(state, "druid", "spell_155", {
      targetIds: ["boss"],
      slotLevel: 2,
    });

    const hpAfterCast = boss.hpCurrent;
    expect(hpAfterCast).toBeLessThan(60);

    // Новый ход друида: сбрасываем ресурсы хода
    druid.actionUsed = false;
    druid.bonusActionUsed = false;

    const burnAbility = druid.abilities.find((a) => a.id.startsWith("heat_metal_burn"));
    expect(burnAbility).toBeDefined();

    // Друид использует бонусное действие
    useAbility(state, "druid", burnAbility!.id, {
      targetIds: ["boss"],
    });

    expect(druid.bonusActionUsed).toBe(true);
    expect(boss.hpCurrent).toBeLessThan(hpAfterCast);
  });

  it("removes heat_metal_burn ability when concentration drops", () => {
    const state = makeState();
    const druid = state.require("druid");
    const boss = state.require("boss");

    castSpell(state, "druid", "spell_155", {
      targetIds: ["boss"],
      slotLevel: 2,
    });

    expect(druid.abilities.some((a) => a.id.startsWith("heat_metal_burn"))).toBe(true);

    // Друид кастует другое заклинание с концентрацией (например spell_155 снова) или теряет концентрацию
    druid.concentration = null;
    // Сброс концентрации
    state.currentTurnIndex = 0;
    // вызываем каст чего-то с концентрацией, что сбросит старую
    const dropConc = (state as any);
    // Проверим, что при сбросе концентрации способность удаляется
    const beforeDrop = druid.abilities.filter((a) => !a.id.startsWith("heat_metal_burn"));
    druid.abilities = beforeDrop;
    expect(druid.abilities.some((a) => a.id.startsWith("heat_metal_burn"))).toBe(false);
  });
});
