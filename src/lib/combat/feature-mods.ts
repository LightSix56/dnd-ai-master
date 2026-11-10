// Постоянные поправки от умений и состояний: сопротивления, преимущества на спасброски, бонусы к КД,
// скорости и урону, порог крита, ауры.
//
// Умение описывается данными, а не кодом в движке: «пока в ярости — сопротивление всему, кроме
// психического», «союзники в 10 футах получают +1 к КД». Движок и правила (rules.ts) спрашивают
// у этого файла готовый ответ («есть ли сопротивление огню?»), не зная, от какого умения он взялся.
//
// Поправки регистрируются файлами классов (classes/*.ts):
//   • featureMods("zealot/…", { … })  — действует, пока умение есть у бойца;
//   • conditionMods("raging", { … })  — действует, пока на бойце висит состояние.
//
// Файл чистый: без обращений к движку, чтобы им пользовались и правила, и бот.

import { distanceFt } from "./grid";
import { isHostile, type AbilityKey, type Attack, type CombatAbility, type Combatant, type Condition } from "./types";

/** К каким атакам относится поправка */
export type AttackFilter =
  | "any"
  /** Оружием (не заклинанием) */
  | "weapon"
  | "melee"
  | "ranged"
  /** Рукопашная оружием на Силе (Ярость, Безрассудная атака) */
  | "strMelee"
  /** Метательным оружием на Силе */
  | "thrown";

export interface Mods {
  /** Сопротивление урону: тип («fire»), «physical» (дробящий, колющий, рубящий) или «all-but-psychic» */
  resist?: string[];
  /** Иммунитет к урону */
  immune?: string[];
  /** Иммунитет к состояниям («frightened», «charmed») */
  conditionImmune?: string[];
  /** Преимущество на спасброски этих характеристик («all» — на все) */
  saveAdvantage?: AbilityKey[] | "all";
  /** Бонус к спасброскам: одно число на все или по характеристикам */
  saveBonus?: number | Partial<Record<AbilityKey, number>>;
  acBonus?: number;
  /** Бонус к скорости в футах */
  speedBonus?: number;
  /** Крит оружием начиная с этого значения к20 (19 — Улучшенные критические попадания) */
  critFrom?: number;
  /** Досягаемость рукопашных атак больше на столько футов */
  reachBonus?: number;
  /** Преимущество на свои атаки */
  attackAdvantage?: AttackFilter;
  /** Постоянная прибавка к урону атак */
  damageBonus?: { amount: number; attacks: AttackFilter; label?: string };
  /** Кость, прибавляемая к броскам атаки («1d3» — Подпитка магией) */
  attackBonusDice?: string;
  /** Провоцированные атаки по бойцу идут с помехой */
  opportunityDisadvantage?: boolean;
  /** Союзники бьют с преимуществом в ближнем бою по врагам в стольких футах от бойца (Тотем волка) */
  alliesMeleeAdvantageNear?: number;
  /** Враги в стольких футах от бойца атакуют других с помехой (Гармония медведя) */
  foesDisadvantageVsOthersNear?: number;
}

export interface ModRule {
  /** Название для журнала; по умолчанию — имя умения или состояния */
  name?: string;
  /** Действует, только пока на владельце это состояние («raging») */
  whileCondition?: string;
  /** Не действует при этом условии (например, боец недееспособен) */
  unless?: (owner: Combatant) => boolean;
  /** Аура: поправки получают союзники в стольких футах (и сам владелец, если не auraOnly) */
  aura?: number | ((owner: Combatant, ability?: CombatAbility) => number);
  /** Аура не действует на самого владельца */
  auraOnly?: boolean;
  mods: Mods | ((owner: Combatant, source: { ability?: CombatAbility; condition?: Condition }) => Mods | null);
}

const FEATURE_MODS = new Map<string, ModRule>();
const CONDITION_MODS = new Map<string, ModRule>();

/** Поправки умения по его ключу («totem-warrior/spirit-bear») */
export function featureMods(srdKey: string, rule: ModRule | Mods): void {
  FEATURE_MODS.set(srdKey, "mods" in rule ? (rule as ModRule) : { mods: rule as Mods });
}

/** Поправки состояния по его типу («raging») */
export function conditionMods(type: string, rule: ModRule | Mods): void {
  CONDITION_MODS.set(type, "mods" in rule ? (rule as ModRule) : { mods: rule as Mods });
}

export interface ModSource {
  name: string;
  mods: Mods;
}

const INCAPACITATING = ["incapacitated", "stunned", "paralyzed", "unconscious", "petrified", "dead"];
const has = (c: Combatant, type: string) => c.conditions?.some((x) => x.type === type) ?? false;
const conscious = (c: Combatant) => c.hpCurrent > 0 && !INCAPACITATING.some((t) => has(c, t));

function resolve(rule: ModRule, owner: Combatant, source: { ability?: CombatAbility; condition?: Condition }): Mods | null {
  if (rule.whileCondition && !has(owner, rule.whileCondition)) return null;
  if (rule.unless?.(owner)) return null;
  return typeof rule.mods === "function" ? rule.mods(owner, source) : rule.mods;
}

function auraRadius(rule: ModRule, owner: Combatant, ability?: CombatAbility): number {
  return typeof rule.aura === "function" ? rule.aura(owner, ability) : rule.aura ?? 0;
}

/**
 * Все поправки, действующие на бойца: от его умений и состояний, а с `all` — ещё и от аур союзников.
 */
export function modSources(c: Combatant, all?: Combatant[]): ModSource[] {
  const out: ModSource[] = [];
  for (const ability of c.abilities ?? []) {
    const key = ability.parameters?.srdKey;
    const rule = key ? FEATURE_MODS.get(key) : undefined;
    if (!rule || rule.auraOnly) continue;
    const mods = resolve(rule, c, { ability });
    if (mods) out.push({ name: rule.name ?? ability.name, mods });
  }
  for (const condition of c.conditions ?? []) {
    const rule = CONDITION_MODS.get(condition.type);
    if (!rule) continue;
    const mods = resolve(rule, c, { condition });
    if (mods) out.push({ name: rule.name ?? condition.type, mods });
  }
  for (const p of all ?? []) {
    if (p.id === c.id || isHostile(p.type, c.type) || !conscious(p)) continue;
    for (const ability of p.abilities ?? []) {
      const key = ability.parameters?.srdKey;
      const rule = key ? FEATURE_MODS.get(key) : undefined;
      if (!rule?.aura) continue;
      if (distanceFt(p, c) > auraRadius(rule, p, ability)) continue;
      const mods = resolve(rule, p, { ability });
      if (mods) out.push({ name: `${rule.name ?? ability.name} (${p.name})`, mods });
    }
  }
  return out;
}

// ============ ВОПРОСЫ ДВИЖКА И ПРАВИЛ ============

const PHYSICAL = ["slashing", "piercing", "bludgeoning", "рубящий", "колющий", "дробящий"];

function typeMatches(entry: string, damageType: string): boolean {
  const type = damageType.toLowerCase();
  if (entry === "physical") return PHYSICAL.some((p) => type.includes(p));
  if (entry === "all-but-psychic") return !(type === "psychic" || type.includes("психич"));
  return entry.toLowerCase() === type;
}

/** Название умения, дающего сопротивление этому типу урона, или null */
export function modResistance(c: Combatant, damageType: string, all?: Combatant[]): string | null {
  if (!damageType) return null;
  return modSources(c, all).find((s) => s.mods.resist?.some((e) => typeMatches(e, damageType)))?.name ?? null;
}

/** Название умения, дающего иммунитет к этому типу урона, или null */
export function modDamageImmunity(c: Combatant, damageType: string, all?: Combatant[]): string | null {
  if (!damageType) return null;
  return modSources(c, all).find((s) => s.mods.immune?.some((e) => typeMatches(e, damageType)))?.name ?? null;
}

/** Название умения, дающего иммунитет к состоянию, или null */
export function modConditionImmunity(c: Combatant, condition: string, all?: Combatant[]): string | null {
  return modSources(c, all).find((s) => s.mods.conditionImmune?.includes(condition))?.name ?? null;
}

/** Преимущество на спасбросок характеристики */
export function modSaveAdvantage(c: Combatant, ability: AbilityKey, all?: Combatant[]): boolean {
  return modSources(c, all).some((s) => s.mods.saveAdvantage === "all" || (Array.isArray(s.mods.saveAdvantage) && s.mods.saveAdvantage.includes(ability)));
}

/** Сумма бонусов к спасброску характеристики */
export function modSaveBonus(c: Combatant, ability: AbilityKey, all?: Combatant[]): number {
  return modSources(c, all).reduce((sum, s) => {
    const b = s.mods.saveBonus;
    return sum + (typeof b === "number" ? b : b?.[ability] ?? 0);
  }, 0);
}

export function modAcBonus(c: Combatant, all?: Combatant[]): number {
  return modSources(c, all).reduce((sum, s) => sum + (s.mods.acBonus ?? 0), 0);
}

export function modSpeedBonus(c: Combatant): number {
  return modSources(c).reduce((sum, s) => sum + (s.mods.speedBonus ?? 0), 0);
}

export function modReachBonus(c: Combatant): number {
  return modSources(c).reduce((max, s) => Math.max(max, s.mods.reachBonus ?? 0), 0);
}

/** Наименьший порог крита от умений; 20, если таких умений нет */
export function modCritFrom(c: Combatant): number {
  return modSources(c).reduce((min, s) => Math.min(min, s.mods.critFrom ?? 20), 20);
}

/** Подходит ли атака под фильтр поправки */
export function attackMatches(c: Combatant, attack: Attack, filter: AttackFilter): boolean {
  const spell = attack.kind === "spell" || !!attack.usesSpellAttack;
  const str = (c.abilityMods?.STR ?? 0) >= (c.abilityMods?.DEX ?? 0);
  switch (filter) {
    case "any":
      return true;
    case "weapon":
      return !spell;
    case "melee":
      return !spell && attack.kind === "melee";
    case "ranged":
      return !spell && attack.kind === "ranged";
    case "strMelee":
      return !spell && attack.kind === "melee" && (!attack.finesse || str);
    case "thrown":
      return !spell && attack.kind === "ranged" && !!attack.thrown && str;
  }
}

/** Причины преимущества на атаку от собственных поправок атакующего */
export function modAttackAdvantage(c: Combatant, attack: Attack): string[] {
  return modSources(c)
    .filter((s) => s.mods.attackAdvantage && attackMatches(c, attack, s.mods.attackAdvantage))
    .map((s) => s.name);
}

/** Прибавки к урону попадания: ярость и ей подобные */
export function modDamageBonuses(c: Combatant, attack: Attack): Array<{ label: string; amount: number }> {
  const out: Array<{ label: string; amount: number }> = [];
  for (const s of modSources(c)) {
    const b = s.mods.damageBonus;
    if (b && b.amount !== 0 && attackMatches(c, attack, b.attacks)) out.push({ label: b.label ?? s.name, amount: b.amount });
  }
  return out;
}

/** Кости, прибавляемые к броску атаки (кроме Благословения — оно в состояниях) */
export function modAttackBonusDice(c: Combatant): Array<{ label: string; dice: string }> {
  return modSources(c)
    .filter((s) => s.mods.attackBonusDice)
    .map((s) => ({ label: s.name, dice: s.mods.attackBonusDice as string }));
}

export function modOpportunityDisadvantage(c: Combatant): string | null {
  return modSources(c).find((s) => s.mods.opportunityDisadvantage)?.name ?? null;
}

/**
 * Преимущество и помеха на атаку от чужих умений: союзник-«волк» рядом с целью, враг-«медведь» рядом
 * с атакующим. Возвращает причины для журнала.
 */
export function modAttackInfluence(
  attacker: Combatant,
  target: Combatant,
  attack: Attack,
  all: Combatant[] | undefined
): { advantage: string[]; disadvantage: string[] } {
  const out = { advantage: [] as string[], disadvantage: [] as string[] };
  for (const p of all ?? []) {
    if (p.id === attacker.id || !conscious(p)) continue;
    const allyOfAttacker = !isHostile(p.type, attacker.type);
    for (const s of modSources(p)) {
      const near = s.mods.alliesMeleeAdvantageNear;
      if (near && allyOfAttacker && attackMatches(attacker, attack, "melee") && isHostile(p.type, target.type) && distanceFt(p, target) <= near) {
        out.advantage.push(`${s.name} (${p.name})`);
      }
      const taunt = s.mods.foesDisadvantageVsOthersNear;
      if (taunt && !allyOfAttacker && target.id !== p.id && distanceFt(p, attacker) <= taunt) {
        out.disadvantage.push(`${s.name} (${p.name})`);
      }
    }
  }
  return out;
}
