import type { BiomeType, TacticalMapPreset } from "../types";
import { mapRegistry } from "../map-registry";
import { shipBattlePreset } from "./ship-battle";
import { templePreset } from "./temple";
import { tavernPreset } from "./tavern";
import { forestAmbushPreset } from "./forest-ambush";
import { lavaCavePreset } from "./lava-cave";
import { dungeonPrisonPreset } from "./dungeon-prison";
import { cityStreetPreset } from "./city-street";
import { gladiatorArenaPreset } from "./gladiator-arena";
import { CANONICAL_PRESETS_EXTENDED } from "./canonical-biomes";

export {
  shipBattlePreset,
  templePreset,
  tavernPreset,
  forestAmbushPreset,
  lavaCavePreset,
  dungeonPrisonPreset,
  cityStreetPreset,
  gladiatorArenaPreset,
};

export const ALL_PRESETS: TacticalMapPreset[] = [
  shipBattlePreset,
  templePreset,
  tavernPreset,
  forestAmbushPreset,
  lavaCavePreset,
  dungeonPrisonPreset,
  cityStreetPreset,
  gladiatorArenaPreset,
  ...CANONICAL_PRESETS_EXTENDED,
];

export const PRESETS_BY_BIOME: Record<BiomeType, TacticalMapPreset> = ALL_PRESETS.reduce(
  (acc, preset) => {
    acc[preset.biome] = preset;
    return acc;
  },
  {} as Record<BiomeType, TacticalMapPreset>
);

export const PRESETS_BY_ID: Record<string, TacticalMapPreset> = ALL_PRESETS.reduce(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {} as Record<string, TacticalMapPreset>
);

export function getPresetByBiome(biome: BiomeType | string): TacticalMapPreset | null {
  if (PRESETS_BY_BIOME[biome as BiomeType]) return PRESETS_BY_BIOME[biome as BiomeType];
  const normalized = (biome || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  const found = ALL_PRESETS.find(
    (p) =>
      p.biome === normalized ||
      p.biome.startsWith(normalized) ||
      p.biome.includes(normalized) ||
      p.tags.some((t) => t.toLowerCase() === normalized)
  );
  return found || null;
}

export function getPresetById(id: string): TacticalMapPreset | null {
  if (PRESETS_BY_ID[id]) return PRESETS_BY_ID[id];
  if (PRESETS_BY_ID[`preset-${id}`]) return PRESETS_BY_ID[`preset-${id}`];
  const normalized = id.replace(/_/g, "-");
  if (PRESETS_BY_ID[normalized]) return PRESETS_BY_ID[normalized];
  if (PRESETS_BY_ID[`preset-${normalized}`]) return PRESETS_BY_ID[`preset-${normalized}`];
  return ALL_PRESETS.find((p) => p.id === id || p.biome === id || p.name === id) || null;
}

// Автоматическая регистрация всех пресетов в MapRegistry
for (const preset of ALL_PRESETS) {
  mapRegistry.registerPreset(preset);
}
