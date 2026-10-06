// Какой генератор рисует какой биом. Мастер и старые пресеты называют местность
// по-разному (forest_ambush, city_street, lava_cave…) — приводим к своим биомам.

import type { CellKind } from "./markup";
import type { DecorKind, ProcgenBiome } from "./layout";

export const PROCGEN_BIOMES: ProcgenBiome[] = [
  "cave",
  "lava",
  "dungeon",
  "tavern",
  "forest",
  "swamp",
  "desert",
  "snow",
  "mountain",
  "coastal",
  "urban",
];

/** Порядок важен: первое совпадение побеждает (snowy_mountain — снег, lava_cave — лава) */
const KEYWORDS: [ProcgenBiome, RegExp][] = [
  ["lava", /lava|volcan|magma|forge|foundry/],
  ["tavern", /tavern|inn\b|pub/],
  ["snow", /snow|ice|frost|tundra/],
  ["swamp", /swamp|bog|marsh/],
  ["desert", /desert|dune|pyramid|sand/],
  ["coastal", /coast|ship|dock|harbor|harbour|sea|beach|shore/],
  ["urban", /urban|city|street|town|village/],
  ["mountain", /mountain|chasm|cliff|bridge|hill/],
  ["forest", /forest|wood|bandit|spider|jungle|open_field|field/],
  ["dungeon", /dungeon|prison|crypt|tomb|sewer|tower|castle|temple|graveyard|arena|ruin/],
  ["cave", /cave|underdark|mine|cavern/],
];

export function resolveProcgenBiome(name: string | null | undefined): ProcgenBiome {
  const key = (name ?? "").trim().toLowerCase();
  if ((PROCGEN_BIOMES as string[]).includes(key)) return key as ProcgenBiome;
  return KEYWORDS.find(([, re]) => re.test(key))?.[0] ?? "cave";
}

/** Какая жидкость на картах биома */
export const LIQUID: Record<ProcgenBiome, "water" | "lava"> = Object.fromEntries(
  PROCGEN_BIOMES.map((b) => [b, b === "lava" ? "lava" : "water"])
) as Record<ProcgenBiome, "water" | "lava">;

/** Как объект размечается на сетке; null — только картинка */
export const DECOR_CELL: Record<DecorKind, CellKind | null> = {
  boulder: "cover",
  rubble: "difficult",
  stalagmite: null,
  tree: "obstacle",
  bush: "difficult",
  reed: "difficult",
  rock: "obstacle",
  cactus: "obstacle",
  dune: "difficult",
  ice: "difficult",
  pine: "obstacle",
  column: "obstacle",
  crate: "cover",
  barrel: "cover",
  table: "cover",
  counter: "cover",
  cart: "cover",
  well: "obstacle",
  stall: "cover",
};

/** Подписи на карте */
export const BIOME_NAMES: Record<ProcgenBiome, string> = {
  cave: "Пещера",
  lava: "Лавовая пещера",
  dungeon: "Подземелье",
  tavern: "Таверна",
  forest: "Лес",
  swamp: "Болото",
  desert: "Пустыня",
  snow: "Заснеженная равнина",
  mountain: "Горный перевал",
  coastal: "Побережье",
  urban: "Городские улицы",
};
