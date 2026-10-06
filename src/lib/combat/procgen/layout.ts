// Общий план процедурной карты: его отдают все генераторы, по нему строится разметка,
// зоны появления и картинка.

import type { Field } from "./field";

export type ProcgenBiome =
  | "cave"
  | "lava"
  | "dungeon"
  | "tavern"
  | "forest"
  | "swamp"
  | "desert"
  | "snow"
  | "mountain"
  | "coastal"
  | "urban";

export type DecorKind =
  | "boulder"
  | "rubble"
  | "stalagmite"
  | "tree"
  | "bush"
  | "reed"
  | "rock"
  | "cactus"
  | "dune"
  | "ice"
  | "pine"
  | "column"
  | "crate"
  | "barrel"
  | "table"
  | "counter"
  | "cart"
  | "well"
  | "stall";

/** Объект на карте. x, y — в клетках (у прямоугольных w×h — левый верхний угол) */
export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  /** Радиус в долях клетки */
  r: number;
  w?: number;
  h?: number;
}

/** Область карты (зал, комната, край открытой местности) — в клетках */
export interface Area {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export type Polyline = { x: number; y: number }[];

export interface ProcgenLayout {
  biome: ProcgenBiome;
  seed: number;
  width: number;
  height: number;
  /** 1 — можно стоять, 0 — сплошное (скала, стена, дом) */
  ground: Field;
  /** Вода или лава — какая именно, задаёт биом */
  liquid: Field;
  decor: Decor[];
  /** Места для зон партии и врагов */
  areas: Area[];
  /** Места для засады */
  flankAreas: Area[];
  /** Проходы, коридоры, улицы, тропы: по ним клетки прорезаются до проходимых */
  paths: Polyline[];
  /** Комнаты и дома в клетках — для рисовальщика */
  structures: { x: number; y: number; w: number; h: number }[];
}
