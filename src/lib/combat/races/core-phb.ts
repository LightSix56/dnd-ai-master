// Правила всех рас PHB 2014 и их официальных подрас (данные: data/races-2014.json).
// Боевые срабатывания (дыхание, телепорты, реакции, стойкость полуорка) — в core-phb-combat.ts.

import { conditionMods, featureMods } from "../feature-mods";
import type { AbilityKey, Combatant } from "../types";
import {
  defineRace,
  type Calc,
  type InnateSpellSpec,
  type RaceFeatureRule,
  type RaceOptionRule,
} from "./race-defs";

const skip = (id: string): RaceFeatureRule => ({ id, kind: "skip" });
const passive = (id: string, extra: Partial<RaceFeatureRule> = {}): RaceFeatureRule => ({
  id,
  kind: "passive",
  ...extra,
});
const spell = (
  spellId: string,
  name: string,
  level: number,
  minCharacterLevel: number,
  castingAbility: AbilityKey,
  usesMax = level === 0 ? 0 : 1,
  refresh: "long" | "short" = "long"
): InnateSpellSpec => ({
  spellId,
  name,
  level,
  minCharacterLevel,
  usesMax,
  refresh,
  castingAbility,
});

const conDc = (c: Calc) => 8 + c.prof + c.mod("CON");
const chaDc = (c: Calc) => 8 + c.prof + c.mod("CHA");

// ============ ОБЩИЕ ПОПРАВКИ ============

featureMods("race/dwarf/dvarfiyskaya-ustoychivost", {
  name: "Дварфийская устойчивость",
  resist: ["poison"],
  saveAdvantageConditions: ["poisoned"],
});
featureMods("race/duergar/duergarskaya-ustoychivost", {
  name: "Дуэргарская устойчивость",
  resist: ["poison"],
  saveAdvantageConditions: ["charmed", "paralyzed", "poisoned"],
});

for (const raceId of ["elf", "half-elf"] as const) {
  featureMods(`race/${raceId}/nasledie-fey`, {
    name: "Наследие фей",
    saveAdvantageConditions: ["charmed"],
    sleepImmune: true,
  });
}

featureMods("race/shadar-kai/nekroticheskoe-soprotivlenie", {
  name: "Некротическое сопротивление",
  resist: ["necrotic"],
});
conditionMods("raven_queen_blessing", {
  name: "Благословение Королевы воронов",
  mods: { resist: ["all"] },
});

featureMods("race/halfling/vezuchiy", { name: "Везучий", rerollOnes: true });
featureMods("race/halfling/khrabryy", { name: "Храбрый", saveAdvantageConditions: ["frightened"] });
featureMods("race/stout-halfling/ustoychivost-korenastykh", {
  name: "Устойчивость коренастых",
  resist: ["poison"],
  saveAdvantageConditions: ["poisoned"],
});

featureMods("race/gnome/gnomya-khitrost", {
  name: "Гномья хитрость",
  magicMentalSaveAdvantage: true,
});

featureMods("race/mark-of-storm/blagoslovenie-buri", {
  name: "Благословение бури",
  resist: ["lightning"],
});

featureMods("race/tiefling/adskoe-soprotivlenie", {
  name: "Адское сопротивление",
  resist: ["fire"],
});

// ============ ТАБЛИЦЫ ДРАКОНОРОЖДЁННЫХ ============

export interface DragonAncestrySpec {
  color: string;
  name: string;
  alias: string;
  damageType: string;
  shape: "cone" | "line";
  sizeFt: number;
  save: AbilityKey;
}

const PHB_ANCESTRIES: DragonAncestrySpec[] = [
  { color: "black", name: "Чёрный дракон", alias: "Чёрный", damageType: "acid", shape: "line", sizeFt: 30, save: "DEX" },
  { color: "blue", name: "Синий дракон", alias: "Синий", damageType: "lightning", shape: "line", sizeFt: 30, save: "DEX" },
  { color: "brass", name: "Латунный дракон", alias: "Латунный", damageType: "fire", shape: "line", sizeFt: 30, save: "DEX" },
  { color: "bronze", name: "Бронзовый дракон", alias: "Бронзовый", damageType: "lightning", shape: "line", sizeFt: 30, save: "DEX" },
  { color: "copper", name: "Медный дракон", alias: "Медный", damageType: "acid", shape: "line", sizeFt: 30, save: "DEX" },
  { color: "gold", name: "Золотой дракон", alias: "Золотой", damageType: "fire", shape: "cone", sizeFt: 15, save: "DEX" },
  { color: "green", name: "Зелёный дракон", alias: "Зелёный", damageType: "poison", shape: "cone", sizeFt: 15, save: "CON" },
  { color: "red", name: "Красный дракон", alias: "Красный", damageType: "fire", shape: "cone", sizeFt: 15, save: "DEX" },
  { color: "silver", name: "Серебряный дракон", alias: "Серебряный", damageType: "cold", shape: "cone", sizeFt: 15, save: "CON" },
  { color: "white", name: "Белый дракон", alias: "Белый", damageType: "cold", shape: "cone", sizeFt: 15, save: "CON" },
];

const CHROMATIC_COLORS = new Set(["black", "blue", "green", "red", "white"]);
const METALLIC_COLORS = new Set(["brass", "bronze", "copper", "gold", "silver"]);

const GEM_ANCESTRIES: DragonAncestrySpec[] = [
  { color: "amethyst", name: "Аметистовый дракон", alias: "Аметистовый", damageType: "force", shape: "cone", sizeFt: 15, save: "DEX" },
  { color: "crystal", name: "Кристальный дракон", alias: "Кристальный", damageType: "radiant", shape: "cone", sizeFt: 15, save: "DEX" },
  { color: "emerald", name: "Изумрудный дракон", alias: "Изумрудный", damageType: "psychic", shape: "cone", sizeFt: 15, save: "DEX" },
  { color: "sapphire", name: "Сапфировый дракон", alias: "Сапфировый", damageType: "thunder", shape: "cone", sizeFt: 15, save: "DEX" },
  { color: "topaz", name: "Топазовый дракон", alias: "Топазовый", damageType: "necrotic", shape: "cone", sizeFt: 15, save: "DEX" },
];

const ALL_ANCESTRIES = [...PHB_ANCESTRIES, ...GEM_ANCESTRIES];

function buildDragonOptions(
  ownerId: string,
  prefix: string,
  list: DragonAncestrySpec[],
  ftdShape?: { shape: "cone" | "line"; sizeFt: number }
): RaceOptionRule[] {
  return list.map((a) => {
    const id = `${prefix}-${a.color}`;
    const shape = ftdShape?.shape ?? a.shape;
    const sizeFt = ftdShape?.sizeFt ?? a.sizeFt;
    const save = ftdShape ? "DEX" : a.save;
    featureMods(`race/${ownerId}/${id}`, {
      name: `Наследие (${a.alias.toLowerCase()})`,
      resist: [a.damageType],
    });
    return {
      id,
      kind: "passive" as const,
      name: a.name,
      description: `Урон: ${a.damageType}, ${shape === "cone" ? `конус ${sizeFt} фт` : `линия ${sizeFt}×5 фт`}, спасбросок ${save}.`,
      tokens: [id, `ancestry-${a.color}`, a.color],
      aliases: [a.alias, a.color],
      resistances: [a.damageType],
    };
  });
}

export function dragonbornAncestry(c: Combatant): DragonAncestrySpec {
  for (const ab of c.abilities ?? []) {
    const key = ab.parameters?.srdKey ?? "";
    const match = key.match(/^race\/[^/]+\/(?:draconic|chromatic|metallic|gem)-([a-z]+)$/);
    if (match) {
      const found = ALL_ANCESTRIES.find((a) => a.color === match[1]);
      if (found) {
        if (c.subraceId === "chromatic-dragonborn") return { ...found, shape: "line", sizeFt: 30, save: "DEX" };
        if (c.subraceId === "metallic-dragonborn" || c.subraceId === "gem-dragonborn") {
          return { ...found, shape: "cone", sizeFt: 15, save: "DEX" };
        }
        return found;
      }
    }
  }
  for (const v of c.racialVariants ?? []) {
    const clean = v.replace(/^(?:draconic|chromatic|metallic|gem|ancestry)-/, "");
    const found = ALL_ANCESTRIES.find((a) => a.color === clean);
    if (found) return found;
  }
  const res = c.damageResistances?.[0]?.toLowerCase();
  if (res) {
    const found = ALL_ANCESTRIES.find((a) => a.damageType === res);
    if (found) return found;
  }
  return PHB_ANCESTRIES.find((a) => a.color === "red")!;
}

export const phbBreathDice = (level: number) =>
  level >= 16 ? "5d6" : level >= 11 ? "4d6" : level >= 6 ? "3d6" : "2d6";
export const ftdBreathDice = (level: number) =>
  level >= 17 ? "4d10" : level >= 11 ? "3d10" : level >= 5 ? "2d10" : "1d10";

conditionMods("chromatic_warding", {
  name: "Защита цветного дракона",
  mods: (owner) => ({ immune: [dragonbornAncestry(owner).damageType] }),
});

// ============ СЕЗОНЫ ЭЛАДРИНА ============

export type EladrinSeason = "osen" | "zima" | "vesna" | "leto";

const ELADRIN_SEASONS: Array<{ id: EladrinSeason; name: string; aliases: string[]; desc: string }> = [
  { id: "osen", name: "Осень", aliases: ["Autumn"], desc: "После телепортации до 2 врагов в 10 фт — спас МУД или очарованы." },
  { id: "zima", name: "Зима", aliases: ["Winter"], desc: "До телепортации 1 враг в 5 фт — спас МУД или испуган." },
  { id: "vesna", name: "Весна", aliases: ["Spring"], desc: "Можно телепортировать согласного союзника в 5 фт вместо себя." },
  { id: "leto", name: "Лето", aliases: ["Summer"], desc: "После телепортации враги в 5 фт получают урон огнём = мод. ХАР (мин. 1)." },
];

export function eladrinSeason(c: Combatant): EladrinSeason | null {
  for (const s of ELADRIN_SEASONS) {
    if (c.racialVariants?.includes(s.id) || c.racialVariants?.includes(s.aliases[0].toLowerCase())) return s.id;
    if (c.abilities.some((a) => a.parameters?.srdKey === `race/eladrin/${s.id}`)) return s.id;
  }
  return null;
}

// ============ ТАБЛИЦА РОДОСЛОВНЫХ ТИФЛИНГА ============

interface TieflingLineageSpec {
  traitId: string;
  spells: InnateSpellSpec[];
}

const TIEFLING_LINEAGES: Record<string, TieflingLineageSpec> = {
  asmodeus: {
    traitId: "dyavolskoe-nasledie",
    spells: [
      spell("thaumaturgy", "Чудотворство", 0, 1, "CHA", 0),
      spell("hellish-rebuke", "Адское возмездие", 2, 3, "CHA", 1),
      spell("darkness", "Тьма", 2, 5, "CHA", 1),
    ],
  },
  baalzebul: {
    traitId: "nasledie-maladomini",
    spells: [
      spell("thaumaturgy", "Чудотворство", 0, 1, "CHA", 0),
      spell("ray-of-sickness", "Луч болезни", 2, 3, "CHA", 1),
      spell("crown-of-madness", "Корона безумия", 2, 5, "CHA", 1),
    ],
  },
  glasya: {
    traitId: "nasledie-malbolga",
    spells: [
      spell("minor-illusion", "Малая иллюзия", 0, 1, "CHA", 0),
      spell("disguise-self", "Маскировка", 1, 3, "CHA", 1),
      spell("invisibility", "Невидимость", 2, 5, "CHA", 1),
    ],
  },
  dispater: {
    traitId: "nasledie-disa",
    spells: [
      spell("thaumaturgy", "Чудотворство", 0, 1, "CHA", 0),
      spell("disguise-self", "Маскировка", 1, 3, "CHA", 1),
      spell("detect-thoughts", "Обнаружение мыслей", 2, 5, "CHA", 1),
    ],
  },
  zariel: {
    traitId: "nasledie-avernusa",
    spells: [
      spell("thaumaturgy", "Чудотворство", 0, 1, "CHA", 0),
      spell("searing-smite", "Обжигающая кара", 2, 3, "CHA", 1),
      spell("branding-smite", "Клеймящая кара", 2, 5, "CHA", 1),
    ],
  },
  levistus: {
    traitId: "nasledie-stigii",
    spells: [
      spell("ray-of-frost", "Луч холода", 0, 1, "CHA", 0),
      spell("armor-of-agathys", "Доспех Агатиса", 2, 3, "CHA", 1),
      spell("darkness", "Тьма", 2, 5, "CHA", 1),
    ],
  },
  mammon: {
    traitId: "nasledie-minaurosa",
    spells: [
      spell("mage-hand", "Волшебная рука", 0, 1, "CHA", 0),
      spell("floating-disk", "Парящий диск", 1, 3, "CHA", 1),
      spell("arcane-lock", "Магический замок", 2, 5, "CHA", 1),
    ],
  },
  mephistopheles: {
    traitId: "nasledie-kanii",
    spells: [
      spell("mage-hand", "Волшебная рука", 0, 1, "CHA", 0),
      spell("burning-hands", "Огненные ладони", 2, 3, "CHA", 1),
      spell("flame-blade", "Пламенеющий клинок", 2, 5, "CHA", 1),
    ],
  },
  fierna: {
    traitId: "nasledie-flegetosa",
    spells: [
      spell("friends", "Дружба", 0, 1, "CHA", 0),
      spell("charm-person", "Очарование гуманоида", 2, 3, "CHA", 1),
      spell("suggestion", "Внушение", 2, 5, "CHA", 1),
    ],
  },
};

// ============ ОПИСАНИЯ 9 РАС PHB 2014 ============

// 1. ЧЕЛОВЕК
defineRace("human", {
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    yazyki: skip("yazyki"),
  },
  subraces: {
    "standard-human": {
      traits: { "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik") },
    },
    "variant-human": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        navyki: skip("navyki"),
        cherta: skip("cherta"),
      },
    },
    "mark-of-finding": {
      darkvision: 60,
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "temnoe-zrenie": skip("temnoe-zrenie"),
        "intuitsiya-okhotnika": skip("intuitsiya-okhotnika"),
        "magiya-iskatelya": skip("magiya-iskatelya"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [
        spell("hunters-mark", "Метка охотника", 1, 1, "WIS", 1),
        spell("locate-object", "Поиск предмета", 2, 3, "WIS", 1),
      ],
    },
    "mark-of-handling": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "dikaya-intuitsiya": skip("dikaya-intuitsiya"),
        "pervobytnaya-svyaz": skip("pervobytnaya-svyaz"),
        "chem-krupnee-protivnik": skip("chem-krupnee-protivnik"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [
        spell("animal-friendship", "Дружба с животными", 1, 1, "WIS", 1, "short"),
        spell("speak-with-animals", "Разговор с животными", 1, 1, "WIS", 1, "short"),
      ],
    },
    "mark-of-making": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "intuitsiya-remeslennika": skip("intuitsiya-remeslennika"),
        "dar-tvortsa": skip("dar-tvortsa"),
        "kuznechnaya-magiya": skip("kuznechnaya-magiya"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [
        spell("mending", "Починка", 0, 1, "INT", 0),
        spell("magic-weapon", "Магическое оружие", 2, 3, "INT", 1),
      ],
    },
    "mark-of-passage": {
      speed: { walk: 35 },
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "skorost-kurera": skip("skorost-kurera"),
        "intuitivnoe-dvizhenie": skip("intuitivnoe-dvizhenie"),
        "magicheskiy-prokhod": skip("magicheskiy-prokhod"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [spell("misty-step", "Туманный шаг", 2, 1, "DEX", 1)],
    },
    "mark-of-sentinel": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "intuitsiya-strazha": skip("intuitsiya-strazha"),
        "shchit-strazha": skip("shchit-strazha"),
        "bditelnyy-strazh": {
          id: "bditelnyy-strazh",
          kind: "active",
          cost: "reaction",
          target: "ally",
          range: 5,
          offTurn: true,
          uses: { max: 1, refresh: "long" },
        },
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [spell("shield", "Щит", 1, 1, "WIS", 1)],
    },
  },
});

// 2. ДВАРФ
defineRace("dwarf", {
  speed: { walk: 25 },
  darkvision: 60,
  defaultResistances: ["poison"],
  traits: {
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "dvarfiyskaya-ustoychivost": passive("dvarfiyskaya-ustoychivost"),
    "dvarfiyskaya-boevaya-trenirovka": skip("dvarfiyskaya-boevaya-trenirovka"),
    "vladenie-instrumentami": skip("vladenie-instrumentami"),
    "znanie-kamnya": skip("znanie-kamnya"),
    yazyki: skip("yazyki"),
  },
  subraces: {
    "mountain-dwarf": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "vladenie-dospekhami-dvarfov": skip("vladenie-dospekhami-dvarfov"),
      },
    },
    "hill-dwarf": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "dvarfiyskaya-vyderzhka": passive("dvarfiyskaya-vyderzhka", { value: (c) => c.level }),
      },
    },
    duergar: {
      darkvision: 120,
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "prevoskhodnoe-temnoe-zrenie": skip("prevoskhodnoe-temnoe-zrenie"),
        "duergarskaya-ustoychivost": passive("duergarskaya-ustoychivost"),
        "duergarskaya-magiya": skip("duergarskaya-magiya"),
        "chuvstvitelnost-k-solnechnomu-svetu": passive("chuvstvitelnost-k-solnechnomu-svetu"),
      },
      innateSpells: [
        spell("enlarge-reduce", "Увеличение/Уменьшение", 2, 3, "INT", 1),
        spell("invisibility", "Невидимость", 2, 5, "INT", 1),
      ],
    },
    "mark-of-warding": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "intuitsiya-nadziratelya": skip("intuitsiya-nadziratelya"),
        "oberegi-i-pechati": skip("oberegi-i-pechati"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [
        spell("mage-armor", "Доспехи мага", 1, 1, "INT", 1),
        spell("arcane-lock", "Магический замок", 2, 3, "INT", 1),
      ],
    },
  },
});

// 3. ЭЛЬФ
defineRace("elf", {
  darkvision: 60,
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "obostrennye-chuvstva": skip("obostrennye-chuvstva"),
    "nasledie-fey": passive("nasledie-fey"),
    trans: skip("trans"),
    yazyki: skip("yazyki"),
  },
  subraces: {
    "high-elf": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "vladenie-elfiyskim-oruzhiem": skip("vladenie-elfiyskim-oruzhiem"),
        zagovor: skip("zagovor"),
        "dopolnitelnyy-yazyk": skip("dopolnitelnyy-yazyk"),
      },
      innateSpells: [spell("ray-of-frost", "Луч холода", 0, 1, "INT", 0)],
    },
    "wood-elf": {
      speed: { walk: 35 },
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "vladenie-elfiyskim-oruzhiem": skip("vladenie-elfiyskim-oruzhiem"),
        "bystrye-nogi": skip("bystrye-nogi"),
        "maskirovka-v-dikoy-mestnosti": passive("maskirovka-v-dikoy-mestnosti"),
      },
    },
    drow: {
      darkvision: 120,
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "prevoskhodnoe-temnoe-zrenie": skip("prevoskhodnoe-temnoe-zrenie"),
        "chuvstvitelnost-k-solntsu": passive("chuvstvitelnost-k-solntsu"),
        "magiya-drou": skip("magiya-drou"),
        "vladenie-oruzhiem-drou": skip("vladenie-oruzhiem-drou"),
      },
      innateSpells: [
        spell("dancing-lights", "Пляшущие огоньки", 0, 1, "CHA", 0),
        spell("faerie-fire", "Огонь фей", 1, 3, "CHA", 1),
        spell("darkness", "Тьма", 2, 5, "CHA", 1),
      ],
    },
    "sea-elf": {
      speed: { swim: 30 },
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "boevaya-podgotovka-morskikh-elfov": skip("boevaya-podgotovka-morskikh-elfov"),
        "ditya-morey": skip("ditya-morey"),
        "morskie-pobratimy": skip("morskie-pobratimy"),
        yazyki: skip("yazyki"),
      },
    },
    "shadar-kai": {
      resistances: ["necrotic"],
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "nekroticheskoe-soprotivlenie": passive("nekroticheskoe-soprotivlenie"),
        "blagoslovenie-korolevy-voronov": {
          id: "blagoslovenie-korolevy-voronov",
          kind: "active",
          cost: "bonus",
          target: "point",
          range: 30,
          minLevel: 1,
          uses: { max: 1, refresh: "long" },
        },
      },
    },
    eladrin: {
      traits: {
        osen: skip("osen"),
        zima: skip("zima"),
        vesna: skip("vesna"),
        leto: skip("leto"),
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "feyskiy-shag": {
          id: "feyskiy-shag",
          kind: "active",
          cost: "bonus",
          target: "point",
          range: 30,
          minLevel: 1,
          save: "WIS",
          dc: chaDc,
          uses: { max: 1, refresh: "short" },
          pick: "sheet",
          options: ELADRIN_SEASONS.map((s) => ({
            id: s.id,
            kind: "passive" as const,
            name: s.name,
            description: s.desc,
            minLevel: 3,
            tokens: [s.id, s.aliases[0].toLowerCase()],
            aliases: s.aliases,
          })),
        },
      },
    },
    "mark-of-shadow": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "intuitsiya-lukavogo": skip("intuitsiya-lukavogo"),
        "ochertaniya-teney": skip("ochertaniya-teney"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [
        spell("minor-illusion", "Малая иллюзия", 0, 1, "CHA", 0),
        spell("invisibility", "Невидимость", 2, 3, "CHA", 1),
        spell("pass-without-trace", "Бесследное передвижение", 2, 5, "CHA", 1),
      ],
    },
    "pallid-elf": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "ostryy-um": skip("ostryy-um"),
        "blagoslovenie-lunnogo-tkacha": skip("blagoslovenie-lunnogo-tkacha"),
      },
      innateSpells: [
        spell("light", "Свет", 0, 1, "WIS", 0),
        spell("sleep", "Усыпление", 1, 3, "WIS", 1),
        spell("invisibility", "Невидимость", 2, 5, "WIS", 1),
      ],
    },
  },
});

// 4. ПОЛУРОСЛИК
defineRace("halfling", {
  speed: { walk: 25 },
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    vezuchiy: passive("vezuchiy"),
    khrabryy: passive("khrabryy"),
    "provorstvo-poluroslikov": skip("provorstvo-poluroslikov"),
    yazyki: skip("yazyki"),
  },
  subraces: {
    "stout-halfling": {
      resistances: ["poison"],
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "ustoychivost-korenastykh": passive("ustoychivost-korenastykh"),
      },
    },
    "lightfoot-halfling": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "estestvennaya-skrytnost": passive("estestvennaya-skrytnost"),
      },
    },
    "ghostwise-halfling": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "besshumnaya-rech": skip("besshumnaya-rech"),
      },
    },
    "lotusden-halfling": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "ditya-lesa": skip("ditya-lesa"),
        "bluzhdanie-po-lesu": passive("bluzhdanie-po-lesu"),
      },
      innateSpells: [
        spell("druidcraft", "Искусство друидов", 0, 1, "WIS", 0),
        spell("entangle", "Опутывание", 1, 3, "WIS", 1),
        spell("spike-growth", "Шипастый нарост", 2, 5, "WIS", 1),
      ],
    },
    "mark-of-healing": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "vrachebnaya-intuitsiya": skip("vrachebnaya-intuitsiya"),
        "istselyayushchee-prikosnovenie": skip("istselyayushchee-prikosnovenie"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [
        spell("cure-wounds", "Лечение ран", 1, 1, "WIS", 1),
        spell("lesser-restoration", "Низшее восстановление", 2, 3, "WIS", 1),
      ],
    },
    "mark-of-hospitality": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "vsegda-gostepriimen": skip("vsegda-gostepriimen"),
        "magiya-traktirshchika": skip("magiya-traktirshchika"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [spell("aid", "Помощь", 2, 3, "CHA", 1)],
    },
  },
});

// 5. ДРАКОНОРОЖДЁННЫЙ
const FTD_REPLACED_BASE = ["nasledie-drakonov", "oruzhie-dykhaniya", "soprotivlenie-uronu"];

defineRace("dragonborn", {
  traits: {
    "uvelichenie-kharakteristiki": skip("uvelichenie-kharakteristiki"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "nasledie-drakonov": {
      id: "nasledie-drakonov",
      kind: "skip",
      pick: "sheet",
      options: buildDragonOptions("dragonborn", "draconic", PHB_ANCESTRIES),
    },
    "oruzhie-dykhaniya": {
      id: "oruzhie-dykhaniya",
      kind: "active",
      cost: "action",
      minLevel: 1,
      target: "point",
      range: 30,
      save: "DEX",
      dc: conDc,
      uses: { max: 1, refresh: "short" },
      note: (c) => `Урон ${phbBreathDice(c.level)}, СЛ ${conDc(c)}, половина при успехе.`,
    },
    "soprotivlenie-uronu": passive("soprotivlenie-uronu"),
    yazyki: skip("yazyki"),
  },
  subraces: {
    draconblood: {
      darkvision: 60,
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "temnoe-zrenie": skip("temnoe-zrenie"),
        "dovleyushchee-prisutstvie": skip("dovleyushchee-prisutstvie"),
      },
    },
    ravenite: {
      darkvision: 60,
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "temnoe-zrenie": skip("temnoe-zrenie"),
        "mstitelnoe-napadenie": {
          id: "mstitelnoe-napadenie",
          kind: "active",
          cost: "reaction",
          target: "creature",
          range: 5,
          offTurn: true,
          uses: { max: 1, refresh: "short" },
        },
      },
    },
    "chromatic-dragonborn": {
      replacesTraits: FTD_REPLACED_BASE,
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "vid-sushchestva": skip("vid-sushchestva"),
        razmer: skip("razmer"),
        skorost: skip("skorost"),
        yazyki: skip("yazyki"),
        "nasledie-tsvetnogo-drakona": {
          id: "nasledie-tsvetnogo-drakona",
          kind: "skip",
          pick: "sheet",
          options: buildDragonOptions(
            "chromatic-dragonborn",
            "chromatic",
            PHB_ANCESTRIES.filter((a) => CHROMATIC_COLORS.has(a.color)),
            { shape: "line", sizeFt: 30 }
          ),
        },
        "oruzhie-dykhaniya": {
          id: "oruzhie-dykhaniya",
          kind: "active",
          cost: "action",
          minLevel: 1,
          target: "point",
          range: 30,
          save: "DEX",
          dc: conDc,
          uses: "profBonus",
          refresh: "long",
          note: (c) => `Линия 30×5 фт, урон ${ftdBreathDice(c.level)}, СЛ ${conDc(c)}.`,
        },
        "soprotivlenie-drakona": passive("soprotivlenie-drakona"),
        "zashchita-tsvetnogo-drakona": {
          id: "zashchita-tsvetnogo-drakona",
          kind: "active",
          cost: "action",
          minLevel: 5,
          uses: { max: 1, refresh: "long" },
        },
      },
    },
    "metallic-dragonborn": {
      replacesTraits: FTD_REPLACED_BASE,
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "vid-sushchestva": skip("vid-sushchestva"),
        razmer: skip("razmer"),
        skorost: skip("skorost"),
        yazyki: skip("yazyki"),
        "nasledie-metallicheskogo-drakona": {
          id: "nasledie-metallicheskogo-drakona",
          kind: "skip",
          pick: "sheet",
          options: buildDragonOptions(
            "metallic-dragonborn",
            "metallic",
            PHB_ANCESTRIES.filter((a) => METALLIC_COLORS.has(a.color)),
            { shape: "cone", sizeFt: 15 }
          ),
        },
        "oruzhie-dykhaniya": {
          id: "oruzhie-dykhaniya",
          kind: "active",
          cost: "action",
          minLevel: 1,
          target: "point",
          range: 15,
          save: "DEX",
          dc: conDc,
          uses: "profBonus",
          refresh: "long",
          note: (c) => `Конус 15 фт, урон ${ftdBreathDice(c.level)}, СЛ ${conDc(c)}.`,
        },
        "soprotivlenie-drakona": passive("soprotivlenie-drakona"),
        "metallicheskoe-oruzhie-dykhaniya": {
          id: "metallicheskoe-oruzhie-dykhaniya",
          kind: "pool",
          minLevel: 5,
          uses: { max: 1, refresh: "long" },
          pick: "all",
          options: [
            {
              id: "metallic-enervating",
              kind: "active",
              cost: "action",
              target: "point",
              range: 15,
              save: "CON",
              dc: conDc,
              pool: "race/metallic-dragonborn/metallicheskoe-oruzhie-dykhaniya",
              name: "Изнуряющее дыхание",
              description: "Конус 15 фт: спас ТЕЛ или недееспособен до начала вашего следующего хода.",
            },
            {
              id: "metallic-repulsion",
              kind: "active",
              cost: "action",
              target: "point",
              range: 15,
              save: "STR",
              dc: conDc,
              pool: "race/metallic-dragonborn/metallicheskoe-oruzhie-dykhaniya",
              name: "Отталкивающее дыхание",
              description: "Конус 15 фт: спас СИЛ или толчок на 20 фт и сбит с ног.",
            },
          ],
        },
      },
    },
    "gem-dragonborn": {
      replacesTraits: FTD_REPLACED_BASE,
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "vid-sushchestva": skip("vid-sushchestva"),
        razmer: skip("razmer"),
        skorost: skip("skorost"),
        yazyki: skip("yazyki"),
        "nasledie-samotsvetnogo-drakona": {
          id: "nasledie-samotsvetnogo-drakona",
          kind: "skip",
          pick: "sheet",
          options: buildDragonOptions("gem-dragonborn", "gem", GEM_ANCESTRIES, { shape: "cone", sizeFt: 15 }),
        },
        "oruzhie-dykhaniya": {
          id: "oruzhie-dykhaniya",
          kind: "active",
          cost: "action",
          minLevel: 1,
          target: "point",
          range: 15,
          save: "DEX",
          dc: conDc,
          uses: "profBonus",
          refresh: "long",
          note: (c) => `Конус 15 фт, урон ${ftdBreathDice(c.level)}, СЛ ${conDc(c)}.`,
        },
        "soprotivlenie-drakona": passive("soprotivlenie-drakona"),
        "psionicheskiy-razum": skip("psionicheskiy-razum"),
        "polet-samotsvetnogo-drakona": {
          id: "polet-samotsvetnogo-drakona",
          kind: "active",
          cost: "bonus",
          minLevel: 5,
          uses: { max: 1, refresh: "long" },
        },
      },
    },
  },
});

// 6. ГНОМ
defineRace("gnome", {
  speed: { walk: 25 },
  darkvision: 60,
  traits: {
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "gnomya-khitrost": passive("gnomya-khitrost"),
    yazyki: skip("yazyki"),
  },
  subraces: {
    "forest-gnome": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "prirodnaya-illyuziya": skip("prirodnaya-illyuziya"),
        "obshchenie-s-malenkimi-zveryami": skip("obshchenie-s-malenkimi-zveryami"),
      },
      innateSpells: [spell("minor-illusion", "Малая иллюзия", 0, 1, "INT", 0)],
    },
    "rock-gnome": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "remeslennye-znaniya": skip("remeslennye-znaniya"),
        zhestyanshchik: skip("zhestyanshchik"),
        "zavodnaya-igrushka": skip("zavodnaya-igrushka"),
        zazhigalka: skip("zazhigalka"),
        "muzykalnaya-shkatulka": skip("muzykalnaya-shkatulka"),
      },
    },
    "deep-gnome": {
      darkvision: 120,
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "prevoskhodnoe-temnoe-zrenie": skip("prevoskhodnoe-temnoe-zrenie"),
        "kamennyy-kamuflyazh": passive("kamennyy-kamuflyazh"),
        "optsionalnaya-cherta": skip("optsionalnaya-cherta"),
      },
    },
    "mark-of-scribing": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "talant-pisarya": skip("talant-pisarya"),
        "pronitsatelnost-pistsa": skip("pronitsatelnost-pistsa"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [spell("silence", "Тишина", 2, 5, "INT", 1)],
    },
  },
});

// 7. ПОЛУЭЛЬФ
defineRace("half-elf", {
  darkvision: 60,
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "nasledie-fey": passive("nasledie-fey"),
    "universalnost-navykov": skip("universalnost-navykov"),
    yazyki: skip("yazyki"),
  },
  subraces: {
    "half-elf-faerun": {
      speed: { swim: 30 },
      traits: { "magiya-drou": skip("magiya-drou") },
      innateSpells: [
        spell("dancing-lights", "Пляшущие огоньки", 0, 1, "CHA", 0),
        spell("faerie-fire", "Огонь фей", 1, 3, "CHA", 1),
        spell("darkness", "Тьма", 2, 5, "CHA", 1),
      ],
    },
    "mark-of-detection": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "deduktivnaya-intuitsiya": skip("deduktivnaya-intuitsiya"),
        "magicheskoe-obnaruzhenie": skip("magicheskoe-obnaruzhenie"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [
        spell("detect-magic", "Обнаружение магии", 1, 1, "WIS", 1),
        spell("see-invisibility", "Видение невидимого", 2, 3, "WIS", 1),
      ],
    },
    "mark-of-storm": {
      resistances: ["lightning"],
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "intuitsiya-vetrodela": skip("intuitsiya-vetrodela"),
        "blagoslovenie-buri": passive("blagoslovenie-buri"),
        "vstrechnye-vetra": skip("vstrechnye-vetra"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [spell("gust-of-wind", "Порыв ветра", 2, 3, "CHA", 1)],
    },
  },
});

// 8. ПОЛУОРК
defineRace("half-orc", {
  darkvision: 60,
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "ugrozhayushchiy-vid": skip("ugrozhayushchiy-vid"),
    "nepokolebimaya-stoykost": passive("nepokolebimaya-stoykost", { uses: { max: 1, refresh: "long" } }),
    "svirepye-ataki": passive("svirepye-ataki"),
    yazyki: skip("yazyki"),
  },
  subraces: {
    "mark-of-finding": {
      darkvision: 60,
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "temnoe-zrenie": skip("temnoe-zrenie"),
        "intuitsiya-okhotnika": skip("intuitsiya-okhotnika"),
        "magiya-iskatelya": skip("magiya-iskatelya"),
        yazyki: skip("yazyki"),
        "zaklinaniya-metki": skip("zaklinaniya-metki"),
      },
      innateSpells: [
        spell("hunters-mark", "Метка охотника", 1, 1, "WIS", 1),
        spell("locate-object", "Поиск предмета", 2, 3, "WIS", 1),
      ],
    },
  },
});

// 9. ТИФЛИНГ
defineRace("tiefling", {
  darkvision: 60,
  defaultResistances: ["fire"],
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "adskoe-soprotivlenie": passive("adskoe-soprotivlenie"),
    "dyavolskoe-nasledie": skip("dyavolskoe-nasledie"),
    yazyki: skip("yazyki"),
  },
  innateSpells: TIEFLING_LINEAGES.asmodeus.spells,
  subraces: {
    "tiefling-faerun": {
      replacesInnateSpells: true,
      speed: { fly: 30 },
      traits: {
        zveropodobnyy: skip("zveropodobnyy"),
        "dyavolskiy-yazyk": skip("dyavolskiy-yazyk"),
        "adskoe-plamya": skip("adskoe-plamya"),
        krylatyy: passive("krylatyy"),
      },
      innateSpells: [
        spell("thaumaturgy", "Чудотворство", 0, 1, "CHA", 0),
        spell("burning-hands", "Огненные ладони", 2, 3, "CHA", 1),
        spell("darkness", "Тьма", 2, 5, "CHA", 1),
      ],
    },
    "winged-tiefling": {
      replacesInnateSpells: true,
      speed: { fly: 30 },
      traits: {
        krylatyy: passive("krylatyy"),
      },
      innateSpells: [],
    },
    ...Object.fromEntries(
      Object.entries(TIEFLING_LINEAGES).map(([subId, lin]) => [
        subId,
        {
          replacesInnateSpells: true,
          traits: {
            "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
            [lin.traitId]: skip(lin.traitId),
          },
          innateSpells: lin.spells,
        },
      ])
    ),
  },
});
