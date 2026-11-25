// Боевая механика 20 legacy-рас (VGM / MTF / POA / TCE / VRGR):
// Аасимар, Багбир, Дампир, Фирболг, Гоблин, Голиаф, Хобгоблин, Кобольд, Людоящер, Орк, Табакси.

import { distanceFt } from "../grid";
import { computeReachable, findPath } from "../movement";
import { canAct, checkReach, effectiveSpeed, hasCondition } from "../rules";
import {
  EngineError,
  applyEffect,
  attemptHide,
  dealDamage,
  grantTempHp,
  heal,
  isUndeadOrConstruct,
  moveCombatant,
  performAttack,
  spendAbilityUse,
  type CombatState,
} from "../engine";
import { registerClassModule } from "../class-hooks";
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
  registerKit,
  removeConditions,
  result,
  rollOf,
  saves,
  type ActionCtx,
  type StanceRule,
} from "../class-kit";
import { isHostile, type Combatant, type CreatureSize } from "../types";
import { AASIMAR_FORMS } from "./legacy-volo-mtf";

const SIZE_ORDER: CreatureSize[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const sizeLarger = (a: Combatant, b: Combatant) =>
  SIZE_ORDER.indexOf(a.size ?? "medium") > SIZE_ORDER.indexOf(b.size ?? "medium");

function setFlySpeed(c: Combatant, flySpeed: number, prevType: string): void {
  const prevFly = c.speeds?.fly ?? 0;
  c.conditions = [
    ...c.conditions.filter((x) => x.type !== prevType),
    { type: prevType, value: prevFly },
  ];
  c.speeds = { ...(c.speeds ?? {}), fly: Math.max(prevFly, flySpeed) };
}

function restoreFlySpeed(state: CombatState, c: Combatant, prevType: string): void {
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

const aasimarStances: Record<string, StanceRule> = {};
for (const f of AASIMAR_FORMS) {
  if (f.save) continue; // Саван смерти имеет AoE-спасбросок в actions
  aasimarStances[`race/${f.subraceId}/${f.traitId}`] = {
    condition: f.condition,
    rounds: 10,
    text: (c) => `${c.name} активирует «${f.label}»`,
  };
}

const aasimarRiders = Object.fromEntries(
  AASIMAR_FORMS.map((f) => [
    `race/${f.subraceId}/${f.traitId}`,
    {
      attacks: "any" as const,
      whileCondition: f.condition,
      ownTurn: true,
      oncePerTurn: true,
      apply: (ctx: Parameters<NonNullable<import("../class-kit").RiderRule["apply"]>>[0]) => {
        const bonus = Math.max(1, ctx.attacker.level || 1);
        ctx.add(bonus, f.damageType, true);
        return `, ${f.label} +${bonus}`;
      },
    },
  ])
);

function findAggressiveStep(state: CombatState, c: Combatant, foe: Combatant, maxFt: number): { x: number; y: number } {
  const startDist = distanceFt(c, foe);
  if (startDist <= 5) {
    throw new EngineError(`${c.name} уже вплотную к ${foe.name}`);
  }
  const reachable = computeReachable(
    { x: c.x, y: c.y },
    maxFt,
    state.mapElements,
    state.combatants,
    state.gridWidth,
    state.gridHeight,
    c.id,
    c
  );
  let best: { x: number; y: number; dist: number; cost: number } | null = null;
  for (const [key, node] of reachable.entries()) {
    if (node.cost <= 0) continue;
    const [xs, ys] = key.split(",").map(Number);
    const cell = { x: xs, y: ys };
    const d = distanceFt(cell, foe);
    if (d >= startDist) continue;
    if (!best || d < best.dist || (d === best.dist && node.cost < best.cost)) {
      best = { x: xs, y: ys, dist: d, cost: node.cost };
    }
  }
  if (!best) {
    throw new EngineError(`Не удаётся приблизиться к ${foe.name}`);
  }
  return { x: best.x, y: best.y };
}

function clearHiddenStep(state: CombatState, c: Combatant): void {
  const hidden = c.conditions.find((x) => x.type === "invisible" && x.source === "firbolg_hidden_step");
  if (!hidden) return;
  c.conditions = c.conditions.filter((x) => x !== hidden);
  state.mark(c.id);
  log(state, c, `${c.name}: Незримая поступь заканчивается`, "system");
}

function clearCowerTargets(state: CombatState, kobold: Combatant): void {
  for (const t of state.combatants) {
    if (!t.conditions.some((x) => x.type === "kobold_cower" && x.source === kobold.id)) continue;
    t.conditions = t.conditions.filter((x) => !(x.type === "kobold_cower" && x.source === kobold.id));
    state.mark(t.id);
  }
}

function clearShroudFearTargets(state: CombatState, aasimar: Combatant): void {
  for (const t of state.combatants) {
    if (!t.conditions.some((x) => x.type === "frightened" && x.source === aasimar.id)) continue;
    t.conditions = t.conditions.filter((x) => !(x.type === "frightened" && x.source === aasimar.id));
    state.mark(t.id);
  }
}

registerKit({
  id: "races-volo-mtf",

  stances: {
    ...aasimarStances,
    "race/tabaxi/koshache-provorstvo": {
      condition: "feline_agility",
      rounds: 1,
      text: (c) => `${c.name} удваивает скорость перемещения («Кошачье проворство»)`,
    },
  },

  endsWhenDown: [
    ...AASIMAR_FORMS.map((f) => f.condition),
    "aasimar_shroud_fear_aura",
    "kobold_cower_aura",
    "feline_agility",
  ],

  conditionStart: {
    "race/protector-aasimar/siyayushchaya-dusha": {
      condition: "aasimar_radiant_soul",
      run: (_state, c) => setFlySpeed(c, 30, "aasimar_fly_prev"),
    },
  },

  conditionEnd: {
    "race/protector-aasimar/siyayushchaya-dusha": {
      condition: "aasimar_radiant_soul",
      run: (state, c) => restoreFlySpeed(state, c, "aasimar_fly_prev"),
    },
    "race/fallen-aasimar/savan-smerti": {
      condition: "aasimar_shroud_fear_aura",
      run: (state, c) => clearShroudFearTargets(state, c),
    },
    "race/kobold/sklonis-sezhsya-i-umolyay": {
      condition: "kobold_cower_aura",
      run: (state, c) => clearCowerTargets(state, c),
    },
  },

  startTurn: {
    "race/firbolg/nezrimaya-postup": (state, c) => clearHiddenStep(state, c),
  },

  endTurn: {
    // Аасимар-каратель: в конце своего хода наносит ceil(level/2) урона излучением всем в 10 фт (включая себя)
    "race/scourge-aasimar/ispuskanie-siyaniya": (state, c) => {
      if (!hasCondition(c, "aasimar_radiant_consumption")) return;
      const dmg = Math.ceil((c.level || 1) / 2);
      const targets = state.combatants.filter((t) => alive(t) && distanceFt(c, t) <= 10);
      for (const t of targets) {
        dealDamage(state, t.id, dmg, { damageType: "radiant", attackerId: c.id, source: c.id });
      }
      log(state, c, `${c.name}: Испускание сияния — ${dmg} урона излучением в радиусе 10 фт`);
    },

    // Табакси: перезарядка Кошачьего проворства, если за ход перемещение составило 0 фт
    "race/tabaxi/koshache-provorstvo": (state, c, ability) => {
      if (ability.usesUsed <= 0 || hasCondition(c, "feline_agility")) return;
      if (c.movementUsed === 0) {
        ability.usesUsed = 0;
        c.abilities = [...c.abilities];
        state.mark(c.id);
        log(state, c, `${c.name}: «Кошачье проворство» перезаряжено (0 фт движения за ход)`);
      }
    },
  },

  afterAbility: {
    "race/firbolg/nezrimaya-postup": (state, c, _ability, usedKey) => {
      if (usedKey === "race/firbolg/nezrimaya-postup") return;
      const used = c.abilities.find((a) => a.parameters?.srdKey === usedKey);
      if (used?.parameters?.saveType || (used?.parameters?.damage?.length ?? 0) > 0) {
        clearHiddenStep(state, c);
      }
    },
  },

  afterAttack: {
    "race/firbolg/nezrimaya-postup": (state, c) => clearHiddenStep(state, c),
    "race/dhampir/ukus-vampira": (state, c) => {
      const cond = c.conditions.find((x) => x.type === "dhampir_bite_bonus");
      if (!cond) return;
      if (cond.source === "fresh") {
        c.conditions = c.conditions.map((x) => (x === cond ? { ...x, source: "ready" } : x));
      } else {
        removeConditions(state, c, "dhampir_bite_bonus");
      }
      state.mark(c.id);
    },
  },

  actions: {
    // Аасимар: Исцеляющие руки
    "race/aasimar/istselyayushchie-ruki": (ctx: ActionCtx) => {
      const target = ctx.opts.targetIds?.[0] ? ctx.state.require(ctx.opts.targetIds[0]) : ctx.c;
      if (!friendly(ctx.c, target) || !alive(target)) {
        throw new EngineError("Выберите живого союзника или себя");
      }
      if (distanceFt(ctx.c, target) > 5) throw new EngineError(`${target.name} дальше 5 фт`);
      ctx.pay();
      const amount = Math.max(1, ctx.c.level || 1);
      heal(ctx.state, target.id, amount);
      log(ctx.state, ctx.c, `${ctx.c.name}: Исцеляющие руки — ${target.name} восстанавливает ${amount} хитов`);
      return result(`${target.name} восстанавливает ${amount} хитов`, [{ name: target.name, amount }]);
    },

    // Падший аасимар: Саван смерти
    "race/fallen-aasimar/savan-smerti": (ctx: ActionCtx) => {
      const { state, c, ability } = ctx;
      ctx.pay();
      applyEffect(state, c.id, { condition: "aasimar_necrotic_shroud", durationRounds: 10 }, c.id);
      fireConditionStart(state, c, "aasimar_necrotic_shroud", ctx.opts);
      applyEffect(state, c.id, { condition: "aasimar_shroud_fear_aura", durationRounds: 2 }, c.id);
      fireConditionStart(state, c, "aasimar_shroud_fear_aura", ctx.opts);
      const dc = dcBy(c, "CHA");
      const nearby = state.combatants.filter(
        (t) => t.id !== c.id && alive(t) && distanceFt(c, t) <= 10 && !hasCondition(t, "blinded")
      );
      const outcomes: Array<{ name: string; saved: boolean; amount: number }> = [];
      for (const t of nearby) {
        const saved = saves(state, t, "CHA", dc, ability.name);
        if (!saved) {
          applyEffect(state, t.id, { condition: "frightened" }, c.id);
        }
        outcomes.push({ name: t.name, saved, amount: 0 });
      }
      log(state, c, `${c.name}: Саван смерти (СЛ ${dc})`);
      return result(`${c.name} активирует «Саван смерти»`, outcomes);
    },

    // Фирболг: Незримая поступь
    "race/firbolg/nezrimaya-postup": (ctx: ActionCtx) => {
      const { state, c } = ctx;
      ctx.pay();
      applyEffect(state, c.id, { condition: "invisible" }, "firbolg_hidden_step");
      log(state, c, `${c.name}: Незримая поступь — становится невидимым до начала следующего хода`);
      return result(`${c.name} становится невидимым («Незримая поступь»)`);
    },

    // Гоблин: Шустрый побег (Отход и Засада)
    "race/goblin/nimble-disengage": (ctx: ActionCtx) => {
      ctx.pay();
      if (!hasCondition(ctx.c, "disengaging")) {
        ctx.c.conditions = [...ctx.c.conditions, { type: "disengaging", duration: 1 }];
      }
      ctx.state.mark(ctx.c.id);
      log(ctx.state, ctx.c, `${ctx.c.name}: Шустрый побег — Отход бонусным действием`);
      return result(`${ctx.c.name} совершает Отход («Шустрый побег»)`);
    },
    "race/goblin/nimble-hide": (ctx: ActionCtx) => {
      const hideRes = attemptHide(ctx.state, ctx.c.id, { skipTurnCheck: true, skipCost: true });
      ctx.pay();
      return result(hideRes.text);
    },

    // Голиаф: Выносливость камня (ручной клик напоминает о срабатывании реакцией)
    "race/goliath/vynoslivost-kamnya": () => {
      throw new EngineError("«Выносливость камня» срабатывает автоматически реакцией при получении урона");
    },

    // Кобольд: Склонись, съёжься и умоляй
    "race/kobold/sklonis-sezhsya-i-umolyay": (ctx: ActionCtx) => {
      const { state, c } = ctx;
      ctx.pay();
      applyEffect(state, c.id, { condition: "kobold_cower_aura", durationRounds: 2 }, c.id);
      fireConditionStart(state, c, "kobold_cower_aura", ctx.opts);
      const foes = hostilesOf(state, c, 10).filter((t) => !hasCondition(t, "blinded"));
      for (const f of foes) {
        applyEffect(state, f.id, { condition: "kobold_cower" }, c.id);
      }
      log(state, c, `${c.name}: Склонись, съёжься и умоляй — союзники получают преимущество по ${foes.map((f) => f.name).join(", ") || "врагам рядом"}`);
      return result(
        `${c.name} отвлекает врагов в 10 фт («Склонись, съёжься и умоляй»)`,
        foes.map((f) => ({ name: f.name, amount: 0 }))
      );
    },

    // Людоящер: Голодная пасть
    "race/lizardfolk/golodnaya-past": (ctx: ActionCtx) => {
      const target = ctx.target("Голодная пасть");
      if (!isHostile(ctx.c.type, target.type) || !alive(target)) {
        throw new EngineError("Выберите живого врага");
      }
      const bite = ctx.c.attacks.find((a) => a.id === "lizardfolk_bite") ?? {
        id: "lizardfolk_bite",
        name: "Укус",
        kind: "melee" as const,
        range: { normal: 5 },
        attackBonus: modOf(ctx.c, "STR") + (ctx.c.profBonus || 2),
        damage: [{ dice: "1d6", mod: modOf(ctx.c, "STR"), type: "piercing" }],
        actionCost: "bonus" as const,
      };
      if (!checkReach(ctx.c, target, bite, ctx.state.mapElements).ok) {
        throw new EngineError(`${target.name} вне досягаемости укуса`);
      }
      const hadAttack = ctx.c.attacks.some((a) => a.id === bite.id);
      if (!hadAttack) ctx.c.attacks = [...ctx.c.attacks, bite];
      try {
        ctx.pay();
        const hit = performAttack(ctx.state, ctx.c.id, target.id, bite.id, {
          skipTurnCheck: true,
          skipCost: true,
        });
        if (hit.hit && hit.damage > 0) {
          const temp = Math.max(1, modOf(ctx.c, "CON"));
          grantTempHp(ctx.state, ctx.c.id, temp);
          log(ctx.state, ctx.c, `${ctx.c.name}: Голодная пасть даёт ${temp} временных хитов`);
        }
        return result(`Голодная пасть: ${hit.text}`, [{ name: target.name, hit: hit.hit, amount: hit.damage }]);
      } finally {
        if (!hadAttack) ctx.c.attacks = ctx.c.attacks.filter((a) => a.id !== bite.id);
      }
    },

    // Орк: Агрессивный (перемещение к врагу через moveCombatant с учётом провокаций, трудной местности и зон)
    "race/orc/agressivnyy": (ctx: ActionCtx) => {
      const { state, c } = ctx;
      const maxFt = effectiveSpeed(c);
      if (maxFt <= 0) throw new EngineError(`${c.name} не может двигаться`);
      const picked = ctx.opts.targetIds?.[0] ? state.get(ctx.opts.targetIds[0]) : undefined;
      const foe =
        picked && alive(picked) && isHostile(c.type, picked.type)
          ? picked
          : hostilesOf(state, c).sort((a, b) => distanceFt(c, a) - distanceFt(c, b))[0];
      if (!foe) throw new EngineError("Нет врагов для сближения");

      let dest: { x: number; y: number };
      if (ctx.opts.center) {
        if (distanceFt(ctx.opts.center, foe) >= distanceFt(c, foe)) {
          throw new EngineError("Перемещение «Агрессивного» должно заканчиваться ближе к врагу");
        }
        const path = findPath(c, ctx.opts.center, maxFt, state.mapElements, state.combatants, state.gridWidth, state.gridHeight);
        if (!path.ok) throw new EngineError(path.reason ?? "Путь недоступен");
        dest = ctx.opts.center;
      } else {
        dest = findAggressiveStep(state, c, foe, maxFt);
      }

      ctx.pay();
      const moveRes = moveCombatant(state, c.id, dest, {
        skipTurnCheck: true,
        freeMove: true,
        budgetFt: maxFt,
      });
      log(state, c, `${c.name}: Агрессивный — устремляется к ${foe.name} (${moveRes.costFt} фт)`, "move");
      return result(`${c.name} устремляется к ${foe.name}`, [{ name: foe.name, amount: 0 }]);
    },
  },

  riders: {
    ...aasimarRiders,

    // Багбир: Внезапное нападение (+2к6 1/бой в 1 раунде по цели, которая ещё не ходила или врасплох)
    "race/bugbear/vnezapnoe-napadenie": {
      attacks: "any",
      ownTurn: true,
      when: (ctx) =>
        ctx.state.round === 1 &&
        !hasCondition(ctx.attacker, "once_bugbear_surprise") &&
        (!ctx.target.hasActed || hasCondition(ctx.target, "surprised")),
      apply: (ctx) => {
        ctx.attacker.conditions = [...ctx.attacker.conditions, { type: "once_bugbear_surprise" }];
        const extra = ctx.roll("2d6");
        ctx.add(extra);
        return `, Внезапное нападение +${extra}`;
      },
    },

    // Дампир: Укус вампира (усиление при попадании, не действует на Нежить и Конструктов; берёт только колющий урон укуса)
    "race/dhampir/ukus-vampira": {
      attacks: "melee",
      armed: true,
      spendUse: true,
      when: (ctx) => ctx.attack.id === "dhampir_bite" && !isUndeadOrConstruct(ctx.target),
      apply: (ctx) => {
        const amount = ctx.res.damageParts[0]?.amount ?? 0;
        if (amount <= 0) return "";
        if (ctx.attacker.hpCurrent < ctx.attacker.hpMax) {
          heal(ctx.state, ctx.attacker.id, amount);
          return `, Укус вампира: +${amount} хитов`;
        }
        ctx.attacker.conditions = [
          ...ctx.attacker.conditions.filter((x) => x.type !== "dhampir_bite_bonus"),
          { type: "dhampir_bite_bonus", value: amount, source: "fresh" },
        ];
        return `, Укус вампира: +${amount} к следующей атаке`;
      },
    },

    // Гоблин: Разъяренная мелкота (+уровень урона по цели крупнее себя)
    "race/goblin/razyarennaya-melkota": {
      attacks: "any",
      armed: true,
      spendUse: true,
      when: (ctx) => sizeLarger(ctx.target, ctx.attacker),
      apply: (ctx) => {
        const bonus = Math.max(1, ctx.attacker.level || 1);
        ctx.add(bonus);
        return `, Разъяренная мелкота +${bonus}`;
      },
    },
  },

  reductions: {
    // Голиаф: Выносливость камня (реакцией уменьшить урон на 1к12 + ТЕЛ)
    "race/goliath/vynoslivost-kamnya": {
      by: "self",
      reaction: true,
      spendUse: true,
      reduce: (ctx) => rollOf("1d12") + modOf(ctx.owner, "CON"),
    },
  },
});

// Хобгоблин: Сохранить лицо — при провале спасброска добавляет +min(5, союзников в 30 фт)
registerClassModule({
  id: "races-volo-mtf-saves",
  saveFailed(state, c, _ability, dc, _reroll, failedSave) {
    if (!failedSave || failedSave.success || failedSave.autoFail) return null;
    const ability = abilityByKey(c, "race/hobgoblin/sokhranit-litso");
    if (!ability || (ability.usesMax > 0 && ability.usesUsed >= ability.usesMax)) return null;
    const alliesCount = alliesOf(state, c, 30).filter((a) => canAct(a)).length;
    const bonus = Math.min(5, alliesCount);
    if (bonus <= 0) return null;
    if (failedSave.roll.total + bonus < dc) return null;

    spendAbilityUse(c, ability);
    state.mark(c.id);
    const nextRoll = {
      ...failedSave.roll,
      modifier: failedSave.roll.modifier + bonus,
      total: failedSave.roll.total + bonus,
    };
    log(state, c, `${c.name}: Сохранить лицо — +${bonus} к спасброску (${nextRoll.total} против СЛ ${dc})`);
    return {
      ...failedSave,
      success: true,
      roll: nextRoll,
      text: `${nextRoll.total} vs DC ${dc} (Успех, Сохранить лицо +${bonus})`,
    };
  },
});
