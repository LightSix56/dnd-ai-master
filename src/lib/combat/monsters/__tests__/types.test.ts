import { describe, it, expect } from "vitest";
import type {
  CreatureType,
  CreatureSize,
  MonsterDefinition,
  MonsterAction,
  MonsterSpeed,
  MonsterManifestEntry,
} from "../types";

describe("Monster Compendium Types", () => {
  it("should validate all 14 canonical CreatureType values", () => {
    const canonicalTypes: CreatureType[] = [
      "aberration",
      "beast",
      "celestial",
      "construct",
      "dragon",
      "elemental",
      "fey",
      "fiend",
      "giant",
      "humanoid",
      "monstrosity",
      "ooze",
      "plant",
      "undead",
    ];
    expect(canonicalTypes).toHaveLength(14);
  });

  it("should correctly structure a complete MonsterDefinition", () => {
    const dragon: MonsterDefinition = {
      id: "132-adult_silver_dragon",
      slug: "adult_silver_dragon",
      name: "Взрослый серебряный дракон",
      nameEn: "Adult Silver Dragon",
      size: "huge",
      type: "dragon",
      subtype: null,
      alignment: "законно-добрый",
      challengeRating: 16,
      xp: 15000,
      source: "Monster Manual",
      isNamed: false,
      armorClass: {
        value: 19,
        type: "природный доспех",
      },
      hitPoints: {
        average: 243,
        hitDice: "18d12+126",
      },
      speed: {
        walk: 40,
        fly: 80,
      },
      abilities: {
        str: 27,
        dex: 10,
        con: 25,
        int: 16,
        wis: 13,
        cha: 21,
      },
      savingThrows: {
        dex: 5,
        con: 12,
        wis: 6,
        cha: 10,
      },
      skills: {
        perception: 11,
        history: 8,
        arcana: 8,
        stealth: 5,
      },
      senses: {
        blindsight: 60,
        darkvision: 120,
        passivePerception: 21,
      },
      languages: ["Общий", "Драконий"],
      damageResistances: [],
      damageImmunities: ["cold"],
      damageVulnerabilities: [],
      conditionImmunities: [],
      traits: [
        {
          name: "Легендарное сопротивление (3/день)",
          description: "Если дракон проваливает спасбросок, он может вместо этого сделать спасбросок успешным.",
        },
      ],
      actions: [
        {
          name: "Мультиатака",
          type: "multiattack",
          description: "Дракон совершает три атаки: одну укусом и две когтями.",
        },
        {
          name: "Укус",
          type: "melee_attack",
          description: "Рукопашная атака оружием",
          attackBonus: 13,
          reachFt: 10,
          damage: [{ dice: "2d10", mod: 8, type: "piercing" }],
        },
        {
          name: "Холодное дыхание",
          type: "breath",
          description: "Дракон выдыхает волну ледяного воздуха",
          recharge: "5-6",
          aoe: { shape: "cone", sizeFt: 60 },
          save: { ability: "CON", dc: 20, halfOnSuccess: true },
          damage: [{ dice: "13d8", mod: 0, type: "cold" }],
        },
      ],
      reactions: [],
      legendaryActions: {
        actionsPerRound: 3,
        options: [
          { name: "Обнаружение", cost: 1, description: "Проверка Восприятия" },
          { name: "Атака хвостом", cost: 1, description: "Атака хвостом" },
        ],
      },
      lairActions: [],
      spellcasting: null,
    };

    expect(dragon.id).toBe("132-adult_silver_dragon");
    expect(dragon.type).toBe("dragon");
    expect(dragon.challengeRating).toBe(16);
    expect(dragon.actions).toHaveLength(3);
    expect(dragon.actions[2].recharge).toBe("5-6");
  });

  it("should validate MonsterManifestEntry structure", () => {
    const entry: MonsterManifestEntry = {
      id: "30-aarakocra",
      slug: "aarakocra",
      name: "Ааракокра",
      nameEn: "Aarakocra",
      type: "humanoid",
      size: "medium",
      challengeRating: 0.25,
      xp: 50,
      hpAverage: 13,
      ac: 12,
      source: "Monster Manual",
      isNamed: false,
      filePath: "humanoid/aarakocra.json",
    };

    expect(entry.challengeRating).toBe(0.25);
    expect(entry.filePath).toBe("humanoid/aarakocra.json");
  });
});
