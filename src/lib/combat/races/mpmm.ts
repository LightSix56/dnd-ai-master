// Правила всех 30 MPMM-рас D&D 5e (Mordenkainen Presents: Monsters of the Multiverse, *-mpmm).
// Данные: data/races-2014.json. Боевые срабатывания — в mpmm-combat.ts.

import { featureMods, type Mods } from "../feature-mods";
import type { AbilityKey } from "../types";
import { ELADRIN_SEASONS } from "./core-phb";
import {
  chosenMentalAbility,
  defineRace,
  mentions,
  optionChosen,
  type Calc,
  type InnateSpellSpec,
  type OptionRule,
  type RaceFeatureRule,
} from "./race-defs";

const skip = (id: string): RaceFeatureRule => ({ id, kind: "skip" });
const passive = (id: string, extra: Partial<RaceFeatureRule> = {}): RaceFeatureRule => ({
  id,
  kind: "passive",
  ...extra,
});
const skipTraits = (...ids: string[]): Record<string, RaceFeatureRule> =>
  Object.fromEntries(ids.map((id) => [id, skip(id)]));

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

const chosenMentalDc = (fallback: AbilityKey) => {
  const pick = chosenMentalAbility(fallback);
  return (c: Calc) => 8 + c.prof + c.mod(pick(c));
};

const chaDc = (c: Calc) => 8 + c.prof + c.mod("CHA");

// ============ ПОСТОЯННЫЕ ПОПРАВКИ ============

// Наследие фей (только преимущество на спас от очарования; у Багбира/Гоблина/Хобгоблина/Морского эльфа/Шадар-кай/Эладрина MPMM)
for (const raceId of [
  "bugbear-mpmm",
  "goblin-mpmm",
  "sea-elf-mpmm",
  "hobgoblin-mpmm",
  "shadar-kai-mpmm",
  "eladrin-mpmm",
] as const) {
  featureMods(`race/${raceId}/nasledie-fey`, {
    name: "Наследие фей",
    saveAdvantageConditions: ["charmed"],
  });
}

// Транс (иммунитет к магическому усыплению)
for (const raceId of ["sea-elf-mpmm", "shadar-kai-mpmm", "eladrin-mpmm"] as const) {
  featureMods(`race/${raceId}/trans`, {
    name: "Транс",
    sleepImmune: true,
  });
}

// Сопротивления и защиты от состояний
featureMods("race/aasimar-mpmm/nebesnoe-soprotivlenie", {
  name: "Небесное сопротивление",
  resist: ["radiant", "necrotic"],
});
featureMods("race/bugbear-mpmm/dlinnye-konechnosti", {
  name: "Длинные конечности",
  reachBonus: 5,
});
featureMods("race/githzerai-mpmm/mentalnaya-distsiplina", {
  name: "Ментальная дисциплина",
  saveAdvantageConditions: ["charmed", "frightened"],
});
featureMods("race/githzerai-mpmm/soprotivlenie-psikhicheskoy-energii", {
  name: "Сопротивление психической энергии",
  resist: ["psychic"],
});
featureMods("race/githyanki-mpmm/soprotivlenie-psikhicheskoy-energii", {
  name: "Сопротивление психической энергии",
  resist: ["psychic"],
});
featureMods("race/deep-gnome-mpmm/gnome-magicheskoe-soprotivlenie", {
  name: "Гномье магическое сопротивление",
  magicMentalSaveAdvantage: true,
});
featureMods("race/goliath-mpmm/rozhdennyy-v-gorakh", {
  name: "Рождённый в горах",
  resist: ["cold"],
});
featureMods("race/air-genasi/soprotivlenie-elektrichestvu", {
  name: "Сопротивление электричеству",
  resist: ["lightning"],
});
featureMods("race/duergar-mpmm/duergarskaya-ustoychivost", {
  name: "Дуэргарская устойчивость",
  resist: ["poison"],
  saveAdvantageConditions: ["poisoned"],
});
featureMods("race/duergar-mpmm/psionicheskaya-stoykost", {
  name: "Псионическая стойкость",
  saveAdvantageConditions: ["charmed", "stunned"],
});
featureMods("race/harengon-mpmm/zayachya-rezvost", {
  name: "Заячья резвость",
  mods: (owner) => ({ initiativeBonus: owner.profBonus || 2 }),
});
featureMods("race/kobold-mpmm/kobold-defiance", {
  name: "Неповиновение",
  saveAdvantageConditions: ["frightened"],
});
featureMods("race/lizardfolk-mpmm/prirodnyy-dospekh", {
  name: "Природный доспех",
  minBaseAC: (owner) => 13 + (owner.abilityMods?.DEX ?? 0),
});
featureMods("race/sea-elf-mpmm/ditya-morey", {
  name: "Дитя морей",
  resist: ["cold"],
});
featureMods("race/satyr-mpmm/soprotivlenie-magii", {
  name: "Сопротивление магии",
  spellSaveAdvantage: true,
});
featureMods("race/tortle-mpmm/prirodnyy-dospekh", {
  name: "Природный доспех",
  minBaseAC: () => 17,
});
featureMods("race/triton-mpmm/strazhi-glubin", {
  name: "Стражи глубин",
  resist: ["cold"],
});
featureMods("race/shadar-kai-mpmm/nekroticheskoe-soprotivlenie", {
  name: "Некротическое сопротивление",
  resist: ["necrotic"],
});
featureMods("race/yuan-ti-mpmm/soprotivlenie-magii", {
  name: "Сопротивление магии",
  spellSaveAdvantage: true,
});
featureMods("race/yuan-ti-mpmm/soprotivlenie-yadu", {
  name: "Сопротивление яду",
  resist: ["poison"],
  saveAdvantageConditions: ["poisoned"],
});

// Шифтер MPMM (опции внутри смены формы)
const registerMpmmShifterMod = (
  optionId: string,
  name: string,
  mods: Mods,
  unless?: (owner: import("../types").Combatant) => boolean
) =>
  featureMods(`race/shifter-mpmm/${optionId}`, {
    name,
    whileCondition: "shifter_shifted",
    ...(unless ? { unless } : {}),
    mods,
  });

registerMpmmShifterMod("beasthide", "Зверошкур (Смена формы)", { acBonus: 1 });
registerMpmmShifterMod("swiftstride", "Быстроног (Смена формы)", { speedBonus: 10 });
registerMpmmShifterMod(
  "wildhunt",
  "Дикий охотник (Смена формы)",
  { preventAdvantageWithinFt: 30 },
  (owner) =>
    owner.conditions.some((x) =>
      ["incapacitated", "stunned", "paralyzed", "unconscious", "petrified", "dead"].includes(x.type)
    )
);

// ============ ТАБЛИЦЫ ВАРИАНТОВ ============

const KOBOLD_SORCERY_OPTION: OptionRule = {
  id: "kobold-draconic-sorcery",
  kind: "passive",
  name: "Драконье чародейство",
  description: "Вы знаете один заговор чародея (ИНТ/МУД/ХАР по выбору).",
  tokens: ["kobold-draconic-sorcery", "draconic-sorcery"],
  aliases: ["Драконье чародейство", "Draconic Sorcery"],
};

const KOBOLD_SORCERER_CANTRIPS: Array<{ spellId: string; name: string; en: string }> = [
  { spellId: "fire-bolt", name: "Огненный снаряд", en: "Fire Bolt" },
  { spellId: "ray-of-frost", name: "Луч холода", en: "Ray of Frost" },
  { spellId: "shocking-grasp", name: "Электрошок", en: "Shocking Grasp" },
  { spellId: "acid-splash", name: "Брызги кислоты", en: "Acid Splash" },
  { spellId: "poison-spray", name: "Брызги яда", en: "Poison Spray" },
  { spellId: "chill-touch", name: "Леденящее прикосновение", en: "Chill Touch" },
  { spellId: "mage-hand", name: "Волшебная рука", en: "Mage Hand" },
  { spellId: "light", name: "Свет", en: "Light" },
  { spellId: "minor-illusion", name: "Малая иллюзия", en: "Minor Illusion" },
  { spellId: "booming-blade", name: "Громовой клинок", en: "Booming Blade" },
  { spellId: "green-flame-blade", name: "Клинок зелёного пламени", en: "Green-Flame Blade" },
];

const cantripChosen = (c: Calc, token: string, ru: string, en: string) =>
  c.tokens.has(token) || mentions(c.text, ru) || mentions(c.text, en);

const hasExplicitKoboldCantrip = (c: Calc) =>
  KOBOLD_SORCERER_CANTRIPS.some((s) => cantripChosen(c, s.spellId, s.name, s.en));

// ============ ОПИСАНИЯ 30 РАС MPMM ============

// 1. ААРАКОКРА (MPMM)
defineRace("aarakocra-mpmm", {
  speed: { walk: 30, fly: 30 },
  naturalWeapons: [
    { id: "aarakocra_claws", name: "Когти", dice: "1d6", damageType: "slashing", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "yazyki"),
    polet: passive("polet"),
    kogti: passive("kogti"),
    "zovushchiy-veter": { ...skip("zovushchiy-veter"), minLevel: 3 },
  },
  innateSpells: [spell("gust-of-wind", "Порыв ветра", 2, 3, chosenMentalAbility("WIS"), 1)],
});

// 2. ААСИМАР (MPMM)
defineRace("aasimar-mpmm", {
  darkvision: 60,
  defaultResistances: ["radiant", "necrotic"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "nesushchiy-svet", "yazyki"),
    "nebesnoe-soprotivlenie": passive("nebesnoe-soprotivlenie"),
    "istselyayushchie-ruki": {
      id: "istselyayushchie-ruki",
      kind: "active",
      cost: "action",
      target: "ally",
      range: 5,
      uses: { max: 1, refresh: "long" },
      note: (c) => `Восстанавливает ${c.prof}к4 хитов касанием.`,
    },
    "nebesnoe-otkrovenie": {
      id: "nebesnoe-otkrovenie",
      kind: "pool",
      minLevel: 3,
      uses: { max: 1, refresh: "long" },
      pick: "sheet-or-all",
      options: [
        {
          id: "savan-smerti",
          kind: "active",
          name: "Небесное откровение: Саван смерти",
          description: "Бонусным действием на 1 минуту: существа в 10 фт — спас ХАР или испуганы до конца вашего следующего хода; раз в ход +БМ урона некротической энергией.",
          cost: "bonus",
          minLevel: 3,
          save: "CHA",
          dc: chaDc,
          pool: "race/aasimar-mpmm/nebesnoe-otkrovenie",
          tokens: ["savan-smerti", "necrotic-shroud"],
          aliases: ["Саван смерти", "Necrotic Shroud"],
        },
        {
          id: "ispuskanie-siyaniya",
          kind: "active",
          name: "Небесное откровение: Испускание сияния",
          description: "Бонусным действием на 1 минуту: в конце каждого хода всем в 10 фт (включая себя) БМ урона излучением; раз в ход +БМ урона излучением.",
          cost: "bonus",
          minLevel: 3,
          pool: "race/aasimar-mpmm/nebesnoe-otkrovenie",
          tokens: ["ispuskanie-siyaniya", "radiant-consumption"],
          aliases: ["Испускание сияния", "Radiant Consumption"],
        },
        {
          id: "siyayushchaya-dusha",
          kind: "active",
          name: "Небесное откровение: Сияющая душа",
          description: "Бонусным действием на 1 минуту: скорость полёта равна скорости ходьбы; раз в ход +БМ урона излучением.",
          cost: "bonus",
          minLevel: 3,
          pool: "race/aasimar-mpmm/nebesnoe-otkrovenie",
          tokens: ["siyayushchaya-dusha", "radiant-soul"],
          aliases: ["Сияющая душа", "Radiant Soul"],
        },
      ],
    },
  },
  innateSpells: [spell("light", "Свет", 0, 1, "CHA", 0)],
});

// 3. БАГБИР (MPMM)
defineRace("bugbear-mpmm", {
  darkvision: 60,
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "temnoe-zrenie", "moshchnoe-teloslozhenie", "skrytnost", "yazyki"),
    "nasledie-fey": passive("nasledie-fey"),
    "dlinnye-konechnosti": passive("dlinnye-konechnosti"),
    "vnezapnoe-napadenie": passive("vnezapnoe-napadenie"),
  },
});

// 4. ГИТЦЕРАЙ (MPMM)
defineRace("githzerai-mpmm", {
  defaultResistances: ["psychic"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "yazyki"),
    "mentalnaya-distsiplina": passive("mentalnaya-distsiplina"),
    "soprotivlenie-psikhicheskoy-energii": passive("soprotivlenie-psikhicheskoy-energii"),
    "psionika-gittseraev": { ...skip("psionika-gittseraev"), minLevel: 1 },
  },
  innateSpells: [
    spell("mage-hand", "Волшебная рука", 0, 1, chosenMentalAbility("WIS"), 0),
    spell("shield", "Щит", 1, 3, chosenMentalAbility("WIS"), 1),
    spell("detect-thoughts", "Обнаружение мыслей", 2, 5, chosenMentalAbility("WIS"), 1),
  ],
});

// 5. ГИТЪЯНКИ (MPMM)
defineRace("githyanki-mpmm", {
  defaultResistances: ["psychic"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "astralnoe-znanie", "yazyki"),
    "soprotivlenie-psikhicheskoy-energii": passive("soprotivlenie-psikhicheskoy-energii"),
    "psionika-gityanki": { ...skip("psionika-gityanki"), minLevel: 1 },
  },
  innateSpells: [
    spell("mage-hand", "Волшебная рука", 0, 1, chosenMentalAbility("INT"), 0),
    spell("jump", "Прыжок", 1, 3, chosenMentalAbility("INT"), 1),
    spell("misty-step", "Туманный шаг", 2, 5, chosenMentalAbility("INT"), 1),
  ],
});

// 6. ГЛУБИННЫЙ ГНОМ (MPMM)
defineRace("deep-gnome-mpmm", {
  darkvision: 120,
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "yazyki"),
    "gnome-magicheskoe-soprotivlenie": passive("gnome-magicheskoe-soprotivlenie"),
    "dar-svirfneblina": { ...skip("dar-svirfneblina"), minLevel: 3 },
    "kamuflyazh-svirfneblina": {
      id: "kamuflyazh-svirfneblina",
      kind: "active",
      cost: "free",
      manual: true,
      uses: "profBonus",
      refresh: "long",
      note: () => "Преимущество на проверку Ловкости (Скрытность).",
    },
  },
  innateSpells: [
    spell("disguise-self", "Маскировка", 1, 3, chosenMentalAbility("INT"), 1),
    spell("nondetection", "Необнаружимость", 3, 5, chosenMentalAbility("INT"), 1),
  ],
});

// 7. ГОБЛИН (MPMM)
defineRace("goblin-mpmm", {
  darkvision: 60,
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "yazyki"),
    "nasledie-fey": passive("nasledie-fey"),
    "yarost-melkogo": {
      id: "yarost-melkogo",
      kind: "active",
      cost: "free",
      defer: true,
      uses: "profBonus",
      refresh: "long",
      note: (c) => `Заряжает атаку/заклинание в этом ходу: +${c.prof} урона по цели крупнее вас (1/ход).`,
    },
    "shustryy-pobeg": {
      id: "shustryy-pobeg",
      kind: "skip",
      pick: "all",
      options: [
        {
          id: "nimble-disengage",
          kind: "active",
          cost: "bonus",
          name: "Шустрый побег: Отход",
          description: "Бонусным действием совершает действие Отход.",
        },
        {
          id: "nimble-hide",
          kind: "active",
          cost: "bonus",
          name: "Шустрый побег: Засада",
          description: "Бонусным действием совершает действие Засада (попытка Скрытности).",
        },
      ],
    },
  },
});

// 8. ГОЛИАФ (MPMM)
defineRace("goliath-mpmm", {
  defaultResistances: ["cold"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "malenkiy-velikan", "yazyki"),
    "rozhdennyy-v-gorakh": passive("rozhdennyy-v-gorakh"),
    "vynoslivost-kamnya": {
      id: "vynoslivost-kamnya",
      kind: "active",
      cost: "reaction",
      offTurn: true,
      uses: "profBonus",
      refresh: "long",
      note: (c) => `Реакцией уменьшает получаемый урон на 1к12 + ${c.mod("CON")}.`,
    },
  },
});

// 9. ДЖЕНАЗИ (MPMM, 4 подрасы)
defineRace("genasi-mpmm", {
  darkvision: 60,
  traits: skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "temnoe-zrenie", "yazyki"),
  subraces: {
    "air-genasi": {
      speed: { walk: 35 },
      resistances: ["lightning"],
      traits: {
        ...skipTraits("skorost", "beskonechnoe-dykhanie"),
        "soprotivlenie-elektrichestvu": passive("soprotivlenie-elektrichestvu"),
        "obshchenie-s-vetrom": { ...skip("obshchenie-s-vetrom"), minLevel: 1 },
      },
      innateSpells: [
        spell("shocking-grasp", "Электрошок", 0, 1, chosenMentalAbility("CHA"), 0),
        spell("feather-fall", "Плавное падение", 1, 3, chosenMentalAbility("CHA"), 1),
        spell("levitate", "Левитация", 2, 5, chosenMentalAbility("CHA"), 1),
      ],
    },
    "earth-genasi": {
      speed: { walk: 30 },
      traits: {
        skorost: skip("skorost"),
        "khozhdenie-po-zemle": passive("khozhdenie-po-zemle"),
        "sliyanie-s-kamnem": {
          id: "sliyanie-s-kamnem",
          kind: "active",
          cost: "bonus",
          minLevel: 1,
          uses: "profBonus",
          refresh: "long",
          note: () => "Накладывает «Защиту от оружия» (сопротивление дробящему, колющему и рубящему урону от атак оружием) до конца следующего хода.",
        },
      },
      innateSpells: [
        spell("blade-ward", "Защита от оружия", 0, 1, chosenMentalAbility("CHA"), 0),
        spell("pass-without-trace", "Бесследное передвижение", 2, 5, chosenMentalAbility("CHA"), 1),
      ],
    },
    "fire-genasi": {
      speed: { walk: 30 },
      resistances: ["fire"],
      traits: {
        skorost: skip("skorost"),
        "soprotivlenie-ognyu": passive("soprotivlenie-ognyu"),
        "vybros-plameni": { ...skip("vybros-plameni"), minLevel: 1 },
      },
      innateSpells: [
        spell("produce-flame", "Сотворение пламени", 0, 1, chosenMentalAbility("CHA"), 0),
        spell("burning-hands", "Огненные ладони", 1, 3, chosenMentalAbility("CHA"), 1),
        spell("flame-blade", "Пламенеющий клинок", 2, 5, chosenMentalAbility("CHA"), 1),
      ],
    },
    "water-genasi": {
      speed: { walk: 30, swim: 30 },
      resistances: ["acid"],
      traits: {
        ...skipTraits("skorost", "amfibiya"),
        "soprotivlenie-kislote": passive("soprotivlenie-kislote"),
        "prizyv-volny": { ...skip("prizyv-volny"), minLevel: 1 },
      },
      innateSpells: [
        spell("acid-splash", "Брызги кислоты", 0, 1, chosenMentalAbility("CHA"), 0),
        spell("create-or-destroy-water", "Создание или уничтожение воды", 1, 3, chosenMentalAbility("CHA"), 1),
        spell("water-walk", "Водохождение", 3, 5, chosenMentalAbility("CHA"), 1),
      ],
    },
  },
});

// 10. ДУЭРГАР (MPMM)
defineRace("duergar-mpmm", {
  darkvision: 120,
  defaultResistances: ["poison"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "yazyki"),
    "duergarskaya-ustoychivost": passive("duergarskaya-ustoychivost"),
    "psionicheskaya-stoykost": passive("psionicheskaya-stoykost"),
    "duergarskaya-magiya": { ...skip("duergarskaya-magiya"), minLevel: 3 },
  },
  innateSpells: [
    spell("enlarge-reduce", "Увеличение/уменьшение", 2, 3, chosenMentalAbility("INT"), 1),
    spell("invisibility", "Невидимость", 2, 5, chosenMentalAbility("INT"), 1),
  ],
});

// 11. ЗАЙЦЕГОН (MPMM)
defineRace("harengon-mpmm", {
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "zayache-chute", "yazyki"),
    "zayachya-rezvost": passive("zayachya-rezvost", { value: (c) => c.prof }),
    "udachnyy-manevr": passive("udachnyy-manevr"),
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

// 12. КЕНКУ (MPMM)
defineRace("kenku-mpmm", {
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "ekspertnaya-poddelka", "imitirovanie", "yazyki"),
    "vospominaniya-kenku": {
      id: "vospominaniya-kenku",
      kind: "active",
      cost: "free",
      manual: true,
      uses: "profBonus",
      refresh: "long",
      note: () => "Преимущество на проверку характеристики с использованием навыка.",
    },
  },
});

// 13. КЕНТАВР (MPMM)
defineRace("centaur-mpmm", {
  speed: { walk: 40 },
  naturalWeapons: [
    { id: "centaur_hooves", name: "Копыта", dice: "1d6", damageType: "bludgeoning", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "loshadinoe-teloslozhenie", "blizost-s-prirodoy", "yazyki"),
    kopyta: passive("kopyta"),
    razbeg: {
      id: "razbeg",
      kind: "active",
      cost: "bonus",
      target: "creature",
      range: 5,
      note: () => "После перемещения минимум на 30 фт и попадания рукопашной атакой даёт бонусную атаку копытами (1к6 + СИЛ).",
    },
  },
});

// 14. КОБОЛЬД (MPMM)
defineRace("kobold-mpmm", {
  darkvision: 60,
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "temnoe-zrenie", "yazyki"),
    "rev-drakona": {
      id: "rev-drakona",
      kind: "active",
      cost: "bonus",
      range: 10,
      uses: "profBonus",
      refresh: "long",
      note: () => "Вы и ваши союзники получаете преимущество на атаки по слышавшим рёв врагам в 10 фт до конца вашего следующего хода.",
    },
    "nasledie-koboldov": {
      id: "nasledie-koboldov",
      kind: "skip",
      pick: "sheet",
      options: [
        {
          id: "kobold-craftiness",
          kind: "skip",
          name: "Хитрость",
          description: "Владение одним навыком по выбору.",
          tokens: ["kobold-craftiness", "craftiness"],
          aliases: ["Хитрость", "Craftiness"],
        },
        {
          id: "kobold-defiance",
          kind: "passive",
          name: "Неповиновение",
          description: "Преимущество на спасброски от состояния испуган.",
          tokens: ["kobold-defiance", "defiance"],
          aliases: ["Неповиновение", "Defiance"],
        },
        KOBOLD_SORCERY_OPTION,
      ],
    },
  },
  innateSpells: KOBOLD_SORCERER_CANTRIPS.map((s) =>
    spell(
      s.spellId,
      s.name,
      0,
      1,
      chosenMentalAbility("CHA"),
      0,
      "long",
      (c) =>
        optionChosen(KOBOLD_SORCERY_OPTION, c) &&
        (cantripChosen(c, s.spellId, s.name, s.en) || (s.spellId === "fire-bolt" && !hasExplicitKoboldCantrip(c)))
    )
  ),
});

// 15. ЛЮДОЯЩЕР (MPMM)
defineRace("lizardfolk-mpmm", {
  speed: { walk: 30, swim: 30 },
  naturalWeapons: [
    { id: "lizardfolk_bite", name: "Укус", dice: "1d6", damageType: "slashing", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "zaderzhivanie-dykhaniya", "prirodnaya-intuitsiya", "yazyki"),
    ukus: passive("ukus"),
    "prirodnyy-dospekh": passive("prirodnyy-dospekh", { value: (c) => 13 + c.mod("DEX") }),
    "golodnaya-past": {
      id: "golodnaya-past",
      kind: "active",
      cost: "bonus",
      target: "creature",
      range: 5,
      uses: "profBonus",
      refresh: "long",
      note: (c) => `Атака укусом: при попадании даёт ${c.prof} временных хитов.`,
    },
  },
});

// 16. МИНОТАВР (MPMM)
defineRace("minotaur-mpmm", {
  naturalWeapons: [
    { id: "minotaur_horns", name: "Рога", dice: "1d6", damageType: "piercing", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "zov-labirinta", "yazyki"),
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

// 17. МОРСКОЙ ЭЛЬФ (MPMM)
defineRace("sea-elf-mpmm", {
  darkvision: 60,
  speed: { walk: 30, swim: 30 },
  defaultResistances: ["cold"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "drug-morey", "obostrennye-chuvstva", "yazyki"),
    "nasledie-fey": passive("nasledie-fey"),
    "ditya-morey": passive("ditya-morey"),
    trans: passive("trans"),
  },
});

// 18. ОРК (MPMM)
defineRace("orc-mpmm", {
  darkvision: 60,
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "moshchnoe-teloslozhenie", "yazyki"),
    "vybros-adrenalina": {
      id: "vybros-adrenalina",
      kind: "active",
      cost: "bonus",
      uses: "profBonus",
      refresh: "long",
      note: (c) => `Бонусное действие Рывок + ${c.prof} временных хитов.`,
    },
    "nepokolebimaya-stoykost": passive("nepokolebimaya-stoykost", {
      uses: { max: 1, refresh: "long" },
      note: () => "1/длинный отдых при падении до 0 хитов (не от мгновенной смерти) остаётся с 1 хитом.",
    }),
  },
});

// 19. САТИР (MPMM)
defineRace("satyr-mpmm", {
  speed: { walk: 35 },
  naturalWeapons: [
    { id: "satyr_ram", name: "Таран", dice: "1d6", damageType: "bludgeoning", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "zrelishchnye-pryzhki", "gulyaka"),
    taran: passive("taran"),
    "soprotivlenie-magii": passive("soprotivlenie-magii"),
  },
});

// 20. ТАБАКСИ (MPMM)
defineRace("tabaxi-mpmm", {
  darkvision: 60,
  speed: { walk: 30, climb: 30 },
  naturalWeapons: [
    { id: "tabaxi_claws", name: "Когти", dice: "1d6", damageType: "slashing", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "koshachi-sposobnosti", "yazyki"),
    "koshachi-kogti": passive("koshachi-kogti"),
    "koshache-provorstvo": {
      id: "koshache-provorstvo",
      kind: "active",
      cost: "free",
      uses: { max: 1, refresh: "short" },
      note: () => "Удваивает скорость до конца хода; перезаряжается в конце хода без перемещения (0 фт).",
    },
  },
});

// 21. ТОРТЛ (MPMM)
defineRace("tortle-mpmm", {
  naturalWeapons: [
    { id: "tortle_claws", name: "Когти", dice: "1d6", damageType: "slashing", ability: "STR" },
  ],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "zaderzhivanie-dykhaniya", "prirodnaya-intuitsiya", "yazyki"),
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

// 22. ТРИТОН (MPMM)
defineRace("triton-mpmm", {
  darkvision: 60,
  speed: { walk: 30, swim: 30 },
  defaultResistances: ["cold"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "amfibiya", "poslannik-morya", "yazyki"),
    "strazhi-glubin": passive("strazhi-glubin"),
    "upravlenie-vozdukhom-i-vodoy": { ...skip("upravlenie-vozdukhom-i-vodoy"), minLevel: 1 },
  },
  innateSpells: [
    spell("fog-cloud", "Туманное облако", 1, 1, chosenMentalAbility("CHA"), 1),
    spell("gust-of-wind", "Порыв ветра", 2, 3, chosenMentalAbility("CHA"), 1),
    spell("water-walk", "Водохождение", 3, 5, chosenMentalAbility("CHA"), 1),
  ],
});

// 23. ФИРБОЛГ (MPMM)
defineRace("firbolg-mpmm", {
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "magiya-firbolgov", "moshchnoe-teloslozhenie", "yazyk-zverey-i-listvy", "yazyki"),
    "nezrimaya-postup": {
      id: "nezrimaya-postup",
      kind: "active",
      cost: "bonus",
      uses: "profBonus",
      refresh: "long",
    },
  },
  innateSpells: [
    spell("detect-magic", "Обнаружение магии", 1, 1, chosenMentalAbility("WIS"), 1),
    spell("disguise-self", "Маскировка", 1, 1, chosenMentalAbility("WIS"), 1),
  ],
});

// 24. ФЭЙРИ (MPMM)
defineRace("fairy-mpmm", {
  speed: { walk: 30, fly: 30 },
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "yazyki"),
    polet: passive("polet"),
    "magiya-fey": { ...skip("magiya-fey"), minLevel: 1 },
  },
  innateSpells: [
    spell("druidcraft", "Искусство друидов", 0, 1, chosenMentalAbility("CHA"), 0),
    spell("faerie-fire", "Огонь фей", 1, 3, chosenMentalAbility("CHA"), 1),
    spell("enlarge-reduce", "Увеличение/уменьшение", 2, 5, chosenMentalAbility("CHA"), 1),
  ],
});

// 25. ХОБГОБЛИН (MPMM)
defineRace("hobgoblin-mpmm", {
  darkvision: 60,
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "yazyki"),
    "nasledie-fey": passive("nasledie-fey"),
    "dar-fey": {
      id: "dar-fey",
      kind: "active",
      cost: "bonus",
      target: "ally",
      minLevel: 1,
      uses: "profBonus",
      refresh: "long",
      pick: "all",
      note: () => "Бонусным действием совершает действие Помощь (с 3 уровня — выбор эффекта: Радушие, Проход или Злость).",
      options: [
        {
          id: "fey-gift-hospitality",
          kind: "active",
          cost: "bonus",
          target: "ally",
          minLevel: 3,
          pool: "race/hobgoblin-mpmm/dar-fey",
          name: "Дар фей: Радушие",
          description: "Помощь союзнику; вы и союзник получаете 1к6 + БМ временных хитов.",
        },
        {
          id: "fey-gift-passage",
          kind: "active",
          cost: "bonus",
          target: "ally",
          minLevel: 3,
          pool: "race/hobgoblin-mpmm/dar-fey",
          name: "Дар фей: Проход",
          description: "Помощь союзнику; скорость ходьбы обоих увеличена на 10 фт до начала вашего следующего хода.",
        },
        {
          id: "fey-gift-spite",
          kind: "active",
          cost: "bonus",
          target: "ally",
          minLevel: 3,
          pool: "race/hobgoblin-mpmm/dar-fey",
          name: "Дар фей: Злость",
          description: "Помощь союзнику; первое попадание союзника до начала вашего следующего хода накладывает на цель помеху на следующую атаку.",
        },
      ],
    },
    "udacha-mnozhestva": passive("udacha-mnozhestva", {
      uses: "profBonus",
      refresh: "long",
      note: () => "При провале атаки, проверки или спасброска добавляет +число видимых союзников в 30 фт (макс. +3).",
    }),
  },
});

// 26. ЧЕЙНДЖЛИНГ (MPMM)
defineRace("changeling-mpmm", {
  traits: skipTraits(
    "uvelichenie-kharakteristik",
    "skorost",
    "vid-sushchestva",
    "razmer",
    "instinkty-cheyndzhlinga",
    "perevertysh",
    "yazyki"
  ),
});

// 27. ШАДАР-КАЙ (MPMM)
defineRace("shadar-kai-mpmm", {
  darkvision: 60,
  defaultResistances: ["necrotic"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "obostrennye-chuvstva", "yazyki"),
    "nasledie-fey": passive("nasledie-fey"),
    "nekroticheskoe-soprotivlenie": passive("nekroticheskoe-soprotivlenie"),
    trans: passive("trans"),
    "blagoslovenie-korolevy-voronov": {
      id: "blagoslovenie-korolevy-voronov",
      kind: "active",
      cost: "bonus",
      target: "point",
      range: 30,
      minLevel: 1,
      uses: "profBonus",
      refresh: "long",
      note: () => "Телепорт 30 фт бонусным действием; с 3 уровня — сопротивление всему урону до начала следующего хода.",
    },
  },
});

// 28. ШИФТЕР (MPMM, опции внутри smena-formy)
defineRace("shifter-mpmm", {
  darkvision: 60,
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "vid-sushchestva", "razmer", "skorost", "zverinye-instinkty", "temnoe-zrenie", "yazyki"),
    "smena-formy": {
      id: "smena-formy",
      kind: "active",
      cost: "bonus",
      uses: "profBonus",
      refresh: "long",
      pick: "sheet",
      note: (c) => `Принимает облик на 1 минуту: +${2 * c.prof} временных хитов.`,
      options: [
        {
          id: "beasthide",
          kind: "passive",
          name: "Зверошкур",
          description: "+1к6 дополнительных временных хитов и +1 к КД, пока форма активна.",
          tokens: ["beasthide"],
          aliases: ["Зверошкур", "Beasthide"],
        },
        {
          id: "longtooth",
          kind: "active",
          cost: "bonus",
          target: "creature",
          range: 5,
          name: "Укус длиннозуба",
          description: "Пока смена формы активна: безоружный укус бонусным действием (1к6 + СИЛ колющего урона).",
          tokens: ["longtooth"],
          aliases: ["Длиннозуб", "Longtooth", "Укус длиннозуба"],
        },
        {
          id: "swiftstride",
          kind: "passive",
          name: "Быстроног",
          description: "Пока смена формы активна: +10 фт скорости и реакцией отход до 10 фт без ОА, когда враг заканчивает ход в 5 фт.",
          tokens: ["swiftstride"],
          aliases: ["Быстроног", "Swiftstride"],
        },
        {
          id: "wildhunt",
          kind: "passive",
          name: "Дикий охотник",
          description: "Пока смена формы активна: враги в 30 фт не получают преимущество на атаки против вас.",
          tokens: ["wildhunt"],
          aliases: ["Дикий охотник", "Wildhunt"],
        },
      ],
    },
  },
});

// 29. ЭЛАДРИН (MPMM)
defineRace("eladrin-mpmm", {
  darkvision: 60,
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "obostrennye-chuvstva", "yazyki"),
    "nasledie-fey": passive("nasledie-fey"),
    trans: passive("trans"),
    "feyskiy-shag": {
      id: "feyskiy-shag",
      kind: "active",
      cost: "bonus",
      target: "point",
      range: 30,
      minLevel: 1,
      save: "WIS",
      dc: chosenMentalDc("CHA"),
      uses: "profBonus",
      refresh: "long",
      pick: "sheet",
      options: ELADRIN_SEASONS.map((s) => ({
        id: s.id,
        kind: "passive" as const,
        name: s.name,
        description: s.id === "leto" ? "После телепортации враги в 5 фт получают урон огнём = БМ." : s.desc,
        minLevel: 3,
        tokens: [s.id, s.aliases[0].toLowerCase()],
        aliases: s.aliases,
      })),
    },
  },
});

// 30. ЮАНЬ-ТИ (MPMM)
defineRace("yuan-ti-mpmm", {
  darkvision: 60,
  defaultResistances: ["poison"],
  traits: {
    ...skipTraits("uvelichenie-kharakteristik", "skorost", "vid-sushchestva", "razmer", "temnoe-zrenie", "yazyki"),
    "soprotivlenie-magii": passive("soprotivlenie-magii"),
    "soprotivlenie-yadu": passive("soprotivlenie-yadu"),
    "zmeinye-zaklinaniya": { ...skip("zmeinye-zaklinaniya"), minLevel: 1 },
  },
  innateSpells: [
    spell("poison-spray", "Брызги яда", 0, 1, chosenMentalAbility("CHA"), 0),
    spell("animal-friendship", "Дружба с животными", 1, 1, chosenMentalAbility("CHA"), 0),
    spell("suggestion", "Внушение", 2, 3, chosenMentalAbility("CHA"), 1),
  ],
});
