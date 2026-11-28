// Боевая механика 20 legacy-рас (VGM / MTF / POA / TCE / VRGR):
// Аасимар, Багбир, Дампир, Фирболг, Гоблин, Голиаф, Хобгоблин, Кобольд, Людоящер, Орк, Табакси.

import { distanceFt } from "../grid";
import { computeReachable, findPath } from "../movement";
import { effectiveSpeed, hasCondition } from "../rules";
import {
  EngineError,
  applyEffect,
  attemptHide,
  heal,
  isUndeadOrConstruct,
  moveCombatant,
  type CombatState,
} from "../engine";
import { registerClassModule } from "../class-hooks";
import {
  alive,
  fireConditionStart,
  friendly,
  hostilesOf,
  log,
  modOf,
  registerKit,
  removeConditions,
  result,
  type ActionCtx,
  type StanceRule,
} from "../class-kit";
import { isHostile, type Combatant } from "../types";
import { AASIMAR_FORMS } from "./legacy-volo-mtf";
import {
  aasimarExtraDamageRider,
  aasimarRadiantConsumptionEndTurn,
  allyCountSaveRescueFailed,
  clearConditionBySource,
  clearHiddenStep,
  felineAgilityEndTurn,
  felineAgilityStance,
  hiddenStepAction,
  hiddenStepAfterAbility,
  hungryJawsAction,
  makeAasimarShroudAction,
  makeNimbleHideAction,
  nimbleDisengageAction,
  restoreFlySpeed,
  setFlySpeed,
  sizeLarger,
  stoneEnduranceAction,
  stoneEnduranceReduction,
} from "./race-combat";

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
    aasimarExtraDamageRider(f.condition, f.damageType, f.label, (a) => Math.max(1, a.level || 1)),
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

registerKit({
  id: "races-volo-mtf",

  stances: {
    ...aasimarStances,
    "race/tabaxi/koshache-provorstvo": felineAgilityStance,
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
      run: (state, c) => clearConditionBySource(state, "frightened", c.id),
    },
    "race/kobold/sklonis-sezhsya-i-umolyay": {
      condition: "kobold_cower_aura",
      run: (state, c) => clearConditionBySource(state, "kobold_cower", c.id),
    },
  },

  startTurn: {
    "race/firbolg/nezrimaya-postup": clearHiddenStep,
  },

  endTurn: {
    // Аасимар-каратель: в конце своего хода наносит ceil(level/2) урона излучением всем в 10 фт (включая себя)
    "race/scourge-aasimar/ispuskanie-siyaniya": (state, c) =>
      aasimarRadiantConsumptionEndTurn(state, c, Math.ceil((c.level || 1) / 2)),

    // Табакси: перезарядка Кошачьего проворства, если за ход перемещение составило 0 фт
    "race/tabaxi/koshache-provorstvo": felineAgilityEndTurn,
  },

  afterAbility: {
    "race/firbolg/nezrimaya-postup": (state, c, _ability, usedKey) =>
      hiddenStepAfterAbility(state, c, usedKey, "race/firbolg/nezrimaya-postup"),
  },

  afterAttack: {
    "race/firbolg/nezrimaya-postup": clearHiddenStep,
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
    "race/fallen-aasimar/savan-smerti": makeAasimarShroudAction(),

    // Фирболг: Незримая поступь
    "race/firbolg/nezrimaya-postup": hiddenStepAction,

    // Гоблин: Шустрый побег (Отход и Засада)
    "race/goblin/nimble-disengage": nimbleDisengageAction,
    "race/goblin/nimble-hide": makeNimbleHideAction(attemptHide),

    // Голиаф: Выносливость камня (ручной клик напоминает о срабатывании реакцией)
    "race/goliath/vynoslivost-kamnya": stoneEnduranceAction,

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
    "race/lizardfolk/golodnaya-past": (ctx: ActionCtx) =>
      hungryJawsAction(ctx, "piercing", (c) => Math.max(1, modOf(c, "CON"))),

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
    "race/goliath/vynoslivost-kamnya": stoneEnduranceReduction,
  },
});

// Хобгоблин: Сохранить лицо — при провале спасброска добавляет +min(5, союзников в 30 фт)
registerClassModule({
  id: "races-volo-mtf-saves",
  saveFailed(state, c, _ability, dc, _reroll, failedSave) {
    if (!failedSave || failedSave.success || failedSave.autoFail) return null;
    return allyCountSaveRescueFailed(
      state,
      c,
      dc,
      failedSave,
      "race/hobgoblin/sokhranit-litso",
      5,
      "Сохранить лицо"
    );
  },
});
