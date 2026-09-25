import type { CreatureType, MonsterManifestEntry } from "../monsters/types";
import type { StoryFactionContext } from "./types";

export interface BiomeAffinity {
  creatureTypes: CreatureType[];
  keywords: string[];
}

export const BIOME_CONFIGS: Record<string, BiomeAffinity> = {
  forest: {
    creatureTypes: ["beast", "plant", "fey"],
    keywords: [
      "wolf", "bear", "treant", "spider", "dryad", "goblin", "druid", "elf",
      "волк", "медведь", "трент", "паук", "дриада", "гоблин", "друид", "эльф", "лес",
    ],
  },
  cave: {
    creatureTypes: ["beast", "monstrosity", "aberration"],
    keywords: [
      "bat", "spider", "troglodyte", "drow", "roper", "purple worm",
      "мышь", "паук", "троглодит", "дроу", "ропер", "червь", "пещер",
    ],
  },
  swamp: {
    creatureTypes: ["monstrosity", "undead", "beast"],
    keywords: [
      "lizardfolk", "croc", "hag", "toad", "hydra", "shambling",
      "ящеролюд", "крокодил", "карга", "жаба", "гидра", "курганник", "болот",
    ],
  },
  lava: {
    creatureTypes: ["elemental", "fiend", "dragon"],
    keywords: [
      "fire", "magma", "salamander", "red dragon", "cinder",
      "огонь", "огнен", "магм", "саламандра", "красный дракон", "пепел", "лав",
    ],
  },
  snow: {
    creatureTypes: ["beast", "giant", "elemental"],
    keywords: [
      "yeti", "winter", "frost", "white dragon", "mammoth",
      "йети", "зима", "зимн", "мороз", "белый дракон", "мамонт", "снег", "снеж", "лед", "хлад",
    ],
  },
  coastal: {
    creatureTypes: ["humanoid", "monstrosity"],
    keywords: [
      "pirate", "sailor", "siren", "kraken", "sahuagin",
      "пират", "матрос", "моряк", "сирена", "кракен", "сахуагин", "водяной", "рыба", "прибреж",
    ],
  },
  ship: {
    creatureTypes: ["humanoid", "monstrosity"],
    keywords: [
      "pirate", "sailor", "siren", "kraken", "sahuagin",
      "пират", "матрос", "моряк", "сирена", "кракен", "корабл", "матрос", "пират",
    ],
  },
  dungeon: {
    creatureTypes: ["undead", "construct", "humanoid", "fiend"],
    keywords: [
      "skeleton", "zombie", "trap", "guard", "cultist",
      "скелет", "зомби", "ловушка", "страж", "культист", "горгулья", "подземель",
    ],
  },
  urban: {
    creatureTypes: ["humanoid"],
    keywords: [
      "guard", "bandit", "assassin", "noble", "spy", "rogue",
      "страж", "бандит", "убийца", "ассасин", "дворянин", "шпион", "вор", "разбойник", "город",
    ],
  },
  desert: {
    creatureTypes: ["beast", "fiend", "undead"],
    keywords: [
      "scorpion", "mummy", "sphinx", "hyena", "dust",
      "скорпион", "мумия", "сфинкс", "гиена", "песок", "песчан", "пустын",
    ],
  },
  mountain: {
    creatureTypes: ["giant", "beast", "dragon"],
    keywords: [
      "eagle", "roc", "goliath", "stone giant", "harpy",
      "орел", "орёл", "птица рух", "голиаф", "каменный великан", "гарпия", "гор",
    ],
  },
};

export const UNIVERSAL_FALLBACK_TYPES: CreatureType[] = ["humanoid", "beast", "undead"];

export const UNIVERSAL_FALLBACK_KEYWORDS: string[] = [
  "bandit", "guard", "cultist", "wolf", "skeleton", "zombie", "goblin", "acolyte",
  "бандит", "страж", "культист", "волк", "скелет", "зомби", "гоблин", "послушник",
];

function entryMatchesKeywords(entry: MonsterManifestEntry, keywords: string[]): boolean {
  const nameRu = entry.name.toLowerCase();
  const nameEn = entry.nameEn.toLowerCase();
  const slug = entry.slug.toLowerCase();

  return keywords.some((kw) => {
    const k = kw.toLowerCase().trim();
    return nameRu.includes(k) || nameEn.includes(k) || slug.includes(k);
  });
}

/**
 * Selects candidate monsters from the manifest matching the requested biome and optional story faction.
 *
 * Tier 1 (Story Faction): Prioritizes boss monster, faction creature types, and faction tags.
 * Tier 2 (Native Biome): Filters by biome preferred creature types or name/description keywords.
 * Tier 3 (Fallback Guarantee): Ensures at least 10 candidates (or all available if < 10) by pulling universal candidates.
 */
export function getBiomeCandidatePool(
  manifest: MonsterManifestEntry[],
  biome: string,
  faction?: StoryFactionContext
): MonsterManifestEntry[] {
  if (!manifest || manifest.length === 0) {
    return [];
  }

  const pool: MonsterManifestEntry[] = [];
  const seenSlugs = new Set<string>();

  const addEntry = (entry: MonsterManifestEntry) => {
    const key = entry.slug || entry.id;
    if (!seenSlugs.has(key)) {
      seenSlugs.add(key);
      pool.push(entry);
    }
  };

  // --- Tier 1: Story Faction ---
  if (faction) {
    // 1a: Boss monster
    if (faction.bossMonsterId) {
      const target = faction.bossMonsterId.toLowerCase().trim();
      const boss = manifest.find((m) =>
        m.slug.toLowerCase() === target ||
        m.id.toLowerCase() === target ||
        m.name.toLowerCase() === target ||
        m.nameEn.toLowerCase() === target
      );
      if (boss) {
        addEntry(boss);
      }
    }

    // 1b: Faction creature types & tags/name keywords
    const factionTypes = faction.creatureTypes && faction.creatureTypes.length > 0
      ? new Set(faction.creatureTypes)
      : null;
    const factionKeywords = [
      ...(faction.tags || []),
      ...(faction.name ? faction.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3) : []),
    ];
    const hasFactionKeywords = factionKeywords.length > 0;

    if (factionTypes || hasFactionKeywords) {
      for (const entry of manifest) {
        const matchesType = factionTypes ? factionTypes.has(entry.type) : false;
        const matchesTag = hasFactionKeywords ? entryMatchesKeywords(entry, factionKeywords) : false;

        if (matchesType || matchesTag) {
          addEntry(entry);
        }
      }
    }
  }

  // --- Tier 2: Native Biome ---
  const normalizedBiome = biome.toLowerCase().trim();
  const biomeConfig = BIOME_CONFIGS[normalizedBiome];

  if (biomeConfig) {
    for (const entry of manifest) {
      const matchesType = biomeConfig.creatureTypes.includes(entry.type);
      const matchesKeyword = entryMatchesKeywords(entry, biomeConfig.keywords);

      if (matchesType || matchesKeyword) {
        addEntry(entry);
      }
    }
  }

  // --- Tier 3: Fallback Guarantee ---
  // If pool has fewer than 10 candidates (or biome unknown), supplement with universal candidates
  if (pool.length < 10) {
    for (const entry of manifest) {
      if (pool.length >= 10) break;
      const isUniversalType = UNIVERSAL_FALLBACK_TYPES.includes(entry.type);
      const isUniversalKeyword = entryMatchesKeywords(entry, UNIVERSAL_FALLBACK_KEYWORDS);

      if (isUniversalType || isUniversalKeyword) {
        addEntry(entry);
      }
    }
  }

  // If still fewer than 10 (or if pool is empty and manifest has monsters), add any remaining monsters
  if (pool.length < 10 && pool.length < manifest.length) {
    for (const entry of manifest) {
      if (pool.length >= 10 || pool.length >= manifest.length) break;
      addEntry(entry);
    }
  }

  return pool;
}
