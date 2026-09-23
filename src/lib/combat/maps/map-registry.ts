import manifestData from "./data/maps-manifest.json";
import type {
  MapManifestEntry,
  MapTagQuery,
  TacticalMapPreset,
} from "./types";

export class MapRegistry {
  private manifest: MapManifestEntry[];
  private cache: Map<string, TacticalMapPreset> = new Map();

  constructor(customManifest?: MapManifestEntry[]) {
    this.manifest = customManifest || (manifestData as MapManifestEntry[]);
  }

  /**
   * Поиск и ранжирование карт по тегам и критериям
   */
  public search(query: MapTagQuery): MapManifestEntry[] {
    const scored: Array<{ entry: MapManifestEntry; score: number }> = [];

    const queryTags = (query.tags || []).map((t) => t.toLowerCase().trim());

    for (const entry of this.manifest) {
      let score = 0;

      // 1. Точное или частичное совпадение тегов (+10 очков за каждый)
      const entryTags = entry.tags.map((t) => t.toLowerCase());
      for (const qTag of queryTags) {
        if (!qTag) continue;
        if (entryTags.includes(qTag)) {
          score += 10;
        } else if (entryTags.some((et) => et.includes(qTag) || qTag.includes(et))) {
          score += 5;
        }
      }

      // 2. Совпадение биома (+25 очков)
      if (query.biome && entry.biome === query.biome) {
        score += 25;
      }

      // 3. Соответствие типу пространства (indoor / outdoor)
      if (query.indoor !== undefined) {
        if (entry.indoor === query.indoor) {
          score += 5;
        } else {
          score -= 15;
        }
      }

      // 4. Опасности окружения (+8 за каждое совпадение)
      if (query.hazards && query.hazards.length > 0) {
        for (const h of query.hazards) {
          if (entry.hazards.includes(h as any)) {
            score += 8;
          }
        }
      }

      // 5. Минимальные размеры
      if (query.minWidth && entry.gridWidth >= query.minWidth) score += 2;
      if (query.minHeight && entry.gridHeight >= query.minHeight) score += 2;

      // Если запрос пустой, отдаём базовый приоритет всем
      if (queryTags.length === 0 && !query.biome && query.indoor === undefined && !query.hazards) {
        score = 1;
      }

      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.entry);
  }

  /**
   * Регистрация пресета в памяти / кэше
   */
  public registerPreset(preset: TacticalMapPreset): void {
    this.cache.set(preset.id, preset);
  }

  /**
   * Получение пресета по ID из кэша
   */
  public getPreset(id: string): TacticalMapPreset | null {
    return this.cache.get(id) || null;
  }

  /**
   * Возвращает весь список манифеста
   */
  public getAllManifest(): MapManifestEntry[] {
    return [...this.manifest];
  }
}

// Экспорт синглтона по умолчанию
export const mapRegistry = new MapRegistry();
