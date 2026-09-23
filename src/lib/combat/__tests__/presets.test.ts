import { describe, it, expect } from "vitest";
import { DEFAULT_PRESETS, createCombatantFromPreset, createPresetFromCombatant } from "../preset-data";
import type { Combatant } from "../types";

describe("Character Presets & Bestiary", () => {
  it("DEFAULT_PRESETS contains authentic campaign heroes and monsters", () => {
    expect(DEFAULT_PRESETS.length).toBeGreaterThanOrEqual(10);

    const heroes = DEFAULT_PRESETS.filter((p) => p.type === "player");
    const silas = heroes.find((h) => h.name.includes("Силас"));
    const nyx = heroes.find((h) => h.name.includes("Никс"));
    const torbor = heroes.find((h) => h.name.includes("Торбор"));
    const varis = heroes.find((h) => h.name.includes("Варис"));

    expect(silas).toBeDefined();
    expect(silas?.className).toBe("Следопыт");
    expect(silas?.hpMax).toBe(42);
    expect(silas?.ac).toBe(17);
    expect(silas?.attacks.some((a) => a.name.includes("Ручной арбалет"))).toBe(true);

    expect(nyx).toBeDefined();
    expect(nyx?.className).toBe("Плут (Убийца)");
    expect(nyx?.hpMax).toBe(29);
    expect(nyx?.ac).toBe(17);
    expect(nyx?.attacks.some((a) => a.name.includes("Клинок Лунной Тени"))).toBe(true);

    expect(torbor).toBeDefined();
    expect(torbor?.className).toBe("Друид (Круг Луны)");
    expect(torbor?.hpMax).toBe(36);
    expect(torbor?.ac).toBe(19);
    expect(torbor?.attacks.some((a) => a.name.includes("Чёрный Вяз"))).toBe(true);

    expect(varis).toBeDefined();
    expect(varis?.className).toBe("Воин");
    expect(varis?.hpMax).toBe(38);

    const monsters = DEFAULT_PRESETS.filter((p) => p.type === "enemy");
    expect(monsters.some((m) => m.name.includes("Пепельный Глубинный Жрец"))).toBe(true);
    expect(monsters.some((m) => m.name.includes("Гоблин"))).toBe(true);
    expect(monsters.some((m) => m.name.includes("Орк-рубака"))).toBe(true);
    expect(monsters.some((m) => m.name.includes("Молодой красный дракон"))).toBe(true);
  });

  it("createCombatantFromPreset accurately instantiates a Combatant", () => {
    const goblinPreset = DEFAULT_PRESETS.find((p) => p.name === "Гоблин")!;
    expect(goblinPreset).toBeDefined();

    const combatant = createCombatantFromPreset(goblinPreset, { x: 5, y: 7 }, "Гоблин 1");
    expect(combatant.name).toBe("Гоблин 1");
    expect(combatant.hpCurrent).toBe(7);
    expect(combatant.hpMax).toBe(7);
    expect(combatant.ac).toBe(15);
    expect(combatant.x).toBe(5);
    expect(combatant.y).toBe(7);
    expect(combatant.facing).toBe("W");
    expect(combatant.attacks.length).toBe(2);
    expect(combatant.abilities.some((a) => a.name.includes("Проворное бегство"))).toBe(true);
  });

  it("createPresetFromCombatant saves a custom combatant into a template", () => {
    const mockCombatant: Combatant = {
      id: "c-custom-hero",
      name: "Арагорн",
      type: "player",
      color: "#10b981",
      x: 2,
      y: 3,
      hpCurrent: 45,
      hpMax: 45,
      hpTemp: 0,
      ac: 17,
      speed: 30,
      initiative: 14,
      initiativeTiebreak: 0,
      dexMod: 2,
      conditions: [],
      isHidden: false,
      hasActed: false,
      className: "Следопыт",
      level: 5,
      size: "medium",
      movementUsed: 0,
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      attacksPerAction: 2,
      attacksMadeThisAction: 0,
      extraActions: 0,
      hotbar: [],
      attacks: [
        {
          id: "anduril",
          name: "Андуриль",
          kind: "melee",
          range: { normal: 5 },
          attackBonus: 7,
          damage: [{ dice: "1d8", mod: 4, type: "slashing" }],
          actionCost: "action",
        },
      ],
      spells: { slots: { 1: { max: 4, used: 0 } }, known: ["Метка охотника"] },
      abilities: [],
      concentration: null,
      wildShape: null,
      saves: { STR: { prof: true, mod: 6 } },
      abilityMods: { STR: 3, DEX: 2, CON: 2, INT: 1, WIS: 2, CHA: 1 },
      profBonus: 3,
      isAIControlled: false,
    };

    const preset = createPresetFromCombatant(mockCombatant, "Арагорн (Шаблон)");
    expect(preset.name).toBe("Арагорн (Шаблон)");
    expect(preset.hpMax).toBe(45);
    expect(preset.ac).toBe(17);
    expect(preset.attacksPerAction).toBe(2);
    expect(preset.attacks[0].name).toBe("Андуриль");
    expect(preset.spells.known).toContain("Метка охотника");
    expect(preset.isTemplate).toBe(false);
  });
});
