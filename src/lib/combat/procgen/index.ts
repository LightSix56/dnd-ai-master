// Процедурная карта боя: план по зерну → разметка и зоны в формате обычного пресета.
// Фон боя — ссылка procgen:, по которой браузер рисует ту же карту.

import type { BiomeType, TacticalMapPreset } from "../maps/types";
import { generateCaveLayout } from "./cave";
import { classifyCells, mergeToElements } from "./markup";
import { buildSpawnZones } from "./zones";
import { BIOME_NAMES, PROCGEN_BIOMES, resolveProcgenBiome } from "./biomes";
import { classifyLayout, clearPathObstacles } from "./classify";
import { buildAreaZones } from "./areas";
import type { ProcgenBiome, ProcgenLayout } from "./layout";
import { generateLavaLayout, caveToLayout } from "./gen-lava";
import { generateDungeonLayout } from "./gen-dungeon";
import { generateOutdoorLayout } from "./gen-outdoor";
import { generateCityLayout } from "./gen-city";

const VERSION = 1;
const MAX_ATTEMPTS = 20;

export function formatProcgenUrl(seed: number, biome: ProcgenBiome = "cave"): string {
  return `procgen:${biome}?seed=${seed}&v=${VERSION}`;
}

export function parseProcgenUrl(url: string | null | undefined): { biome: ProcgenBiome; seed: number; version: 1 } | null {
  const match = /^procgen:([a-z]+)\?seed=(-?\d+)&v=(\d+)$/.exec(url ?? "");
  if (!match || Number(match[3]) !== VERSION) return null;
  if (!(PROCGEN_BIOMES as string[]).includes(match[1])) return null;
  return { biome: match[1] as ProcgenBiome, seed: Number(match[2]), version: VERSION };
}

/** Генераторы общих планов; пещера идёт своим путём (её план и разметка зафиксированы v1) */
const RAW_GENERATORS: Partial<Record<ProcgenBiome, (seed: number) => ProcgenLayout>> = {
  lava: generateLavaLayout,
  dungeon: (seed) => generateDungeonLayout(seed, "dungeon"),
  tavern: (seed) => generateDungeonLayout(seed, "tavern"),
  forest: (seed) => generateOutdoorLayout(seed, "forest"),
  swamp: (seed) => generateOutdoorLayout(seed, "swamp"),
  desert: (seed) => generateOutdoorLayout(seed, "desert"),
  snow: (seed) => generateOutdoorLayout(seed, "snow"),
  mountain: (seed) => generateOutdoorLayout(seed, "mountain"),
  coastal: (seed) => generateOutdoorLayout(seed, "coastal"),
  urban: generateCityLayout,
};

/** Готовые генераторы: с осей путей убраны непроходимые объекты (картинка = разметка) */
export const GENERATORS: Partial<Record<ProcgenBiome, (seed: number) => ProcgenLayout>> = Object.fromEntries(
  Object.entries(RAW_GENERATORS).map(([biome, generate]) => [biome, (seed: number) => clearPathObstacles(generate(seed))])
);

/** Какой старый биом пресета соответствует процедурному — для подбора монстров без биома в запросе */
const PRESET_BIOME: Record<ProcgenBiome, BiomeType> = {
  cave: "underdark_mushrooms",
  lava: "lava_cave",
  dungeon: "dungeon_prison",
  tavern: "tavern",
  forest: "forest_ambush",
  swamp: "swamp_bog",
  desert: "desert_dunes",
  snow: "snowy_mountain",
  mountain: "bridge_chasm",
  coastal: "docks_harbor",
  urban: "city_street",
};

function generateCaveMap(seed: number): TacticalMapPreset {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const s = seed + attempt;
    const layout = generateCaveLayout(s);
    const cells = classifyCells(layout);
    const spawnZones = buildSpawnZones(layout, cells);
    if (!spawnZones) continue;
    return {
      id: `procgen-cave-${s}`,
      name: "Пещера",
      nameEn: "Cave",
      biome: "underdark_mushrooms",
      tags: ["cave", "procgen"],
      gridWidth: layout.width,
      gridHeight: layout.height,
      cellSizeFt: 5,
      backgroundUrl: formatProcgenUrl(s),
      elements: mergeToElements(cells),
      spawnZones,
      description: "Пещера, собранная генератором из залов, проходов и ниш.",
    };
  }
  throw new Error("Не удалось собрать карту пещеры");
}

/**
 * Собирает карту биома по зерну. Если на зерне партия не может дойти до врагов или зоны
 * не помещаются, берётся следующее зерно.
 */
export function generateProcgenMap(biomeName: BiomeType | string, seed: number): TacticalMapPreset {
  const biome = resolveProcgenBiome(biomeName);
  const generate = GENERATORS[biome];
  if (!generate) return generateCaveMap(seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const s = seed + attempt;
    const layout = generate(s);
    const cells = classifyLayout(layout);
    const spawnZones = buildAreaZones(layout, cells);
    if (!spawnZones) continue;
    return {
      id: `procgen-${biome}-${s}`,
      name: BIOME_NAMES[biome],
      nameEn: biome,
      biome: PRESET_BIOME[biome],
      tags: [biome, "procgen"],
      gridWidth: layout.width,
      gridHeight: layout.height,
      cellSizeFt: 5,
      backgroundUrl: formatProcgenUrl(s, biome),
      elements: mergeToElements(cells, { water: "Вода" }),
      spawnZones,
      description: `${BIOME_NAMES[biome]}: карта собрана генератором.`,
    };
  }
  throw new Error(`Не удалось собрать карту: ${BIOME_NAMES[biome]}`);
}

/** План карты по ссылке фона — для отрисовки в браузере. Битая ссылка — null */
export function layoutForUrl(url: string): ProcgenLayout | null {
  const parsed = parseProcgenUrl(url);
  if (!parsed) return null;
  if (parsed.biome === "cave") return caveToLayout(generateCaveLayout(parsed.seed));
  return GENERATORS[parsed.biome]?.(parsed.seed) ?? null;
}
