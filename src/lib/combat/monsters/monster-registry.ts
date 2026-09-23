import type {
  MonsterDefinition,
  MonsterManifestEntry,
  MonsterQueryFilter,
} from "./types";

/**
 * Преобразует полную сущность монстра в компактную запись для манифеста
 */
export function createManifestEntry(
  monster: MonsterDefinition,
  filePath: string
): MonsterManifestEntry {
  return {
    id: monster.id,
    slug: monster.slug,
    name: monster.name,
    nameEn: monster.nameEn,
    type: monster.type,
    size: monster.size,
    challengeRating: monster.challengeRating,
    xp: monster.xp,
    hpAverage: monster.hitPoints.average,
    ac: monster.armorClass.value,
    source: monster.source,
    isNamed: monster.isNamed,
    filePath,
  };
}

/**
 * Фильтрация монстров по критериям генератора столкновений
 */
export function filterMonsters(
  entries: MonsterManifestEntry[],
  filter: MonsterQueryFilter = {}
): MonsterManifestEntry[] {
  return entries.filter((entry) => {
    // Фильтр по типу существа
    if (filter.type && entry.type !== filter.type) {
      return false;
    }

    // Фильтр по минимальному ПО (CR)
    if (filter.minCR !== undefined && entry.challengeRating < filter.minCR) {
      return false;
    }

    // Фильтр по максимальному ПО (CR)
    if (filter.maxCR !== undefined && entry.challengeRating > filter.maxCR) {
      return false;
    }

    // Фильтр по размеру
    if (filter.size && entry.size !== filter.size) {
      return false;
    }

    // Фильтр по именным/уникальным NPC
    if (filter.isNamed !== undefined && entry.isNamed !== filter.isNamed) {
      return false;
    }

    // Текстовый поиск по русскому или английскому имени
    if (filter.search) {
      const q = filter.search.toLowerCase().trim();
      const matchRu = entry.name.toLowerCase().includes(q);
      const matchEn = entry.nameEn.toLowerCase().includes(q);
      if (!matchRu && !matchEn) {
        return false;
      }
    }

    return true;
  });
}
