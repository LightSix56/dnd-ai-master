// Как выглядит каждый биом: текстуры земли и сплошного, дороги, жидкость, затемнение.

import type { ProcgenBiome } from "./layout";

export type TextureKey =
  | "caveFloorA"
  | "caveFloorB"
  | "caveRock"
  | "grassA"
  | "grassB"
  | "sandA"
  | "sandB"
  | "stoneTiles"
  | "woodFloor"
  | "dirtPath"
  | "brick"
  | "roof"
  | "cobble";

export const TEXTURE_FILES: Record<TextureKey, string> = {
  caveFloorA: "/textures/cc0/cave-floor-a.png",
  caveFloorB: "/textures/cc0/cave-floor-b.png",
  caveRock: "/textures/cc0/cave-rock.png",
  grassA: "/textures/cc0/grass-a.png",
  grassB: "/textures/cc0/grass-b.png",
  sandA: "/textures/cc0/sand-a.png",
  sandB: "/textures/cc0/sand-b.png",
  stoneTiles: "/textures/cc0/stone-tiles.png",
  woodFloor: "/textures/cc0/wood-floor.png",
  dirtPath: "/textures/cc0/dirt-path.png",
  brick: "/textures/cc0/brick.png",
  roof: "/textures/cc0/roof.png",
  cobble: "/textures/cc0/cobble.png",
};

export interface Palette {
  groundA: TextureKey;
  groundB: TextureKey;
  /** Сила пятен второй текстуры земли (0 — нет) */
  groundMix: number;
  /** Цвет поверх земли: снег */
  groundTint?: string;
  /** Как выглядит сплошное: рельефная скала, каменная кладка, крыши домов */
  solid: "rock" | "brick" | "roof";
  solidTexture: TextureKey;
  /** Тропы и дороги по путям плана; ширина в клетках */
  road?: { texture: TextureKey; width: number; tint?: string };
  liquid: "water" | "swamp" | "sea" | "lava";
  /** Тень у основания стен (0 — нет) */
  ambientOcclusion: number;
  /** Затемнение краёв карты */
  vignette: number;
  /** Яркость сплошного (скала на открытой местности светлее, чем в пещере) */
  solidLight?: number;
}

export const PALETTES: Record<ProcgenBiome, Palette> = {
  cave: { groundA: "caveFloorA", groundB: "caveFloorB", groundMix: 0.7, solid: "rock", solidTexture: "caveRock", liquid: "water", ambientOcclusion: 1, vignette: 0.45 },
  lava: { groundA: "caveFloorB", groundB: "caveFloorA", groundMix: 0.6, groundTint: "rgba(70,22,10,0.38)", solid: "rock", solidTexture: "caveRock", liquid: "lava", ambientOcclusion: 1, vignette: 0.55 },
  dungeon: { groundA: "stoneTiles", groundB: "stoneTiles", groundMix: 0, solid: "brick", solidTexture: "brick", liquid: "water", ambientOcclusion: 0.8, vignette: 0.4 },
  tavern: { groundA: "woodFloor", groundB: "woodFloor", groundMix: 0, groundTint: "rgba(45,24,10,0.4)", solid: "brick", solidTexture: "brick", liquid: "water", ambientOcclusion: 0.6, vignette: 0.3 },
  forest: { groundA: "grassA", groundB: "grassB", groundMix: 0.7, solid: "rock", solidTexture: "caveRock", road: { texture: "dirtPath", width: 1.1 }, liquid: "water", ambientOcclusion: 0.4, vignette: 0.25 },
  swamp: { groundA: "grassB", groundB: "caveFloorA", groundMix: 0.8, solid: "rock", solidTexture: "caveRock", road: { texture: "caveFloorB", width: 0.9 }, liquid: "swamp", ambientOcclusion: 0.4, vignette: 0.35 },
  desert: { groundA: "sandA", groundB: "sandB", groundMix: 0.6, solid: "rock", solidTexture: "caveRock", road: { texture: "sandB", width: 1.1 }, liquid: "water", ambientOcclusion: 0.4, vignette: 0.2 },
  snow: { groundA: "sandA", groundB: "sandB", groundMix: 0.4, groundTint: "rgba(238,243,250,0.82)", solid: "rock", solidTexture: "caveRock", road: { texture: "sandB", width: 1, tint: "rgba(220,226,236,0.6)" }, liquid: "water", ambientOcclusion: 0.4, vignette: 0.2 },
  mountain: { groundA: "caveFloorA", groundB: "grassA", groundMix: 0.4, solid: "rock", solidTexture: "caveRock", road: { texture: "dirtPath", width: 1.4 }, liquid: "water", ambientOcclusion: 0.8, vignette: 0.3, solidLight: 1.45 },
  coastal: { groundA: "sandA", groundB: "sandB", groundMix: 0.6, solid: "rock", solidTexture: "caveRock", liquid: "sea", ambientOcclusion: 0.4, vignette: 0.2 },
  urban: { groundA: "cobble", groundB: "stoneTiles", groundMix: 0.3, solid: "roof", solidTexture: "roof", liquid: "water", ambientOcclusion: 0.7, vignette: 0.25 },
};
