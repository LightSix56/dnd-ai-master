// Правила 25 рас сеттингов и приключений D&D 5e (данные: data/races-2014.json).
// Боевые срабатывания (телепорты, реакции Хадози/Зайцегона/Быстронога, Панцирь тортла, Шифтер и др.) — в legacy-settings-combat.ts.

import { featureMods, type Mods } from "../feature-mods";
import type { AbilityKey } from "../types";
import {
  chosenMentalAbility,
  defineRace,
  mentions,
  optionChosen,
  type Calc,
  type InnateSpellSpec,
  type OptionRule,
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
  castingAbility: AbilityKey | ((c: Calc) => AbilityKey),
  usesMax = level === 0 ? 0 : 1,
  refresh: "long" | "short" = "long",
  when?: (c: Calc) => boolean
): InnateSpellSpec => ({
  spellId,
  name,
  level,
  minCharacterLevel,
  usesMax,
  refresh,
  castingAbility,
  ...(when ? { when } : {}),
});

const skipTraits = (...ids: string[]): Record<string, RaceFeatureRule> =>
  Object.fromEntries(ids.map((id) => [id, skip(id)]));

const registerNaturalAC = (srdKey: string, name: string, base: number, ability: "DEX" | "CON") =>
  featureMods(srdKey, {
    name,
    minBaseAC: (owner) => base + (owner.abilityMods?.[ability] ?? 0),
  });

const registerShifterMod = (subraceId: string, name: string, mods: Mods, unless?: (owner: import("../types").Combatant) => boolean) =>
  featureMods(`race/${subraceId}/osobennosti-smeny-formy`, {
    name,
    whileCondition: "shifter_shifted",
    ...(unless ? { unless } : {}),
    mods,
  });

const dexMod = (c: Calc) => c.mod("DEX");
const conMod = (c: Calc) => c.mod("CON");
const maxMentalDc = (c: Calc) => 8 + c.prof + Math.max(c.mod("INT"), c.mod("WIS"), c.mod("CHA"));

// ============ ПОСТОЯННЫЕ ПОПРАВКИ ============

// Автогном
registerNaturalAC("race/autognome/usilennyy-karkas", "Усиленный каркас", 13, "DEX");
featureMods("race/autognome/mekhanicheskaya-priroda", {
  name: "Механическая природа",
  resist: ["poison"],
  saveAdvantageConditions: ["paralyzed", "poisoned"],
});

// Астральный эльф
featureMods("race/astral-elf/nasledie-fey", {
  name: "Наследие фей",
  saveAdvantageConditions: ["charmed"],
});
featureMods("race/astral-elf/astralnyy-trans", {
  name: "Астральный транс",
  sleepImmune: true,
});

// Ведалкен и Вердан
featureMods("race/vedalken/besstrastie-vedalkenov", {
  name: "Бесстрастие ведалкенов",
  saveAdvantage: ["INT", "WIS", "CHA"],
});
featureMods("race/verdan/telepaticheskaya-pronitsatelnost", {
  name: "Телепатическая проницательность",
  saveAdvantage: ["WIS", "CHA"],
});

// Гибрид Симиков (Панцирь)
featureMods("race/simic-hybrid/carapace", {
  name: "Панцирь (Гибрид Симиков)",
  mods: (owner) => (owner.armorType === "heavy" ? null : { acBonus: 1 }),
});

// Гифф
featureMods("race/giff/sila-begemota", {
  name: "Сила бегемота",
  saveAdvantage: ["STR"],
});

// Грунг
featureMods("race/grung/immunitet-k-yadam", {
  name: "Иммунитет к ядам",
  immune: ["poison"],
  conditionImmune: ["poisoned"],
});

// Зайцегон
featureMods("race/harengon/zayache-serdtse", {
  name: "Заячье сердце",
  mods: (owner) => ({ initiativeBonus: owner.profBonus || 2 }),
});

// Калаштар
featureMods("race/kalashtar/dvoystvennost-razuma", {
  name: "Двойственность разума",
  saveAdvantage: ["WIS"],
});
featureMods("race/kalashtar/mentalnaya-distsiplina", {
  name: "Ментальная дисциплина",
  resist: ["psychic"],
});

// Кендер
featureMods("race/kender/besstrashie", {
  name: "Бесстрашие",
  saveAdvantageConditions: ["frightened"],
});

// Кованый
featureMods("race/warforged/stoykost-kovanykh", {
  name: "Стойкость кованых",
  resist: ["poison"],
  saveAdvantageConditions: ["poisoned"],
  sleepImmune: true,
});
featureMods("race/warforged/vstroennaya-zashchita", {
  name: "Встроенная защита",
  acBonus: 1,
});

// Локата
registerNaturalAC("race/locathah/prirodnyy-dospekh", "Природный доспех", 12, "DEX");
featureMods("race/locathah/volya-leviafana", {
  name: "Воля Левиафана",
  saveAdvantageConditions: ["charmed", "frightened", "paralyzed", "poisoned", "stunned", "sleep"],
});

// Локсодон
featureMods("race/loxodon/spokoystvie-loksodonov", {
  name: "Спокойствие локсодонов",
  saveAdvantageConditions: ["charmed", "frightened"],
});
registerNaturalAC("race/loxodon/prirodnyy-dospekh", "Природный доспех", 12, "CON");

// Плазмоид
featureMods("race/plasmoid/amorfnyy", {
  name: "Аморфный",
  saveAdvantageConditions: ["grappled"],
});
featureMods("race/plasmoid/estestvennaya-stoykost", {
  name: "Естественная стойкость",
  resist: ["acid", "poison"],
  saveAdvantageConditions: ["poisoned"],
});

// Сатир
featureMods("race/satyr/soprotivlenie-magii", {
  name: "Сопротивление магии",
  spellSaveAdvantage: true,
});

// Тортл и Три-крин
featureMods("race/tortle/prirodnyy-dospekh", {
  name: "Природный доспех",
  minBaseAC: () => 17,
});
registerNaturalAC("race/thri-kreen/pantsir-khameleon", "Панцирь-хамелеон", 13, "DEX");

// Шифтер (Зверошкуры, Быстроноги, Дикие охотники)
registerShifterMod("beasthide", "Зверошкур (Смена формы)", { acBonus: 1 });
registerShifterMod("swiftstride", "Быстроног (Смена формы)", { speedBonus: 10 });
registerShifterMod(
  "wildhunt",
  "Дикий охотник (Смена формы)",
  { preventAdvantageWithinFt: 30 },
  (owner) =>
    owner.conditions.some((x) =>
      ["incapacitated", "stunned", "paralyzed", "unconscious", "petrified", "dead"].includes(x.type)
    )
);

// ============ ТАБЛИЦЫ ВАРИАНТОВ ============

const SIMIC_GRAPPLING_OPTION: OptionRule = {
  id: "grappling-appendages",
  kind: "passive",
  name: "Хватательные придатки",
  description: "Природное оружие ближнего боя: 1к6 + СИЛ дробящего урона (с 5 уровня).",
  minLevel: 5,
  tokens: ["grappling-appendages"],
  aliases: ["Хватательные придатки", "Grappling Appendages"],
};

const SIMIC_OPTIONS: RaceOptionRule[] = [
  {
    id: "manta-glide",
    kind: "passive",
    name: "Мантия ската",
    description: "Вычитает до 100 футов падения и позволяет планировать по горизонтали.",
    tokens: ["manta-glide"],
    aliases: ["Мантия ската", "Manta Glide"],
  },
  {
    id: "nimble-climber",
    kind: "passive",
    name: "Проворный скалолаз",
    description: "Скорость лазания равна вашей скорости ходьбы.",
    tokens: ["nimble-climber"],
    aliases: ["Проворный скалолаз", "Nimble Climber"],
  },
  {
    id: "underwater-adaptation",
    kind: "passive",
    name: "Подводная адаптация",
    description: "Дышите воздухом и водой, скорость плавания равна скорости ходьбы.",
    tokens: ["underwater-adaptation"],
    aliases: ["Подводная адаптация", "Underwater Adaptation"],
  },
  SIMIC_GRAPPLING_OPTION,
  {
    id: "carapace",
    kind: "passive",
    name: "Панцирь",
    description: "+1 к КД, пока вы не носите тяжёлый доспех.",
    minLevel: 5,
    tokens: ["carapace"],
    aliases: ["Панцирь", "Carapace"],
  },
  {
    id: "acid-spit",
    kind: "active",
    name: "Кислотный плевок",
    cost: "action",
    target: "creature",
    range: 30,
    minLevel: 5,
    save: "DEX",
    dc: (c) => 8 + c.prof + conMod(c),
    uses: (c) => ({ max: Math.max(1, conMod(c)), refresh: "long" }),
    tokens: ["acid-spit"],
    aliases: ["Кислотный плевок", "Acid Spit"],
    description: "Струя кислоты на 30 футов: спасбросок Ловкости или урон кислотой.",
    note: (c) => {
      const dice = c.level >= 17 ? "4d10" : c.level >= 11 ? "3d10" : "2d10";
      return `Урон: ${dice} кислотой при провале спасброска ЛОВ (СЛ ${8 + c.prof + conMod(c)}).`;
    },
  },
];

const astralCantripChosen = (c: Calc, token: string, ru: string, en: string) =>
  c.tokens.has(token) || mentions(c.text, ru) || mentions(c.text, en);

const hasAnyAstralCantrip = (c: Calc) =>
  astralCantripChosen(c, "sacred-flame", "Священное пламя", "Sacred Flame") ||
  astralCantripChosen(c, "light", "Свет", "Light") ||
  astralCantripChosen(c, "dancing-lights", "Пляшущие огоньки", "Dancing Lights");

// ============ ОПИСАНИЯ 25 РАС СЕТТИНГОВ И ПРИКЛЮЧЕНИЙ ============

// 1. АВТОГНОМ
defineRace("autognome", {
  defaultResistances: ["poison"],
  traits: {
    ...skipTraits(
      "uvelichenie-kharakteristik",
      "vid-sushchestva",
      "razmer",
      "skorost",
      "otdykh-strazha",
      "osobaya-sborka",
      "lechashchaya-mashina"
    ),
    "usilennyy-karkas": passive("usilennyy-karkas", { value: (c) => 13 + dexMod(c) }),
    "sozdan-dlya-uspekha": {
      id: "sozdan-dlya-uspekha",
      kind: "active",
      cost: "free",
      manual: true,
      uses: "profBonus",
      refresh: "long",
      note: () => "Добавляет 1к4 к броску атаки, проверке характеристики или спасброску после к20.",
    },
    "mekhanicheskaya-priroda": passive("mekhanicheskaya-priroda"),
  },
});

// 2. АСТРАЛЬНЫЙ ЭЛЬФ
defineRace("astral-elf", {
  darkvision: 60,
  traits: {
    ...skipTraits(
      "uvelichenie-kharakteristik",
      "vid-sushchestva",
      "razmer",
      "skorost",
      "astralnoe-plamya",
      "temnoe-zrenie",
      "obostrennye-chuvstva"
    ),
    "nasledie-fey": passive("nasledie-fey"),
    "zvezdnyy-shag": {
      id: "zvezdnyy-shag",
      kind: "active",
      cost: "bonus",
      target: "point",
      range: 30,
      uses: "profBonus",
      refresh: "long",
      note: () => "Телепортация бонусным действием на расстояние до 30 фт в видимую свободную клетку.",
    },
    "astralnyy-trans": passive("astralnyy-trans"),
  },
  innateSpells: [
    spell(
      "sacred-flame",
      "Священное пламя",
      0,
      1,
      chosenMentalAbility("WIS"),
      0,
      "long",
      (c) => astralCantripChosen(c, "sacred-flame", "Священное пламя", "Sacred Flame") || !hasAnyAstralCantrip(c)
    ),
    spell("light", "Свет", 0, 1, chosenMentalAbility("WIS"), 0, "long", (c) =>
      astralCantripChosen(c, "light", "Свет", "Light")
    ),
    spell("dancing-lights", "Пляшущие огоньки", 0, 1, chosenMentalAbility("WIS"), 0, "long", (c) =>
      astralCantripChosen(c, "dancing-lights", "Пляшущие огоньки", "Dancing Lights")
    ),
  ],
});

// 3. ВЕДАЛКЕН
defineRace("vedalken", {
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "razmer", "skorost", "neustannaya-skrupuleznost", "chastichno-amfibiya", "yazyki"),
    "besstrastie-vedalkenov": passive("besstrastie-vedalkenov"),
  },
});

// 4. ВЕРДАН
defineRace("verdan", {
  traits: {
    ...skipTraits(
      "uvelichenie-kharakteristik",
      "skorost",
      "razmer",
      "chernaya-istselyayushchaya-krov",
      "ogranichennaya-telepatiya",
      "ubeditelnyy",
      "yazyk"
    ),
    "telepaticheskaya-pronitsatelnost": passive("telepaticheskaya-pronitsatelnost"),
  },
});

// 5. ГИБРИД СИМИКОВ
defineRace("simic-hybrid", {
  darkvision: 60,
  naturalWeapons: [
    {
      id: "simic_grappling_appendages",
      name: "Хватательный придаток",
      dice: "1d6",
      damageType: "bludgeoning",
      ability: "STR",
      minLevel: 5,
      when: (c) => optionChosen(SIMIC_GRAPPLING_OPTION, c),
      description: "1к6 + СИЛ дробящего урона (доступно с 5 уровня при выборе «Хватательных придатков»).",
    },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "razmer", "skorost", "temnoe-zrenie", "yazyki"),
    "zhivotnoe-usilenie": {
      id: "zhivotnoe-usilenie",
      kind: "skip",
      pick: "sheet",
      options: SIMIC_OPTIONS,
    },
  },
});

// 6. ГИФФ
defineRace("giff", {
  speed: { walk: 30, swim: 30 },
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "vladenie-ognestrelnym-oruzhiem"),
    "astralnaya-iskra": {
      id: "astralnaya-iskra",
      kind: "active",
      cost: "free",
      defer: true,
      uses: "profBonus",
      refresh: "long",
      note: (c) => `Заряжает атаку оружием в этом ходу: +${c.prof} силового урона (1/ход).`,
    },
    "sila-begemota": passive("sila-begemota"),
  },
});

// 7. ГРУНГ
defineRace("grung", {
  speed: { walk: 25, climb: 25 },
  conditionImmunities: ["poisoned"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "razmer", "drevesnaya-bditelnost", "amfibiya", "pryzhok-s-mesta", "zavisimost-ot-vody", "yazyki"),
    "immunitet-k-yadam": passive("immunitet-k-yadam"),
    "yadovitaya-kozha": passive("yadovitaya-kozha"),
  },
});

// 8. ЗАЙЦЕГОН
defineRace("harengon", {
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "dlinnye-ushi", "yazyki"),
    "zayache-serdtse": passive("zayache-serdtse", { value: (c) => c.prof }),
    "silnye-nogi": passive("silnye-nogi"),
    "krolichiy-pryzhok": {
      id: "krolichiy-pryzhok",
      kind: "active",
      cost: "bonus",
      target: "point",
      range: 30,
      uses: "profBonus",
      refresh: "long",
      note: (c) => `Прыжок до ${5 * c.prof} фт без провоцированных атак, если скорость > 0.`,
    },
  },
});

// 9. КАЛАШТАР
defineRace("kalashtar", {
  defaultResistances: ["psychic"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "razmer", "skorost", "svyaz-razumov", "yazyki"),
    "dvoystvennost-razuma": passive("dvoystvennost-razuma"),
    "mentalnaya-distsiplina": passive("mentalnaya-distsiplina"),
    "otdelennyy-ot-snov": passive("otdelennyy-ot-snov"),
  },
});

// 10. КЕНДЕР
defineRace("kender", {
  traits: {
    ...skipTraits("vid-sushchestva", "razmer", "skorost", "lyubopytstvo-kenderov"),
    besstrashie: passive("besstrashie", {
      uses: { max: 1, refresh: "long" },
      note: () => "Преимущество на спасброски от испуга; 1/длинный отдых превращает провал в успех.",
    }),
    nasmeshka: {
      id: "nasmeshka",
      kind: "active",
      cost: "bonus",
      target: "creature",
      range: 60,
      save: "WIS",
      dc: maxMentalDc,
      uses: "profBonus",
      refresh: "long",
      note: (c) => `Спасбросок МУД (СЛ ${maxMentalDc(c)}): при провале цель атакует других с помехой до начала вашего следующего хода.`,
    },
  },
});

// 11. КЕНТАВР
defineRace("centaur", {
  speed: { walk: 40 },
  naturalWeapons: [
    { id: "centaur_hooves", name: "Копыта", dice: "1d4", damageType: "bludgeoning", ability: "STR" },
  ],
  traits: {
    ...skipTraits(
      "uvelichenie-kharakteristik",
      "razmer",
      "modifikator-razmera",
      "vysota",
      "ves-v-funtakh",
      "skorost",
      "feya",
      "loshadinoe-teloslozhenie",
      "utselevshiy",
      "yazyki"
    ),
    kopyta: passive("kopyta"),
    razbeg: {
      id: "razbeg",
      kind: "active",
      cost: "bonus",
      target: "creature",
      range: 5,
      note: () => "После перемещения минимум на 30 фт и попадания рукопашной атакой даёт бонусную атаку копытами.",
    },
  },
});

// 12. КОВАНЫЙ
defineRace("warforged", {
  defaultResistances: ["poison"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "razmer", "skorost", "otdykh-strazha", "spetsialnaya-sborka", "yazyki"),
    "stoykost-kovanykh": passive("stoykost-kovanykh"),
    "vstroennaya-zashchita": passive("vstroennaya-zashchita"),
  },
});

// 13. ЛЕОНИН
defineRace("leonin", {
  speed: { walk: 35 },
  darkvision: 60,
  naturalWeapons: [
    { id: "leonin_claws", name: "Когти", dice: "1d4", damageType: "slashing", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "razmer", "temnoe-zrenie", "instinkty-okhotnika", "yazyki"),
    kogti: passive("kogti"),
    "ustrashayushchiy-rev": {
      id: "ustrashayushchiy-rev",
      kind: "active",
      cost: "bonus",
      range: 10,
      save: "WIS",
      dc: (c) => 8 + c.prof + conMod(c),
      uses: { max: 1, refresh: "short" },
      note: (c) => `Слышащие враги в 10 фт: спасбросок МУД (СЛ ${8 + c.prof + conMod(c)}) или испуганы до конца вашего следующего хода.`,
    },
  },
});

// 14. ЛОКАТА
defineRace("locathah", {
  speed: { walk: 30, swim: 30 },
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "razmer", "nablyudatelnyy-i-sportivnyy", "chastichnaya-zemnovodnost", "yazyk"),
    "prirodnyy-dospekh": passive("prirodnyy-dospekh", { value: (c) => 12 + dexMod(c) }),
    "volya-leviafana": passive("volya-leviafana"),
  },
});

// 15. ЛОКСОДОН
defineRace("loxodon", {
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "razmer", "krupnoe-teloslozhenie", "skorost", "khobot", "obostrennyy-nyukh", "yazyki"),
    "spokoystvie-loksodonov": passive("spokoystvie-loksodonov"),
    "prirodnyy-dospekh": passive("prirodnyy-dospekh", { value: (c) => 12 + conMod(c) }),
  },
});

// 16. МИНОТАВР
defineRace("minotaur", {
  naturalWeapons: [
    { id: "minotaur_horns", name: "Рога", dice: "1d6", damageType: "piercing", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "razmer", "skorost", "vpechatlyayushchiy-vid", "yazyki"),
    roga: passive("roga"),
    "pronzayushchiy-natisk": {
      id: "pronzayushchiy-natisk",
      kind: "active",
      cost: "bonus",
      target: "creature",
      range: 5,
      note: () => "После Рывка и перемещения минимум на 20 фт совершает бонусную атаку рогами.",
    },
    "sokrushitelnye-roga": {
      id: "sokrushitelnye-roga",
      kind: "active",
      cost: "bonus",
      target: "creature",
      range: 5,
      save: "STR",
      dc: (c) => 8 + c.prof + c.mod("STR"),
      note: (c) => `После попадания рукопашной атакой толкает цель до на 1 размер больше на 10 фт при провале спасброска СИЛ (СЛ ${8 + c.prof + c.mod("STR")}).`,
    },
  },
});

// 17. ПЛАЗМОИД
defineRace("plasmoid", {
  darkvision: 60,
  defaultResistances: ["acid", "poison"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "temnoe-zrenie", "zaderzhka-dykhaniya", "sobstvennoe-izmenenie"),
    amorfnyy: passive("amorfnyy"),
    "estestvennaya-stoykost": passive("estestvennaya-stoykost"),
  },
});

// 18. САТИР
defineRace("satyr", {
  speed: { walk: 35 },
  naturalWeapons: [
    { id: "satyr_ram", name: "Таран", dice: "1d4", damageType: "bludgeoning", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "razmer", "feya", "zrelishchnye-pryzhki", "gulyaka", "yazyki"),
    taran: passive("taran"),
    "soprotivlenie-magii": passive("soprotivlenie-magii"),
  },
});

// 19. СОВЛИН
defineRace("owlin", {
  darkvision: 120,
  speed: { walk: 30, fly: 30 },
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "temnoe-zrenie", "tikhie-perya", "yazyki"),
    polet: passive("polet"),
  },
});

// 20. ТОРТЛ
defineRace("tortle", {
  naturalWeapons: [
    { id: "tortle_claws", name: "Когти", dice: "1d4", damageType: "slashing", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "razmer", "skorost", "zaderzhivanie-dykhaniya", "instinkt-vyzhivaniya", "yazyki"),
    kogti: passive("kogti"),
    "prirodnyy-dospekh": passive("prirodnyy-dospekh", { value: () => 17 }),
    "pantsirnaya-zashchita": {
      id: "pantsirnaya-zashchita",
      kind: "active",
      cost: "action",
      exitsCondition: "tortle_shell",
      uses: { max: 0, refresh: "none" },
      note: () => "Вход действием (+4 к КД, преимущество на спас СИЛ/ТЕЛ, скорость 0); выход бонусным действием.",
    },
  },
});

// 21. ТРИ-КРИН
defineRace("thri-kreen", {
  darkvision: 60,
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "temnoe-zrenie", "vtorye-ruki", "telepatiya-tri-krinov"),
    "pantsir-khameleon": passive("pantsir-khameleon", { value: (c) => 13 + dexMod(c) }),
    "bessonnoe-vosstanovlenie": passive("bessonnoe-vosstanovlenie"),
  },
});

// 22. ФЭЙРИ
defineRace("fairy", {
  speed: { walk: 30, fly: 30 },
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "yazyki"),
    "magiya-fey": { ...skip("magiya-fey"), minLevel: 1 },
    polet: passive("polet"),
  },
  innateSpells: [
    spell("druidcraft", "Искусство друидов", 0, 1, chosenMentalAbility("CHA"), 0),
    spell("faerie-fire", "Огонь фей", 1, 3, chosenMentalAbility("CHA"), 1),
    spell("enlarge-reduce", "Увеличение/уменьшение", 2, 5, chosenMentalAbility("CHA"), 1),
  ],
});

// 23. ХАДОЗИ
defineRace("hadozee", {
  speed: { walk: 30, climb: 30 },
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "lovkie-stupni", "planirovanie"),
    "vertkost-khadozi": {
      id: "vertkost-khadozi",
      kind: "active",
      cost: "reaction",
      offTurn: true,
      uses: "profBonus",
      refresh: "long",
      note: (c) => `Реакцией уменьшает получаемый урон на 1к6 + ${c.prof}.`,
    },
  },
});

// 24. ЧЕЙНДЖЛИНГ
defineRace("changeling", {
  traits: skipTraits("uvelichenie-kharakteristik", "razmer", "skorost", "yazyki"),
});

// 25. ШИФТЕР (+ 4 подрасы)
defineRace("shifter", {
  darkvision: 60,
  traits: {
    ...skipTraits("razmer", "skorost", "temnoe-zrenie", "yazyki"),
    "smena-formy": {
      id: "smena-formy",
      kind: "active",
      cost: "bonus",
      uses: { max: 1, refresh: "short" },
      note: (c) => `Принимает облик на 1 минуту: +${Math.max(1, c.level + conMod(c))} временных хитов.`,
    },
  },
  subraces: {
    beasthide: {
      traits: {
        ...skipTraits("uvelichenie-kharakteristik", "krepkiy"),
        "osobennosti-smeny-formy": passive("osobennosti-smeny-formy", {
          note: () => "При смене формы +1к6 дополнительных временных хитов и +1 к КД, пока форма активна.",
        }),
      },
    },
    longtooth: {
      traits: {
        ...skipTraits("uvelichenie-kharakteristik", "zhestokost"),
        "osobennosti-smeny-formy": {
          id: "osobennosti-smeny-formy",
          kind: "active",
          cost: "bonus",
          target: "creature",
          range: 5,
          name: "Укус длиннозуба",
          note: (c) => `Пока смена формы активна: безоружный укус бонусным действием (1к6 + ${c.mod("STR")} колющего урона).`,
        },
      },
    },
    swiftstride: {
      traits: {
        ...skipTraits("uvelichenie-kharakteristik", "gratsiya"),
        "osobennosti-smeny-formy": passive("osobennosti-smeny-formy", {
          note: () => "Пока смена формы активна: +10 фт скорости и реакцией отход до 10 фт, когда враг заканчивает ход в 5 фт.",
        }),
      },
    },
    wildhunt: {
      traits: {
        ...skipTraits("uvelichenie-kharakteristik", "sledopyt-ot-prirody", "p"),
        "osobennosti-smeny-formy": passive("osobennosti-smeny-formy", {
          note: () => "Пока смена формы активна: враги в 30 фт не получают преимущество на атаки против вас.",
        }),
      },
    },
  },
});
