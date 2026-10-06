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

/**
 * Начала слов, по которым узнаётся биом. Название делится на слова, и слово подходит,
 * если начинается с одного из них — так «office» не превращается в снег из-за «ice».
 * Порядок важен: первое подходящее правило побеждает. Лава и пещера идут первыми, чтобы
 * «ice cave» или «sea cave» остались пещерой; «snowy_mountain» — снег, «город» — не горы.
 */
const STEMS: [ProcgenBiome, string[]][] = [
  ["lava", ["lava", "volcan", "magma", "forge", "foundry", "лава", "лавов", "вулкан", "магм"]],
  ["cave", ["cave", "cavern", "underdark", "grotto", "mine", "пещер", "грот", "шахт"]],
  ["tavern", ["tavern", "=inn", "=inns", "pub", "таверн", "трактир", "корчм"]],
  ["snow", ["snow", "=ice", "=icy", "frost", "tundra", "glacier", "winter", "снег", "снеж", "лёд", "=лед", "ледян", "ледник", "мороз", "зим", "тундр"]],
  ["swamp", ["swamp", "bog", "marsh", "=fen", "=fens", "болот", "топь", "трясин"]],
  ["desert", ["desert", "dune", "pyramid", "sand", "oasis", "пустын", "бархан", "пирамид", "песк", "песок", "оазис"]],
  ["coastal", ["coast", "ship", "dock", "harbor", "harbour", "=sea", "=seas", "seaside", "beach", "shore", "pier", "=port", "=ports", "берег", "побереж", "корабл", "пристан", "=порт", "море", "морск", "залив", "пляж"]],
  ["urban", ["urban", "city", "street", "town", "village", "market", "square", "alley", "город", "улиц", "деревн", "сел", "рын", "площад", "переул"]],
  ["mountain", ["mountain", "chasm", "cliff", "bridge", "hill", "peak", "=pass", "гор", "ущел", "скал", "перевал", "утёс", "утес", "мост", "холм"]],
  ["forest", ["forest", "wood", "bandit", "spider", "jungle", "field", "battlefield", "road", "plain", "grass", "meadow", "river", "farm", "country", "лес", "рощ", "чащ", "дорог", "тракт", "поле", "полян", "луг", "рек", "равнин", "ферм"]],
  ["dungeon", ["dungeon", "prison", "jail", "crypt", "tomb", "sewer", "tower", "castle", "temple", "graveyard", "arena", "ruin", "hall", "house", "office", "lab", "library", "manor", "mansion", "building", "подземел", "тюрь", "склеп", "гробниц", "канализ", "башн", "замк", "замок", "храм", "кладбищ", "арен", "руин", "здани", "зал", "особняк", "библиотек"]],
];

export function resolveProcgenBiome(name: string | null | undefined): ProcgenBiome {
  const words = (name ?? "").toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (words.length === 1 && (PROCGEN_BIOMES as string[]).includes(words[0])) return words[0] as ProcgenBiome;
  // «=слово» — только точное совпадение: inn не должен ловить inner, port — portal
  const matches = (w: string, stem: string) => (stem.startsWith("=") ? w === stem.slice(1) : w.startsWith(stem));
  for (const [biome, stems] of STEMS) {
    if (words.some((w) => stems.some((stem) => matches(w, stem)))) return biome;
  }
  return "cave";
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
  chair: null,
  bench: null,
  stool: null,
  hearth: "obstacle",
  bed: "cover",
  door: null,
  window: null,
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
