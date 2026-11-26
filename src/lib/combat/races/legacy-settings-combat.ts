// Боевая механика 25 рас сеттингов и приключений (Автогном, Астральный эльф, Гибрид Симиков,
// Гифф, Грунг, Зайцегон, Кендер, Кентавр, Леонин, Минотавр, Тортл, Хадози, Шифтер).

import { rollDice } from "@/lib/dnd/dice";
import { distanceFt } from "../grid";
import { computeReachable } from "../movement";
import { askReaction } from "../reactions";
import { canAct, checkReach, effectiveSpeed, hasCondition, hasNoReactions } from "../rules";
import {
  EngineError,
  applyEffect,
  dealDamage,
  grantTempHp,
  payActionCost,
  pushCombatantAway,
  spendAbilityUse,
  teleportCombatant,
  type CombatState,
} from "../engine";
import { registerClassModule } from "../class-hooks";
import {
  abilityByKey,
  alive,
  dcBy,
  fireConditionStart,
  hostilesOf,
  isOwnTurn,
  log,
  markTurn,
  modOf,
  registerKit,
  removeConditions,
  result,
  rollOf,
  saves,
  strikeWith,
  usedThisTurn,
  type ActionCtx,
} from "../class-kit";
import { isHostile, type Attack, type Combatant, type CreatureSize } from "../types";

const SIZE_ORDER: CreatureSize[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const sizeStepDiff = (target: Combatant, actor: Combatant) =>
  SIZE_ORDER.indexOf(target.size ?? "medium") - SIZE_ORDER.indexOf(actor.size ?? "medium");

function clearConditionBySource(state: CombatState, type: string, sourceId: string): void {
  for (const t of state.combatants) {
    if (!t.conditions.some((x) => x.type === type && x.source === sourceId)) continue;
    t.conditions = t.conditions.filter((x) => !(x.type === type && x.source === sourceId));
    state.mark(t.id);
  }
}

function naturalStrikeAction(
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

function hoovesAttackFor(c: Combatant): Attack {
  return (
    c.attacks.find((a) => a.id === "centaur_hooves") ?? {
      id: "centaur_hooves",
      name: "Копыта",
      kind: "melee",
      range: { normal: 5 },
      attackBonus: modOf(c, "STR") + (c.profBonus || 2),
      damage: [{ dice: "1d4", mod: modOf(c, "STR"), type: "bludgeoning" }],
      actionCost: "bonus",
    }
  );
}

function hornsAttackFor(c: Combatant): Attack {
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

registerKit({
  id: "races-settings",

  stances: {
    "race/shifter/smena-formy": {
      condition: "shifter_shifted",
      rounds: 10,
      text: (c) => `${c.name} принимает звериный облик («Смена формы»)`,
    },
  },

  endsWhenDown: ["shifter_shifted", "leonin_roar_aura", "tortle_shell", "kender_taunt_aura"],

  conditionStart: {
    "race/shifter/smena-formy": {
      condition: "shifter_shifted",
      run: (state, c) => {
        const baseTemp = Math.max(1, (c.level || 1) + modOf(c, "CON"));
        const extraTemp = c.subraceId === "beasthide" ? rollOf("1d6") : 0;
        const total = baseTemp + extraTemp;
        grantTempHp(state, c.id, total);
        return `получает ${total} временных хитов`;
      },
    },
  },

  conditionEnd: {
    "race/leonin/ustrashayushchiy-rev": {
      condition: "leonin_roar_aura",
      run: (state, c) => clearConditionBySource(state, "frightened", c.id),
    },
    "race/kender/nasmeshka": {
      condition: "kender_taunt_aura",
      run: (state, c) => clearConditionBySource(state, "kender_taunted", c.id),
    },
  },

  startTurn: {
    "race/kender/nasmeshka": (state, c) => {
      removeConditions(state, c, "kender_taunt_aura");
      clearConditionBySource(state, "kender_taunted", c.id);
    },
  },

  actions: {
    // Астральный эльф: Звёздный шаг
    "race/astral-elf/zvezdnyy-shag": (ctx) => {
      const center = ctx.opts.center;
      if (!center) throw new EngineError("Выберите клетку для телепортации");
      teleportCombatant(ctx.state, ctx.c.id, center, 30, { skipTurnCheck: true });
      ctx.pay();
      return result(`${ctx.c.name} телепортируется («Звёздный шаг»)`);
    },

    // Гибрид Симиков: Кислотный плевок
    "race/simic-hybrid/acid-spit": (ctx) => {
      const { state, c, ability } = ctx;
      const target = ctx.target("Кислотный плевок");
      if (!isHostile(c.type, target.type) || !alive(target)) {
        throw new EngineError("Выберите живого врага");
      }
      if (distanceFt(c, target) > 30) throw new EngineError(`${target.name} дальше 30 фт`);
      ctx.pay();

      const dc = dcBy(c, "CON");
      const lvl = c.level || 1;
      const dice = lvl >= 17 ? "4d10" : lvl >= 11 ? "3d10" : "2d10";
      const saved = saves(state, target, "DEX", dc, ability.name);
      let dmg = 0;
      if (!saved) {
        dmg = rollOf(dice);
        dealDamage(state, target.id, dmg, { damageType: "acid", attackerId: c.id, source: c.id });
      }
      log(state, c, `${c.name}: Кислотный плевок по ${target.name} (СЛ ${dc}) — ${saved ? "уклонился" : `${dmg} урона кислотой`}`);
      return result(`Кислотный плевок: ${saved ? "цель уклонилась" : `${dmg} урона кислотой`}`, [
        { name: target.name, saved, amount: dmg },
      ]);
    },

    // Зайцегон: Кроличий прыжок (без провоцированных атак, если скорость > 0)
    "race/harengon/krolichiy-pryzhok": (ctx) => {
      const { state, c } = ctx;
      if (effectiveSpeed(c) <= 0) throw new EngineError(`${c.name} не может прыгать (скорость 0)`);
      const center = ctx.opts.center;
      if (!center) throw new EngineError("Выберите клетку для прыжка");
      const maxFt = 5 * (c.profBonus || 2);
      teleportCombatant(state, c.id, center, maxFt, { skipTurnCheck: true });
      ctx.pay();
      return result(`${c.name} совершает «Кроличий прыжок» (до ${maxFt} фт)`);
    },

    // Кендер: Насмешка
    "race/kender/nasmeshka": (ctx) => {
      const { state, c, ability } = ctx;
      const target = ctx.target("Насмешка");
      if (!isHostile(c.type, target.type) || !alive(target)) {
        throw new EngineError("Выберите живого врага");
      }
      if (distanceFt(c, target) > 60) throw new EngineError(`${target.name} дальше 60 фт`);
      if (hasCondition(target, "deafened")) throw new EngineError(`${target.name} оглушён и не слышит насмешку`);
      ctx.pay();

      const maxMental = Math.max(modOf(c, "INT"), modOf(c, "WIS"), modOf(c, "CHA"));
      const dc = 8 + (c.profBonus || 2) + maxMental;
      const saved = saves(state, target, "WIS", dc, ability.name);
      if (!saved) {
        applyEffect(state, target.id, { condition: "kender_taunted" }, c.id);
        applyEffect(state, c.id, { condition: "kender_taunt_aura" }, c.id);
        fireConditionStart(state, c, "kender_taunt_aura", ctx.opts);
      }
      log(state, c, `${c.name}: Насмешка на ${target.name} (СЛ ${dc}) — ${saved ? "устоял" : "спровоцирован"}`);
      return result(`Насмешка: ${saved ? `${target.name} устоял` : `${target.name} получает помеху по другим`}`, [
        { name: target.name, saved, amount: 0 },
      ]);
    },

    // Кентавр: Разбег (бонусная атака копытами после >= 30 фт движения и попадания рукопашной атакой)
    "race/centaur/razbeg": (ctx) =>
      naturalStrikeAction(ctx, "Разбег", hoovesAttackFor(ctx.c), () => {
        if (ctx.c.movementUsed < 30 || !usedThisTurn(ctx.state, ctx.c, "centaur_charge_hit")) {
          throw new EngineError("«Разбег» требует переместиться на 30+ фт и попасть рукопашной атакой в этом ходу");
        }
      }),

    // Леонин: Устрашающий рёв (AoE 10 фт, спас МУД до конца след. хода леонина)
    "race/leonin/ustrashayushchiy-rev": (ctx) => {
      const { state, c, ability } = ctx;
      ctx.pay();
      applyEffect(state, c.id, { condition: "leonin_roar_aura", durationRounds: 2 }, c.id);
      fireConditionStart(state, c, "leonin_roar_aura", ctx.opts);
      const dc = dcBy(c, "CON");
      const pickedIds = new Set(ctx.opts.targetIds ?? []);
      const targets = hostilesOf(state, c, 10).filter(
        (t) => !hasCondition(t, "deafened") && (pickedIds.size === 0 || pickedIds.has(t.id))
      );
      const outcomes: Array<{ name: string; saved: boolean; amount: number }> = [];
      for (const t of targets) {
        const saved = saves(state, t, "WIS", dc, ability.name, { condition: "frightened" });
        if (!saved) {
          applyEffect(state, t.id, { condition: "frightened" }, c.id);
        }
        outcomes.push({ name: t.name, saved, amount: 0 });
      }
      log(state, c, `${c.name}: Устрашающий рёв (СЛ ${dc})`);
      return result(`${c.name} издаёт «Устрашающий рёв»`, outcomes);
    },

    // Минотавр: Пронзающий натиск (бонусная атака рогами после Рывка и >= 20 фт движения)
    "race/minotaur/pronzayushchiy-natisk": (ctx) =>
      naturalStrikeAction(ctx, "Пронзающий натиск", hornsAttackFor(ctx.c), () => {
        if (!hasCondition(ctx.c, "dashing") || ctx.c.movementUsed < 20) {
          throw new EngineError("«Пронзающий натиск» требует Рывка и перемещения минимум на 20 фт");
        }
      }),

    // Минотавр: Сокрушительные рога (бонусное отталкивание на 10 фт после попадания рукопашной атакой)
    "race/minotaur/sokrushitelnye-roga": (ctx) => {
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
    },

    // Тортл: Панцирная защита (действие — спрятаться; бонусное действие — выйти)
    "race/tortle/pantsirnaya-zashchita": (ctx) => {
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
    },

    // Хадози: ручной клик напоминает о срабатывании реакцией
    "race/hadozee/vertkost-khadozi": () => {
      throw new EngineError("«Вёрткость хадози» срабатывает автоматически реакцией при получении урона");
    },

    // Шифтер-Длиннозуб: укус бонусным действием в изменённой форме
    "race/longtooth/osobennosti-smeny-formy": (ctx) =>
      naturalStrikeAction(
        ctx,
        "Укус длиннозуба",
        {
          id: "longtooth_bite",
          name: "Клыки длиннозуба",
          kind: "melee",
          range: { normal: 5 },
          attackBonus: modOf(ctx.c, "STR") + (ctx.c.profBonus || 2),
          damage: [{ dice: "1d6", mod: modOf(ctx.c, "STR"), type: "piercing" }],
          actionCost: "bonus",
        },
        () => {
          if (!hasCondition(ctx.c, "shifter_shifted")) {
            throw new EngineError("Укус длиннозуба доступен только во время «Смены формы»");
          }
        }
      ),
  },

  riders: {
    // Гифф: Астральная искра (+бонус мастерства силового урона 1/ход)
    "race/giff/astralnaya-iskra": {
      attacks: "weapon",
      armed: true,
      oncePerTurn: true,
      spendUse: true,
      apply: (ctx) => {
        const bonus = ctx.attacker.profBonus || 2;
        ctx.add(bonus, "force", true);
        return `, Астральная искра +${bonus}`;
      },
    },

    // Кентавр: фиксируем попадание рукопашной атакой после 30+ фт движения
    "race/centaur/razbeg": {
      attacks: "melee",
      ownTurn: true,
      when: (ctx) => ctx.attacker.movementUsed >= 30,
      apply: (ctx) => {
        markTurn(ctx.state, ctx.attacker, "centaur_charge_hit");
        return "";
      },
    },

    // Минотавр: фиксируем попадание рукопашной атакой для Сокрушительных рогов
    "race/minotaur/sokrushitelnye-roga": {
      attacks: "melee",
      ownTurn: true,
      apply: (ctx) => {
        markTurn(ctx.state, ctx.attacker, "minotaur_melee_hit");
        return "";
      },
    },
  },

  reductions: {
    // Хадози: Вёрткость хадози (реакцией уменьшает урон на 1к6 + БМ)
    "race/hadozee/vertkost-khadozi": {
      by: "self",
      reaction: true,
      spendUse: true,
      reduce: (ctx) => rollOf("1d6") + (ctx.owner.profBonus || 2),
    },
  },

  damaged: {
    // Грунг: Ядовитая кожа при прямом контакте (атака в пределах 5 фт -> спас ТЕЛ СЛ 12, отравлен до 1 минуты с повтором спаса в конце хода)
    "race/grung/yadovitaya-kozha": (ctx) => {
      const { state, owner, ability, attacker, isAttack } = ctx;
      if (!isAttack || !attacker || attacker.id === owner.id || !alive(attacker)) return;
      if (distanceFt(owner, attacker) > 5) return;
      const saved = saves(state, attacker, "CON", 12, ability.name, { condition: "poisoned" });
      if (!saved) {
        applyEffect(state, attacker.id, { condition: "poisoned", durationRounds: 10, saveType: "CON", saveDC: 12 }, owner.id);
      }
    },
  },
});

// Хуки спасбросков (Зайцегон «Сильные ноги», Кендер «Бесстрашие») и конца хода (Шифтер-Быстроног)
registerClassModule({
  id: "races-settings-hooks",

  saveFailed(state, c, ability, dc, _reroll, failedSave, condition) {
    if (!failedSave || failedSave.success || failedSave.autoFail) return null;

    // Кендер: Бесстрашие — 1/длинный отдых превращает проваленный спасбросок от испуга в успех
    if (condition === "frightened") {
      const fearless = abilityByKey(c, "race/kender/besstrashie");
      if (fearless && (fearless.usesMax <= 0 || fearless.usesUsed < fearless.usesMax)) {
        spendAbilityUse(c, fearless);
        state.mark(c.id);
        log(state, c, `${c.name}: Бесстрашие — превращает провал от испуга в успех`);
        return {
          ...failedSave,
          success: true,
          text: `${failedSave.roll.total} vs DC ${dc} (Успех, Бесстрашие)`,
        };
      }
    }

    // Зайцегон: Сильные ноги — реакцией +1к4 к проваленному спасброску Ловкости (если не ничком, скорость > 0 и реакции не запрещены)
    if (
      ability === "DEX" &&
      !c.reactionUsed &&
      !hasNoReactions(c) &&
      alive(c) &&
      canAct(c) &&
      !hasCondition(c, "prone") &&
      effectiveSpeed(c) > 0 &&
      failedSave.roll.total + 4 >= dc &&
      abilityByKey(c, "race/harengon/silnye-nogi")
    ) {
      c.reactionUsed = true;
      const bonus = rollDice("1d4").total;
      const nextTotal = failedSave.roll.total + bonus;
      const success = nextTotal >= dc;
      state.mark(c.id);
      log(state, c, `${c.name}: Сильные ноги — +${bonus} к спасброску ЛОВ (${nextTotal} против СЛ ${dc})`);
      return {
        ...failedSave,
        success,
        roll: {
          ...failedSave.roll,
          modifier: failedSave.roll.modifier + bonus,
          total: nextTotal,
        },
        text: `${nextTotal} vs DC ${dc} (${success ? "Успех" : "Провал"}, Сильные ноги +${bonus})`,
      };
    }

    return null;
  },

  endTurn(state, current, phase) {
    if (phase !== "before") return;
    for (const shifter of state.combatants) {
      if (shifter.id === current.id || !alive(shifter) || !canAct(shifter) || shifter.reactionUsed || hasNoReactions(shifter)) continue;
      if (!isHostile(shifter.type, current.type) || !hasCondition(shifter, "shifter_shifted")) continue;
      if (!abilityByKey(shifter, "race/swiftstride/osobennosti-smeny-formy")) continue;
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
  },
});
