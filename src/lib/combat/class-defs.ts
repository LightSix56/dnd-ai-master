// Умения классов и подклассов для боя, описанные правилами-данными.
//
// Тексты умений берутся из data/class-subclasses.json (собирается scripts/import-sheet-classes.mjs из
// данных сайта листа: 115 официальных подклассов). Что умение значит в бою, описывает правило (Rule):
// когда применяется (действие, бонусное, реакция), сколько зарядов и когда они возвращаются, из какого
// запаса тратится, какой спасбросок вызывает. Правила лежат в classes/<класс>.ts и регистрируются
// через defineClass. Что происходит при применении — в classes/<класс>-combat.ts (см. class-kit.ts).
//
// Умения базовых классов и подклассов SRD по-прежнему собирает class-features.ts; здесь им можно
// поправить параметры (srd: { … }), когда движок начинает разыгрывать их сам.
//
// Файл без обращений к движку: им пользуются сервер и редактор способностей в браузере.

import data from "./data/class-subclasses.json";
import type { HeroFeatureContext, SrdAbilityDefinition } from "./class-features";
import type { AbilityKey, ActionCost, ActionParameters, CombatAbility } from "./types";

// ============ ДАННЫЕ ============

export interface SubclassFeatureData {
  level: number;
  name: string;
  description: string;
}

export interface SubclassData {
  classId: string;
  className: string;
  id: string;
  name: string;
  nameEn: string;
  source: string;
  features: SubclassFeatureData[];
}

export const SUBCLASSES = data.subclasses as SubclassData[];

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

// ============ ПРАВИЛА ============

type Refresh = CombatAbility["refresh"];

/** Числа героя, от которых зависят заряды, СЛ и подписи */
export interface Calc {
  level: number;
  prof: number;
  mod: (a: AbilityKey) => number;
  /** Текст листа (умения, черты) в нижнем регистре: по нему узнаём выбранные варианты */
  text: string;
  /** Метки выбора из traitsList листа («totem-bear») */
  tokens: Set<string>;
}

export interface Rule {
  /** Латинский идентификатор умения: ключ способности — «подкласс/id» */
  id: string;
  /** skip — вне боя; passive — срабатывает само или справка; pool — счётчик запаса; active — кнопка */
  kind: "skip" | "passive" | "pool" | "active";
  cost?: ActionCost;
  /** Кого выбирают целью кнопки (по умолчанию — себя) */
  target?: "creature" | "ally" | "point";
  /** Дальность выбора цели или клетки в футах */
  range?: number;
  /** Спасбросок цели и его СЛ */
  save?: AbilityKey;
  dc?: (c: Calc) => number;
  /** Эффект разыгрывает мастер: движок только тратит действие и заряды */
  manual?: boolean;
  /** Заряжает умение до атаки: запас списывается при срабатывании, а не при нажатии */
  defer?: boolean;
  /** Сколько зарядов и когда они возвращаются */
  uses?: (c: Calc) => { max: number; refresh: Refresh };
  /** Траты из общего запаса: ключ запаса и сколько */
  pool?: string;
  poolAmount?: number;
  /** Когда использования кончились, умение можно повторить за заряд этого запаса */
  dieFallback?: string;
  /** Число умения (кость, бонус, радиус) — попадает в featureValue */
  value?: (c: Calc) => number;
  /** Дополнение к описанию с посчитанными числами */
  note?: (c: Calc) => string;
  /** Умение есть не у всех: условие по листу и уровню */
  when?: (c: Calc) => boolean;
  /** Название способности в бою, если оно не совпадает с названием умения */
  name?: string;
  /** Описание вместо текста из data/class-subclasses.json (когда тот расходится с источником) */
  description?: string;
  /** Реакция, применимая и не в свой ход */
  offTurn?: boolean;
}

/** Вариант умения на выбор (тотем, стихия ауры, форма зверя) */
export interface OptionRule extends Rule {
  /** Название варианта: показывается в бою и ищется в листе */
  name: string;
  description: string;
  /** Метки листа, по которым вариант считается выбранным («totem-bear») */
  tokens?: string[];
  /** Как вариант может быть назван в тексте листа */
  aliases?: string[];
  /** С какого уровня вариант доступен (по умолчанию — с уровня умения) */
  minLevel?: number;
}

export interface FeatureRule extends Rule {
  /**
   * Варианты на выбор. Какие из них показать:
   *  • sheet — только найденные в листе;
   *  • sheet-or-all — найденные в листе, а если не найден ни один — все (выбор делается в бою);
   *  • all — всегда все (выбор делается каждый раз заново, как Форма зверя).
   */
  options?: OptionRule[];
  pick?: "sheet" | "sheet-or-all" | "all";
}

export interface SubclassRules {
  /** Умения подкласса: ключ — название умения в данных (data/class-subclasses.json) */
  features: Record<string, FeatureRule>;
  /** Кнопки, которых нет в тексте умений, но без которых умение в бою не сыграть */
  extra?: Array<FeatureRule & { name: string; description: string; minLevel: number }>;
  /** Как ещё подкласс может называться в листе */
  pattern?: RegExp;
}

/** Правка параметров умения SRD (class-features.ts), когда движок разыгрывает его сам */
export type SrdOverride = (c: Calc) => Partial<ActionParameters> & { usesMax?: number; refresh?: Refresh };

export interface ClassRules {
  classId: string;
  subclasses: Record<string, SubclassRules>;
  srd?: Record<string, SrdOverride>;
}

const CLASSES = new Map<string, ClassRules>();
const SRD_OVERRIDES = new Map<string, SrdOverride>();

export function defineClass(rules: ClassRules): void {
  CLASSES.set(rules.classId, rules);
  for (const [key, fn] of Object.entries(rules.srd ?? {})) SRD_OVERRIDES.set(key, fn);
}

export function classRules(classId: string): ClassRules | undefined {
  return CLASSES.get(classId);
}

// ============ ПОДКЛАСС ГЕРОЯ ============

/** Подкласс по названию из листа: русское или английское название, идентификатор, pattern из правил */
export function findSubclass(classId: string, subclass: string | null | undefined): SubclassData | null {
  const want = norm(String(subclass || ""));
  if (!want) return null;
  const rules = CLASSES.get(classId);
  const list = SUBCLASSES.filter((s) => s.classId === classId);
  return (
    list.find((s) => norm(s.name) === want || norm(s.nameEn) === want || s.id === want) ??
    list.find((s) => rules?.subclasses[s.id]?.pattern?.test(want)) ??
    // «Путь тотемного воина (PHB)», «Тотемный воин»: название подкласса входит в строку листа или наоборот
    list.find((s) => want.includes(norm(s.name)) || want.includes(norm(s.nameEn))) ??
    list.find((s) => norm(s.name).includes(want) && want.length >= 5) ??
    null
  );
}

// ============ ВЫБРАННЫЕ ВАРИАНТЫ ============

export function calcOf(ctx: HeroFeatureContext): Calc {
  const sheet = ctx.sheet;
  const parts: string[] = [];
  const tokens = new Set<string>();
  for (const key of ["featuresTraits", "additionalFeaturesTraits"]) {
    if (typeof sheet?.[key] === "string") parts.push(sheet[key]);
  }
  for (const t of Array.isArray(sheet?.traitsList) ? sheet.traitsList : []) {
    if (t?.id) tokens.add(String(t.id));
    parts.push(String(t?.name || ""), String(t?.description || ""));
  }
  return {
    level: Math.max(1, ctx.level || 1),
    prof: ctx.profBonus,
    mod: (a) => ctx.abilityMods[a] ?? 0,
    text: norm(parts.join("\n")),
    tokens,
  };
}

/**
 * Название есть в тексте листа. Многословные ищем целыми словами, однословные («Медведь», «Море») —
 * только как отдельный пункт списка или после двоеточия: иначе совпадут с обычными словами описаний.
 */
export function mentions(text: string, name: string): boolean {
  const n = norm(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = /\s/.test(name.trim())
    ? new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, "u")
    : new RegExp(`(?:^|[\\n,;:•*\\-–—(])[ \\t]*${n}[ \\t]*(?=$|[\\n,;.:)•*\\-–—])`, "u");
  return re.test(text);
}

function optionChosen(o: OptionRule, c: Calc): boolean {
  if (o.tokens?.some((t) => c.tokens.has(t))) return true;
  return [o.name, ...(o.aliases ?? [])].some((a) => mentions(c.text, a));
}

// ============ СБОРКА СПОСОБНОСТЕЙ ============

function buildDefinition(key: string, name: string, description: string, rule: Rule, c: Calc): SrdAbilityDefinition {
  const uses = rule.uses?.(c) ?? { max: 0, refresh: "none" as Refresh };
  const note = rule.note?.(c);
  const common = {
    name,
    type: "ability" as const,
    srdKey: key,
    description: note ? `${description}\n\n${note}` : description,
  };
  const base = { srdKey: key, name, usesMax: uses.max, refresh: uses.refresh };
  const value = rule.value?.(c);
  const save = rule.save ? { saveType: rule.save, saveDC: rule.dc?.(c) ?? null } : {};

  if (rule.kind === "pool") {
    return { ...base, parameters: { ...common, actionCost: "none", isResource: true, targeting: "self", featureValue: value } };
  }
  if (rule.kind === "passive") {
    return {
      ...base,
      parameters: { ...common, actionCost: "none", passive: true, ...save, ...(value !== undefined ? { featureValue: value } : {}) },
    };
  }
  const params: ActionParameters = {
    ...common,
    actionCost: rule.cost ?? "free",
    range: rule.target ? { type: "special", ...(rule.range ? { value: rule.range } : {}) } : { type: "self", ...(rule.range ? { value: rule.range } : {}) },
    targeting: rule.target ?? "self",
    damage: [],
    ...save,
    ...(rule.manual ? { manual: true } : {}),
    ...(rule.defer ? { deferCost: true } : {}),
    ...(rule.offTurn ? { offTurn: true } : {}),
    ...(rule.dieFallback ? { dieFallback: rule.dieFallback } : {}),
    ...(value !== undefined ? { featureValue: value } : {}),
  };
  if (rule.pool) params.resourceCost = { pool: rule.pool, amount: rule.poolAmount ?? 1 };
  return { ...base, parameters: params };
}

/**
 * Способности подкласса героя для боя: умения по уровню и выбранные варианты.
 * Пустой список, если у класса нет правил или подкласс не найден.
 */
export function classAbilityDefinitions(ctx: HeroFeatureContext, classId: string | null): SrdAbilityDefinition[] {
  const rules = classId ? CLASSES.get(classId) : undefined;
  if (!rules || !classId) return [];
  const sub = findSubclass(classId, ctx.subclass);
  const subRules = sub ? rules.subclasses[sub.id] : undefined;
  if (!sub || !subRules) return [];

  const c = calcOf(ctx);
  const out: SrdAbilityDefinition[] = [];
  const push = (rule: Rule, name: string, description: string) => {
    if (rule.kind === "skip" || (rule.when && !rule.when(c))) return;
    out.push(buildDefinition(`${sub.id}/${rule.id}`, rule.name ?? name, description, rule, c));
  };

  for (const f of sub.features) {
    if (f.level > c.level) continue;
    const rule = subRules.features[f.name];
    if (!rule) throw new Error(`Нет правила для умения «${f.name}» (${sub.name})`);
    push(rule, f.name, rule.description ?? f.description);

    const options = (rule.options ?? []).filter((o) => (o.minLevel ?? f.level) <= c.level);
    const chosen = options.filter((o) => optionChosen(o, c));
    const shown = rule.pick === "all" ? options : chosen.length > 0 || rule.pick === "sheet" ? chosen : rule.pick === "sheet-or-all" ? options : chosen;
    for (const o of shown) push(o, o.name, o.description);
  }
  for (const x of subRules.extra ?? []) {
    if (x.minLevel <= c.level) push(x, x.name, x.description);
  }
  return out;
}

/** Правка параметров умения SRD: null, если умение движку не передано */
export function srdOverride(key: string, ctx: HeroFeatureContext): ReturnType<SrdOverride> | null {
  const fn = SRD_OVERRIDES.get(key);
  return fn ? fn(calcOf(ctx)) : null;
}

/** Все правила подкласса с ключами способностей — для проверок полноты */
export function subclassRuleKeys(classId: string, subclassId: string): Array<{ key: string; rule: Rule }> {
  const sub = CLASSES.get(classId)?.subclasses[subclassId];
  if (!sub) return [];
  const out: Array<{ key: string; rule: Rule }> = [];
  for (const rule of Object.values(sub.features)) {
    out.push({ key: `${subclassId}/${rule.id}`, rule });
    for (const o of rule.options ?? []) out.push({ key: `${subclassId}/${o.id}`, rule: o });
  }
  for (const x of sub.extra ?? []) out.push({ key: `${subclassId}/${x.id}`, rule: x });
  return out;
}
