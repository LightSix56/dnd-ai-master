// Боевая механика 25 рас сеттингов и приключений (Автогном, Астральный эльф, Гибрид Симиков,
// Гифф, Грунг, Зайцегон, Кендер, Кентавр, Леонин, Минотавр, Тортл, Хадози, Шифтер).

import { distanceFt } from "../grid";
import { hasCondition } from "../rules";
import {
  EngineError,
  applyEffect,
  dealDamage,
  grantTempHp,
  spendAbilityUse,
} from "../engine";
import { registerClassModule } from "../class-hooks";
import {
  abilityByKey,
  alive,
  dcBy,
  fireConditionStart,
  hostilesOf,
  log,
  markTurn,
  modOf,
  registerKit,
  removeConditions,
  result,
  rollOf,
  saves,
} from "../class-kit";
import { isHostile } from "../types";
import {
  centaurChargeAction,
  clearConditionBySource,
  dexSaveRescueFailed,
  longtoothBiteAttackFor,
  minotaurGoringRushAction,
  minotaurHammeringHornsAction,
  naturalStrikeAction,
  rabbitHopAction,
  runSwiftstrideEndTurn,
  teleportAction,
  tortleShellDefenseAction,
} from "./race-combat";

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
    "race/astral-elf/zvezdnyy-shag": teleportAction(30, "Звёздный шаг"),

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
    "race/harengon/krolichiy-pryzhok": rabbitHopAction,

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
    "race/centaur/razbeg": (ctx) => centaurChargeAction(ctx, "1d4"),

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

    // Минотавр: Пронзающий натиск и Сокрушительные рога
    "race/minotaur/pronzayushchiy-natisk": minotaurGoringRushAction,
    "race/minotaur/sokrushitelnye-roga": minotaurHammeringHornsAction,

    // Тортл: Панцирная защита (действие — спрятаться; бонусное действие — выйти)
    "race/tortle/pantsirnaya-zashchita": tortleShellDefenseAction,

    // Хадози: ручной клик напоминает о срабатывании реакцией
    "race/hadozee/vertkost-khadozi": () => {
      throw new EngineError("«Вёрткость хадози» срабатывает автоматически реакцией при получении урона");
    },

    // Шифтер-Длиннозуб: укус бонусным действием в изменённой форме
    "race/longtooth/osobennosti-smeny-formy": (ctx) =>
      naturalStrikeAction(ctx, "Укус длиннозуба", longtoothBiteAttackFor(ctx.c), () => {
        if (!hasCondition(ctx.c, "shifter_shifted")) {
          throw new EngineError("Укус длиннозуба доступен только во время «Смены формы»");
        }
      }),
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

    // Зайцегон: Сильные ноги — реакцией +1к4 к проваленному спасброску Ловкости
    return dexSaveRescueFailed(
      state,
      c,
      ability,
      dc,
      failedSave,
      "race/harengon/silnye-nogi",
      "Сильные ноги"
    );
  },

  endTurn(state, current, phase) {
    if (phase !== "before") return;
    runSwiftstrideEndTurn(state, current, ["race/swiftstride/osobennosti-smeny-formy"]);
  },
});
