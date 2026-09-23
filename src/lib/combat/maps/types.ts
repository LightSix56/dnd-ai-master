import type { Cell, MapElement, MapElementType, MapElementProperties } from "../types";

export type { Cell, MapElement, MapElementType, MapElementProperties };

/**
 * 24 каноничных биома D&D 5e для тактических сражений
 */
export type BiomeType =
  | "ship_battle"
  | "temple"
  | "tavern"
  | "forest_ambush"
  | "lava_cave"
  | "dungeon_prison"
  | "city_street"
  | "gladiator_arena"
  | "swamp_bog"
  | "snowy_mountain"
  | "desert_dunes"
  | "underdark_mushrooms"
  | "graveyard_crypt"
  | "bridge_chasm"
  | "mine_tracks"
  | "sewers"
  | "wizard_tower"
  | "castle_courtyard"
  | "bandit_camp"
  | "spider_nest"
  | "docks_harbor"
  | "tomb_pyramid"
  | "foundry_forge"
  | "astral_rift";

/**
 * Типы тактических зон размещения участников боя
 */
export type SpawnZoneType =
  | "party"
  | "enemy_frontline"
  | "enemy_backline"
  | "boss"
  | "ambush_flank";

export interface SpawnZoneDefinition {
  name: SpawnZoneType;
  cells: Cell[];
}

/**
 * Полное определение готового тактического пресета карты
 */
export interface TacticalMapPreset {
  id: string;
  name: string;
  nameEn: string;
  biome: BiomeType;
  tags: string[];
  gridWidth: number;
  gridHeight: number;
  cellSizeFt: number;
  backgroundUrl?: string;
  elements: MapElement[];
  spawnZones: SpawnZoneDefinition[];
  description?: string;
}

/**
 * Спецификация открытого формата Universal VTT (.dd2vtt / .uvtt)
 */
export interface UVTTPoint {
  x: number;
  y: number;
}

export interface UVTTResolution {
  map_origin: UVTTPoint;
  map_size: UVTTPoint;
  pixels_per_grid: number;
}

export interface UVTTPortal {
  position: UVTTPoint;
  bounds: UVTTPoint[];
  closed: boolean;
  freestanding?: boolean;
}

export interface UVTTLight {
  position: UVTTPoint;
  range: number;
  intensity: number;
  color: string;
}

export interface UniversalVTT {
  format: number;
  resolution: UVTTResolution;
  line_of_sight: UVTTPoint[][];
  objects_line_of_sight?: UVTTPoint[][];
  portals?: UVTTPortal[];
  environment?: {
    baked_lighting?: boolean;
    ambient_light?: string;
  };
  lights?: UVTTLight[];
  image?: string;
}

/**
 * Запись в реестре карт для каталога по тегам
 */
export interface MapManifestEntry {
  id: string;
  name: string;
  nameEn: string;
  biome: BiomeType;
  tags: string[];
  gridWidth: number;
  gridHeight: number;
  indoor: boolean;
  hazards: Array<"lava" | "water" | "pit" | "difficult">;
  fileUrl?: string;
  previewUrl?: string;
}

/**
 * Запрос для подбора карты ИИ Мастером или поисковым алгоритмом
 */
export interface MapTagQuery {
  tags?: string[];
  biome?: BiomeType;
  indoor?: boolean;
  hazards?: string[];
  minWidth?: number;
  minHeight?: number;
}
