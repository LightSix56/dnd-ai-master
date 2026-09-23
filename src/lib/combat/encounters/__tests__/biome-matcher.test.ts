import { describe, it, expect } from "vitest";
import {
  getBiomeCandidatePool,
  BIOME_CONFIGS,
  type BiomeAffinity,
} from "../biome-matcher";
import type { MonsterManifestEntry } from "../../monsters/types";
import type { StoryFactionContext } from "../types";

function createMockEntry(
  slug: string,
  type: MonsterManifestEntry["type"],
  name: string,
  nameEn: string,
  options?: Partial<MonsterManifestEntry>
): MonsterManifestEntry {
  return {
    id: slug,
    slug,
    name,
    nameEn,
    type,
    size: "medium",
    challengeRating: 1,
    xp: 200,
    hpAverage: 30,
    ac: 13,
    source: "Monster Manual",
    isNamed: false,
    filePath: `${type}/${slug}.json`,
    ...options,
  };
}

const mockManifest: MonsterManifestEntry[] = [
  // Forest / beasts / plants / fey
  createMockEntry("wolf", "beast", "Волк", "Wolf"),
  createMockEntry("brown-bear", "beast", "Бурый медведь", "Brown Bear"),
  createMockEntry("treant", "plant", "Трент", "Treant"),
  createMockEntry("dryad", "fey", "Дриада", "Dryad"),
  createMockEntry("goblin-scout", "humanoid", "Гоблин-разведчик", "Goblin Scout"),

  // Cave / monstrosities / aberrations
  createMockEntry("giant-bat", "beast", "Гигантская летучая мышь", "Giant Bat"),
  createMockEntry("troglodyte", "humanoid", "Троглодит", "Troglodyte"),
  createMockEntry("roper", "monstrosity", "Ропер", "Roper"),
  createMockEntry("drow-warrior", "humanoid", "Воин дроу", "Drow Warrior"),
  createMockEntry("purple-worm", "monstrosity", "Пурпурный червь", "Purple Worm"),

  // Swamp
  createMockEntry("swamp-hag", "fey", "Болотная карга", "Green Hag"),
  createMockEntry("hydra", "monstrosity", "Гидра", "Hydra"),
  createMockEntry("giant-toad", "beast", "Гигантская жаба", "Giant Toad"),
  createMockEntry("lizardfolk", "humanoid", "Ящеролюд", "Lizardfolk"),

  // Lava
  createMockEntry("fire-elemental", "elemental", "Огненный элементаль", "Fire Elemental"),
  createMockEntry("magma-mephit", "elemental", "Магматический мефит", "Magma Mephit"),
  createMockEntry("salamander", "elemental", "Саламандра", "Salamander"),
  createMockEntry("red-dragon-wyrmling", "dragon", "Красный дракончик", "Red Dragon Wyrmling"),
  createMockEntry("bearded-devil", "fiend", "Бородатый дьявол", "Bearded Devil"),

  // Snow
  createMockEntry("yeti", "monstrosity", "Йети", "Yeti"),
  createMockEntry("winter-wolf", "monstrosity", "Зимний волк", "Winter Wolf"),
  createMockEntry("frost-giant", "giant", "Морозный великан", "Frost Giant"),
  createMockEntry("mammoth", "beast", "Мамонт", "Mammoth"),
  createMockEntry("white-dragon", "dragon", "Белый дракон", "White Dragon"),

  // Coastal / Ship
  createMockEntry("pirate-captain", "humanoid", "Капитан пиратов", "Pirate Captain", { isNamed: true }),
  createMockEntry("sahuagin", "humanoid", "Сахуагин", "Sahuagin"),
  createMockEntry("sea-hag", "fey", "Морская карга", "Sea Hag"),
  createMockEntry("kraken", "monstrosity", "Кракен", "Kraken"),

  // Dungeon / Undead / Constructs
  createMockEntry("skeleton", "undead", "Скелет", "Skeleton"),
  createMockEntry("zombie", "undead", "Зомби", "Zombie"),
  createMockEntry("animated-armor", "construct", "Оживлённый доспех", "Animated Armor"),
  createMockEntry("iron-golem", "construct", "Железный голем", "Iron Golem"),

  // Urban
  createMockEntry("city-guard", "humanoid", "Городской стражник", "City Guard"),
  createMockEntry("bandit", "humanoid", "Бандит", "Bandit"),
  createMockEntry("bandit-captain", "humanoid", "Главарь бандитов", "Bandit Captain"),
  createMockEntry("assassin", "humanoid", "Ассасин", "Assassin"),
  createMockEntry("noble-spy", "humanoid", "Благородный шпион", "Noble Spy"),

  // Desert
  createMockEntry("giant-scorpion", "beast", "Гигантский скорпион", "Giant Scorpion"),
  createMockEntry("mummy", "undead", "Мумия", "Mummy"),
  createMockEntry("sphinx", "monstrosity", "Гиносфинкс", "Gynosphinx"),
  createMockEntry("gnoll-hyena", "fiend", "Гнолл-гиена", "Hyena"),

  // Mountain
  createMockEntry("giant-eagle", "beast", "Гигантский орёл", "Giant Eagle"),
  createMockEntry("stone-giant", "giant", "Каменный великан", "Stone Giant"),
  createMockEntry("harpy", "monstrosity", "Гарпия", "Harpy"),
  createMockEntry("roc", "monstrosity", "Птица Рух", "Roc"),

  // Universal Fallbacks
  createMockEntry("cultist", "humanoid", "Культист", "Cultist"),
  createMockEntry("acolyte", "humanoid", "Послушник", "Acolyte"),
];

describe("Biome Mappings & Affinities", () => {
  const supportedBiomes = [
    "cave",
    "dungeon",
    "forest",
    "swamp",
    "mountain",
    "lava",
    "coastal",
    "ship",
    "desert",
    "snow",
    "urban",
  ];

  it("should have configuration entries for all 11 required biomes", () => {
    for (const biome of supportedBiomes) {
      expect(BIOME_CONFIGS[biome], `Biome ${biome} must be defined`).toBeDefined();
      expect(BIOME_CONFIGS[biome].creatureTypes.length).toBeGreaterThan(0);
      expect(BIOME_CONFIGS[biome].keywords.length).toBeGreaterThan(0);
    }
  });

  it("should define correct creature types and keywords for forest", () => {
    const forest = BIOME_CONFIGS.forest;
    expect(forest.creatureTypes).toContain("beast");
    expect(forest.creatureTypes).toContain("plant");
    expect(forest.creatureTypes).toContain("fey");
    expect(forest.keywords).toEqual(expect.arrayContaining(["wolf", "bear", "treant", "spider", "dryad", "goblin"]));
  });

  it("should define correct creature types and keywords for lava", () => {
    const lava = BIOME_CONFIGS.lava;
    expect(lava.creatureTypes).toContain("elemental");
    expect(lava.creatureTypes).toContain("fiend");
    expect(lava.creatureTypes).toContain("dragon");
    expect(lava.keywords).toEqual(expect.arrayContaining(["fire", "magma", "salamander"]));
  });
});

describe("getBiomeCandidatePool - Biome Matching (Tier 2)", () => {
  it("should filter candidates matching the forest biome", () => {
    const pool = getBiomeCandidatePool(mockManifest, "forest");
    const slugs = pool.map((m) => m.slug);

    // Should include beasts, plants, fey, and keyword matches like goblin
    expect(slugs).toContain("wolf");
    expect(slugs).toContain("brown-bear");
    expect(slugs).toContain("treant");
    expect(slugs).toContain("dryad");
    expect(slugs).toContain("goblin-scout");
  });

  it("should match biomes case-insensitively and trim spaces", () => {
    const poolUpper = getBiomeCandidatePool(mockManifest, "  LAVA  ");
    const slugs = poolUpper.map((m) => m.slug);
    expect(slugs).toContain("fire-elemental");
    expect(slugs).toContain("magma-mephit");
    expect(slugs).toContain("salamander");
  });

  it("should filter candidates matching cave biome by keywords and creature types", () => {
    const pool = getBiomeCandidatePool(mockManifest, "cave");
    const slugs = pool.map((m) => m.slug);

    expect(slugs).toContain("giant-bat");
    expect(slugs).toContain("troglodyte"); // keyword
    expect(slugs).toContain("roper");
    expect(slugs).toContain("drow-warrior"); // keyword
    expect(slugs).toContain("purple-worm"); // keyword
  });
});

describe("getBiomeCandidatePool - Story Faction (Tier 1 Priority)", () => {
  it("should prioritize boss monster at the very top of pool when bossMonsterId is specified", () => {
    const faction: StoryFactionContext = {
      name: "Pirate Fleet",
      bossMonsterId: "pirate-captain",
    };

    const pool = getBiomeCandidatePool(mockManifest, "forest", faction);
    expect(pool[0].slug).toBe("pirate-captain");
  });

  it("should match bossMonsterId by name if slug does not directly match", () => {
    const faction: StoryFactionContext = {
      bossMonsterId: "Капитан пиратов",
    };

    const pool = getBiomeCandidatePool(mockManifest, "dungeon", faction);
    expect(pool[0].slug).toBe("pirate-captain");
  });

  it("should prioritize monsters matching faction creatureTypes", () => {
    const faction: StoryFactionContext = {
      name: "Undead Legion",
      creatureTypes: ["undead"],
    };

    // Even in a forest biome, undead faction members should be at the front
    const pool = getBiomeCandidatePool(mockManifest, "forest", faction);
    const topSlugs = pool.slice(0, 3).map((m) => m.slug);

    expect(topSlugs).toContain("skeleton");
    expect(topSlugs).toContain("zombie");
  });

  it("should match faction tags against monster name and slug", () => {
    const faction: StoryFactionContext = {
      name: "Bandit Ring",
      tags: ["bandit"],
    };

    const pool = getBiomeCandidatePool(mockManifest, "cave", faction);
    const firstFew = pool.slice(0, 2).map((m) => m.slug);

    expect(firstFew).toContain("bandit");
    expect(firstFew).toContain("bandit-captain");
  });
});

describe("getBiomeCandidatePool - Fallback Guarantee (Tier 3)", () => {
  it("should supplement candidate pool to at least 10 entries when biome matches are few", () => {
    // Small manifest with only 2 snow monsters and some generic monsters
    const smallManifest: MonsterManifestEntry[] = [
      createMockEntry("yeti", "monstrosity", "Йети", "Yeti"),
      createMockEntry("winter-wolf", "monstrosity", "Зимний волк", "Winter Wolf"),
      createMockEntry("bandit", "humanoid", "Бандит", "Bandit"),
      createMockEntry("city-guard", "humanoid", "Стражник", "Guard"),
      createMockEntry("cultist", "humanoid", "Культист", "Cultist"),
      createMockEntry("skeleton", "undead", "Скелет", "Skeleton"),
      createMockEntry("zombie", "undead", "Зомби", "Zombie"),
      createMockEntry("wolf", "beast", "Волк", "Wolf"),
      createMockEntry("acolyte", "humanoid", "Послушник", "Acolyte"),
      createMockEntry("goblin", "humanoid", "Гоблин", "Goblin"),
      createMockEntry("orc", "humanoid", "Орк", "Orc"),
      createMockEntry("brown-bear", "beast", "Бурый медведь", "Brown Bear"),
    ];

    const pool = getBiomeCandidatePool(smallManifest, "snow");
    expect(pool.length).toBeGreaterThanOrEqual(10);
    // Native matches come first
    expect(pool.slice(0, 2).map((m) => m.slug)).toEqual(["yeti", "winter-wolf"]);
  });

  it("should handle unknown biome gracefully and return fallback candidates", () => {
    const pool = getBiomeCandidatePool(mockManifest, "astral-void-unknown");
    expect(pool.length).toBeGreaterThanOrEqual(10);
    // Should include universal humanoids / beasts / undead
    const slugs = pool.map((m) => m.slug);
    expect(slugs.some((s) => s.includes("bandit") || s.includes("guard") || s.includes("wolf") || s.includes("skeleton"))).toBe(true);
  });

  it("should never return empty array when manifest is non-empty", () => {
    const tinyManifest: MonsterManifestEntry[] = [
      createMockEntry("random-alien", "aberration", "Пришелец", "Alien"),
    ];

    const pool = getBiomeCandidatePool(tinyManifest, "desert");
    expect(pool.length).toBe(1);
    expect(pool[0].slug).toBe("random-alien");
  });

  it("should return empty array when manifest is empty", () => {
    const pool = getBiomeCandidatePool([], "forest");
    expect(pool).toEqual([]);
  });
});

describe("getBiomeCandidatePool - Deduplication", () => {
  it("should not contain any duplicates in candidate pool", () => {
    // If a monster matches faction, biome, and fallback, it must appear exactly once
    const faction: StoryFactionContext = {
      creatureTypes: ["beast"],
      tags: ["wolf"],
    };

    const pool = getBiomeCandidatePool(mockManifest, "forest", faction);
    const slugs = pool.map((m) => m.slug);
    const uniqueSlugs = new Set(slugs);

    expect(slugs.length).toBe(uniqueSlugs.size);
  });
});
