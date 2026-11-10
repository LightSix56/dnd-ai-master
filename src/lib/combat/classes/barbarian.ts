// Варвар: правила умений путей (заряды, цели, спасброски) и постоянные поправки.
//
// Базовые умения варвара и Путь берсерка собирает class-features.ts из данных SRD; здесь — остальные
// восемь официальных путей (тексты — data/class-subclasses.json) и поправки к умениям SRD.
// Что происходит при применении — в barbarian-combat.ts.

import { defineClass, type Calc, type FeatureRule, type OptionRule } from "../class-defs";
import { conditionMods, featureMods, type Mods } from "../feature-mods";
import type { Combatant } from "../types";

export const RAGE = "raging";

const conDc = (c: Calc) => 8 + c.prof + c.mod("CON");
const strDc = (c: Calc) => 8 + c.prof + c.mod("STR");
const perProf = (c: Calc) => ({ max: c.prof, refresh: "long" as const });
const has = (c: Combatant, type: string) => c.conditions?.some((x) => x.type === type) ?? false;
const hasFeature = (c: Combatant, key: string) => c.abilities?.some((a) => a.parameters?.srdKey === key) ?? false;

/** Прибавка Ауры бури Пустыни и Тундры: 2, растёт до 6 к 20 уровню */
export const stormAuraAmount = (level: number) => (level >= 20 ? 6 : level >= 15 ? 5 : level >= 10 ? 4 : level >= 5 ? 3 : 2);
/** Кости молнии Ауры бури Моря */
export const stormSeaDice = (level: number) => (level >= 20 ? 4 : level >= 15 ? 3 : level >= 10 ? 2 : 1);
/** Кости Духовного щита */
export const spiritShieldDice = (level: number) => (level >= 14 ? 4 : level >= 10 ? 3 : 2);

export type StormEnv = "desert" | "sea" | "tundra";
const STORM_ENVS: StormEnv[] = ["desert", "sea", "tundra"];
const STORM_RESIST: Record<StormEnv, string> = { desert: "fire", sea: "lightning", tundra: "cold" };

/**
 * Стихия вестника бури: единственный вариант ауры из листа, а если в листе стихия не записана —
 * та, которую герой включал последней (состояние storm_aura).
 */
export function stormEnv(c: Combatant): StormEnv | null {
  const known = STORM_ENVS.filter((e) => hasFeature(c, `storm-herald/aura-${e}`));
  if (known.length === 1) return known[0];
  const last = c.conditions?.find((x) => x.type === "storm_aura")?.source as StormEnv | undefined;
  return last && STORM_ENVS.includes(last) ? last : null;
}

export const CLEAVER_TYPES: Array<{ id: string; type: string; name: string }> = [
  { id: "acid", type: "acid", name: "кислота" },
  { id: "cold", type: "cold", name: "холод" },
  { id: "fire", type: "fire", name: "огонь" },
  { id: "thunder", type: "thunder", name: "звук" },
  { id: "lightning", type: "lightning", name: "электричество" },
];

// ============ ПОСТОЯННЫЕ ПОПРАВКИ ============

// Ярость: сопротивление дробящему, колющему и рубящему урону и бонус к урону рукопашных атак Силой
conditionMods(RAGE, {
  name: "ярость",
  mods: (_owner, { condition }) => ({
    resist: ["physical"],
    damageBonus: { amount: condition?.value ?? 2, attacks: "strMelee", label: "ярость" },
  }),
});

// Тотемный воин
featureMods("totem-warrior/spirit-bear", { whileCondition: RAGE, mods: { resist: ["all-but-psychic"] } });
featureMods("totem-warrior/spirit-eagle", { whileCondition: RAGE, mods: { opportunityDisadvantage: true } });
featureMods("totem-warrior/spirit-wolf", { whileCondition: RAGE, mods: { alliesMeleeAdvantageNear: 5 } });
featureMods("totem-warrior/spirit-elk", { whileCondition: RAGE, mods: { speedBonus: 15 } });
featureMods("totem-warrior/attune-bear", { whileCondition: RAGE, mods: { foesDisadvantageVsOthersNear: 5 } });

// Вестник бури: сопротивление своей стихии всегда, союзникам в ауре — пока варвар в ярости
const stormResist = (owner: Combatant): Mods | null => {
  const env = stormEnv(owner);
  return env ? { resist: [STORM_RESIST[env]] } : null;
};
featureMods("storm-herald/storm-soul", { mods: stormResist });
featureMods("storm-herald/shielding-storm", { whileCondition: RAGE, aura: 10, auraOnly: true, mods: stormResist });

// Дикая магия: всплеск 6 — +1 к КД варвару и союзникам в 10 футах, пока длится ярость
featureMods("wild-magic/wild-surge", {
  name: "Всплеск дикой магии",
  whileCondition: RAGE,
  aura: 10,
  mods: (owner) => (owner.conditions.some((x) => x.type === "wild_surge" && x.value === 6) ? { acBonus: 1 } : null),
});
conditionMods("bolstered", { name: "Подпитка магией", mods: { attackBonusDice: "1d3" } });

// Великан: в ярости досягаемость больше, а метательное оружие получает бонус урона ярости
featureMods("giant/giants-havoc", {
  name: "Ярость великана",
  whileCondition: RAGE,
  mods: (owner) => ({
    reachBonus: hasFeature(owner, "giant/demiurgic-colossus") ? 10 : 5,
    damageBonus: {
      amount: owner.conditions.find((x) => x.type === RAGE)?.value ?? 2,
      attacks: "thrown",
      label: "ярость (бросок)",
    },
  }),
});

// Чутьё опасности стоит в rules.ts (условие «видит и слышит»), остальное базовое — в SRD

// ============ ПРАВИЛА УМЕНИЙ ============

const skip = (id: string): FeatureRule => ({ id, kind: "skip" });
const passive = (id: string, extra: Partial<FeatureRule> = {}): FeatureRule => ({ id, kind: "passive", ...extra });

const TOTEMS: Array<{ id: string; name: string }> = [
  { id: "bear", name: "Медведь" },
  { id: "eagle", name: "Орёл" },
  { id: "wolf", name: "Волк" },
  { id: "elk", name: "Лось" },
  { id: "tiger", name: "Тигр" },
];

/** Вариант тотема: в листе записан как «Дух тотема: Медведь» */
function totem(stage: "spirit" | "attune", animal: string, description: string, rule: Partial<OptionRule> = {}): OptionRule {
  const t = TOTEMS.find((x) => x.id === animal)!;
  const title = stage === "spirit" ? "Дух тотема" : "Гармония тотема";
  return {
    id: `${stage}-${animal}`,
    kind: "passive",
    name: `${title}: ${t.name}`,
    description,
    aliases: stage === "spirit" ? [`Тотемный дух: ${t.name}`] : [`Тотемное гармонирование: ${t.name}`, `Тотемная гармония: ${t.name}`],
    ...rule,
  };
}

const stormAura = (env: StormEnv, name: string, description: string, rule: Partial<OptionRule> = {}): OptionRule => ({
  id: `aura-${env}`,
  kind: "active",
  cost: "bonus",
  name: `Аура бури: ${name}`,
  description,
  aliases: [name],
  ...rule,
});

defineClass({
  classId: "barbarian",
  srd: {
    // Ответный удар берсерка срабатывает сам реакцией на урон от существа в 5 футах
    "path-of-the-berserker/retaliation": () => ({ actionCost: "none", passive: true }),
  },
  subclasses: {
    "totem-warrior": {
      features: {
        "Поиски духа": skip("spirit-seeker"),
        "Тотемный дух": {
          id: "totem-spirit",
          kind: "skip",
          pick: "sheet",
          options: [
            totem("spirit", "bear", "В ярости вы получаете сопротивление всем видам урона, кроме психического."),
            totem("spirit", "eagle", "В ярости провоцированные атаки по вам совершаются с помехой, а Рывок доступен бонусным действием.", {
              kind: "active",
              cost: "bonus",
              note: () => "Кнопка — Рывок бонусным действием (только в Ярости). Помеха на провоцированные атаки действует сама.",
            }),
            totem("spirit", "wolf", "В ярости ваши союзники совершают рукопашные атаки с преимуществом по врагам в 5 футах от вас."),
            totem("spirit", "elk", "В ярости ваша скорость ходьбы увеличивается на 15 футов."),
            totem("spirit", "tiger", "В ярости вы прыгаете в длину на 10 футов дальше и в высоту на 3 фута выше.", { kind: "skip" }),
          ],
        },
        "Аспект зверя": skip("aspect-of-the-beast"),
        "Проводник духов": skip("spirit-walker"),
        "Тотемное гармонирование": {
          id: "totemic-attunement",
          kind: "skip",
          pick: "sheet",
          options: [
            totem("attune", "bear", "В ярости враги в 5 футах от вас совершают броски атаки по другим существам с помехой."),
            totem("attune", "eagle", "В ярости вы получаете скорость полёта, равную скорости ходьбы (в конце хода нужно стоять на опоре).", {
              note: () => "Полёт на карте боя не отыгрывается: высоту учитывает мастер.",
            }),
            totem("attune", "wolf", "В ярости бонусным действием сбейте с ног существо размером не больше Большого, по которому вы попали рукопашной атакой в этом ходу.", {
              kind: "active",
              cost: "bonus",
              target: "creature",
              range: 5,
            }),
            totem("attune", "elk", "В ярости бонусным действием пройдите сквозь существо размером не больше Большого: спасбросок Силы, при провале оно сбито с ног и получает 1к12 + мод. Силы дробящего урона.", {
              kind: "active",
              cost: "bonus",
              target: "creature",
              range: 5,
              save: "STR",
              dc: strDc,
              note: (c) => `СЛ ${strDc(c)}.`,
            }),
            totem("attune", "tiger", "В ярости, пройдя не менее 20 футов по прямой к цели, бонусным действием совершите по ней дополнительную рукопашную атаку оружием.", {
              kind: "active",
              cost: "bonus",
              target: "creature",
              range: 5,
            }),
          ],
        },
      },
    },

    battlerager: {
      features: {
        "Шипастая броня": {
          id: "spiked-armor",
          kind: "active",
          cost: "bonus",
          target: "creature",
          range: 5,
          note: (c) => `Только в Ярости и в шипастом доспехе: атака шипами +${c.prof + c.mod("STR")}, урон 1к4 + ${c.mod("STR")} колющий.`,
        },
        "Яростный таран": passive("reckless-abandon", {
          note: (c) => `Срабатывает сам: Безрассудная атака в Ярости даёт ${Math.max(1, c.mod("CON"))} временных хитов.`,
        }),
        "Шипастый рывок": { id: "battlerager-charge", kind: "active", cost: "bonus", note: () => "Рывок бонусным действием, только в Ярости." },
        "Острые шипы": passive("spiked-retribution", { note: () => "Срабатывает само в Ярости: попавший по вам рукопашной атакой в 5 футах получает 3 колющего урона." }),
      },
    },

    "ancestral-guardian": {
      features: {
        "Защитники предков": passive("ancestral-protectors", {
          note: () => "Срабатывает само: первое существо, по которому вы попали в свой ход в Ярости, до конца своего хода атакует всех, кроме вас, с помехой, а урон его атак по другим уменьшается вдвое.",
        }),
        "Духовный щит": passive("spirit-shield", {
          value: (c) => spiritShieldDice(c.level),
          note: (c) => `Срабатывает сам реакцией в Ярости, когда союзник в 30 футах получает заметный урон: урон меньше на ${spiritShieldDice(c.level)}к6.`,
        }),
        "Совет предков": skip("consult-the-spirits"),
        "Мстительные предки": passive("vengeful-ancestors", { note: () => "Срабатывает само: нападавший получает урон силовым полем, равный урону, который снял Духовный щит." }),
      },
    },

    "storm-herald": {
      features: {
        "Аура бури": {
          id: "storm-aura",
          kind: "passive",
          value: () => 10,
          note: (c) => `Аура 10 футов действует в Ярости: срабатывает при входе в ярость и потом бонусным действием. СЛ ${conDc(c)}.`,
          pick: "sheet-or-all",
          options: [
            stormAura("desert", "Пустыня", "Все остальные существа в ауре получают урон огнём.", {
              note: (c) => `Урон огнём: ${stormAuraAmount(c.level)}.`,
            }),
            stormAura("sea", "Море", "Одно существо в ауре совершает спасбросок Ловкости: урон молнией, при успехе — половина.", {
              target: "creature",
              range: 10,
              save: "DEX",
              dc: conDc,
              note: (c) => `Урон ${stormSeaDice(c.level)}к6, СЛ ${conDc(c)}.`,
            }),
            stormAura("tundra", "Тундра", "Вы и выбранные существа в ауре получаете временные хиты.", {
              note: (c) => `Временные хиты: ${stormAuraAmount(c.level)}.`,
            }),
          ],
        },
        "Штормовая душа": passive("storm-soul", { note: () => "Сопротивление урону своей стихии действует само: Пустыня — огонь, Море — электричество, Тундра — холод." }),
        "Оберегающий шторм": passive("shielding-storm", { note: () => "Действует сам: союзники в ауре получают то же сопротивление, пока вы в Ярости." }),
        "Ярость бури": passive("raging-storm", {
          save: "DEX",
          dc: conDc,
          note: (c) => `Срабатывает сама, СЛ ${conDc(c)}. Пустыня: реакцией попавший по вам в ауре получает ${Math.floor(c.level / 2)} урона огнём (спасбросок Ловкости). Море: реакцией существо в ауре, по которому вы попали, падает ничком (спасбросок Силы). Тундра: при включении ауры ближайший враг в ней останавливается (спасбросок Силы).`,
        }),
      },
    },

    zealot: {
      features: {
        "Божественная ярость": passive("divine-fury", {
          // 1 — некротический урон, 0 — излучение (по умолчанию)
          value: (c) => (/некротич/.test(c.text) && !/излучени/.test(c.text) ? 1 : 0),
          note: (c) => `Срабатывает сама: первое попадание оружием в каждый ваш ход в Ярости наносит ещё 1к6 + ${Math.floor(c.level / 2)} урона.`,
        }),
        "Воин богов": skip("warrior-of-the-gods"),
        "Фанатичное присутствие": passive("fanatical-focus", { note: () => "Срабатывает само: проваленный в Ярости спасбросок перебрасывается, один раз за ярость." }),
        "Ревностное воодушевление": {
          id: "zealous-presence",
          kind: "active",
          cost: "bonus",
          range: 60,
          uses: () => ({ max: 1, refresh: "long" }),
          note: () => "До 10 союзников в 60 футах получают преимущество на броски атаки и спасброски до начала вашего следующего хода.",
        },
        "Ярость за гранью смерти": passive("rage-beyond-death", { note: () => "Движок это умение не разыгрывает: падение до 0 хитов в Ярости ведёт мастер." }),
      },
    },

    beast: {
      features: {
        "Форма зверя": {
          id: "form-of-the-beast",
          kind: "passive",
          note: () => "Войдя в Ярость, выберите природное оружие кнопкой (без действия): оно появляется среди атак до конца ярости.",
          pick: "all",
          options: [
            {
              id: "form-bite",
              kind: "active",
              cost: "free",
              name: "Форма зверя: Укус",
              description: "Укус: 1к8 колющего урона. Раз в свой ход, попав укусом при хитах меньше половины, вы восстанавливаете хиты, равные бонусу мастерства.",
            },
            {
              id: "form-claws",
              kind: "active",
              cost: "free",
              name: "Форма зверя: Когти",
              description: "Когти: 1к6 рубящего урона. Раз в ход, атаковав когтями действием Атака, вы совершаете ещё одну атаку когтями.",
            },
            {
              id: "form-tail",
              kind: "active",
              cost: "free",
              name: "Форма зверя: Хвост",
              description: "Хвост: 1к8 колющего урона, досягаемость 10 футов. Реакцией на попадание по вам существа в 10 футах — +1к8 к КД против этой атаки.",
            },
          ],
        },
        "Бестиальная душа": passive("bestial-soul", { note: () => "Природное оружие считается магическим. Плавание, лазание и прыжки отыгрывает мастер." }),
        "Инфекционное бешенство": {
          id: "infectious-fury",
          kind: "active",
          cost: "free",
          defer: true,
          save: "WIS",
          dc: conDc,
          uses: perProf,
          note: (c) => `Зарядите перед атакой природным оружием: при попадании цель совершает спасбросок Мудрости (СЛ ${conDc(c)}), при провале получает 2к12 психического урона.`,
        },
        "Зов охоты": passive("call-the-hunt", { note: () => "Движок это умение не разыгрывает: бонусы стае раздаёт мастер." }),
      },
    },

    "wild-magic": {
      features: {
        "Магическое чутьё": skip("magic-awareness"),
        "Всплеск дикой магии": passive("wild-surge", {
          save: "CON",
          dc: conDc,
          note: (c) => `Срабатывает сам при входе в Ярость: бросок к8 по таблице Дикой магии, СЛ ${conDc(c)}. Эффекты 2, 3 и 8 можно повторять бонусным действием — кнопками «Всплеск: …».`,
        }),
        "Подпитка магией": {
          id: "bolstering-magic",
          kind: "pool",
          uses: perProf,
        },
        "Нестабильный отклик": passive("unstable-backlash", { note: () => "Срабатывает сам реакцией, когда вы получаете урон в Ярости, а эффект всплеска уже отыгран (1 или 7): новый бросок по таблице." }),
        "Контролируемый всплеск": passive("controlled-surge", { note: () => "Движок бросает по таблице один раз; выбор из двух бросков отыгрывает мастер." }),
      },
      extra: [
        {
          id: "surge-teleport",
          kind: "active",
          cost: "bonus",
          target: "point",
          range: 30,
          minLevel: 3,
          name: "Всплеск: телепортация",
          description: "Пока длится ярость со всплеском 2: бонусным действием телепортируйтесь до 30 футов в свободную клетку.",
        },
        {
          id: "surge-spirit",
          kind: "active",
          cost: "bonus",
          target: "creature",
          range: 30,
          save: "DEX",
          dc: conDc,
          minLevel: 3,
          name: "Всплеск: взрыв духа",
          description: "Пока длится ярость со всплеском 3: дух появляется у существа в 30 футах и взрывается — 1к6 урона силовым полем ему и врагам в 5 футах (спасбросок Ловкости).",
        },
        {
          id: "surge-bolt",
          kind: "active",
          cost: "bonus",
          target: "creature",
          range: 30,
          save: "CON",
          dc: conDc,
          minLevel: 3,
          name: "Всплеск: луч света",
          description: "Пока длится ярость со всплеском 8: луч бьёт существо в 30 футах — спасбросок Телосложения, при провале 1к6 урона излучением и ослепление до начала вашего следующего хода.",
        },
        {
          id: "bolster-attack",
          kind: "active",
          cost: "action",
          target: "ally",
          range: 5,
          pool: "wild-magic/bolstering-magic",
          minLevel: 6,
          name: "Подпитка магией: усиление",
          description: "Касанием: на 10 минут существо прибавляет 1к3 к броскам атаки и проверкам характеристик.",
        },
        {
          id: "bolster-slot",
          kind: "active",
          cost: "action",
          target: "ally",
          range: 5,
          pool: "wild-magic/bolstering-magic",
          minLevel: 6,
          name: "Подпитка магией: ячейка",
          description: "Касанием: бросок к3 — существо восстанавливает потраченную ячейку заклинаний этого круга или ниже.",
        },
      ],
    },

    giant: {
      features: {
        "Сила великана": skip("giants-power"),
        "Ярость великана": passive("giants-havoc", {
          note: (c) => `В Ярости: досягаемость рукопашных атак +${c.level >= 14 ? 10 : 5} футов, метательное оружие получает бонус урона ярости. Размер на карте боя не меняется.`,
        }),
        "Стихийное оружие": {
          id: "elemental-cleaver",
          kind: "passive",
          value: (c) => (c.level >= 14 ? 2 : 1),
          note: (c) => `В Ярости оружие наносит ещё ${c.level >= 14 ? 2 : 1}к6 урона стихией. При входе в ярость включается огонь (или прошлая стихия); сменить — кнопкой бонусным действием.`,
          pick: "all",
          options: CLEAVER_TYPES.map((t) => ({
            id: `cleaver-${t.id}`,
            kind: "active" as const,
            cost: "bonus" as const,
            name: `Стихийное оружие: ${t.name}`,
            description: `Бонусным действием в Ярости оружие наполняется стихией: дополнительный урон — ${t.name}.`,
          })),
        },
        "Могучий бросок": {
          id: "mighty-impel",
          kind: "active",
          cost: "bonus",
          target: "creature",
          range: 10,
          save: "STR",
          dc: strDc,
          note: (c) => `Только в Ярости: враг размером не больше ${c.level >= 14 ? "Большого" : "Среднего"} в досягаемости отлетает на 30 футов при провале спасброска Силы (СЛ ${strDc(c)}).`,
        },
        "Полубог-великан": passive("demiurgic-colossus", { note: () => "Досягаемость +10 футов, Стихийное оружие 2к6, Могучий бросок действует на Больших существ — уже учтено." }),
      },
    },
  },
});
