// Классовые умения SRD 5.1 из открытой системы D&D 5e для Foundry VTT (данные — в data/).
//
// Каждое умение описано свойствами, а не кодом под конкретное имя: когда получается (уровень),
// чем применяется (действие, бонусное, реакция), сколько зарядов и когда они восстанавливаются,
// из какого общего запаса тратит (ци, Канал божественности, очки чародейства), что делает
// (лечит, вызывает спасбросок, добавляет урон при попадании) и как растёт с уровнем (таблицы роста).
// Отсюда собираются способности героя для боя; значения по уровню считаются здесь же, движок
// получает готовые числа в parameters.
//
// Источник: https://github.com/foundryvtt/dnd5e — см. SRD_CLASS_FEATURES_NOTICE (CC BY 4.0).
// Обновление данных: scripts/import-foundry-class-features.py

import featureData from "./data/srd-class-features.json";
import ruData from "./data/srd-class-features-ru.json";
import { fighterSubclassAbilityDefinitions } from "./fighter-subclasses";
import type { AbilityKey, ActionCost, ActionParameters, AppliedEffect, CombatAbility } from "./types";

// ============ ДАННЫЕ ============

export interface SrdActivity {
  type: string;
  name?: string;
  activation?: string;
  condition?: string;
  target?: string;
  targetCount?: string;
  range?: { units?: string | null; value?: string | null };
  template?: { type?: string; size?: string };
  duration?: { value?: string | null; units?: string };
  consumes?: Array<{ pool: string; amount: string; slotLevel?: string }>;
  heal?: string | null;
  /** «healing» — хиты, «temphp» — временные хиты */
  healTypes?: string[];
  damage?: Array<{ formula: string | null; types: string[] }>;
  save?: { ability?: string; dc?: string | null; onSave?: string };
  attack?: { type?: string };
}

export interface SrdFeature {
  key: string;
  nameEn: string;
  className: string;
  subclass: string | null;
  level: number;
  choice: boolean;
  uses: { max: string; recovery: string[] } | null;
  activities: SrdActivity[];
  hasEffects: boolean;
}

interface ScaleTable {
  type: string;
  scale: Record<string, number | string>;
}

export const SRD_FEATURES = featureData.features as unknown as SrdFeature[];
const SCALES = featureData.scales as unknown as Record<string, ScaleTable>;
const RU = ruData as unknown as Record<string, { name: string; description: string }>;

/** Атрибуция по CC BY 4.0 — показывать рядом с данными SRD */
export const SRD_CLASS_FEATURES_NOTICE: string = featureData.source.notice;

/** Идентификатор умения без класса: «monk/flurry-of-blows» → «flurry-of-blows» */
function identOf(key: string): string {
  return key.slice(key.indexOf("/") + 1);
}

// ============ КЛАСС И АРХЕТИП ГЕРОЯ ============

const CLASS_PATTERNS: Array<[string, RegExp]> = [
  ["barbarian", /варвар|barbarian/i],
  ["fighter", /воин|fighter/i],
  ["rogue", /плут|rogue/i],
  ["paladin", /паладин|paladin/i],
  ["ranger", /следопыт|рейнджер|ranger/i],
  ["cleric", /жрец|клирик|cleric/i],
  ["druid", /друид|druid/i],
  ["monk", /монах|monk/i],
  ["bard", /бард|bard/i],
  ["wizard", /волшебник|wizard/i],
  ["warlock", /колдун|варлок|warlock/i],
  ["sorcerer", /чародей|sorcerer/i],
];

/** Класс SRD по названию класса из листа («Воин», «Fighter») */
export function srdClassKey(className: string | null | undefined): string | null {
  const name = String(className || "");
  // Альтернативный варвар листа — свой набор умений, SRD к нему не подходит
  if (/альтернатив/i.test(name)) return null;
  return CLASS_PATTERNS.find(([, re]) => re.test(name))?.[0] ?? null;
}

// Архетипы SRD: названия как в листе (dnd.su) и английские
const SUBCLASS_PATTERNS: Array<[string, RegExp]> = [
  ["path-of-the-berserker", /берсерк|berserker/i],
  ["college-of-lore", /знани|\blore\b/i],
  ["life-domain", /жизн|\blife\b/i],
  ["circle-of-the-land", /земл|\bland\b/i],
  ["champion", /чемпион|champion/i],
  ["way-of-the-open-hand", /открыт\S* ладон|open hand/i],
  ["oath-of-devotion", /преданност|devotion/i],
  ["hunter", /^\s*(охотник|hunter)\s*$/i],
  ["thief", /^\s*(вор|thief)\s*$/i],
  ["draconic-bloodline", /драконь|draconic/i],
  ["the-fiend", /исчади|fiend/i],
  ["school-of-evocation", /воплощени|эвокац|evocation/i],
];

const SUBCLASS_CLASS = new Map(
  (featureData.subclasses as Array<{ key: string; className: string }>).map((s) => [s.key, s.className])
);

/** Архетип SRD по названию из листа; null — архетип не из SRD или не выбран */
export function srdSubclassKey(classKey: string | null, subclass: string | null | undefined): string | null {
  if (!classKey || !subclass) return null;
  const found = SUBCLASS_PATTERNS.find(
    ([key, re]) => SUBCLASS_CLASS.get(key) === classKey && re.test(String(subclass))
  );
  return found?.[0] ?? null;
}

// ============ ВЫБРАННЫЕ ВАРИАНТЫ (боевой стиль, воззвания, метамагия…) ============

// Как лист хранит выбор: id черт traitsList («fighting-style-archery», «invocation-agonizing-blast»)
// и поля levelHistory. Идентификатор SRD → метки листа
const SHEET_OPTION_IDS: Record<string, string[]> = {
  archery: ["fighting-style:archery"],
  defense: ["fighting-style:defense"],
  dueling: ["fighting-style:dueling"],
  "great-weapon-fighting": ["fighting-style:great-weapon"],
  protection: ["fighting-style:protection"],
  "two-weapon-fighting": ["fighting-style:two-weapon"],
  "careful-spell": ["metamagic:careful"],
  "distant-spell": ["metamagic:distant"],
  "empowered-spell": ["metamagic:empowered"],
  "extended-spell": ["metamagic:extended"],
  "heightened-spell": ["metamagic:heightened"],
  "quickened-spell": ["metamagic:quickened"],
  "subtle-spell": ["metamagic:subtle"],
  "twinned-spell": ["metamagic:twinned"],
  "pact-of-the-blade": ["pact-boon:blade"],
  "pact-of-the-chain": ["pact-boon:chain"],
  "pact-of-the-tome": ["pact-boon:tome"],
};

// Названия вариантов, которые узнаём в тексте умений листа (у охотника выбор хранится только текстом)
const OPTION_TEXT_ALIASES: Record<string, string[]> = {
  "colossus-slayer": ["убийца колоссов", "губитель колоссов", "colossus slayer"],
  "giant-killer": ["убийца великанов", "истребитель великанов", "giant killer"],
  "horde-breaker": ["сокрушитель орды", "крушитель орд", "horde breaker"],
  "escape-the-horde": ["побег от орды", "уход от орды", "escape the horde"],
  "multiattack-defense": ["защита от мультиатаки", "защита от множественных атак", "multiattack defense"],
  "steel-will": ["стальная воля", "steel will"],
  volley: ["залп", "volley"],
  "whirlwind-attack": ["вихревая атака", "whirlwind attack"],
  evasion: ["увёртливость", "увертливость", "evasion"],
  "stand-against-the-tide": ["стойкость против волны", "противостояние потоку", "stand against the tide"],
  "uncanny-dodge": ["невероятное уклонение", "uncanny dodge"],
};

function sheetChoiceTokens(sheet: Record<string, any> | null | undefined): { tokens: Set<string>; text: string } {
  const tokens = new Set<string>();
  const parts: string[] = [typeof sheet?.featuresTraits === "string" ? sheet.featuresTraits : ""];
  if (typeof sheet?.additionalFeaturesTraits === "string") parts.push(sheet.additionalFeaturesTraits);

  for (const t of Array.isArray(sheet?.traitsList) ? sheet.traitsList : []) {
    const id = String(t?.id || "");
    const m = id.match(/^(?:class-)?(fighting-style|metamagic|pact-boon|invocation)-(.+)$/);
    if (m) tokens.add(`${m[1]}:${m[2]}`);
    parts.push(String(t?.name || ""));
  }
  for (const h of Array.isArray(sheet?.levelHistory) ? sheet.levelHistory : []) {
    if (h?.selectedFightingStyle) tokens.add(`fighting-style:${h.selectedFightingStyle}`);
    if (h?.pactBoon) tokens.add(`pact-boon:${h.pactBoon}`);
    for (const inv of Array.isArray(h?.warlockInvocations) ? h.warlockInvocations : []) tokens.add(`invocation:${inv}`);
    if (h?.swappedOutInvocation) tokens.delete(`invocation:${h.swappedOutInvocation}`);
    if (h?.swappedInInvocation) tokens.add(`invocation:${h.swappedInInvocation}`);
  }
  return { tokens, text: parts.join("\n").toLowerCase().replace(/ё/g, "е") };
}

function isOptionChosen(feature: SrdFeature, chosen: { tokens: Set<string>; text: string }): boolean {
  const ident = identOf(feature.key);
  const ids = SHEET_OPTION_IDS[ident] ?? (feature.className === "warlock" ? [`invocation:${ident}`] : []);
  if (ids.some((t) => chosen.tokens.has(t))) return true;
  const aliases = [...(OPTION_TEXT_ALIASES[ident] ?? []), RU[feature.key]?.name ?? ""]
    .map((a) => a.toLowerCase().replace(/ё/g, "е"))
    // Однословные названия («Защита», «Залп») узнаём только из списка синонимов: иначе ложные совпадения
    .filter((a) => a.includes(" ") || (OPTION_TEXT_ALIASES[ident] ?? []).includes(a));
  return aliases.some((a) => a && chosen.text.includes(a));
}

// ============ ФОРМУЛЫ И РОСТ ПО УРОВНЮ ============

/** Значение таблицы роста на уровне: «@scale.rogue.sneak-attack» на 5 ур. → «3d6» */
export function scaleValue(id: string, level: number): number | string | null {
  const table = SCALES[id];
  if (!table) return null;
  let value: number | string | null = null;
  for (const [lvl, v] of Object.entries(table.scale).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    if (Number(lvl) <= level) value = v;
  }
  return value;
}

export interface FormulaContext {
  level: number;
  profBonus: number;
  abilityMods: Partial<Record<string, number>>;
  /** Значение @mod — модификатор характеристики самого умения */
  mod?: number;
}

/** Арифметика без eval: числа, + - * /, скобки, max/min/floor/ceil/round */
function evaluateArithmetic(expr: string): number {
  const tokens = expr.match(/\d+(?:\.\d+)?|[a-z]+|[-+*/(),]/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function primary(): number {
    const t = next();
    if (t === undefined) return 0;
    if (t === "-") return -primary();
    if (t === "+") return primary();
    if (t === "(") {
      const v = sum();
      if (peek() === ")") next();
      return v;
    }
    if (/^[a-z]+$/.test(t)) {
      const args: number[] = [];
      if (peek() === "(") {
        next();
        while (peek() !== undefined && peek() !== ")") {
          args.push(sum());
          if (peek() === ",") next();
        }
        next();
      }
      const x = args[0] ?? 0;
      if (t === "max") return Math.max(x, ...args);
      if (t === "min") return Math.min(x, ...args);
      if (t === "floor") return Math.floor(x);
      if (t === "ceil") return Math.ceil(x);
      if (t === "round") return Math.round(x);
      return 0;
    }
    return Number(t);
  }
  function product(): number {
    let v = primary();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const r = primary();
      v = op === "*" ? v * r : r === 0 ? 0 : v / r;
    }
    return v;
  }
  function sum(): number {
    let v = product();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const r = product();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  const result = sum();
  return Number.isFinite(result) ? result : 0;
}

/**
 * Формула Foundry → кости и число: «1d10 + @classes.fighter.levels» на 5 ур. → { dice: "1d10", mod: 5 }.
 * Кости должны входить слагаемыми (так и есть во всех формулах SRD).
 */
export function evaluateFormula(formula: string | null | undefined, ctx: FormulaContext): { dice: string | null; mod: number } {
  if (!formula) return { dice: null, mod: 0 };
  const level = Math.max(1, ctx.level || 1);
  let s = String(formula)
    // «1@scale.monk.die»: число костей перед таблицей с костью
    .replace(/(\d+)@scale\.([\w-]+)\.([\w-]+)/g, (_, n, owner, id) => {
      const v = scaleValue(`${owner}.${id}`, level);
      const faces = typeof v === "string" ? v.split("d")[1] : null;
      return faces ? `${n}d${faces}` : "0";
    })
    .replace(/@scale\.([\w-]+)\.([\w-]+)/g, (_, owner, id) => String(scaleValue(`${owner}.${id}`, level) ?? 0))
    .replace(/@classes\.[\w-]+\.levels|@details\.level/g, String(level))
    .replace(/@abilities\.(\w+)\.mod/g, (_, a: string) => String(ctx.abilityMods[a.toUpperCase()] ?? 0))
    .replace(/@prof/g, String(ctx.profBonus))
    .replace(/@scaling/g, "1")
    .replace(/@mod/g, String(ctx.mod ?? 0))
    .toLowerCase();

  const dice: string[] = [];
  s = s.replace(/(\d*)d(\d+)/g, (_, n, faces) => {
    dice.push(`${n || 1}d${faces}`);
    return "0";
  });
  return { dice: dice.length ? dice.join("+") : null, mod: Math.floor(evaluateArithmetic(s)) };
}

/** Заряды умения на уровне героя; usesMax 0 — без ограничения (таблицы SRD пишут это как 99/999) */
export function featureUses(
  feature: SrdFeature,
  ctx: FormulaContext
): { usesMax: number; refresh: CombatAbility["refresh"] } | null {
  if (!feature.uses) return null;
  const max = evaluateFormula(feature.uses.max, ctx).mod;
  const refresh: CombatAbility["refresh"] = feature.uses.recovery.includes("sr")
    ? "short"
    : feature.uses.recovery.includes("lr")
      ? "long"
      : "none";
  return { usesMax: max >= 99 ? 0 : Math.max(1, max), refresh };
}

// ============ УМЕНИЯ ГЕРОЯ ============

export interface HeroFeatureContext {
  className: string | null | undefined;
  subclass?: string | null;
  level: number;
  profBonus: number;
  abilityMods: Partial<Record<string, number>>;
  /** Лист героя (characters.data): по нему узнаём выбранные варианты */
  sheet?: Record<string, any> | null;
}

export interface HeroFeature {
  feature: SrdFeature;
  name: string;
  description: string;
}

/** Все умения SRD, которые есть у героя на его уровне (с архетипом и выбранными вариантами) */
export function heroClassFeatures(ctx: HeroFeatureContext): HeroFeature[] {
  const classKey = srdClassKey(ctx.className);
  if (!classKey) return [];
  const subclassKey = srdSubclassKey(classKey, ctx.subclass);
  const chosen = sheetChoiceTokens(ctx.sheet);
  const level = Math.max(1, ctx.level || 1);

  const out: HeroFeature[] = [];
  const seenOptions = new Set<string>();
  for (const f of SRD_FEATURES) {
    if (f.className !== classKey || f.level > level) continue;
    if (f.subclass && f.subclass !== subclassKey) continue;
    if (f.choice) {
      // Один и тот же вариант (боевой стиль воина и чемпиона) — один раз
      if (seenOptions.has(identOf(f.key)) || !isOptionChosen(f, chosen)) continue;
      seenOptions.add(identOf(f.key));
    }
    out.push({ feature: f, name: RU[f.key]?.name ?? f.nameEn, description: RU[f.key]?.description ?? "" });
  }
  return out;
}

// Умения, у которых уже есть ручная реализация в движке (library-data.ts): SRD их не дублирует
export const HAND_IMPLEMENTED_FEATURES = new Set([
  "barbarian/rage",
  "barbarian/reckless-attack",
  "fighter/second-wind",
  "fighter/action-surge",
  "rogue/sneak-attack",
  "rogue/cunning-action",
  "rogue/uncanny-dodge",
  "paladin/divine-smite",
  "paladin/lay-on-hands",
  "monk/monks-focus",
  "monk/flurry-of-blows",
  "monk/patient-defense",
  "monk/step-of-the-wind",
  "druid/wild-shape",
  "bard/bardic-inspiration",
]);

// Умения вне боя (выбор архетипа, навыки, языки, отдых, подготовка заклинаний) — в бой не берём
const OUT_OF_COMBAT = new Set([
  "spellcasting", "pact-magic", "druidic", "thieves-cant", "expertise", "jack-of-all-trades", "song-of-rest",
  "magical-secrets", "additional-magical-secrets", "bonus-proficiencies", "bonus-proficiency", "timeless-body",
  "tongue-of-the-sun-and-moon", "circle-spells", "bonus-cantrip", "evocation-savant", "expanded-spell-list",
  "use-magic-device", "second-story-work", "deft-explorer", "favored-enemy", "hide-in-plain-sight", "primal-path",
  "bard-college", "divine-domain", "druid-circle", "fighting-style", "martial-archetype", "monastic-tradition",
  "sacred-oath", "ranger-archetype", "roguish-archetype", "sorcerous-origins", "otherworldly-patron",
  "arcane-tradition", "metamagic", "eldritch-invocations", "pact-boon", "hunters-prey", "defensive-tactics",
  "multiattack", "superior-hunters-defense", "additional-fighting-style", "mystic-arcanum", "spell-mastery",
  "signature-spells", "dragon-ancestor", "remarkable-athlete", "reliable-talent", "natural-recovery",
  "arcane-recovery", "eldritch-master", "primeval-awareness", "font-of-inspiration", "sorcerous-restoration",
  "beast-speech", "beguiling-influence", "book-of-ancient-secrets", "eyes-of-the-rune-keeper",
  "mask-of-many-faces", "master-of-myriad-forms", "visions-of-distant-realms", "whispers-of-the-grave",
  "gaze-of-two-minds", "eldritch-sight", "voice-of-the-chain-master", "pact-of-the-tome",
  "divine-health", "beast-spells", "unarmored-defense", "unarmored-defense-barbarian", "draconic-resilience",
  "fast-movement", "unarmored-movement", "primal-champion",
]);

// Запас тратится не всегда: Отражение снарядов берёт ци, только чтобы бросить снаряд обратно
const OPTIONAL_POOL_COST = new Set(["monk/deflect-attacks"]);

// Стоимость, которую Foundry держит только в тексте условия
const POOL_COST_OVERRIDES: Record<string, { pool: string; amount: number }> = {
  "monk/superior-defense": { pool: "monk/monks-focus", amount: 4 },
  "monk/disciplined-survivor": { pool: "monk/monks-focus", amount: 1 },
  "draconic-bloodline/draconic-presence": { pool: "sorcerer/font-of-magic", amount: 5 },
};

// Запасы, которые всегда счётчик, даже если ни одного приёма из них пока нет
const ALWAYS_POOL = new Set(["cleric/channel-divinity", "paladin/channel-divinity", "sorcerer/font-of-magic"]);

// Применяются по кнопке, хотя в Foundry у них нет способа применения
const FORCE_ACTIVE: Record<string, ActionCost> = {
  "monk/disciplined-survivor": "free",
  "hunter/horde-breaker": "free",
};

// Умения, которые движок разыгрывает сам (useClassFeature по srdKey), а не мастер
export const ENGINE_ACTIONS = new Set([
  "cleric/channel-divinity-turn-undead",
  "oath-of-devotion/channel-divinity-turn-the-unholy",
  "life-domain/channel-divinity-preserve-life",
  "path-of-the-berserker/frenzy",
  "hunter/horde-breaker",
  "hunter/whirlwind-attack",
  "hunter/volley",
]);

// Особые случаи, где свойств Foundry мало: что именно происходит при провале спасброска
const SAVE_EFFECT_OVERRIDES: Record<string, { effects: AppliedEffect[]; saveAbility?: AbilityKey; dcAbility: AbilityKey; targeting: ActionParameters["targeting"]; range: ActionParameters["range"]; actionCost?: ActionCost }> = {
  // Ошеломляющий удар: после попадания рукопашной атакой, 1 ци, СЛ ци (Мудрость)
  "monk/stunning-strike": {
    effects: [{ condition: "stunned", durationRounds: 1 }],
    saveAbility: "CON",
    dcAbility: "WIS",
    targeting: "creature",
    range: { type: "melee", value: 5 },
    actionCost: "free",
  },
  // Пугающее присутствие берсерка: испуг до конца следующего хода
  "path-of-the-berserker/intimidating-presence": {
    effects: [{ condition: "frightened", durationRounds: 1 }],
    saveAbility: "WIS",
    dcAbility: "CHA",
    targeting: "creature",
    range: { type: "ranged", value: 30 },
  },
};

// Умения, срабатывающие сами (при попадании, в начале хода): движок узнаёт их по srdKey
export const TRIGGERED_FEATURES = new Set([
  "life-domain/divine-strike",
  "paladin/radiant-strikes",
  "hunter/colossus-slayer",
  "barbarian/brutal-critical",
  "champion/improved-critical",
  "champion/superior-critical",
  "champion/survivor",
  "barbarian/danger-sense",
  "paladin/aura-of-protection",
  "rogue/evasion",
  "monk/evasion",
  "hunter/evasion",
  "hunter/uncanny-dodge",
  "barbarian/relentless-rage",
  "barbarian/feral-instinct",
  "path-of-the-berserker/mindless-rage",
  "paladin/aura-of-courage",
  "oath-of-devotion/aura-of-devotion",
  "monk/purity-of-body",
  "circle-of-the-land/natures-ward",
  "rogue/elusive",
  "warlock/thirsting-blade",
  "warlock/agonizing-blast",
  "warlock/repelling-blast",
  "warlock/eldritch-spear",
  "the-fiend/dark-ones-blessing",
  "bard/superior-inspiration",
  "monk/perfect-focus",
  "life-domain/disciple-of-life",
  "life-domain/supreme-healing",
  "life-domain/blessed-healer",
  "school-of-evocation/empowered-evocation",
  "school-of-evocation/potent-cantrip",
  "school-of-evocation/sculpt-spells",
  "fighter/archery",
  "champion/archery",
  "ranger/archery",
  "way-of-the-open-hand/open-hand-technique",
]);

const ACTIVATION_COST: Record<string, ActionCost> = {
  action: "action",
  bonus: "bonus",
  reaction: "reaction",
};

function rangeOf(act: SrdActivity | undefined): ActionParameters["range"] {
  const units = act?.range?.units;
  const value = Number(act?.range?.value) || 0;
  if (!units || units === "self") return { type: "self" };
  if (units === "touch") return { type: "touch", value: 5 };
  if (units === "ft") return value <= 5 ? { type: "melee", value: 5 } : { type: "ranged", value };
  return { type: "special" };
}

function damageTypeOf(types: string[] | undefined): string {
  return types?.[0] ?? "";
}

export interface SrdAbilityDefinition {
  srdKey: string;
  name: string;
  usesMax: number;
  refresh: CombatAbility["refresh"];
  parameters: ActionParameters;
}

/**
 * Способности для боя из умений SRD: заряды и рост по уровню посчитаны, общий запас указан в
 * resourceCost, срабатывающие сами отмечены passive. Умения с ручной реализацией не включаются.
 */
export function srdAbilityDefinitions(ctx: HeroFeatureContext): SrdAbilityDefinition[] {
  const features = heroClassFeatures(ctx);
  const formula: FormulaContext = { level: ctx.level, profBonus: ctx.profBonus, abilityMods: ctx.abilityMods };

  // Запасы, из которых тратят другие умения героя (Канал божественности, очки чародейства)
  const pools = new Set<string>();
  for (const { feature } of features) {
    for (const act of feature.activities) {
      for (const c of act.consumes ?? []) {
        if (c.pool !== feature.key && c.pool !== "spellSlot") pools.add(c.pool);
      }
    }
    const forced = POOL_COST_OVERRIDES[feature.key];
    if (forced) pools.add(forced.pool);
    if (ALWAYS_POOL.has(feature.key)) pools.add(feature.key);
  }

  const out: SrdAbilityDefinition[] = [];
  for (const { feature, name, description } of features) {
    const ident = identOf(feature.key);
    if (HAND_IMPLEMENTED_FEATURES.has(feature.key) || OUT_OF_COMBAT.has(ident)) continue;

    const uses = featureUses(feature, formula);
    const base = { srdKey: feature.key, name, usesMax: uses?.usesMax ?? 0, refresh: uses?.refresh ?? ("none" as const) };
    const common = { name, type: "ability" as const, srdKey: feature.key, description };

    // 1. Общий запас: сам по себе не применяется, его тратят приёмы
    if (pools.has(feature.key)) {
      out.push({ ...base, parameters: { ...common, actionCost: "none", isResource: true, targeting: "self" } });
      continue;
    }

    const active: SrdActivity | undefined = FORCE_ACTIVE[feature.key]
      ? { ...(feature.activities[0] ?? { type: "utility" }), activation: FORCE_ACTIVE[feature.key] === "free" ? "special" : FORCE_ACTIVE[feature.key] }
      : feature.activities.find(
          (a) =>
            (a.activation && ACTIVATION_COST[a.activation]) ||
            (a.activation && a.activation !== "none" && (uses || (a.consumes ?? []).some((c) => c.pool !== "spellSlot")))
        );

    // 2. Срабатывает само или просто действует: движок или мастер учитывают его без кнопки
    if (!active || TRIGGERED_FEATURES.has(feature.key)) {
      out.push({ ...base, parameters: { ...common, actionCost: "none", passive: true, ...triggerValues(feature, ctx) } });
      continue;
    }

    // 3. Применяемое умение
    const poolCost = POOL_COST_OVERRIDES[feature.key]
      ? { pool: POOL_COST_OVERRIDES[feature.key].pool, amount: String(POOL_COST_OVERRIDES[feature.key].amount) }
      : (active.consumes ?? []).find((c) => c.pool !== feature.key && c.pool !== "spellSlot");
    const params: ActionParameters = {
      ...common,
      actionCost: ACTIVATION_COST[active.activation ?? ""] ?? "free",
      range: rangeOf(active),
      targeting: "self",
      damage: [],
    };
    if (poolCost && !OPTIONAL_POOL_COST.has(feature.key)) {
      params.resourceCost = {
        pool: poolCost.pool,
        amount: Math.max(1, evaluateFormula(poolCost.amount, formula).mod),
      };
    }

    const override = SAVE_EFFECT_OVERRIDES[feature.key];
    if (ENGINE_ACTIONS.has(feature.key)) {
      Object.assign(params, engineActionValues(feature, ctx));
    } else if (override) {
      params.saveType = override.saveAbility ?? null;
      params.saveDC = 8 + ctx.profBonus + (ctx.abilityMods[override.dcAbility] ?? 0);
      params.effects = override.effects;
      params.targeting = override.targeting;
      params.range = override.range;
      if (override.actionCost) params.actionCost = override.actionCost;
    } else if (
      active.type === "heal" &&
      active.heal &&
      !active.condition &&
      !active.healTypes?.includes("temphp") &&
      (active.target === "self" || active.range?.units === "self")
    ) {
      // Лечение себя (Исцеление тела)
      const heal = evaluateFormula(active.heal, formula);
      params.selfHeal = { dice: heal.dice ?? "0", mod: heal.mod };
    } else {
      // Остальное мастер разыгрывает сам: движок тратит действие и заряды и пишет в журнал
      params.manual = true;
    }

    out.push({ ...base, parameters: params });
  }
  // Подклассы Воина из dnd.su (кроме Чемпиона, он уже в SRD): fighter-subclasses.ts
  out.push(...fighterSubclassAbilityDefinitions(ctx));
  return out;
}

/** Параметры умений, которые разыгрывает движок: дальность, спасбросок, запас лечения… */
function engineActionValues(feature: SrdFeature, ctx: HeroFeatureContext): Partial<ActionParameters> {
  const dc = (ability: AbilityKey) => 8 + ctx.profBonus + (ctx.abilityMods[ability] ?? 0);
  switch (feature.key) {
    case "cleric/channel-divinity-turn-undead":
      return {
        targeting: "self",
        range: { type: "self", value: 30 },
        saveType: "WIS",
        saveDC: dc("WIS"),
        // Уничтожение нежити: нежить с ПО не выше этого порога рассыпается
        featureValue: Number(scaleValue("cleric.destroy-undead", ctx.level)) || 0,
      };
    case "oath-of-devotion/channel-divinity-turn-the-unholy":
      return { targeting: "self", range: { type: "self", value: 30 }, saveType: "WIS", saveDC: dc("CHA") };
    case "life-domain/channel-divinity-preserve-life":
      return { targeting: "self", range: { type: "self", value: 30 }, featureValue: 5 * Math.max(1, ctx.level) };
    case "path-of-the-berserker/frenzy":
      return { targeting: "creature", range: { type: "melee", value: 5 } };
    case "hunter/horde-breaker":
      return { targeting: "creature", range: { type: "special" } };
    case "hunter/whirlwind-attack":
      return { targeting: "self", range: { type: "self", value: 5 } };
    case "hunter/volley":
      return { targeting: "point", range: { type: "ranged", value: 150 }, aoe: { shape: "sphere", size: 10 } };
    default:
      return {};
  }
}

/** Готовые числа для срабатывающих умений: кость Божественного удара, лишние кости крита… */
function triggerValues(feature: SrdFeature, ctx: HeroFeatureContext): Partial<ActionParameters> {
  const formula: FormulaContext = { level: ctx.level, profBonus: ctx.profBonus, abilityMods: ctx.abilityMods };
  switch (feature.key) {
    case "life-domain/divine-strike":
    case "paladin/radiant-strikes":
    case "hunter/colossus-slayer": {
      const part = feature.activities.find((a) => a.damage?.length)?.damage?.[0];
      const roll = evaluateFormula(part?.formula, formula);
      return { damage: [{ dice: roll.dice ?? "1d8", mod: roll.mod, type: damageTypeOf(part?.types) }] };
    }
    case "barbarian/brutal-critical":
      return { featureValue: Number(scaleValue("barbarian.brutal-critical", ctx.level)) || 1 };
    case "champion/improved-critical":
      return { featureValue: 19 };
    case "champion/superior-critical":
      return { featureValue: 18 };
    case "champion/survivor":
      return { featureValue: 5 + (ctx.abilityMods.CON ?? 0) };
    case "paladin/aura-of-protection":
      return {
        featureValue: Math.max(1, ctx.abilityMods.CHA ?? 0),
        range: { type: "self", value: Number(scaleValue("paladin.aura-radius", ctx.level)) || 10 },
      };
    case "paladin/aura-of-courage":
    case "oath-of-devotion/aura-of-devotion":
      return { range: { type: "self", value: Number(scaleValue("paladin.aura-radius", ctx.level)) || 10 } };
    case "the-fiend/dark-ones-blessing":
      return { featureValue: Math.max(1, (ctx.abilityMods.CHA ?? 0) + ctx.level) };
    case "school-of-evocation/empowered-evocation":
      return { featureValue: ctx.abilityMods.INT ?? 0 };
    case "warlock/agonizing-blast":
      return { featureValue: ctx.abilityMods.CHA ?? 0 };
    default:
      return {};
  }
}

/** Способности героя из SRD в виде CombatAbility для боя */
export function srdCombatAbilities(ctx: HeroFeatureContext, idPrefix: string): CombatAbility[] {
  return srdAbilityDefinitions(ctx).map((d, idx) => ({
    id: `${idPrefix}_srd_${idx}_${identOf(d.srdKey)}`,
    name: d.name,
    usesMax: d.usesMax,
    usesUsed: 0,
    refresh: d.refresh,
    parameters: d.parameters,
  }));
}
