// Декларативный реестр рас D&D 5e (2014 Legacy + MPMM) для тактического боя.
//
// Данные рас берутся из data/races-2014.json (синхронизируется scripts/sync-dnd-shared-races.mjs
// из C:\antig\dnd-shared\data\races.json). Боевые правила рас регистрируются через defineRace
// в src/lib/combat/races/*.ts, а срабатывания в бою — через registerKit / featureMods.
//
// Переиспользует примитивы правил из ../class-defs (Calc, Rule, OptionRule, FeatureRule, calcOf,
// optionChosen, buildDefinition) без дублирования.

import data from "../data/races-2014.json";
import type { SrdAbilityDefinition } from "../class-features";
import {
  buildDefinition,
  calcOf,
  mentions,
  optionChosen,
  type Calc,
  type FeatureRule,
  type OptionRule,
  type Rule,
} from "../class-defs";
import type { AbilityKey, ActionCost, Attack, CombatAbility, CreatureSize } from "../types";

export { calcOf, mentions, type Calc, type FeatureRule, type OptionRule, type Rule };

// ============ ДАННЫЕ РАС ============

export interface SpeedProfile {
  walk: number;
  fly?: number;
  swim?: number;
  climb?: number;
  burrow?: number;
  flyNoHeavyOrMediumArmor?: boolean;
  flyNoHeavyArmor?: boolean;
}

export interface RaceTraitCombatData {
  kind?: string;
  naturalWeapon?: string;
  darkvision?: number;
  resistances?: string[];
  actionType?: string;
  innateSpellcasting?: boolean;
  creatureType?: boolean;
  acModifier?: boolean;
  saveAdvantage?: boolean;
  breathWeapon?: boolean;
}

export interface RaceTraitData {
  id: string;
  name: string;
  description: string;
  combatRelevant?: boolean;
  combat?: RaceTraitCombatData;
  minLevel?: number;
}

export interface SubraceData {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  abilityBonuses: Record<string, number>;
  traits: RaceTraitData[];
  aliases?: string[];
  sourceBook?: string;
  darkvision?: number;
  speeds?: Partial<SpeedProfile>;
  size?: string;
  resistances?: string[];
  conditionImmunities?: string[];
}

export interface RaceProgressionData {
  level: number;
  traitId: string;
  name: string;
  description: string;
  subraceId?: string;
  spell?: { name: string; level: number };
}

export interface RaceData {
  id: string;
  editionVariant: "legacy" | "mpmm" | string;
  name: string;
  nameEn: string;
  sourceBook: string;
  source: string;
  dndsuUrl?: string;
  size: string;
  speeds: SpeedProfile;
  darkvision: number;
  abilityBonuses: Record<string, number>;
  languages: string[];
  aliases: string[];
  description: string;
  traits: RaceTraitData[];
  subraces: SubraceData[];
  progression: RaceProgressionData[];
  resistances?: string[];
  conditionImmunities?: string[];
}

export const RACES_2014 = data as RaceData[];

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

// ============ ПРАВИЛА РАС ============

type Refresh = CombatAbility["refresh"];
export type UsesSpec = Rule["uses"] | "profBonus" | "level" | { max: number; refresh: Refresh };

export interface RaceOptionRule extends Omit<OptionRule, "uses"> {
  uses?: UsesSpec;
  refresh?: Refresh;
}

export interface RaceFeatureRule extends Omit<FeatureRule, "uses" | "options"> {
  minLevel?: number;
  uses?: UsesSpec;
  refresh?: Refresh;
  options?: RaceOptionRule[];
}

export interface NaturalWeaponSpec {
  id: string;
  name: string;
  dice: string;
  damageType: string;
  ability?: AbilityKey;
  finesse?: boolean;
  reach?: number;
  description?: string;
  actionCost?: ActionCost;
}

export interface InnateSpellSpec {
  spellId: string;
  name: string;
  level: number;
  minCharacterLevel?: number;
  usesMax?: number;
  refresh?: "long" | "short";
  castingAbility?: AbilityKey;
}

export interface SubraceRules {
  pattern?: RegExp;
  traits: Record<string, RaceFeatureRule>;
  naturalWeapons?: NaturalWeaponSpec[];
  resistances?: string[];
  conditionImmunities?: string[];
  speed?: Partial<Pick<SpeedProfile, "walk" | "fly" | "swim" | "climb" | "burrow">>;
  darkvision?: number;
  innateSpells?: InnateSpellSpec[];
  extra?: Array<RaceFeatureRule & { name: string; description: string; minLevel?: number }>;
}

export interface RaceRules {
  pattern?: RegExp;
  traits: Record<string, RaceFeatureRule>;
  subraces?: Record<string, SubraceRules>;
  defaultResistances?: string[];
  conditionImmunities?: string[];
  naturalWeapons?: NaturalWeaponSpec[];
  speed?: Partial<Pick<SpeedProfile, "walk" | "fly" | "swim" | "climb" | "burrow">>;
  darkvision?: number;
  innateSpells?: InnateSpellSpec[];
  extra?: Array<RaceFeatureRule & { name: string; description: string; minLevel?: number }>;
}

const RACES = new Map<string, RaceRules>();

export function defineRace(raceId: string, rules: RaceRules): void {
  RACES.set(raceId, rules);
}

export function raceRules(raceId: string): RaceRules | undefined {
  return RACES.get(raceId);
}

// ============ ПОИСК РАСЫ И ПОДРАСЫ ============

function matchSubrace(race: RaceData, subraceQuery?: string | null): SubraceData | undefined {
  const want = norm(String(subraceQuery || ""));
  if (!want || race.subraces.length === 0) return undefined;
  const rules = RACES.get(race.id);
  return (
    race.subraces.find(
      (s) =>
        norm(s.id) === want ||
        norm(s.name) === want ||
        norm(s.nameEn) === want ||
        (s.aliases ?? []).some((a) => norm(a) === want)
    ) ??
    race.subraces.find((s) => rules?.subraces?.[s.id]?.pattern?.test(want)) ??
    race.subraces.find(
      (s) =>
        want.includes(norm(s.name)) ||
        want.includes(norm(s.nameEn)) ||
        (s.aliases ?? []).some((a) => norm(a).length >= 4 && want.includes(norm(a)))
    ) ??
    race.subraces.find((s) => norm(s.name).includes(want) && want.length >= 5) ??
    undefined
  );
}

/**
 * Поиск расы (и опциональной подрасы) по названию, английскому имени, id или алиасам.
 * При коллизии Legacy vs MPMM («Аасимар»): если в запросе нет MPMM, предпочтение у Legacy
 * (и у расы, в которой находится переданная подраса).
 */
export function findRaceData(
  raceQuery?: string | null,
  subraceQuery?: string | null
): { race: RaceData; subrace?: SubraceData } | null {
  const want = norm(String(raceQuery || ""));
  if (!want) return null;

  const combinedQuery = `${raceQuery ?? ""} ${subraceQuery ?? ""}`;
  const wantsMpmm = /\bmpmm\b|\(mpmm\)|-mpmm|мультивселен/i.test(combinedQuery);

  let candidates = RACES_2014.filter(
    (r) =>
      norm(r.id) === want ||
      norm(r.name) === want ||
      norm(r.nameEn) === want ||
      r.aliases.some((a) => norm(a) === want)
  );

  if (candidates.length === 0) {
    candidates = RACES_2014.filter((r) => RACES.get(r.id)?.pattern?.test(want));
  }
  if (candidates.length === 0) {
    candidates = RACES_2014.filter(
      (r) =>
        want.includes(norm(r.name)) ||
        want.includes(norm(r.nameEn)) ||
        r.aliases.some((a) => norm(a).length >= 4 && want.includes(norm(a)))
    );
  }
  if (candidates.length === 0) {
    candidates = RACES_2014.filter((r) => norm(r.name).includes(want) && want.length >= 5);
  }
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    const aMpmm = a.editionVariant === "mpmm" || a.id.endsWith("-mpmm");
    const bMpmm = b.editionVariant === "mpmm" || b.id.endsWith("-mpmm");
    if (aMpmm !== bMpmm) return wantsMpmm ? (aMpmm ? -1 : 1) : (aMpmm ? 1 : -1);
    if (subraceQuery) {
      const aHasSub = matchSubrace(a, subraceQuery) ? 1 : 0;
      const bHasSub = matchSubrace(b, subraceQuery) ? 1 : 0;
      if (aHasSub !== bHasSub) return bHasSub - aHasSub;
    }
    return 0;
  });

  const race = sorted[0];
  const subrace = matchSubrace(race, subraceQuery);
  return { race, subrace };
}

// ============ СБОРКА РАСОВОГО НАБОРА ============

export interface RaceHeroContext {
  race?: string | null;
  subrace?: string | null;
  level: number;
  profBonus: number;
  abilityMods: Partial<Record<string, number>>;
  sheet?: Record<string, any> | null;
  racialVariants?: string[];
}

export interface ResolvedRaceLoadout {
  raceId: string;
  raceName: string;
  subraceId?: string;
  subraceName?: string;
  size: CreatureSize;
  darkvision: number;
  speeds: { walk: number; fly?: number; swim?: number; climb?: number; burrow?: number };
  resistances: string[];
  conditionImmunities: string[];
  naturalAttacks: Attack[];
  abilities: CombatAbility[];
  innateSpells: Array<{
    spellId: string;
    name: string;
    level: number;
    minCharacterLevel: number;
    usesMax: number;
    refresh: "long" | "short";
    castingAbility: AbilityKey;
  }>;
  racialVariants: string[];
}

function normalizeUses(uses: UsesSpec | undefined, fallbackRefresh: Refresh = "long"): Rule["uses"] {
  if (!uses) return undefined;
  if (typeof uses === "function") return uses;
  if (uses === "profBonus") return (c) => ({ max: c.prof, refresh: fallbackRefresh });
  if (uses === "level") return (c) => ({ max: c.level, refresh: fallbackRefresh });
  return () => uses;
}

function toRule(rule: RaceFeatureRule | RaceOptionRule): Rule {
  const { uses, ...rest } = rule;
  return {
    ...rest,
    uses: normalizeUses(uses, rule.refresh ?? "long"),
  };
}

function toOptionRule(opt: RaceOptionRule): OptionRule {
  return {
    ...opt,
    uses: normalizeUses(opt.uses, opt.refresh ?? "long"),
  };
}

function resolveSize(race: RaceData, subrace: SubraceData | undefined, sheet?: Record<string, any> | null): CreatureSize {
  const raw = norm(subrace?.size ?? race.size ?? "Средний");
  if (raw === "маленький" || raw === "small") return "small";
  if (raw.includes("маленький") && raw.includes("средний")) {
    const sheetSize = norm(String(sheet?.size ?? ""));
    if (sheetSize === "маленький" || sheetSize === "small") return "small";
    return "medium";
  }
  return "medium";
}

function toNaturalAttack(nw: NaturalWeaponSpec, ctx: RaceHeroContext): Attack {
  const baseMod = ctx.abilityMods[nw.ability ?? "STR"] ?? 0;
  const dexMod = ctx.abilityMods.DEX ?? 0;
  const mod = nw.finesse ? Math.max(baseMod, dexMod) : baseMod;
  return {
    id: nw.id,
    name: nw.name,
    attackBonus: mod + ctx.profBonus,
    damage: [{ dice: nw.dice, mod, type: nw.damageType }],
    kind: "melee",
    range: { normal: nw.reach ?? 5 },
    actionCost: nw.actionCost ?? "action",
    ...(nw.finesse ? { finesse: true } : {}),
    ...(nw.description ? { description: nw.description } : {}),
  };
}

export function resolveRaceForCharacter(ctx: RaceHeroContext, idPrefix = "hero"): ResolvedRaceLoadout | null {
  const found = findRaceData(ctx.race, ctx.subrace);
  if (!found) return null;

  const { race, subrace } = found;
  const rules = RACES.get(race.id);
  const subRules = subrace ? rules?.subraces?.[subrace.id] : undefined;

  const c = calcOf({ className: null, level: ctx.level, profBonus: ctx.profBonus, abilityMods: ctx.abilityMods, sheet: ctx.sheet });
  const variants = new Set<string>(ctx.racialVariants ?? []);
  if (Array.isArray(ctx.sheet?.racialVariants)) {
    for (const v of ctx.sheet.racialVariants) variants.add(String(v));
  }
  for (const v of variants) c.tokens.add(v);

  const defs: SrdAbilityDefinition[] = [];
  const pushRule = (ownerId: string, rule: RaceFeatureRule | RaceOptionRule, name: string, description: string) => {
    if (rule.kind === "skip" || (rule.when && !rule.when(c))) return;
    defs.push(buildDefinition(`race/${ownerId}/${rule.id}`, rule.name ?? name, description, toRule(rule), c));
  };

  const processFeatureSet = (
    ownerId: string,
    traitsData: RaceTraitData[],
    traitRules: Record<string, RaceFeatureRule> | undefined,
    extraRules: Array<RaceFeatureRule & { name: string; description: string; minLevel?: number }> | undefined
  ) => {
    if (!traitRules && !extraRules) return;
    const matchedKeys = new Set<string>();

    for (const t of traitsData) {
      const ruleKey = traitRules && (t.id in traitRules ? t.id : t.name in traitRules ? t.name : null);
      if (!ruleKey || !traitRules) continue;
      matchedKeys.add(ruleKey);
      const rule = traitRules[ruleKey];
      const minLvl = rule.minLevel ?? t.minLevel ?? 1;
      if (minLvl > c.level) continue;

      pushRule(ownerId, rule, t.name, rule.description ?? t.description);

      const options = (rule.options ?? []).filter((o) => (o.minLevel ?? minLvl) <= c.level);
      const chosen = options.filter((o) => optionChosen(toOptionRule(o), c));
      const shown =
        rule.pick === "all"
          ? options
          : chosen.length > 0 || rule.pick === "sheet"
            ? chosen
            : rule.pick === "sheet-or-all"
              ? options
              : chosen;
      for (const o of shown) {
        pushRule(ownerId, o, o.name, o.description);
        variants.add(o.id);
      }
    }

    // Синтетические или дополнительные правила, заданные по ключу без записи в traits JSON
    if (traitRules) {
      for (const [key, rule] of Object.entries(traitRules)) {
        if (matchedKeys.has(key)) continue;
        if ((rule.minLevel ?? 1) > c.level) continue;
        if (!rule.name && rule.kind === "skip") continue;
        pushRule(ownerId, rule, rule.name ?? key, rule.description ?? "");
      }
    }

    for (const x of extraRules ?? []) {
      if ((x.minLevel ?? 1) > c.level) continue;
      pushRule(ownerId, x, x.name, x.description);
      const options = (x.options ?? []).filter((o) => (o.minLevel ?? x.minLevel ?? 1) <= c.level);
      const chosen = options.filter((o) => optionChosen(toOptionRule(o), c));
      const shown =
        x.pick === "all"
          ? options
          : chosen.length > 0 || x.pick === "sheet"
            ? chosen
            : x.pick === "sheet-or-all"
              ? options
              : chosen;
      for (const o of shown) {
        pushRule(ownerId, o, o.name, o.description);
        variants.add(o.id);
      }
    }
  };

  processFeatureSet(race.id, race.traits, rules?.traits, rules?.extra);
  if (subrace) {
    processFeatureSet(subrace.id, subrace.traits, subRules?.traits, subRules?.extra);
  }

  const abilities: CombatAbility[] = defs.map((d, idx) => ({
    id: `${idPrefix}_race_${idx}_${d.srdKey.split("/").pop() ?? "trait"}`,
    name: d.name,
    usesMax: d.usesMax,
    usesUsed: 0,
    refresh: d.refresh,
    parameters: d.parameters,
  }));

  // Скорости: база расы -> подраса -> правила
  const speeds: ResolvedRaceLoadout["speeds"] = {
    walk: subRules?.speed?.walk ?? rules?.speed?.walk ?? subrace?.speeds?.walk ?? race.speeds?.walk ?? 30,
  };
  for (const key of ["fly", "swim", "climb", "burrow"] as const) {
    const val = subRules?.speed?.[key] ?? rules?.speed?.[key] ?? subrace?.speeds?.[key] ?? race.speeds?.[key];
    if (typeof val === "number" && val > 0) speeds[key] = val;
  }

  // Тёмное зрение
  const darkvision = subRules?.darkvision ?? rules?.darkvision ?? subrace?.darkvision ?? race.darkvision ?? 0;

  // Сопротивления и иммунитеты к состояниям
  const resSet = new Set<string>();
  const addTraitRes = (traits: RaceTraitData[]) => {
    for (const t of traits) {
      if ((t.minLevel ?? 1) <= c.level) {
        for (const r of t.combat?.resistances ?? []) resSet.add(r);
      }
    }
  };
  if (rules?.defaultResistances) {
    for (const r of rules.defaultResistances) resSet.add(r);
  } else {
    addTraitRes(race.traits);
  }
  if (subRules?.resistances) {
    for (const r of subRules.resistances) resSet.add(r);
  } else if (subrace) {
    addTraitRes(subrace.traits);
    for (const r of subrace.resistances ?? []) resSet.add(r);
  }
  for (const r of race.resistances ?? []) resSet.add(r);

  const ciSet = new Set<string>([
    ...(race.conditionImmunities ?? []),
    ...(subrace?.conditionImmunities ?? []),
    ...(rules?.conditionImmunities ?? []),
    ...(subRules?.conditionImmunities ?? []),
  ]);

  const naturalAttacks = [
    ...(rules?.naturalWeapons ?? []),
    ...(subRules?.naturalWeapons ?? []),
  ].map((nw) => toNaturalAttack(nw, ctx));

  const innateSpells = [...(rules?.innateSpells ?? []), ...(subRules?.innateSpells ?? [])]
    .filter((s) => (s.minCharacterLevel ?? 1) <= c.level)
    .map((s) => ({
      spellId: s.spellId,
      name: s.name,
      level: s.level,
      minCharacterLevel: s.minCharacterLevel ?? 1,
      usesMax: s.usesMax ?? (s.level === 0 ? 0 : 1),
      refresh: s.refresh ?? ("long" as const),
      castingAbility: s.castingAbility ?? ("CHA" as const),
    }));

  return {
    raceId: race.id,
    raceName: race.name,
    ...(subrace ? { subraceId: subrace.id, subraceName: subrace.name } : {}),
    size: resolveSize(race, subrace, ctx.sheet),
    darkvision,
    speeds,
    resistances: [...resSet],
    conditionImmunities: [...ciSet],
    naturalAttacks,
    abilities,
    innateSpells,
    racialVariants: [...variants],
  };
}

/** Все ключи правил расы и её подрас — для проверок полноты */
export function raceRuleKeys(
  raceId: string
): Array<{ key: string; subraceId?: string; traitName: string; rule: Rule }> {
  const rules = RACES.get(raceId);
  if (!rules) return [];
  const out: Array<{ key: string; subraceId?: string; traitName: string; rule: Rule }> = [];

  const collect = (ownerId: string, subraceId: string | undefined, traits: Record<string, RaceFeatureRule>, extra?: RaceRules["extra"]) => {
    for (const [traitName, r] of Object.entries(traits)) {
      out.push({ key: `race/${ownerId}/${r.id}`, subraceId, traitName, rule: toRule(r) });
      for (const o of r.options ?? []) {
        out.push({ key: `race/${ownerId}/${o.id}`, subraceId, traitName: o.name, rule: toRule(o) });
      }
    }
    for (const x of extra ?? []) {
      out.push({ key: `race/${ownerId}/${x.id}`, subraceId, traitName: x.name, rule: toRule(x) });
      for (const o of x.options ?? []) {
        out.push({ key: `race/${ownerId}/${o.id}`, subraceId, traitName: o.name, rule: toRule(o) });
      }
    }
  };

  collect(raceId, undefined, rules.traits, rules.extra);
  for (const [subId, sub] of Object.entries(rules.subraces ?? {})) {
    collect(subId, subId, sub.traits, sub.extra);
  }
  return out;
}
