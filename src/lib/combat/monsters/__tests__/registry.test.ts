import { describe, it, expect } from "vitest";
import { filterMonsters, createManifestEntry } from "../monster-registry";
import type { MonsterDefinition, MonsterManifestEntry, MonsterQueryFilter } from "../types";

const mockEntries: MonsterManifestEntry[] = [
  {
    id: "goblin",
    slug: "goblin",
    name: "Гоблин",
    nameEn: "Goblin",
    type: "humanoid",
    size: "small",
    challengeRating: 0.25,
    xp: 50,
    hpAverage: 7,
    ac: 15,
    source: "Monster Manual",
    isNamed: false,
    filePath: "humanoid/goblin.json",
  },
  {
    id: "adult-silver-dragon",
    slug: "adult-silver-dragon",
    name: "Взрослый серебряный дракон",
    nameEn: "Adult Silver Dragon",
    type: "dragon",
    size: "huge",
    challengeRating: 16,
    xp: 15000,
    hpAverage: 243,
    ac: 19,
    source: "Monster Manual",
    isNamed: false,
    filePath: "dragon/adult-silver-dragon.json",
  },
  {
    id: "strahd-von-zarovich",
    slug: "strahd-von-zarovich",
    name: "Страд фон Зарович",
    nameEn: "Strahd von Zarovich",
    type: "undead",
    size: "medium",
    challengeRating: 15,
    xp: 13000,
    hpAverage: 144,
    ac: 16,
    source: "Curse of Strahd",
    isNamed: true,
    filePath: "undead/strahd-von-zarovich.json",
  },
  {
    id: "wolf",
    slug: "wolf",
    name: "Волк",
    nameEn: "Wolf",
    type: "beast",
    size: "medium",
    challengeRating: 0.25,
    xp: 50,
    hpAverage: 11,
    ac: 13,
    source: "Monster Manual",
    isNamed: false,
    filePath: "beast/wolf.json",
  },
];

describe("Monster Registry & Query Engine (monster-registry)", () => {
  it("should filter monsters by CR range", () => {
    const filter: MonsterQueryFilter = { minCR: 1, maxCR: 16 };
    const results = filterMonsters(mockEntries, filter);
    expect(results.length).toBe(2);
    expect(results.map((r) => r.id)).toEqual(["adult-silver-dragon", "strahd-von-zarovich"]);
  });

  it("should filter monsters by creature type", () => {
    const filter: MonsterQueryFilter = { type: "beast" };
    const results = filterMonsters(mockEntries, filter);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("wolf");
  });

  it("should filter monsters by size", () => {
    const filter: MonsterQueryFilter = { size: "small" };
    const results = filterMonsters(mockEntries, filter);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("goblin");
  });

  it("should filter out named bosses when isNamed is false", () => {
    const filter: MonsterQueryFilter = { isNamed: false };
    const results = filterMonsters(mockEntries, filter);
    expect(results.length).toBe(3);
    expect(results.some((r) => r.id === "strahd-von-zarovich")).toBe(false);
  });

  it("should search monsters by Russian or English substring", () => {
    const ruFilter: MonsterQueryFilter = { search: "серебряный" };
    expect(filterMonsters(mockEntries, ruFilter).length).toBe(1);

    const enFilter: MonsterQueryFilter = { search: "dragon" };
    expect(filterMonsters(mockEntries, enFilter).length).toBe(1);
  });

  it("should correctly convert MonsterDefinition to MonsterManifestEntry", () => {
    const fullMonster: MonsterDefinition = {
      id: "ogre",
      slug: "ogre",
      name: "Огр",
      nameEn: "Ogre",
      size: "large",
      type: "giant",
      alignment: "хаотично-злой",
      challengeRating: 2,
      xp: 450,
      source: "Monster Manual",
      isNamed: false,
      armorClass: { value: 11 },
      hitPoints: { average: 59, hitDice: "7d10 + 21" },
      speed: { walk: 40 },
      abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
      savingThrows: {},
      skills: {},
      damageResistances: [],
      damageImmunities: [],
      damageVulnerabilities: [],
      conditionImmunities: [],
      senses: { darkvision: 60, passivePerception: 8 },
      languages: ["Общий", "Великаний"],
      traits: [],
      actions: [],
      reactions: [],
    };

    const entry = createManifestEntry(fullMonster, "giant/ogre.json");
    expect(entry.id).toBe("ogre");
    expect(entry.slug).toBe("ogre");
    expect(entry.type).toBe("giant");
    expect(entry.challengeRating).toBe(2);
    expect(entry.hpAverage).toBe(59);
    expect(entry.ac).toBe(11);
    expect(entry.filePath).toBe("giant/ogre.json");
  });
});
