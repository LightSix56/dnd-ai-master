import type { MapElement, SpawnZoneDefinition, BiomeType } from "./types";

export interface OpenBattlemap {
  id: string;
  name: string;
  nameEn: string;
  biome: BiomeType;
  tags: string[];
  description: string;
  gridWidth: number;
  gridHeight: number;
  cellSizeFt?: number;
  imageUrl: string;
  thumbnailUrl?: string;
  author: string;
  license: string;
  sourceUrl?: string;
  elements?: MapElement[];
  spawnZones?: SpawnZoneDefinition[];
}

export interface OpenMapSearchQuery {
  query?: string;
  tags?: string[];
  category?: string;
  page?: number;
  limit?: number;
}

// Готовые карты перенесены в archive/maps и больше не участвуют в боях:
// карта боя собирается генератором (src/lib/combat/procgen)
export const OPEN_BATTLEMAP_CATALOG: OpenBattlemap[] = [];

export const POPULAR_MAP_TAGS: Array<{ tag: string; labelRu: string; count: number }> = [
  { tag: "dungeon", labelRu: "Подземелье", count: 8 },
  { tag: "forest", labelRu: "Лес", count: 7 },
  { tag: "crypt", labelRu: "Крипта / Гробница", count: 5 },
  { tag: "tavern", labelRu: "Таверна", count: 4 },
  { tag: "temple", labelRu: "Храм / Алтарь", count: 6 },
  { tag: "cave", labelRu: "Пещеры", count: 5 },
  { tag: "water", labelRu: "Вода / Река", count: 6 },
  { tag: "ship", labelRu: "Корабль / Море", count: 3 },
  { tag: "bridge", labelRu: "Мост / Переправа", count: 3 },
  { tag: "ruins", labelRu: "Руины", count: 7 },
  { tag: "arena", labelRu: "Арена / Колизей", count: 3 },
  { tag: "lava", labelRu: "Лава / Вулкан", count: 3 },
  { tag: "snow", labelRu: "Снег / Горы", count: 4 },
  { tag: "city", labelRu: "Город / Улицы", count: 4 },
  { tag: "castle", labelRu: "Замок / Цитадель", count: 4 },
];

export function getPopularTags() {
  return POPULAR_MAP_TAGS;
}

export function searchOpenMaps(options: OpenMapSearchQuery = {}): OpenBattlemap[] {
  const { query, tags, category } = options;

  return OPEN_BATTLEMAP_CATALOG.filter((map) => {
    // 1. Категория
    if (category && category !== "all") {
      const b = (map.biome || "").toLowerCase();
      if (category === "dungeon_cave") {
        const match = b.includes("cave") || b.includes("dungeon") || b.includes("underdark") || map.tags.includes("crypt") || map.tags.includes("catacombs");
        if (!match) return false;
      } else if (category === "forest_swamp") {
        const match = b.includes("forest") || b.includes("swamp") || map.tags.includes("trees") || map.tags.includes("marsh");
        if (!match) return false;
      } else if (category === "mountain_snow") {
        const match = b.includes("mountain") || b.includes("snow") || b.includes("desert") || map.tags.includes("cliff");
        if (!match) return false;
      } else if (category === "urban_buildings") {
        const match = b.includes("city") || b.includes("urban") || b.includes("tavern") || b.includes("temple") || b.includes("arena");
        if (!match) return false;
      } else if (category === "water_lava") {
        const match = b.includes("ship") || b.includes("lava") || b.includes("coastal") || map.tags.includes("water");
        if (!match) return false;
      }
    }

    // 2. Теги (если указаны)
    if (tags && tags.length > 0) {
      const hasAnyTag = tags.some((t) => map.tags.includes(t.toLowerCase()));
      if (!hasAnyTag) return false;
    }

    // 3. Текстовый поиск
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      const matchName = map.name.toLowerCase().includes(q) || map.nameEn.toLowerCase().includes(q);
      const matchDesc = map.description.toLowerCase().includes(q);
      const matchTags = map.tags.some((t) => t.toLowerCase().includes(q));
      const matchBiome = map.biome.toLowerCase().includes(q);

      if (!matchName && !matchDesc && !matchTags && !matchBiome) {
        return false;
      }
    }

    return true;
  });
}

export function getOpenMapById(id: string): OpenBattlemap | undefined {
  return OPEN_BATTLEMAP_CATALOG.find((m) => m.id === id);
}

