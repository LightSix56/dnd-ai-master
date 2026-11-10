// Конструктор боевой механики классов: типовые механики описываются данными.
//
// Большинство умений D&D сводится к нескольким схемам, и для каждой здесь есть готовая форма:
//  • stances  — «стойка»: кнопка вешает на себя состояние на время (Ярость, Песнь клинка). Что стойка
//               даёт пассивно (сопротивления, бонус урона) — описывается поправками в feature-mods.ts;
//  • riders   — добавка к попаданию: срабатывает сама при подходящей атаке (Божественная ярость) или
//               после зарядки кнопкой (armed);
//  • actions  — действие по кнопке с произвольной логикой (есть готовые помощники: спасбросок, атака);
//  • reductions — уменьшение урона реакцией: себе или союзнику рядом (Духовный щит);
//  • damaged  — ответ на полученный урон (Ответный удар, шипы);
//  • startTurn / endTurn / battleStart / afterAbility / afterAttack / onDrop — срабатывания по событиям;
//  • saveRerolls — переброс проваленного спасброска;
//  • conditionStart / conditionEnd — что происходит, когда стойка началась или закончилась.
//
// Заряды и запасы задаются в правилах умения (class-defs.ts): движок сам проверяет и списывает их.
// Модуль класса собирается из такого описания функцией registerKit и подключается к движку через
// class-hooks.ts — engine.ts при добавлении класса не меняется.

import { rollDice } from "@/lib/dnd/dice";
import { distanceFt } from "./grid";
import { canAct, checkReach, hasCondition, type SaveResult } from "./rules";
import {
  EngineError,
  applyEffect,
  dealDamage,
  dropConcentration,
  payActionCost,
  performAttack,
  rollEffectSave,
  spendAbilityUse,
  turnKey,
  type CastResult,
  type CombatState,
} from "./engine";
import { registerClassModule, type ClassModule, type FeatureOpts, type HitResolution } from "./class-hooks";
import { attackMatches, type AttackFilter } from "./feature-mods";
import { abilityByKey, armRider, armedRider, disarmRider, poolLeft, rollDiceCrit, spendPool } from "./fighter-pool";
import { isHostile, type AbilityKey, type ActionParameters, type Attack, type CombatAbility, type Combatant } from "./types";

// ============ ПОМОЩНИКИ ============

export const alive = (c: Combatant) => c.hpCurrent > 0 && !hasCondition(c, "dead");
export const friendly = (a: Combatant, b: Combatant) => !isHostile(a.type, b.type);
export const modOf = (c: Combatant, a: AbilityKey) => c.abilityMods?.[a] ?? 0;
export const dcBy = (c: Combatant, a: AbilityKey) => 8 + (c.profBonus || 2) + modOf(c, a);

export function hostilesOf(state: CombatState, c: Combatant, withinFt?: number): Combatant[] {
  return state.combatants.filter(
    (t) => t.id !== c.id && alive(t) && isHostile(c.type, t.type) && (withinFt === undefined || distanceFt(c, t) <= withinFt)
  );
}

export function alliesOf(state: CombatState, c: Combatant, withinFt?: number): Combatant[] {
  return state.combatants.filter(
    (t) => t.id !== c.id && alive(t) && friendly(c, t) && (withinFt === undefined || distanceFt(c, t) <= withinFt)
  );
}

export function log(state: CombatState, c: Combatant, text: string, kind = "ability"): void {
  state.addLog(text, kind as never, c.name);
}

export const isOwnTurn = (state: CombatState, c: Combatant) => state.current()?.id === c.id;

/** Метки «уже было в этом ходу»: одно служебное состояние на метку, устаревшие вычищаются */
const ONCE = "once_mark";

export function usedThisTurn(state: CombatState, c: Combatant, marker: string): boolean {
  return c.conditions.some((x) => x.type === ONCE && x.source === `${turnKey(state)}|${marker}`);
}

export function markTurn(state: CombatState, c: Combatant, marker: string): void {
  const key = turnKey(state);
  c.conditions = [
    ...c.conditions.filter((x) => x.type !== ONCE || (x.source ?? "").startsWith(`${key}|`)),
    { type: ONCE, source: `${key}|${marker}` },
  ];
  state.mark(c.id);
}

/** Проверяет и сразу ставит метку: true — в этом ходу ещё не было */
export function onceThisTurn(state: CombatState, c: Combatant, marker: string): boolean {
  if (usedThisTurn(state, c, marker)) return false;
  markTurn(state, c, marker);
  return true;
}

export function removeConditions(state: CombatState, c: Combatant, ...types: string[]): void {
  if (!c.conditions.some((x) => types.includes(x.type))) return;
  c.conditions = c.conditions.filter((x) => !types.includes(x.type));
  state.mark(c.id);
}

/** Умение готово сработать само: есть заряды, боец дееспособен, свободна реакция (если она нужна) */
export function featureReady(c: Combatant, key: string, opts: { reaction?: boolean; pool?: string } = {}): CombatAbility | null {
  const ability = abilityByKey(c, key);
  if (!ability || !alive(c) || !canAct(c)) return null;
  if (opts.reaction && c.reactionUsed) return null;
  if (ability.usesMax > 0 && ability.usesUsed >= ability.usesMax) return null;
  if (opts.pool && poolLeft(c, opts.pool) < 1) return null;
  return ability;
}

/** Лучшая атака оружием нужного вида (без заклинательных и служебных) */
export function weaponOf(c: Combatant, kind?: "melee" | "ranged"): Attack | undefined {
  return c.attacks
    .filter((a) => a.kind !== "spell" && !a.usesSpellAttack && !a.id.startsWith("__") && (!kind || a.kind === kind))
    .sort((a, b) => b.attackBonus - a.attackBonus)[0];
}

/** Атака оружием в рамках умения: без оплаты действия, с обычными бросками и срабатываниями */
export function strike(state: CombatState, c: Combatant, target: Combatant, attack: Attack): CastResult["targets"][number] & { text: string } {
  const res = performAttack(state, c.id, target.id, attack.id, { skipTurnCheck: true, skipCost: true });
  return { name: target.name, hit: res.hit, amount: res.damage, text: res.hit ? `${target.name}: ${res.damage} ур.` : `${target.name}: промах` };
}

/** Атака оружием, которого нет в списке атак бойца (шипы доспеха): добавляется на время удара */
export function strikeWith(state: CombatState, c: Combatant, target: Combatant, attack: Attack) {
  c.attacks = [...c.attacks, attack];
  try {
    return strike(state, c, target, attack);
  } finally {
    c.attacks = c.attacks.filter((a) => a.id !== attack.id);
  }
}

export function inReach(state: CombatState, c: Combatant, target: Combatant, attack: Attack): boolean {
  return checkReach(c, target, attack, state.mapElements).ok;
}

/** Спасбросок цели с записью в журнал; true — спасбросок успешен */
export function saves(state: CombatState, target: Combatant, ability: AbilityKey, dc: number, label: string): boolean {
  const save = rollEffectSave(state, target, ability, dc, false, label);
  state.addLog(`${target.name}: ${save.text} против «${label}»`, "save", target.name);
  return save.success;
}

export const result = (text: string, targets: CastResult["targets"] = []): CastResult => ({ text, targets });

// ============ ОПИСАНИЕ КЛАССА ============

export interface HitCtx {
  state: CombatState;
  attacker: Combatant;
  target: Combatant;
  attack: Attack;
  res: HitResolution;
  ability: CombatAbility;
  /** Прибавляет урон к попаданию; тип по умолчанию — как у оружия */
  add: (amount: number, type?: string, magical?: boolean) => void;
  /** Бросок костей умения («2d6»); при крите кости удваиваются */
  roll: (dice: string) => number;
  /** Спасбросок цели; true — успех */
  save: (ability: AbilityKey, dc: number, label: string) => boolean;
}

export interface RiderRule {
  /** К каким атакам относится (по умолчанию — оружием) */
  attacks?: AttackFilter;
  /** Только пока на атакующем это состояние («raging») */
  whileCondition?: string;
  /** Только в свой ход */
  ownTurn?: boolean;
  /** Не чаще раза за ход */
  oncePerTurn?: boolean;
  /** Срабатывает, только если умение заряжено кнопкой; заряд снимается при попадании */
  armed?: boolean;
  /** Тратит использование умения при срабатывании */
  spendUse?: boolean;
  /** Тратит реакцию */
  reaction?: boolean;
  when?: (ctx: HitCtx) => boolean;
  /** Применяется при попадании; возвращает текст для строки атаки */
  apply: (ctx: HitCtx) => string;
}

export interface StanceRule {
  /** Состояние, которое вешается на бойца */
  condition: string;
  /** Длительность в раундах (по умолчанию 10 — минута) */
  rounds?: number;
  /** Число состояния (бонус урона Ярости) */
  value?: (c: Combatant, ability: CombatAbility) => number;
  /** Состояние, без которого стойку не включить */
  requires?: string;
  /** Стойка обрывает концентрацию (Ярость) */
  breaksConcentration?: boolean;
  /** Текст в журнал */
  text?: (c: Combatant, ability: CombatAbility) => string;
}

export interface ActionCtx {
  state: CombatState;
  c: Combatant;
  ability: CombatAbility;
  params: ActionParameters;
  opts: FeatureOpts;
  /** Выбранная цель; бросает ошибку, если цели нет */
  target: (what?: string) => Combatant;
  /** СЛ умения из его параметров */
  dc: number;
  /** Оплата действия (вызывается после проверок, чтобы ошибка ничего не тратила) */
  pay: () => void;
}

export type ActionRule = (ctx: ActionCtx) => CastResult;

export interface DamageCtx {
  state: CombatState;
  /** Владелец умения */
  owner: Combatant;
  ability: CombatAbility;
  /** Кто получает урон */
  target: Combatant;
  attacker?: Combatant;
  amount: number;
  isAttack: boolean;
  damageType?: string;
}

export interface ReductionRule {
  /** Чей урон уменьшается: свой (self), союзника (ally) или любой из них (any) */
  by: "self" | "ally" | "any";
  /** Дальность до союзника в футах */
  range?: number;
  whileCondition?: string;
  /** Тратит реакцию (по умолчанию да) */
  reaction?: boolean;
  /** Тратит использование умения */
  spendUse?: boolean;
  when?: (ctx: DamageCtx) => boolean;
  /** На сколько уменьшить урон */
  reduce: (ctx: DamageCtx) => number;
  after?: (ctx: DamageCtx, cut: number) => void;
}

export interface SaveRerollRule {
  whileCondition?: string;
  /** Состояние-метка «уже использовано»; снимает его тот, кто знает, когда умение обновляется */
  marker: string;
}

type Trigger = (state: CombatState, c: Combatant, ability: CombatAbility) => void;

export interface ClassKit {
  id: string;
  stances?: Record<string, StanceRule>;
  actions?: Record<string, ActionRule>;
  riders?: Record<string, RiderRule>;
  reductions?: Record<string, ReductionRule>;
  /** Владелец умения получил урон */
  damaged?: Record<string, (ctx: DamageCtx) => void>;
  startTurn?: Record<string, Trigger>;
  /** Конец своего хода, до тиканья таймеров состояний */
  endTurn?: Record<string, Trigger>;
  battleStart?: Record<string, Trigger>;
  /** Владелец применил другую способность (usedKey — её ключ) */
  afterAbility?: Record<string, (state: CombatState, c: Combatant, ability: CombatAbility, usedKey: string) => void>;
  /** Владелец закончил атаку */
  afterAttack?: Record<string, (state: CombatState, c: Combatant, ability: CombatAbility, target: Combatant, attack: Attack) => void>;
  /** После броска атаки по владельцу, до урона: умение может превратить попадание в промах */
  defense?: Record<string, (ctx: { state: CombatState; owner: Combatant; ability: CombatAbility; attacker: Combatant; attack: Attack; res: import("./rules").AttackResolution }) => void>;
  onDrop?: Record<string, (state: CombatState, c: Combatant, ability: CombatAbility, hpBefore: number, amount: number) => boolean>;
  saveRerolls?: Record<string, SaveRerollRule>;
  /** У владельца умения началось состояние-стойка */
  conditionStart?: Record<string, { condition: string; run: (state: CombatState, c: Combatant, ability: CombatAbility, opts: FeatureOpts) => string | void }>;
  /** У владельца умения закончилось состояние-стойка */
  conditionEnd?: Record<string, { condition: string; run: Trigger }>;
  /** Состояния-стойки, которые снимаются, когда боец падает до 0 хитов */
  endsWhenDown?: string[];
}

const KITS: ClassKit[] = [];

/** Есть ли у ключа обработчик кнопки в каком-либо классе (для проверок полноты правил) */
export function kitHandles(key: string): boolean {
  return KITS.some((k) => k.stances?.[key] || k.actions?.[key] || k.riders?.[key]?.armed);
}

// ============ СТОЙКИ И ИХ ОКОНЧАНИЕ ============

/** Служебная отметка «стойка была включена»: по ней замечаем, что состояние закончилось */
const WATCH = "kit_watch";

function watch(c: Combatant, condition: string): void {
  if (c.conditions.some((x) => x.type === WATCH && x.source === condition)) return;
  c.conditions = [...c.conditions, { type: WATCH, source: condition }];
}

/** Запускает conditionStart у всех умений бойца; возвращает тексты для журнала */
export function fireConditionStart(state: CombatState, c: Combatant, condition: string, opts: FeatureOpts = {}): string[] {
  watch(c, condition);
  const texts: string[] = [];
  for (const kit of KITS) {
    for (const [key, rule] of Object.entries(kit.conditionStart ?? {})) {
      if (rule.condition !== condition) continue;
      const ability = abilityByKey(c, key);
      if (!ability) continue;
      const text = rule.run(state, c, ability, opts);
      if (text) texts.push(text);
    }
  }
  return texts;
}

/** Замечает закончившиеся стойки (таймер, потеря сознания, снятие) и запускает conditionEnd */
export function sweepStances(state: CombatState, c: Combatant): void {
  const marks = c.conditions.filter((x) => x.type === WATCH);
  if (marks.length === 0) return;
  for (const mark of marks) {
    const condition = mark.source ?? "";
    const down = c.hpCurrent <= 0 && KITS.some((k) => k.endsWhenDown?.includes(condition));
    if (down) c.conditions = c.conditions.filter((x) => x.type !== condition);
    if (hasCondition(c, condition)) continue;
    c.conditions = c.conditions.filter((x) => x !== mark);
    state.mark(c.id);
    for (const kit of KITS) {
      for (const [key, rule] of Object.entries(kit.conditionEnd ?? {})) {
        if (rule.condition !== condition) continue;
        const ability = abilityByKey(c, key);
        if (ability) rule.run(state, c, ability);
      }
    }
  }
}

function runStance(state: CombatState, c: Combatant, ability: CombatAbility, params: ActionParameters, rule: StanceRule, opts: FeatureOpts): CastResult {
  if (hasCondition(c, rule.condition)) throw new EngineError(`«${ability.name}» уже действует`);
  if (rule.requires && !hasCondition(c, rule.requires)) throw new EngineError(`«${ability.name}» сейчас недоступно`);
  payActionCost(state, c, params.actionCost);
  applyEffect(state, c.id, { condition: rule.condition, durationRounds: rule.rounds ?? 10, value: rule.value?.(c, ability) }, c.id);
  if (rule.breaksConcentration && c.concentration) {
    log(state, c, `${c.name}: концентрация на «${c.concentration.spellName}» прервана`, "system");
    dropConcentration(state, c.id);
  }
  const text = rule.text?.(c, ability) ?? `${c.name} применяет «${ability.name}»`;
  log(state, c, text);
  const extra = fireConditionStart(state, c, rule.condition, opts);
  state.mark(c.id);
  return result([text, ...extra].join(". "), [{ name: c.name, amount: 0 }]);
}

// ============ СБОРКА МОДУЛЯ ============

function ownedAbilities<T>(c: Combatant, table: Record<string, T> | undefined): Array<[string, T, CombatAbility]> {
  if (!table) return [];
  const out: Array<[string, T, CombatAbility]> = [];
  for (const ability of c.abilities ?? []) {
    const key = ability.parameters?.srdKey;
    if (key && key in table) out.push([key, table[key], ability]);
  }
  return out;
}

function addDamage(res: HitResolution, attack: Attack, amount: number, type?: string, magical?: boolean): void {
  if (amount <= 0) return;
  const weaponPart = res.damageParts[0];
  res.damage += amount;
  res.damageParts.push({
    amount,
    type: type ?? weaponPart?.type ?? attack.damage[0]?.type ?? "",
    magical: magical ?? weaponPart?.magical,
  });
}

export function registerKit(kit: ClassKit): void {
  const at = KITS.findIndex((k) => k.id === kit.id);
  if (at >= 0) KITS[at] = kit;
  else KITS.push(kit);

  const mod: ClassModule = {
    id: kit.id,

    useFeature(state, c, ability, params, opts) {
      const key = params.srdKey ?? "";
      const stance = kit.stances?.[key];
      const action = kit.actions?.[key];
      const rider = kit.riders?.[key]?.armed ? kit.riders[key] : undefined;
      if (!stance && !action && !rider) return null;

      let out: CastResult;
      if (stance) {
        out = runStance(state, c, ability, params, stance, opts);
      } else if (action) {
        out = action({
          state,
          c,
          ability,
          params,
          opts,
          dc: params.saveDC ?? dcBy(c, "CON"),
          pay: () => payActionCost(state, c, params.actionCost),
          target: (what) => {
            const t = opts.targetIds?.[0] ? state.get(opts.targetIds[0]) : undefined;
            if (!t) throw new EngineError(`Выберите цель для «${what ?? ability.name}»`);
            return t;
          },
        });
      } else {
        // Зарядка: умение сработает при ближайшем подходящем попадании в этом ходу
        if (rider!.whileCondition && !hasCondition(c, rider!.whileCondition)) throw new EngineError(`«${ability.name}» сейчас недоступно`);
        payActionCost(state, c, params.actionCost);
        armRider(c, key, opts.targetIds?.[0]);
        log(state, c, `${c.name} готовит «${ability.name}»: сработает при попадании в этом ходу`);
        state.mark(c.id);
        return result(`${c.name} готовит «${ability.name}». Тратится при попадании.`);
      }
      // Использования самого умения; общий запас (resourceCost) списывает движок
      if (!params.deferCost && ability.usesMax > 0) spendAbilityUse(c, ability);
      state.mark(c.id);
      return out;
    },

    hitRiders(state, attacker, target, attack, res) {
      let text = "";
      for (const [key, rule, ability] of ownedAbilities(attacker, kit.riders)) {
        if (!attackMatches(attacker, attack, rule.attacks ?? "weapon")) continue;
        if (rule.whileCondition && !hasCondition(attacker, rule.whileCondition)) continue;
        if (rule.ownTurn && !isOwnTurn(state, attacker)) continue;
        if (rule.armed && !armedRider(attacker, key)) continue;
        if (rule.oncePerTurn && usedThisTurn(state, attacker, key)) continue;
        if (rule.reaction && attacker.reactionUsed) continue;
        if (rule.spendUse && ability.usesMax > 0 && ability.usesUsed >= ability.usesMax) {
          if (rule.armed) disarmRider(attacker, key);
          continue;
        }
        const ctx: HitCtx = {
          state,
          attacker,
          target,
          attack,
          res,
          ability,
          add: (amount, type, magical) => addDamage(res, attack, amount, type, magical),
          roll: (dice) => rollDiceCrit(dice, res.crit),
          save: (ab, dc, label) => saves(state, target, ab, dc, label),
        };
        if (rule.when && !rule.when(ctx)) continue;
        if (rule.oncePerTurn) markTurn(state, attacker, key);
        if (rule.armed) disarmRider(attacker, key);
        if (rule.spendUse) spendAbilityUse(attacker, ability);
        if (rule.reaction) attacker.reactionUsed = true;
        text += rule.apply(ctx);
        state.mark(attacker.id);
      }
      return text;
    },

    reduceDamage(state, target, amount, opts) {
      if (!kit.reductions || amount <= 0) return amount;
      const attacker = opts.attackerId ? state.get(opts.attackerId) : undefined;
      let left = amount;
      for (const owner of state.combatants) {
        if (left <= 0) break;
        const self = owner.id === target.id;
        if (!self && !friendly(owner, target)) continue;
        for (const [key, rule, ability] of ownedAbilities(owner, kit.reductions)) {
          if (left <= 0) break;
          if (rule.by === "self" && !self) continue;
          if (rule.by === "ally" && self) continue;
          if (!self && distanceFt(owner, target) > (rule.range ?? 30)) continue;
          if (rule.whileCondition && !hasCondition(owner, rule.whileCondition)) continue;
          const needsReaction = rule.reaction !== false;
          if (!featureReady(owner, key, { reaction: needsReaction })) continue;
          const ctx: DamageCtx = { state, owner, ability, target, attacker, amount: left, isAttack: !!opts.isAttack, damageType: opts.damageType };
          if (rule.when && !rule.when(ctx)) continue;
          const cut = Math.min(left, Math.max(0, rule.reduce(ctx)));
          if (cut <= 0) continue;
          if (needsReaction) owner.reactionUsed = true;
          if (rule.spendUse) spendAbilityUse(owner, ability);
          log(state, owner, `🛡️ ${owner.name}: ${ability.name} — урон по ${target.name} уменьшен на ${cut} (${left} → ${left - cut})`);
          left -= cut;
          state.mark(owner.id);
          rule.after?.(ctx, cut);
        }
      }
      return left;
    },

    damaged(state, target, attacker, amount, opts) {
      for (const [, run, ability] of ownedAbilities(target, kit.damaged)) {
        run({ state, owner: target, ability, target, attacker, amount, isAttack: !!opts.isAttack, damageType: opts.damageType });
      }
    },

    defense(state, attacker, target, attack, res) {
      for (const [, run, ability] of ownedAbilities(target, kit.defense)) {
        if (res.hit) run({ state, owner: target, ability, attacker, attack, res });
      }
      return target;
    },

    onDrop(state, target, hpBefore, amount) {
      for (const [, run, ability] of ownedAbilities(target, kit.onDrop)) {
        if (run(state, target, ability, hpBefore, amount)) return true;
      }
      return false;
    },

    saveFailed(state, c, _ability, _dc, reroll): SaveResult | null {
      for (const [, rule, ability] of ownedAbilities(c, kit.saveRerolls)) {
        if (rule.whileCondition && !hasCondition(c, rule.whileCondition)) continue;
        if (hasCondition(c, rule.marker)) continue;
        c.conditions = [...c.conditions, { type: rule.marker }];
        state.mark(c.id);
        const again = reroll();
        return { ...again, text: `${again.text} (переброс: ${ability.name})` };
      }
      return null;
    },

    startTurn(state, c) {
      for (const [, run, ability] of ownedAbilities(c, kit.startTurn)) run(state, c, ability);
    },

    battleStart(state, c) {
      for (const [, run, ability] of ownedAbilities(c, kit.battleStart)) run(state, c, ability);
    },

    endTurn(state, c, phase) {
      if (phase === "before") {
        for (const [, run, ability] of ownedAbilities(c, kit.endTurn)) run(state, c, ability);
        return;
      }
      // Таймеры протикали: замечаем закончившиеся стойки у всех бойцов
      if (kit.conditionEnd || kit.endsWhenDown) for (const k of state.combatants) sweepStances(state, k);
    },

    afterAbility(state, c, srdKey) {
      if (!srdKey) return;
      for (const [, run, ability] of ownedAbilities(c, kit.afterAbility)) run(state, c, ability, srdKey);
    },

    afterAttack(state, attacker, target, attack) {
      if (!attack) return;
      for (const [, run, ability] of ownedAbilities(attacker, kit.afterAttack)) run(state, attacker, ability, target, attack);
    },
  };
  registerClassModule(mod);
}

/** Бросок костей без крита: «2d6» → число */
export const rollOf = (dice: string) => rollDice(dice).total;

export { abilityByKey, armRider, armedRider, disarmRider, poolLeft, spendPool, dealDamage, applyEffect };
