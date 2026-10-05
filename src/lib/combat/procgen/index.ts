// Процедурная карта боя: план по зерну → разметка и зоны в формате обычного пресета.
// Фон боя — ссылка procgen:, по которой браузер рисует ту же карту.

import type { BiomeType, TacticalMapPreset } from "../maps/types";
import { generateCaveLayout } from "./cave";
import { classifyCells, mergeToElements } from "./markup";
import { buildSpawnZones } from "./zones";

const VERSION = 1;
const MAX_ATTEMPTS = 20;

export function formatProcgenUrl(seed: number): string {
  return `procgen:cave?seed=${seed}&v=${VERSION}`;
}

export function parseProcgenUrl(url: string | null | undefined): { biome: "cave"; seed: number; version: 1 } | null {
  const match = /^procgen:cave\?seed=(-?\d+)&v=(\d+)$/.exec(url ?? "");
  if (!match || Number(match[2]) !== VERSION) return null;
  return { biome: "cave", seed: Number(match[1]), version: VERSION };
}

/**
 * Собирает карту по зерну. Пока любой биом получает пещеру; биом нужен только для
 * подбора монстров. Если на зерне партия не может дойти до врагов, берётся следующее.
 */
export function generateProcgenMap(_biome: BiomeType | string, seed: number): TacticalMapPreset {
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
