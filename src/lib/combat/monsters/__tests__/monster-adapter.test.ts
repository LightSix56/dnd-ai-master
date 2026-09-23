import { describe, it, expect } from "vitest";
import { monsterDefinitionToCombatant } from "../monster-adapter";
import type { MonsterDefinition } from "../types";

describe("Monster Adapter (Task 2)", () => {
  const mockWolf: MonsterDefinition = {
    id: "2",
    slug: "2-wolf",
    name: "Волк",
    nameEn: "Wolf",
    size: "medium",
    type: "beast",
    subtype: null,
    alignment: "без мировоззрения",
    challengeRating: 0.25,
    xp: 50,
    source: "Player's Handbook",
    isNamed: false,
    armorClass: { value: 13, type: "природный доспех" },
    hitPoints: { average: 11, hitDice: "2d8 + 2" },
    speed: { walk: 40 },
    abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    savingThrows: {},
    skills: { perception: 3, stealth: 4 },
    damageResistances: [],
    damageImmunities: [],
    damageVulnerabilities: [],
    conditionImmunities: [],
    senses: { passivePerception: 13 },
    languages: [],
    traits: [
      { name: "Острый слух и тонкий нюх", description: "Преимущество на восприятие" },
      { name: "Тактика стаи", description: "Преимущество на атаку если союзник в 5 фт" },
    ],
    actions: [
      {
        name: "Укус",
        type: "melee_attack",
        description: "Рукопашная атака оружием: +4 к попаданию, досягаемость 5 футов",
        attackBonus: 4,
        reachFt: 5,
        damage: [{ dice: "2d4", mod: 2, type: "piercing" }],
        save: { ability: "STR", dc: 11, halfOnSuccess: false },
      },
    ],
    reactions: [],
    legendaryActions: null,
    lairActions: [],
    spellcasting: null,
  };

  const mockDragon: MonsterDefinition = {
    id: "108",
    slug: "108-adult-red-dragon",
    name: "Взрослый красный дракон",
    nameEn: "Adult Red Dragon",
    size: "huge",
    type: "dragon",
    subtype: null,
    alignment: "хаотично-злой",
    challengeRating: 17,
    xp: 18000,
    source: "Monster Manual",
    isNamed: false,
    armorClass: { value: 19, type: "природный доспех" },
    hitPoints: { average: 256, hitDice: "19d12 + 133" },
    speed: { walk: 40, fly: 80 },
    abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
    savingThrows: { dex: 6, con: 13, wis: 7, cha: 11 },
    skills: { perception: 13, stealth: 6 },
    damageResistances: [],
    damageImmunities: ["огонь"],
    damageVulnerabilities: [],
    conditionImmunities: ["испуг", "паралич"],
    senses: { blindsight: 60, darkvision: 120, passivePerception: 23 },
    languages: ["Общий", "Драконий"],
    traits: [
      {
        name: "Легендарное сопротивление (3/день)",
        description: "Если дракон проваливает спасбросок, он может вместо этого сделать его успешным.",
      },
    ],
    actions: [
      {
        name: "Мультиатака",
        type: "special",
        description: "Дракон совершает три атаки: одну укусом и две когтями.",
      },
      {
        name: "Укус",
        type: "melee_attack",
        description: "Рукопашная атака оружием: +14 к попаданию, досягаемость 10 фт",
        attackBonus: 14,
        reachFt: 10,
        damage: [{ dice: "2d10", mod: 8, type: "piercing" }],
      },
      {
        name: "Коготь",
        type: "melee_attack",
        description: "Рукопашная атака оружием: +14 к попаданию, досягаемость 5 фт",
        attackBonus: 14,
        reachFt: 5,
        damage: [{ dice: "2d6", mod: 8, type: "slashing" }],
      },
      {
        name: "Огненное дыхание (перезарядка 5–6)",
        type: "breath",
        description: "Конус 60 фт",
        recharge: "5-6",
        aoe: { shape: "cone", sizeFt: 60 },
        damage: [{ dice: "18d6", mod: 0, type: "fire" }],
        save: { ability: "DEX", dc: 21, halfOnSuccess: true },
      },
    ],
    reactions: [],
    legendaryActions: {
      actionsPerRound: 3,
      options: [
        { name: "Обнаружение", cost: 1, description: "Проверка восприятия" },
        { name: "Атака хвостом", cost: 1, description: "Удар хвостом 15 фт" },
        { name: "Атака крыльями (стоит 2 действия)", cost: 2, description: "Удар крыльями 10 фт" },
      ],
    },
    lairActions: [],
    spellcasting: null,
  };

  it("correctly converts a simple beast (Wolf) into a Combatant", () => {
    const combatant = monsterDefinitionToCombatant(mockWolf, { role: "flanker" });

    expect(combatant.name).toBe("Волк");
    expect(combatant.hpMax).toBe(11);
    expect(combatant.hpCurrent).toBe(11);
    expect(combatant.ac).toBe(13);
    expect(combatant.speed).toBe(40);
    expect(combatant.abilityMods.STR).toBe(1);
    expect(combatant.abilityMods.DEX).toBe(2);
    expect(combatant.dexMod).toBe(2);
    expect(combatant.tacticalRole).toBe("flanker");
    expect(combatant.attacks.length).toBe(1);
    expect(combatant.attacks[0].name).toBe("Укус");
    expect(combatant.attacks[0].attackBonus).toBe(4);
    expect(combatant.attacks[0].damage[0].dice).toBe("2d4");
    expect(combatant.monsterTraits?.some((t) => t.name === "Тактика стаи")).toBe(true);
    expect(combatant.legendaryState).toBeNull();
  });

  it("correctly converts a complex boss (Adult Red Dragon) with Multiattack, Legendary Actions & Recharge", () => {
    const combatant = monsterDefinitionToCombatant(mockDragon, { role: "boss" });

    expect(combatant.name).toBe("Взрослый красный дракон");
    expect(combatant.ac).toBe(19);
    expect(combatant.hpMax).toBe(256);
    expect(combatant.damageImmunities).toContain("огонь");
    expect(combatant.conditionImmunities).toContain("испуг");
    expect(combatant.conditionImmunities).toContain("паралич");

    // Saves
    expect(combatant.saves.CON.prof).toBe(true);
    expect(combatant.saves.CON.mod).toBe(13);

    // Multiattack: 1 bite + 2 claws
    expect(combatant.multiattack).toBeDefined();
    expect(combatant.multiattack?.attacks.length).toBe(2);
    const biteOption = combatant.multiattack?.attacks.find((a) => a.attackId.includes("укус"));
    const clawOption = combatant.multiattack?.attacks.find((a) => a.attackId.includes("коготь"));
    expect(biteOption?.count).toBe(1);
    expect(clawOption?.count).toBe(2);
    expect(combatant.attacksPerAction).toBe(3);

    // Recharge ability (Breath)
    expect(combatant.rechargeAbilities?.length).toBe(1);
    expect(combatant.rechargeAbilities?.[0].recharge).toBe("5-6");
    expect(combatant.rechargeAbilities?.[0].isCharged).toBe(true);

    // Legendary Actions and Resistance
    expect(combatant.legendaryState).toBeDefined();
    expect(combatant.legendaryState?.actionsPerRound).toBe(3);
    expect(combatant.legendaryState?.options.length).toBe(3);
    expect(combatant.legendaryState?.legendaryResistancesMax).toBe(3);
    expect(combatant.legendaryState?.legendaryResistancesRemaining).toBe(3);
  });

  it("loads and adapts a real monster JSON from disk compendium", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.resolve(process.cwd(), "src/data/compendium/monsters/beast/2-wolf.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const wolfData = JSON.parse(raw) as MonsterDefinition;

    const combatant = monsterDefinitionToCombatant(wolfData);
    expect(combatant.name).toBe("Волк");
    expect(combatant.hpMax).toBe(11);
    expect(combatant.attacks.length).toBeGreaterThanOrEqual(1);
    expect(combatant.monsterTraits?.length).toBeGreaterThanOrEqual(1);
  });
});
