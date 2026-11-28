// Общие боевые обработчики расовых умений, переиспользуемые пакетными модулями рас.
// Пакетные модули рас импортируются рядом в combat-index.ts.

import { rollDice } from "@/lib/dnd/dice";
import { distanceFt } from "../grid";
import { computeReachable } from "../movement";
import { askReaction } from "../reactions";
import { canAct, checkReach, effectiveSpeed, hasCondition, hasNoReactions, type SaveResult } from "../rules";
import {
  EngineError,
  applyEffect,
  dealDamage,
  grantTempHp,
  heal,
  payActionCost,
  pushCombatantAway,
  spendAbilityUse,
  teleportCombatant,
  type CombatState,
} from "../engine";
import {
  abilityByKey,
  alive,
  alliesOf,
  dcBy,
  fireConditionStart,
  friendly,
  hostilesOf,
  log,
  modOf,
  removeConditions,
  result,
  rollOf,
  saves,
  strikeWith,
  usedThisTurn,
  type ActionCtx,
  type ActionRule,
  type HitCtx,
  type ReductionRule,
} from "../class-kit";
import { isHostile, type AbilityKey, type Attack, type CombatAbility, type Combatant, type CreatureSize } from "../types";
import type { EladrinSeason } from "./core-phb";

export const SIZE_ORDER: CreatureSize[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
export const sizeStepDiff = (target: Combatant, actor: Combatant) =>
  SIZE_ORDER.indexOf(target.size ?? "medium") - SIZE_ORDER.indexOf(actor.size ?? "medium");
export const sizeLarger = (a: Combatant, b: Combatant) => sizeStepDiff(a, b) > 0;

export function clearConditionBySource(state: CombatState, type: string, sourceId: string): void {
  for (const t of state.combatants) {
    if (!t.conditions.some((x) => x.type === type && x.source === sourceId)) continue;
    t.conditions = t.conditions.filter((x) => !(x.type === type && x.source === sourceId));
    state.mark(t.id);
  }
}

export function setFlySpeed(c: Combatant, flySpeed: number, prevType: string): void {
  const prevFly = c.speeds?.fly ?? 0;
  c.conditions = [
    ...c.conditions.filter((x) => x.type !== prevType),
    { type: prevType, value: prevFly },
  ];
  c.speeds = { ...(c.speeds ?? {}), fly: Math.max(prevFly, flySpeed) };
}

export function restoreFlySpeed(state: CombatState, c: Combatant, prevType: string): void {
  const prev = c.conditions.find((x) => x.type === prevType)?.value ?? 0;
  c.conditions = c.conditions.filter((x) => x.type !== prevType);
  if (prev > 0) {
    c.speeds = { ...(c.speeds ?? {}), fly: prev };
  } else if (c.speeds) {
    const rest = { ...c.speeds };
    delete rest.fly;
    c.speeds = rest;
  }
  state.mark(c.id);
}

export function teleportAction(rangeFt: number, label: string): ActionRule {
  return (ctx) => {
    const center = ctx.opts.center;
    if (!center) throw new EngineError("Выберите клетку для телепортации");
    teleportCombatant(ctx.state, ctx.c.id, center, rangeFt, { skipTurnCheck: true });
    ctx.pay();
    return result(`${ctx.c.name} телепортируется («${label}»)`);
  };
}

export const rabbitHopAction: ActionRule = (ctx) => {
  const { state, c } = ctx;
  if (effectiveSpeed(c) <= 0) throw new EngineError(`${c.name} не может прыгать (скорость 0)`);
  const center = ctx.opts.center;
  if (!center) throw new EngineError("Выберите клетку для прыжка");
  const maxFt = 5 * (c.profBonus || 2);
  teleportCombatant(state, c.id, center, maxFt, { skipTurnCheck: true });
  ctx.pay();
  return result(`${c.name} совершает «Кроличий прыжок» (до ${maxFt} фт)`);
};

export function clearRavenQueenBlessing(state: CombatState, c: Combatant): void {
  if (!hasCondition(c, "raven_queen_blessing")) return;
  c.conditions = c.conditions.filter((x) => x.type !== "raven_queen_blessing");
  state.mark(c.id);
}

export const shadarKaiBlessingAction: ActionRule = (ctx) => {
  const { state, c } = ctx;
  const center = ctx.opts.center;
  if (!center) throw new EngineError("Выберите клетку для телепортации");
  teleportCombatant(state, c.id, center, 30, { skipTurnCheck: true });
  ctx.pay();
  if ((c.level || 1) >= 3) {
    applyEffect(state, c.id, { condition: "raven_queen_blessing" }, c.id);
    log(state, c, `${c.name}: Благословение Королевы воронов — сопротивление всему урону до следующего хода`);
  }
  return result(`${c.name} телепортируется («Благословение Королевы воронов»)`);
};

export function eladrinFeyStepAction(
  seasonFn: (c: Combatant) => EladrinSeason | null,
  summerDamageFn: (c: Combatant) => number,
  dcAbilityFn: (c: Combatant, ctx: ActionCtx) => number
): ActionRule {
  return (ctx) => {
    const { state, c } = ctx;
    const center = ctx.opts.center;
    if (!center) throw new EngineError("Выберите клетку для телепортации");
    const season = (c.level || 1) >= 3 ? seasonFn(c) : null;
    const dc = dcAbilityFn(c, ctx);
    const origin = { x: c.x, y: c.y };

    const springTargetId = ctx.opts.targetIds?.[0];
    if (season === "vesna" && springTargetId && springTargetId !== c.id) {
      const allyTarget = state.get(springTargetId);
      if (!allyTarget || !friendly(c, allyTarget) || !alive(allyTarget)) {
        throw new EngineError("Весна: выберите согласного союзника");
      }
      if (distanceFt(c, allyTarget) > 5) throw new EngineError(`${allyTarget.name} дальше 5 фт`);
      teleportCombatant(state, allyTarget.id, center, 30, { skipTurnCheck: true });
      ctx.pay();
      log(state, c, `${c.name}: Фейский шаг (Весна) — переносит ${allyTarget.name}`);
      return result(`${c.name} телепортирует ${allyTarget.name}`);
    }

    const winterTarget =
      season === "zima"
        ? (ctx.opts.targetIds?.[0] ? state.get(ctx.opts.targetIds[0]) : undefined) ??
          hostilesOf(state, c, 5).sort((a, b) => distanceFt(origin, a) - distanceFt(origin, b))[0]
        : undefined;

    teleportCombatant(state, c.id, center, 30, { skipTurnCheck: true });
    ctx.pay();

    if (winterTarget && winterTarget.id !== c.id && isHostile(c.type, winterTarget.type) && alive(winterTarget) && distanceFt(origin, winterTarget) <= 5) {
      if (!saves(state, winterTarget, "WIS", dc, "Фейский шаг (Зима)")) {
        applyEffect(state, winterTarget.id, { condition: "frightened", durationRounds: 2 }, c.id);
      }
    } else if (season === "osen") {
      const picked = (ctx.opts.targetIds ?? [])
        .map((id) => state.get(id))
        .filter((t): t is Combatant => Boolean(t && alive(t) && isHostile(c.type, t.type) && distanceFt(c, t) <= 10));
      const foes = (picked.length > 0 ? picked : hostilesOf(state, c, 10)).slice(0, 2);
      for (const f of foes) {
        if (!saves(state, f, "WIS", dc, "Фейский шаг (Осень)")) {
          applyEffect(state, f.id, { condition: "charmed", durationRounds: 10 }, c.id);
        }
      }
    } else if (season === "leto") {
      const fireDmg = summerDamageFn(c);
      for (const f of hostilesOf(state, c, 5)) {
        dealDamage(state, f.id, fireDmg, { damageType: "fire", attackerId: c.id, source: c.id });
      }
    }

    return result(`${c.name} совершает «Фейский шаг»`);
  };
}

export function makeAasimarShroudAction(opts: { hostilesOnly?: boolean } = {}): ActionRule {
  return (ctx) => {
    const { state, c, ability } = ctx;
    ctx.pay();
    applyEffect(state, c.id, { condition: "aasimar_necrotic_shroud", durationRounds: 10 }, c.id);
    fireConditionStart(state, c, "aasimar_necrotic_shroud", ctx.opts);
    applyEffect(state, c.id, { condition: "aasimar_shroud_fear_aura", durationRounds: 2 }, c.id);
    fireConditionStart(state, c, "aasimar_shroud_fear_aura", ctx.opts);
    const dc = dcBy(c, "CHA");
    const nearby = state.combatants.filter(
      (t) =>
        t.id !== c.id &&
        alive(t) &&
        (!opts.hostilesOnly || isHostile(c.type, t.type)) &&
        distanceFt(c, t) <= 10 &&
        !hasCondition(t, "blinded")
    );
    const outcomes: Array<{ name: string; saved: boolean; amount: number }> = [];
    for (const t of nearby) {
      const saved = saves(state, t, "CHA", dc, ability.name, { condition: "frightened" });
      if (!saved) {
        applyEffect(state, t.id, { condition: "frightened" }, c.id);
      }
      outcomes.push({ name: t.name, saved, amount: 0 });
    }
    log(state, c, `${c.name}: Саван смерти (СЛ ${dc})`);
    return result(`${c.name} активирует «Саван смерти»`, outcomes);
  };
}

export function aasimarRadiantConsumptionEndTurn(
  state: CombatState,
  c: Combatant,
  dmg: number
): void {
  if (!hasCondition(c, "aasimar_radiant_consumption")) return;
  const targets = state.combatants.filter((t) => alive(t) && distanceFt(c, t) <= 10);
  for (const t of targets) {
    dealDamage(state, t.id, dmg, { damageType: "radiant", attackerId: c.id, source: c.id });
  }
  log(state, c, `${c.name}: Испускание сияния — ${dmg} урона излучением в радиусе 10 фт`);
}

export function aasimarExtraDamageRider(
  condition: string,
  damageType: "radiant" | "necrotic",
  label: string,
  bonusFn: (attacker: Combatant) => number
) {
  return {
    attacks: "any" as const,
    whileCondition: condition,
    ownTurn: true,
    oncePerTurn: true,
    apply: (ctx: HitCtx) => {
      const bonus = bonusFn(ctx.attacker);
      ctx.add(bonus, damageType, true);
      return `, ${label} +${bonus}`;
    },
  };
}

export const stoneEnduranceAction: ActionRule = () => {
  throw new EngineError("«Выносливость камня» срабатывает автоматически реакцией при получении урона");
};

export const stoneEnduranceReduction: ReductionRule = {
  by: "self",
  reaction: true,
  spendUse: true,
  reduce: (ctx) => rollOf("1d12") + modOf(ctx.owner, "CON"),
};

export function relentlessEnduranceOnDrop(
  state: CombatState,
  c: Combatant,
  ability: CombatAbility,
  hpBefore: number,
  amount: number
): boolean {
  if (amount - hpBefore >= c.hpMax) return false;
  if (ability.usesMax > 0 && ability.usesUsed >= ability.usesMax) return false;
  spendAbilityUse(c, ability);
  c.hpCurrent = 1;
  state.mark(c.id);
  log(state, c, `${c.name}: Непоколебимая стойкость — остаётся с 1 хитом`);
  return true;
}

export const nimbleDisengageAction: ActionRule = (ctx) => {
  ctx.pay();
  if (!hasCondition(ctx.c, "disengaging")) {
    ctx.c.conditions = [...ctx.c.conditions, { type: "disengaging", duration: 1 }];
  }
  ctx.state.mark(ctx.c.id);
  log(ctx.state, ctx.c, `${ctx.c.name}: Шустрый побег — Отход бонусным действием`);
  return result(`${ctx.c.name} совершает Отход («Шустрый побег»)`);
};

export function makeNimbleHideAction(attemptHideFn: (state: CombatState, id: string, opts: { skipTurnCheck?: boolean; skipCost?: boolean }) => { text: string }): ActionRule {
  return (ctx) => {
    const hideRes = attemptHideFn(ctx.state, ctx.c.id, { skipTurnCheck: true, skipCost: true });
    ctx.pay();
    return result(hideRes.text);
  };
}

export function clearHiddenStep(state: CombatState, c: Combatant): void {
  const hidden = c.conditions.find((x) => x.type === "invisible" && x.source === "firbolg_hidden_step");
  if (!hidden) return;
  c.conditions = c.conditions.filter((x) => x !== hidden);
  state.mark(c.id);
  log(state, c, `${c.name}: Незримая поступь заканчивается`, "system");
}

export const hiddenStepAction: ActionRule = (ctx) => {
  const { state, c } = ctx;
  ctx.pay();
  applyEffect(state, c.id, { condition: "invisible" }, "firbolg_hidden_step");
  log(state, c, `${c.name}: Незримая поступь — становится невидимым до начала следующего хода`);
  return result(`${c.name} становится невидимым («Незримая поступь»)`);
};

export function hiddenStepAfterAbility(
  state: CombatState,
  c: Combatant,
  usedKey: string,
  ownKey: string
): void {
  if (usedKey === ownKey) return;
  const used = c.abilities.find((a) => a.parameters?.srdKey === usedKey);
  if (used?.parameters?.saveType || (used?.parameters?.damage?.length ?? 0) > 0) {
    clearHiddenStep(state, c);
  }
}

export const felineAgilityStance = {
  condition: "feline_agility",
  rounds: 1,
  text: (c: Combatant) => `${c.name} удваивает скорость перемещения («Кошачье проворство»)`,
};

export function felineAgilityEndTurn(state: CombatState, c: Combatant, ability: CombatAbility): void {
  if (ability.usesUsed <= 0 || hasCondition(c, "feline_agility")) return;
  if (c.movementUsed === 0) {
    ability.usesUsed = 0;
    c.abilities = [...c.abilities];
    state.mark(c.id);
    log(state, c, `${c.name}: «Кошачье проворство» перезаряжено (0 фт движения за ход)`);
  }
}

export function naturalStrikeAction(
  ctx: ActionCtx,
  label: string,
  attack: Attack,
  guard?: () => void
) {
  guard?.();
  const target = ctx.target(label);
  if (!isHostile(ctx.c.type, target.type) || !alive(target)) {
    throw new EngineError("Выберите живого врага");
  }
  if (!checkReach(ctx.c, target, attack, ctx.state.mapElements).ok) {
    throw new EngineError(`${target.name} вне досягаемости`);
  }
  ctx.pay();
  const hit = strikeWith(ctx.state, ctx.c, target, attack);
  return result(`${label}: ${hit.text}`, [hit]);
}

export function hoovesAttackFor(c: Combatant, defaultDice = "1d4"): Attack {
  return (
    c.attacks.find((a) => a.id === "centaur_hooves") ?? {
      id: "centaur_hooves",
      name: "Копыта",
      kind: "melee",
      range: { normal: 5 },
      attackBonus: modOf(c, "STR") + (c.profBonus || 2),
      damage: [{ dice: defaultDice, mod: modOf(c, "STR"), type: "bludgeoning" }],
      actionCost: "bonus",
    }
  );
}

export function hornsAttackFor(c: Combatant): Attack {
  return (
    c.attacks.find((a) => a.id === "minotaur_horns") ?? {
      id: "minotaur_horns",
      name: "Рога",
      kind: "melee",
      range: { normal: 5 },
      attackBonus: modOf(c, "STR") + (c.profBonus || 2),
      damage: [{ dice: "1d6", mod: modOf(c, "STR"), type: "piercing" }],
      actionCost: "bonus",
    }
  );
}

export function longtoothBiteAttackFor(c: Combatant): Attack {
  return {
    id: "longtooth_bite",
    name: "Клыки длиннозуба",
    kind: "melee",
    range: { normal: 5 },
    attackBonus: modOf(c, "STR") + (c.profBonus || 2),
    damage: [{ dice: "1d6", mod: modOf(c, "STR"), type: "piercing" }],
    actionCost: "bonus",
  };
}

export function hungryJawsAction(
  ctx: ActionCtx,
  defaultDamageType: string,
  tempHpFn: (c: Combatant) => number
) {
  const target = ctx.target("Голодная пасть");
  if (!isHostile(ctx.c.type, target.type) || !alive(target)) {
    throw new EngineError("Выберите живого врага");
  }
  const bite: Attack = ctx.c.attacks.find((a) => a.id === "lizardfolk_bite") ?? {
    id: "lizardfolk_bite",
    name: "Укус",
    kind: "melee",
    range: { normal: 5 },
    attackBonus: modOf(ctx.c, "STR") + (ctx.c.profBonus || 2),
    damage: [{ dice: "1d6", mod: modOf(ctx.c, "STR"), type: defaultDamageType }],
    actionCost: "bonus",
  };
  if (!checkReach(ctx.c, target, bite, ctx.state.mapElements).ok) {
    throw new EngineError(`${target.name} вне досягаемости укуса`);
  }
  ctx.pay();
  const hit = strikeWith(ctx.state, ctx.c, target, bite);
  if (hit.hit && hit.amount > 0) {
    const temp = tempHpFn(ctx.c);
    grantTempHp(ctx.state, ctx.c.id, temp);
    log(ctx.state, ctx.c, `${ctx.c.name}: Голодная пасть даёт ${temp} временных хитов`);
  }
  return result(`Голодная пасть: ${hit.text}`, [{ name: target.name, hit: hit.hit, amount: hit.amount }]);
}

export function centaurChargeAction(ctx: ActionCtx, defaultHoovesDice = "1d4") {
  return naturalStrikeAction(ctx, "Разбег", hoovesAttackFor(ctx.c, defaultHoovesDice), () => {
    if (ctx.c.movementUsed < 30 || !usedThisTurn(ctx.state, ctx.c, "centaur_charge_hit")) {
      throw new EngineError("«Разбег» требует переместиться на 30+ фт и попасть рукопашной атакой в этом ходу");
    }
  });
}

export const minotaurGoringRushAction: ActionRule = (ctx) =>
  naturalStrikeAction(ctx, "Пронзающий натиск", hornsAttackFor(ctx.c), () => {
    if (!hasCondition(ctx.c, "dashing") || ctx.c.movementUsed < 20) {
      throw new EngineError("«Пронзающий натиск» требует Рывка и перемещения минимум на 20 фт");
    }
  });

export const minotaurHammeringHornsAction: ActionRule = (ctx) => {
  const { state, c, ability } = ctx;
  if (!usedThisTurn(state, c, "minotaur_melee_hit")) {
    throw new EngineError("«Сокрушительные рога» применяются после попадания рукопашной атакой в этом ходу");
  }
  const target = ctx.target("Сокрушительные рога");
  if (!isHostile(c.type, target.type) || !alive(target)) {
    throw new EngineError("Выберите живого врага");
  }
  if (distanceFt(c, target) > 5) throw new EngineError(`${target.name} дальше 5 фт`);
  if (sizeStepDiff(target, c) > 1) {
    throw new EngineError(`${target.name} слишком велик для отталкивания рогами`);
  }
  ctx.pay();
  const dc = dcBy(c, "STR");
  const saved = saves(state, target, "STR", dc, ability.name);
  if (!saved) {
    pushCombatantAway(state, target, { x: c.x, y: c.y }, 2);
  }
  log(state, c, `${c.name}: Сокрушительные рога против ${target.name} (СЛ ${dc}) — ${saved ? "устоял" : "оттолкнут на 10 фт"}`);
  return result(`Сокрушительные рога: ${saved ? "цель устояла" : `${target.name} оттолкнут на 10 фт`}`, [
    { name: target.name, saved, amount: 0 },
  ]);
};

export const tortleShellDefenseAction: ActionRule = (ctx) => {
  const { state, c } = ctx;
  if (hasCondition(c, "tortle_shell")) {
    payActionCost(state, c, "bonus");
    removeConditions(state, c, "tortle_shell");
    log(state, c, `${c.name}: выходит из панциря`);
    return result(`${c.name} выходит из панциря`);
  }
  ctx.pay();
  applyEffect(state, c.id, { condition: "tortle_shell" }, c.id);
  fireConditionStart(state, c, "tortle_shell", ctx.opts);
  log(state, c, `${c.name}: Панцирная защита (+4 к КД, преимущество на спас СИЛ/ТЕЛ, скорость 0)`);
  return result(`${c.name} прячется в панцирь («Панцирная защита»)`);
};

export function dexSaveRescueFailed(
  state: CombatState,
  c: Combatant,
  ability: AbilityKey,
  dc: number,
  failedSave: SaveResult,
  srdKey: string,
  label: string
): SaveResult | null {
  if (
    ability !== "DEX" ||
    c.reactionUsed ||
    hasNoReactions(c) ||
    !alive(c) ||
    !canAct(c) ||
    hasCondition(c, "prone") ||
    effectiveSpeed(c) <= 0 ||
    failedSave.roll.total + 4 < dc ||
    !abilityByKey(c, srdKey)
  ) {
    return null;
  }
  c.reactionUsed = true;
  const bonus = rollDice("1d4").total;
  const nextTotal = failedSave.roll.total + bonus;
  const success = nextTotal >= dc;
  state.mark(c.id);
  log(state, c, `${c.name}: ${label} — +${bonus} к спасброску ЛОВ (${nextTotal} против СЛ ${dc})`);
  return {
    ...failedSave,
    success,
    roll: {
      ...failedSave.roll,
      modifier: failedSave.roll.modifier + bonus,
      total: nextTotal,
    },
    text: `${nextTotal} vs DC ${dc} (${success ? "Успех" : "Провал"}, ${label} +${bonus})`,
  };
}

export function allyCountSaveRescueFailed(
  state: CombatState,
  c: Combatant,
  dc: number,
  failedSave: SaveResult,
  srdKey: string,
  maxCap: number,
  label: string
): SaveResult | null {
  const ability = abilityByKey(c, srdKey);
  if (!ability || (ability.usesMax > 0 && ability.usesUsed >= ability.usesMax)) return null;
  const alliesCount = alliesOf(state, c, 30).filter((a) => canAct(a)).length;
  const bonus = Math.min(maxCap, alliesCount);
  if (bonus <= 0 || failedSave.roll.total + bonus < dc) return null;

  spendAbilityUse(c, ability);
  state.mark(c.id);
  const nextRoll = {
    ...failedSave.roll,
    modifier: failedSave.roll.modifier + bonus,
    total: failedSave.roll.total + bonus,
  };
  log(state, c, `${c.name}: ${label} — +${bonus} к спасброску (${nextRoll.total} против СЛ ${dc})`);
  return {
    ...failedSave,
    success: true,
    roll: nextRoll,
    text: `${nextRoll.total} vs DC ${dc} (Успех, ${label} +${bonus})`,
  };
}

export function runSwiftstrideEndTurn(state: CombatState, current: Combatant, srdKeys: string[]): void {
  for (const shifter of state.combatants) {
    if (shifter.id === current.id || !alive(shifter) || !canAct(shifter) || shifter.reactionUsed || hasNoReactions(shifter)) continue;
    if (!isHostile(shifter.type, current.type) || !hasCondition(shifter, "shifter_shifted")) continue;
    if (!srdKeys.some((k) => abilityByKey(shifter, k))) continue;
    if (distanceFt(shifter, current) > 5 || effectiveSpeed(shifter) <= 0) continue;

    const stepBudget = Math.min(10, effectiveSpeed(shifter));
    const reachable = computeReachable(
      { x: shifter.x, y: shifter.y },
      stepBudget,
      state.mapElements,
      state.combatants,
      state.gridWidth,
      state.gridHeight,
      shifter.id,
      shifter
    );
    let best: { x: number; y: number; dist: number; cost: number } | null = null;
    for (const [key, node] of reachable.entries()) {
      if (node.cost <= 0) continue;
      const [xs, ys] = key.split(",").map(Number);
      const d = distanceFt({ x: xs, y: ys }, current);
      if (!best || d > best.dist || (d === best.dist && node.cost < best.cost)) {
        best = { x: xs, y: ys, dist: d, cost: node.cost };
      }
    }
    if (!best) continue;

    const choice = askReaction(shifter, {
      title: "Использовать реакцию?",
      text: `${current.name} заканчивает ход в пределах 5 фт от ${shifter.name}.`,
      options: [{ id: "swiftstride_move", label: "Быстроног: отступить до 10 фт без провоцированных атак" }],
    });
    if (!choice) continue;

    shifter.reactionUsed = true;
    shifter.x = best.x;
    shifter.y = best.y;
    state.mark(shifter.id);
    log(state, shifter, `${shifter.name}: Быстроног — отходит на ${best.cost} фт без провоцированных атак`, "move");
  }
}
