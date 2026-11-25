// Правила 20 legacy-рас D&D 5e (VGM / MTF / POA / TCE / VRGR) и их подрас (данные: data/races-2014.json).
// Боевые срабатывания (превращения аасимара, внезапное нападение, выносливость камня и др.) — в legacy-volo-mtf-combat.ts.

import { conditionMods, featureMods } from "../feature-mods";
import type { AbilityKey } from "../types";
import {
  defineRace,
  type Calc,
  type InnateSpellSpec,
  type RaceFeatureRule,
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

const chaDc = (c: Calc) => 8 + c.prof + c.mod("CHA");

// ============ ПОСТОЯННЫЕ ПОПРАВКИ ============

featureMods("race/aasimar/nebesnoe-soprotivlenie", {
  name: "Небесное сопротивление",
  resist: ["radiant", "necrotic"],
});

featureMods("race/bugbear/dlinnye-konechnosti", {
  name: "Длинные конечности",
  reachBonus: 5,
});

conditionMods("dhampir_bite_bonus", {
  name: "Укус вампира (усиление)",
  mods: (_owner, { condition }) => ({ attackBonus: condition?.value ?? 0 }),
});

featureMods("race/fire-genasi/soprotivlenie-ognyu", {
  name: "Сопротивление огню",
  resist: ["fire"],
});

featureMods("race/water-genasi/soprotivlenie-kislote", {
  name: "Сопротивление кислоте",
  resist: ["acid"],
});

featureMods("race/githzerai/mentalnaya-distsiplina", {
  name: "Ментальная дисциплина",
  saveAdvantageConditions: ["charmed", "frightened"],
});

featureMods("race/goliath/rozhdennyy-v-gorakh", {
  name: "Рождённый в горах",
  resist: ["cold"],
});

featureMods("race/kobold/taktika-stai", {
  name: "Тактика стаи",
  attackAdvantageNearAlly: 5,
});

featureMods("race/lizardfolk/prirodnyy-dospekh", {
  name: "Природный доспех",
  minBaseAC: (owner) => 13 + (owner.abilityMods?.DEX ?? 0),
});

featureMods("race/reborn/bessmertnaya-priroda", {
  name: "Бессмертная природа",
  resist: ["poison"],
  saveAdvantageConditions: ["poisoned"],
  sleepImmune: true,
  deathSaveAdvantage: true,
});

featureMods("race/triton/strazhi-glubin", {
  name: "Стражи глубин",
  resist: ["cold"],
});

featureMods("race/yuan-ti-pureblood/soprotivlenie-magii", {
  name: "Сопротивление магии",
  spellSaveAdvantage: true,
});

featureMods("race/yuan-ti-pureblood/immun", {
  name: "Иммунитет к яду",
  immune: ["poison"],
  conditionImmune: ["poisoned"],
});

// ============ ТАБЛИЦЫ ДАННЫХ ============

export interface AasimarFormSpec {
  subraceId: string;
  traitId: string;
  condition: string;
  damageType: "radiant" | "necrotic";
  save?: AbilityKey;
  flySpeed?: number;
  auraEndTurn?: boolean;
  label: string;
}

export const AASIMAR_FORMS: AasimarFormSpec[] = [
  {
    subraceId: "protector-aasimar",
    traitId: "siyayushchaya-dusha",
    condition: "aasimar_radiant_soul",
    damageType: "radiant",
    flySpeed: 30,
    label: "Сияющая душа",
  },
  {
    subraceId: "scourge-aasimar",
    traitId: "ispuskanie-siyaniya",
    condition: "aasimar_radiant_consumption",
    damageType: "radiant",
    auraEndTurn: true,
    label: "Испускание сияния",
  },
  {
    subraceId: "fallen-aasimar",
    traitId: "savan-smerti",
    condition: "aasimar_necrotic_shroud",
    damageType: "necrotic",
    save: "CHA",
    label: "Саван смерти",
  },
];

// ============ ОПИСАНИЯ 20 LEGACY-РАС ============

// 1. ААРАКОКРА
defineRace("aarakocra", {
  speed: { walk: 25, fly: 50 },
  naturalWeapons: [
    { id: "aarakocra_claws", name: "Когти", dice: "1d4", damageType: "slashing", ability: "STR" },
  ],
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    polet: passive("polet"),
    kogti: passive("kogti"),
    yazyk: skip("yazyk"),
  },
});

// 2. ААСИМАР
defineRace("aasimar", {
  darkvision: 60,
  defaultResistances: ["radiant", "necrotic"],
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "nebesnoe-soprotivlenie": passive("nebesnoe-soprotivlenie"),
    "istselyayushchie-ruki": {
      id: "istselyayushchie-ruki",
      kind: "active",
      cost: "action",
      target: "ally",
      range: 5,
      uses: { max: 1, refresh: "long" },
      note: (c) => `Восстанавливает ${c.level} хитов касанием.`,
    },
    "nesushchiy-svet": skip("nesushchiy-svet"),
    yazyki: skip("yazyki"),
  },
  innateSpells: [spell("light", "Свет", 0, 1, "CHA", 0)],
  subraces: Object.fromEntries(
    AASIMAR_FORMS.map((form) => [
      form.subraceId,
      {
        traits: {
          "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
          [form.traitId]: {
            id: form.traitId,
            kind: "active" as const,
            cost: "action" as const,
            minLevel: 3,
            ...(form.save ? { save: form.save, dc: chaDc } : {}),
            uses: { max: 1, refresh: "long" as const },
            note: (c: Calc) =>
              `Длится 1 минуту: раз в ход +${c.level} урона (${form.damageType}).`,
          },
        },
      },
    ])
  ),
});

// 3. БАГБИР
defineRace("bugbear", {
  darkvision: 60,
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "dlinnye-konechnosti": passive("dlinnye-konechnosti"),
    "moshchnoe-teloslozhenie": skip("moshchnoe-teloslozhenie"),
    skrytnost: skip("skrytnost"),
    "vnezapnoe-napadenie": passive("vnezapnoe-napadenie"),
    yazyki: skip("yazyki"),
  },
});

// 4. ДАМПИР
defineRace("dhampir", {
  speed: { walk: 35, climb: 35 },
  darkvision: 60,
  naturalWeapons: [
    {
      id: "dhampir_bite",
      name: "Укус вампира",
      dice: "1d4",
      damageType: "piercing",
      ability: "CON",
      description: "1к4 + ТЕЛ колющего урона; с усилением лечит или добавляет бонус к следующему броску.",
    },
  ],
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    "vid-sushchestva": skip("vid-sushchestva"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "nasledie-predkov": skip("nasledie-predkov"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "priroda-nezhiti": skip("priroda-nezhiti"),
    "pauche-lazanie": passive("pauche-lazanie", { minLevel: 1 }),
    "ukus-vampira": {
      id: "ukus-vampira",
      kind: "active",
      cost: "free",
      uses: "profBonus",
      refresh: "long",
      note: () => "Заряжает «Укус вампира» в этом ходу: лечение на нанесённый урон или бонус к следующей атаке.",
    },
    yazyki: skip("yazyki"),
  },
});

// 5. ФИРБОЛГ
defineRace("firbolg", {
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "magiya-firbolgov": skip("magiya-firbolgov"),
    "nezrimaya-postup": {
      id: "nezrimaya-postup",
      kind: "active",
      cost: "bonus",
      uses: { max: 1, refresh: "short" },
    },
    "moshchnoe-teloslozhenie": skip("moshchnoe-teloslozhenie"),
    "yazyk-zverey-i-listvy": skip("yazyk-zverey-i-listvy"),
    yazyki: skip("yazyki"),
  },
  innateSpells: [
    spell("detect-magic", "Обнаружение магии", 1, 1, "WIS", 1, "short"),
    spell("disguise-self", "Маскировка", 1, 1, "WIS", 1, "short"),
  ],
});

// 6. ДЖЕНАЗИ
defineRace("genasi", {
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    yazyki: skip("yazyki"),
    podrasa: skip("podrasa"),
  },
  subraces: {
    "air-genasi": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "beskonechnoe-dykhanie": skip("beskonechnoe-dykhanie"),
        "obshchenie-s-vetrom": skip("obshchenie-s-vetrom"),
      },
      innateSpells: [spell("levitate", "Левитация", 2, 1, "CON", 1)],
    },
    "earth-genasi": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "khozhdenie-po-zemle": passive("khozhdenie-po-zemle"),
        "sliyanie-s-kamnem": skip("sliyanie-s-kamnem"),
      },
      innateSpells: [spell("pass-without-trace", "Бесследное передвижение", 2, 1, "CON", 1)],
    },
    "fire-genasi": {
      darkvision: 60,
      resistances: ["fire"],
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "temnoe-zrenie": skip("temnoe-zrenie"),
        "soprotivlenie-ognyu": passive("soprotivlenie-ognyu"),
        "vybros-plameni": { ...skip("vybros-plameni"), minLevel: 1 },
      },
      innateSpells: [
        spell("produce-flame", "Сотворение пламени", 0, 1, "CON", 0),
        spell("burning-hands", "Огненные ладони", 1, 3, "CON", 1),
      ],
    },
    "water-genasi": {
      speed: { swim: 30 },
      resistances: ["acid"],
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "soprotivlenie-kislote": passive("soprotivlenie-kislote"),
        amfibiya: skip("amfibiya"),
        plovets: skip("plovets"),
        "prizyv-volny": skip("prizyv-volny"),
      },
      innateSpells: [spell("create-or-destroy-water", "Создание или уничтожение воды", 2, 3, "CON", 1)],
    },
  },
});

// 7. ГИТ
defineRace("gith", {
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    yazyki: skip("yazyki"),
  },
  subraces: {
    githzerai: {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "mentalnaya-distsiplina": passive("mentalnaya-distsiplina"),
        "psionika-gittseraev": { ...skip("psionika-gittseraev"), minLevel: 1 },
      },
      innateSpells: [
        spell("mage-hand", "Волшебная рука", 0, 1, "WIS", 0),
        spell("shield", "Щит", 1, 3, "WIS", 1),
        spell("detect-thoughts", "Обнаружение мыслей", 2, 5, "WIS", 1),
      ],
    },
    githyanki: {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        "dekadentskoe-masterstvo": skip("dekadentskoe-masterstvo"),
        "voinskoe-vospitanie": skip("voinskoe-vospitanie"),
        "psionika-gityanki": { ...skip("psionika-gityanki"), minLevel: 1 },
      },
      innateSpells: [
        spell("mage-hand", "Волшебная рука", 0, 1, "INT", 0),
        spell("jump", "Прыжок", 1, 3, "INT", 1),
        spell("misty-step", "Туманный шаг", 2, 5, "INT", 1),
      ],
    },
  },
});

// 8. ГОБЛИН
defineRace("goblin", {
  darkvision: 60,
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "razyarennaya-melkota": {
      id: "razyarennaya-melkota",
      kind: "active",
      cost: "free",
      uses: { max: 1, refresh: "short" },
      note: (c) => `Заряжает атаку/заклинание в этом ходу: +${c.level} урона по цели крупнее вас.`,
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
    yazyki: skip("yazyki"),
  },
  subraces: {
    "dankwood-goblin": {
      traits: {
        "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
        razmer: skip("razmer"),
        skorost: skip("skorost"),
        "temnoe-zrenie": skip("temnoe-zrenie"),
        "obshchenie-s-malenkimi-zveryami": skip("obshchenie-s-malenkimi-zveryami"),
        "shustryy-pobeg": skip("shustryy-pobeg"),
        yazyki: skip("yazyki"),
      },
    },
  },
});

// 9. ГОЛИАФ
defineRace("goliath", {
  defaultResistances: ["cold"],
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "istinnyy-atlet": skip("istinnyy-atlet"),
    "vynoslivost-kamnya": {
      id: "vynoslivost-kamnya",
      kind: "active",
      cost: "reaction",
      offTurn: true,
      uses: { max: 1, refresh: "short" },
      note: (c) => `Уменьшает получаемый урон реакцией на 1к12 + ${c.mod("CON")}.`,
    },
    "silnye-ruki": skip("silnye-ruki"),
    "rozhdennyy-v-gorakh": passive("rozhdennyy-v-gorakh"),
    yazyki: skip("yazyki"),
  },
});

// 10. ВЕДЬМОВСКАЯ КРОВЬ
defineRace("hexblood", {
  darkvision: 60,
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    "vid-sushchestva": skip("vid-sushchestva"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "nasledie-predkov": skip("nasledie-predkov"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "zhutkiy-suvenir": skip("zhutkiy-suvenir"),
    "telepaticheskoe-poslanie": skip("telepaticheskoe-poslanie"),
    "udalennoe-nablyudenie": skip("udalennoe-nablyudenie"),
    "vedmovskaya-magiya": skip("vedmovskaya-magiya"),
    yazyki: skip("yazyki"),
  },
  innateSpells: [
    spell("disguise-self", "Маскировка", 1, 1, "CHA", 1),
    spell("hex", "Сглаз", 1, 1, "CHA", 1),
  ],
});

// 11. ХОБГОБЛИН
defineRace("hobgoblin", {
  darkvision: 60,
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "boevaya-podgotovka": skip("boevaya-podgotovka"),
    "sokhranit-litso": passive("sokhranit-litso", { uses: { max: 1, refresh: "short" } }),
    yazyki: skip("yazyki"),
  },
});

// 12. КЕНКУ
defineRace("kenku", {
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "master-poddelok": skip("master-poddelok"),
    "podgotovka-kenku": skip("podgotovka-kenku"),
    imitirovanie: skip("imitirovanie"),
    yazyki: skip("yazyki"),
  },
});

// 13. КОБОЛЬД
defineRace("kobold", {
  darkvision: 60,
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "sklonis-sezhsya-i-umolyay": {
      id: "sklonis-sezhsya-i-umolyay",
      kind: "active",
      cost: "action",
      uses: { max: 1, refresh: "short" },
    },
    "taktika-stai": passive("taktika-stai"),
    "chuvstvitelnost-k-solnechnomu-svetu": passive("chuvstvitelnost-k-solnechnomu-svetu"),
    yazyki: skip("yazyki"),
  },
});

// 14. ЛЮДОЯЩЕР
defineRace("lizardfolk", {
  speed: { walk: 30, swim: 30 },
  naturalWeapons: [
    { id: "lizardfolk_bite", name: "Укус", dice: "1d6", damageType: "piercing", ability: "STR" },
  ],
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    ukus: passive("ukus"),
    "umelyy-remeslennik": skip("umelyy-remeslennik"),
    "zaderzhivanie-dykhaniya": skip("zaderzhivanie-dykhaniya"),
    "znaniya-okhotnika": skip("znaniya-okhotnika"),
    "prirodnyy-dospekh": passive("prirodnyy-dospekh", { value: (c) => 13 + c.mod("DEX") }),
    "golodnaya-past": {
      id: "golodnaya-past",
      kind: "active",
      cost: "bonus",
      target: "creature",
      range: 5,
      uses: { max: 1, refresh: "short" },
      note: (c) => `Атака укусом: при попадании даёт ${Math.max(1, c.mod("CON"))} временных хитов.`,
    },
    yazyki: skip("yazyki"),
  },
});

// 15. ОРК
const ORC_SUBRACE_SKIP: Record<string, RaceFeatureRule> = {
  "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
  razmer: skip("razmer"),
  skorost: skip("skorost"),
  "temnoe-zrenie": skip("temnoe-zrenie"),
  agressivnyy: skip("agressivnyy"),
  "chute-dikarya": skip("chute-dikarya"),
  "moshchnoe-teloslozhenie": skip("moshchnoe-teloslozhenie"),
  yazyki: skip("yazyki"),
};

defineRace("orc", {
  darkvision: 60,
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    agressivnyy: {
      id: "agressivnyy",
      kind: "active",
      cost: "bonus",
      target: "creature",
      range: 120,
      uses: { max: 0, refresh: "none" },
    },
    "chute-dikarya": skip("chute-dikarya"),
    "moshchnoe-teloslozhenie": skip("moshchnoe-teloslozhenie"),
    yazyki: skip("yazyki"),
  },
  subraces: {
    "orc-rlw": { traits: ORC_SUBRACE_SKIP },
    "orc-egw": { traits: ORC_SUBRACE_SKIP },
  },
});

// 16. ВОЗРОЖДЁННЫЙ
defineRace("reborn", {
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    "vid-sushchestva": skip("vid-sushchestva"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "nasledie-predkov": skip("nasledie-predkov"),
    "bessmertnaya-priroda": passive("bessmertnaya-priroda"),
    "znaniya-iz-proshloy-zhizni": {
      id: "znaniya-iz-proshloy-zhizni",
      kind: "active",
      cost: "free",
      manual: true,
      uses: "profBonus",
      refresh: "long",
      note: () => "Добавляет 1к6 к проверке характеристики с использованием навыка.",
    },
    yazyki: skip("yazyki"),
  },
});

// 17. ТАБАКСИ
defineRace("tabaxi", {
  darkvision: 60,
  speed: { walk: 30, climb: 20 },
  naturalWeapons: [
    { id: "tabaxi_claws", name: "Когти", dice: "1d4", damageType: "slashing", ability: "STR" },
  ],
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "koshache-provorstvo": {
      id: "koshache-provorstvo",
      kind: "active",
      cost: "free",
      uses: { max: 1, refresh: "short" },
      note: () => "Удваивает скорость до конца хода; перезаряжается в конце хода без перемещения (0 фт).",
    },
    "koshachi-kogti": passive("koshachi-kogti"),
    "koshachi-sposobnosti": skip("koshachi-sposobnosti"),
    yazyki: skip("yazyki"),
  },
});

// 18. ТРИТОН
defineRace("triton", {
  darkvision: 60,
  speed: { walk: 30, swim: 30 },
  defaultResistances: ["cold"],
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    "modifikator-razmera": skip("modifikator-razmera"),
    vysota: skip("vysota"),
    "ves-v-funtakh": skip("ves-v-funtakh"),
    skorost: skip("skorost"),
    amfibiya: skip("amfibiya"),
    "upravlenie-vozdukhom-i-vodoy": { ...skip("upravlenie-vozdukhom-i-vodoy"), minLevel: 1 },
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "poslannik-morya": skip("poslannik-morya"),
    "strazhi-glubin": passive("strazhi-glubin"),
    yazyki: skip("yazyki"),
  },
  innateSpells: [
    spell("fog-cloud", "Туманное облако", 1, 1, "CHA", 1),
    spell("gust-of-wind", "Порыв ветра", 2, 3, "CHA", 1),
    spell("wall-of-water", "Водяная стена", 3, 5, "CHA", 1),
  ],
});

// 19. ЮАНЬ-ТИ
defineRace("yuan-ti-pureblood", {
  darkvision: 60,
  conditionImmunities: ["poisoned"],
  traits: {
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "temnoe-zrenie": skip("temnoe-zrenie"),
    "vrozhdennaya-magiya": { ...skip("vrozhdennaya-magiya"), minLevel: 1 },
    "soprotivlenie-magii": passive("soprotivlenie-magii"),
    immun: passive("immun"),
    yazyki: skip("yazyki"),
  },
  innateSpells: [
    spell("poison-spray", "Брызги яда", 0, 1, "CHA", 0),
    spell("animal-friendship", "Дружба с животными", 1, 1, "CHA", 0),
    spell("suggestion", "Внушение", 2, 3, "CHA", 1),
  ],
});

// 20. СВОЁ ПРОИСХОЖДЕНИЕ (Custom Lineage)
defineRace("custom-lineage", {
  traits: {
    "vid-sushchestva": skip("vid-sushchestva"),
    razmer: skip("razmer"),
    skorost: skip("skorost"),
    "uvelichenie-kharakteristik": skip("uvelichenie-kharakteristik"),
    cherta: skip("cherta"),
    "vyborochnaya-osobennost": {
      id: "vyborochnaya-osobennost",
      kind: "skip",
      pick: "sheet",
      options: [
        {
          id: "darkvision-60",
          kind: "passive",
          name: "Тёмное зрение (60 фт)",
          description: "Тёмное зрение в пределах 60 футов.",
          darkvision: 60,
          tokens: ["darkvision-60", "darkvision", "temnoe-zrenie"],
          aliases: ["Тёмное зрение", "Darkvision"],
        },
        {
          id: "skill-prof",
          kind: "skip",
          name: "Владение навыком",
          description: "Владение одним навыком по выбору.",
          tokens: ["skill-prof", "skill"],
          aliases: ["Владение одним навыком", "Skill Proficiency"],
        },
      ],
    },
    yazyki: skip("yazyki"),
  },
});
