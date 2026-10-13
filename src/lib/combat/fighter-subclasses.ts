// Подклассы Воина (редакция 2014) с dnd.su: умения и варианты на выбор для боя.
//
// Данные — data/fighter-dndsu.json (собираются scripts/import-dndsu-fighter.py): 10 официальных
// подклассов, 56 умений, 42 варианта (приёмы Мастера боевых искусств, магические выстрелы,
// псионические силы, руны). Чемпион уже есть в умениях SRD (class-features.ts) — здесь его умения
// не дублируются.
//
// Как и умения SRD, всё описано свойствами: когда применяется (действие, бонусное, реакция), сколько
// зарядов и когда они возвращаются, из какого запаса тратится (кости превосходства, псионической
// энергии, магические выстрелы). Эффекты, которых движок сам не разыгрывает, помечены manual:
// движок тратит действие и заряды, пишет в журнал и показывает мастеру описание с уже посчитанными
// числами (СЛ, кость, количество). Срабатывающие сами и справочные умения — passive.

import data from "./data/fighter-dndsu.json";
import type { HeroFeatureContext, SrdAbilityDefinition } from "./class-features";
import { ARCANE_SHOT_POOL, PSIONIC_POOL, SUPERIORITY_POOL } from "./fighter-pool";
import type { AbilityKey, ActionCost, ActionParameters, CombatAbility } from "./types";

// ============ ДАННЫЕ ============

export interface FighterOption {
  id: string;
  name: string;
  description: string;
}

export interface FighterFeature {
  id: string;
  subclassId: string;
  subclass: string;
  level: number;
  name: string;
  description: string;
  source: string;
  options: FighterOption[];
}

export const FIGHTER_SUBCLASSES = data.subclasses as Array<{ id: string; name: string }>;
export const FIGHTER_FEATURES = data.features as FighterFeature[];

/** Название архетипа из листа → идентификатор подкласса (названия dnd.su и английские) */
const SUBCLASS_PATTERNS: Array<[string, RegExp]> = [
  ["battlemaster", /мастер боевых искусств|battle ?master/i],
  ["eldritch-knight", /мистическ\S* рыцар|eldritch knight/i],
  ["banneret", /пурпурн\S* дракон|знаменосец|banneret|purple dragon/i],
  ["cavalier", /кавалерист|cavalier/i],
  ["arcane-archer", /мистическ\S* лучник|arcane archer/i],
  ["samurai", /самурай|samurai/i],
  ["echo-knight", /рыцарь эха|echo knight/i],
  ["psi-warrior", /пси-?воин|псионическ\S* воин|psi warrior/i],
  ["rune-knight", /рунн\S* рыцар|рунич\S* рыцар|rune knight/i],
];

/** Подкласс Воина из dnd.su по названию архетипа в листе; Чемпиона здесь нет (он в SRD) */
export function fighterSubclassId(subclass: string | null | undefined): string | null {
  if (!subclass) return null;
  return SUBCLASS_PATTERNS.find(([, re]) => re.test(String(subclass)))?.[0] ?? null;
}

// ============ ВЫБРАННЫЕ ВАРИАНТЫ ============

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

/** Текст листа, где игрок записал выбранные приёмы, выстрелы, руны и силы */
function sheetText(sheet: Record<string, any> | null | undefined): string {
  const parts: string[] = [];
  for (const key of ["featuresTraits", "additionalFeaturesTraits"]) {
    if (typeof sheet?.[key] === "string") parts.push(sheet[key]);
  }
  for (const t of Array.isArray(sheet?.traitsList) ? sheet.traitsList : []) {
    parts.push(String(t?.name || ""), String(t?.description || ""));
  }
  return norm(parts.join("\n"));
}

/**
 * Название варианта есть в тексте листа. Многословные («Точная атака») ищем целыми словами, однословные
 * («Готовность», «Засада») — только как отдельный пункт списка, иначе совпадут с обычными словами в описаниях.
 */
function mentions(text: string, name: string): boolean {
  const n = norm(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = /\s/.test(name.trim())
    ? new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, "u")
    : new RegExp(`(?:^|[\\n,;:•*\\-–—(])[ \\t]*${n}[ \\t]*(?=$|[\\n,;.:)•*\\-–—])`, "u");
  return re.test(text);
}

// ============ ПРАВИЛА УМЕНИЙ ============

/** Запасы: на них ссылаются resourceCost вариантов */
export { SUPERIORITY_POOL, PSIONIC_POOL, ARCANE_SHOT_POOL };

type Refresh = CombatAbility["refresh"];

interface Rule {
  /** skip — вне боя; passive — справка/срабатывает само; pool — счётчик; active — кнопка */
  kind: "skip" | "passive" | "pool" | "active";
  cost?: ActionCost;
  /** Кого выбирают целью кнопки (по умолчанию — себя) */
  target?: "creature" | "ally";
  /** Спасбросок цели и характеристика СЛ */
  save?: AbilityKey;
  dc?: (ctx: Calc) => number;
  /** Разыгрывается движком сама (fighter-combat.ts); без флага эффект разыгрывает мастер */
  auto?: boolean;
  /** Заряжает умение до атаки: запас списывается при срабатывании, а не при нажатии */
  defer?: boolean;
  /** Сколько зарядов и когда они возвращаются */
  uses?: (ctx: Calc) => { max: number; refresh: Refresh };
  /** Траты из общего запаса */
  pool?: string;
  /** Дополнение к описанию с посчитанными числами */
  note?: (ctx: Calc) => string;
  /** Число умения (временные хиты Боевого духа, кость…) */
  value?: (ctx: Calc) => number;
}

interface Calc {
  level: number;
  prof: number;
  mod: (a: AbilityKey) => number;
}

const calc = (ctx: HeroFeatureContext): Calc => ({
  level: Math.max(1, ctx.level || 1),
  prof: ctx.profBonus,
  mod: (a) => ctx.abilityMods[a] ?? 0,
});

const atLeastOne = (n: number) => Math.max(1, n);
const dcOf = (a: AbilityKey) => (c: Calc) => 8 + c.prof + c.mod(a);

export const superiorityDice = (level: number) => (level >= 15 ? 6 : level >= 7 ? 5 : 4);
export const superiorityFaces = (level: number) => (level >= 18 ? 12 : level >= 10 ? 10 : 8);
export const psionicDice = (prof: number) => 2 * prof;
export const psionicFaces = (level: number) => (level >= 17 ? 12 : level >= 11 ? 10 : level >= 5 ? 8 : 6);
const giantsMightDie = (level: number) => (level >= 18 ? "1к10" : level >= 10 ? "1к8" : "1к6");

const onePerRest = (refresh: Refresh) => () => ({ max: 1, refresh });

const maneuver = (cost: ActionCost, extra: Partial<Rule> = {}): Rule => ({
  kind: "active",
  cost,
  pool: SUPERIORITY_POOL,
  dc: (c) => 8 + c.prof + Math.max(c.mod("STR"), c.mod("DEX")),
  note: (c) =>
    `Тратит кость превосходства (к${superiorityFaces(c.level)})` +
    (extra.save ? `; СЛ спасброска приёма ${8 + c.prof + Math.max(c.mod("STR"), c.mod("DEX"))}.` : "."),
  ...extra,
});

const arcaneShot = (extra: Partial<Rule> = {}): Rule => ({
  kind: "active",
  cost: "free",
  pool: ARCANE_SHOT_POOL,
  dc: dcOf("INT"),
  note: (c) => `Тратит использование Магического выстрела; СЛ ${8 + c.prof + c.mod("INT")}. ${c.level >= 18 ? "Усилено (18 ур.)." : ""}`.trim(),
  target: "creature",
  ...extra,
});

const rune = (cost: ActionCost, extra: Partial<Rule> = {}): Rule => ({
  kind: "active",
  cost,
  dc: dcOf("CON"),
  uses: (c) => (c.level >= 15 ? { max: 2, refresh: "short" } : { max: 1, refresh: "long" }),
  note: (c) => `СЛ рунной магии ${8 + c.prof + c.mod("CON")}.`,
  ...extra,
});

/** Правила умений: «подкласс/умение». Чего здесь нет, того в бою нет (вне боя) */
const FEATURE_RULES: Record<string, Rule> = {
  // Мастер боевых искусств
  "battlemaster/combat-superiority": {
    kind: "pool",
    uses: (c) => ({ max: superiorityDice(c.level), refresh: "short" }),
    value: (c) => superiorityFaces(c.level),
    note: (c) => `Сейчас: ${superiorityDice(c.level)} костей превосходства к${superiorityFaces(c.level)}, СЛ приёмов ${8 + c.prof + Math.max(c.mod("STR"), c.mod("DEX"))}.`,
  },
  "battlemaster/student-of-war": { kind: "skip" },
  "battlemaster/know-your-enemy": { kind: "skip" },
  "battlemaster/improved-combat-superiority": { kind: "skip" }, // размер кости считает запас
  "battlemaster/relentless": { kind: "passive" },

  // Мистический рыцарь
  "eldritch-knight/spellcasting": { kind: "skip" },
  "eldritch-knight/weapon-bond": { kind: "passive" },
  "eldritch-knight/war-magic": { kind: "passive" },
  "eldritch-knight/eldritch-strike": { kind: "passive" },
  "eldritch-knight/arcane-charge": { kind: "passive" },
  "eldritch-knight/improved-war-magic": { kind: "passive" },

  // Рыцарь Пурпурного дракона
  "banneret/rallying-cry": { kind: "passive" },
  "banneret/royal-envoy": { kind: "skip" },
  "banneret/inspiring-surge": { kind: "passive" },
  "banneret/bulwark": { kind: "passive" },

  // Кавалерист
  "cavalier/bonus-proficiencies": { kind: "skip" },
  "cavalier/born-to-the-saddle": { kind: "skip" },
  "cavalier/unwavering-mark": {
    kind: "active",
    cost: "free",
    target: "creature",
    uses: (c) => ({ max: atLeastOne(c.mod("STR")), refresh: "long" }),
  },
  "cavalier/warding-maneuver": {
    kind: "active",
    cost: "reaction",
    target: "ally",
    uses: (c) => ({ max: atLeastOne(c.mod("CON")), refresh: "long" }),
  },
  "cavalier/hold-the-line": { kind: "passive" },
  "cavalier/ferocious-charger": {
    kind: "active",
    cost: "free",
    target: "creature",
    save: "STR",
    dc: dcOf("STR"),
    uses: onePerRest("turn"),
    note: (c) => `СЛ ${8 + c.prof + c.mod("STR")}.`,
  },
  "cavalier/vigilant-defender": { kind: "passive" },

  // Мистический лучник
  "arcane-archer/arcane-archer-lore": { kind: "skip" },
  "arcane-archer/arcane-shot": {
    kind: "pool",
    uses: () => ({ max: 2, refresh: "short" }),
    note: (c) => `СЛ Магического выстрела ${8 + c.prof + c.mod("INT")}.`,
  },
  "arcane-archer/magic-arrow": { kind: "passive" },
  "arcane-archer/curving-shot": { kind: "active", cost: "bonus", target: "creature" },
  "arcane-archer/ever-ready-shot": { kind: "passive" },

  // Самурай
  "samurai/bonus-proficiencies": { kind: "skip" },
  "samurai/elegant-courtier": { kind: "skip" },
  "samurai/fighting-spirit": {
    kind: "active",
    cost: "bonus",
    uses: () => ({ max: 3, refresh: "long" }),
    value: (c) => (c.level >= 15 ? 15 : c.level >= 10 ? 10 : 5),
    note: (c) => `Преимущество на атаки оружием до конца хода и ${c.level >= 15 ? 15 : c.level >= 10 ? 10 : 5} временных хитов.`,
  },
  "samurai/tireless-spirit": { kind: "passive" },
  "samurai/rapid-strike": { kind: "active", cost: "free", target: "creature", uses: onePerRest("turn") },
  "samurai/strength-before-death": { kind: "active", cost: "reaction", uses: onePerRest("long") },

  // Рыцарь Эха
  "echo-knight/manifest-echo": { kind: "active", cost: "bonus" },
  "echo-knight/unleash-incarnation": {
    kind: "active",
    cost: "free",
    target: "creature",
    uses: (c) => ({ max: atLeastOne(c.mod("CON")), refresh: "long" }),
  },
  "echo-knight/echo-avatar": { kind: "active", cost: "action" },
  "echo-knight/shadow-martyr": { kind: "active", cost: "reaction", target: "ally", uses: onePerRest("short") },
  "echo-knight/reclaim-potential": {
    kind: "active",
    cost: "free",
    uses: (c) => ({ max: atLeastOne(c.mod("CON")), refresh: "long" }),
    note: (c) => `Временные хиты: 2к6 + ${c.mod("CON")}.`,
  },
  "echo-knight/legion-of-one": { kind: "passive" },

  // Пси-воин
  "psi-warrior/psionic-power": {
    kind: "pool",
    uses: (c) => ({ max: psionicDice(c.prof), refresh: "long" }),
    value: (c) => psionicFaces(c.level),
    note: (c) => `Сейчас: ${psionicDice(c.prof)} костей псионической энергии к${psionicFaces(c.level)}.`,
  },
  "psi-warrior/telekinetic-adept": { kind: "skip" }, // варианты — отдельными кнопками
  "psi-warrior/guarded-mind": { kind: "passive" },
  "psi-warrior/bulwark-of-force": { kind: "active", cost: "bonus", uses: onePerRest("long") },
  "psi-warrior/telekinetic-master": { kind: "active", cost: "action", uses: onePerRest("long") },

  // Рунный рыцарь
  "rune-knight/bonus-proficiencies": { kind: "skip" },
  "rune-knight/rune-carver": { kind: "skip" }, // руны — отдельными кнопками
  "rune-knight/giants-might": {
    kind: "active",
    cost: "bonus",
    uses: (c) => ({ max: c.prof, refresh: "long" }),
    note: (c) => `Дополнительный урон раз в ход: ${giantsMightDie(c.level)}.`,
  },
  "rune-knight/runic-shield": {
    kind: "active",
    cost: "reaction",
    target: "ally",
    uses: (c) => ({ max: c.prof, refresh: "long" }),
  },
  "rune-knight/great-stature": { kind: "passive" },
  "rune-knight/master-of-runes": { kind: "passive" },
  "rune-knight/runic-juggernaut": { kind: "passive" },
};

/** Реакция воина срабатывает сама, когда выполнено условие (см. fighter-combat.ts) */
const reaction = (): Rule => ({
  kind: "passive",
  note: (c) => `Срабатывает сама как реакция и тратит кость превосходства (к${superiorityFaces(c.level)}).`,
});

/** Правила вариантов на выбор: «подкласс/вариант» */
const OPTION_RULES: Record<string, Rule> = {
  // Приёмы Мастера боевых искусств
  "evasive-footwork": maneuver("free", { auto: true }),
  "lunging-attack": maneuver("free", { auto: true, defer: true }),
  "maneuvering-attack": maneuver("free", { auto: true, defer: true }),
  "menacing-attack": maneuver("free", { auto: true, defer: true, save: "WIS" }),
  "feinting-attack": maneuver("bonus", { auto: true, target: "creature" }),
  "disarming-attack": maneuver("free", { auto: true, defer: true, save: "STR" }),
  "trip-attack": maneuver("free", { auto: true, defer: true, save: "STR" }),
  riposte: reaction(),
  "distracting-strike": maneuver("free", { auto: true, defer: true }),
  parry: reaction(),
  "goading-attack": maneuver("free", { auto: true, defer: true, save: "WIS" }),
  rally: maneuver("bonus", { auto: true, target: "ally" }),
  "pushing-attack": maneuver("free", { auto: true, defer: true, save: "STR" }),
  "precision-attack": maneuver("free", { auto: true, defer: true }),
  "commanders-strike": maneuver("bonus", { auto: true, target: "ally" }),
  "sweeping-attack": maneuver("free", { auto: true, defer: true }),
  "grappling-strike": maneuver("bonus", { auto: true, target: "creature" }),
  "quick-toss": maneuver("bonus", { auto: true, target: "creature" }),
  brace: reaction(),
  ambush: maneuver("free"),
  "commanding-presence": maneuver("free"),
  "bait-and-switch": maneuver("free", { auto: true, target: "ally" }),
  "tactical-assessment": maneuver("free"),

  // Магические выстрелы
  "bursting-arrow": arcaneShot(),
  "banishing-arrow": arcaneShot({ save: "CHA" }),
  "seeking-arrow": arcaneShot({ save: "DEX" }),
  "beguiling-arrow": arcaneShot({ save: "WIS" }),
  "enfeebling-arrow": arcaneShot({ save: "CON" }),
  "piercing-arrow": arcaneShot({ save: "DEX" }),
  "grasping-arrow": arcaneShot(),
  "shadow-arrow": arcaneShot({ save: "WIS" }),

  // Псионические силы
  "protective-field": {
    kind: "active",
    cost: "reaction",
    target: "ally",
    pool: PSIONIC_POOL,
    note: (c) => `Тратит кость псионической энергии (к${psionicFaces(c.level)}): урон уменьшается на результат + мод. Интеллекта (${Math.max(1, c.mod("INT"))}).`,
  },
  "psionic-strike": {
    kind: "active",
    cost: "free",
    target: "creature",
    pool: PSIONIC_POOL,
    uses: onePerRest("turn"),
    note: (c) => `Тратит кость псионической энергии (к${psionicFaces(c.level)}): урон силовым полем = результат + мод. Интеллекта (${c.mod("INT")}).`,
  },
  "telekinetic-movement": { kind: "active", cost: "action", target: "ally", uses: onePerRest("short") },
  "psi-powered-leap": { kind: "active", cost: "bonus", uses: onePerRest("short") },
  "telekinetic-thrust": {
    kind: "passive",
    save: "STR",
    dc: dcOf("INT"),
    note: (c) => `СЛ ${8 + c.prof + c.mod("INT")}.`,
  },

  // Руны
  "stone-rune": rune("reaction", { target: "creature", save: "WIS" }),
  "frost-rune": rune("bonus"),
  "cloud-rune": rune("reaction", { target: "creature" }),
  "fire-rune": rune("free", { target: "creature", save: "STR" }),
  "hill-rune": rune("bonus"),
  "storm-rune": rune("bonus"),
};

// ============ УМЕНИЯ ГЕРОЯ ============

function buildDefinition(
  key: string,
  name: string,
  description: string,
  rule: Rule,
  c: Calc
): SrdAbilityDefinition {
  const uses = rule.uses?.(c) ?? { max: 0, refresh: "none" as Refresh };
  const note = rule.note?.(c);
  const common: ActionParameters = {
    name,
    type: "ability",
    srdKey: key,
    description: note ? `${description}\n\n${note}` : description,
  } as ActionParameters;
  const base = { srdKey: key, name, usesMax: uses.max, refresh: uses.refresh };

  if (rule.kind === "pool") {
    return {
      ...base,
      parameters: { ...common, actionCost: "none", isResource: true, targeting: "self", featureValue: rule.value?.(c) },
    };
  }
  if (rule.kind === "passive") {
    const params: ActionParameters = { ...common, actionCost: "none", passive: true };
    if (rule.save) {
      params.saveType = rule.save;
      params.saveDC = rule.dc?.(c) ?? null;
    }
    return { ...base, parameters: params };
  }

  const params: ActionParameters = {
    ...common,
    actionCost: rule.cost ?? "free",
    range: { type: rule.target ? "special" : "self" },
    targeting: rule.target ?? "self",
    damage: [],
    ...(rule.auto ? {} : { manual: true }),
    ...(rule.defer ? { deferCost: true } : {}),
  };
  if (rule.pool) params.resourceCost = { pool: rule.pool, amount: 1 };
  if (rule.save) {
    params.saveType = rule.save;
    params.saveDC = rule.dc?.(c) ?? null;
  }
  if (rule.value) params.featureValue = rule.value(c);
  return { ...base, parameters: params };
}

/**
 * Способности подкласса Воина из dnd.su для боя: умения по уровню героя и выбранные в листе варианты
 * (приёмы, выстрелы, силы, руны). Пустой список, если подкласс не из dnd.su или это Чемпион.
 */
export function fighterSubclassAbilityDefinitions(ctx: HeroFeatureContext): SrdAbilityDefinition[] {
  if (!/воин|fighter/i.test(String(ctx.className || "")) || /альтернатив/i.test(String(ctx.className || ""))) return [];
  const subclassId = fighterSubclassId(ctx.subclass);
  if (!subclassId) return [];

  const c = calc(ctx);
  const text = sheetText(ctx.sheet);
  const out: SrdAbilityDefinition[] = [];

  for (const f of FIGHTER_FEATURES) {
    if (f.subclassId !== subclassId || f.level > c.level) continue;
    const key = `${subclassId}/${f.id}`;
    const rule = FEATURE_RULES[key];
    if (!rule) throw new Error(`Нет правила для умения ${key}`);

    if (rule.kind !== "skip") {
      out.push(buildDefinition(key, f.name, f.description, rule, c));
    }

    // Варианты на выбор — только те, что игрок записал в листе
    for (const o of f.options) {
      if (!mentions(text, o.name)) continue;
      const optRule = OPTION_RULES[o.id];
      if (!optRule) throw new Error(`Нет правила для варианта ${o.id}`);
      if (optRule.kind === "skip") continue;
      out.push(buildDefinition(`${subclassId}/${o.id}`, o.name, o.description, optRule, c));
    }
  }
  return out;
}
