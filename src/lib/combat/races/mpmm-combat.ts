// Боевая механика всех 30 MPMM-рас (*-mpmm).
// Повторно использует общие хелперы из race-combat.ts без дублирования.

import { distanceFt } from "../grid";
import { hasCondition } from "../rules";
import {
  EngineError,
  applyEffect,
  attemptHide,
  grantTempHp,
  heal,
  type CombatState,
} from "../engine";
import { registerClassModule } from "../class-hooks";
import {
  abilityByKey,
  alive,
  fireConditionStart,
  friendly,
  hostilesOf,
  log,
  markTurn,
  registerKit,
  result,
  rollOf,
  type ActionCtx,
  type StanceRule,
} from "../class-kit";
import type { Combatant } from "../types";
import { eladrinSeason } from "./core-phb";
import { AASIMAR_FORMS } from "./legacy-volo-mtf";
import {
  aasimarExtraDamageRider,
  aasimarRadiantConsumptionEndTurn,
  allyCountSaveRescueFailed,
  centaurChargeAction,
  clearConditionBySource,
  clearHiddenStep,
  clearRavenQueenBlessing,
  dexSaveRescueFailed,
  eladrinFeyStepAction,
  felineAgilityEndTurn,
  felineAgilityStance,
  hiddenStepAction,
  hiddenStepAfterAbility,
  hungryJawsAction,
  longtoothBiteAttackFor,
  makeAasimarShroudAction,
  makeNimbleHideAction,
  minotaurGoringRushAction,
  minotaurHammeringHornsAction,
  naturalStrikeAction,
  nimbleDisengageAction,
  rabbitHopAction,
  relentlessEnduranceOnDrop,
  restoreFlySpeed,
  runSwiftstrideEndTurn,
  setFlySpeed,
  shadarKaiBlessingAction,
  sizeLarger,
  stoneEnduranceAction,
  stoneEnduranceReduction,
  tortleShellDefenseAction,
} from "./race-combat";

const mpmmAasimarStances: Record<string, StanceRule> = {};
for (const f of AASIMAR_FORMS) {
  if (f.save) continue;
  mpmmAasimarStances[`race/aasimar-mpmm/${f.traitId}`] = {
    condition: f.condition,
    rounds: 10,
    text: (c) => `${c.name} активирует «${f.label}»`,
  };
}

const mpmmAasimarRiders = Object.fromEntries(
  AASIMAR_FORMS.map((f) => [
    `race/aasimar-mpmm/${f.traitId}`,
    aasimarExtraDamageRider(f.condition, f.damageType, f.label, (a) => a.profBonus || 2),
  ])
);

function hobgoblinHelpAction(mode: "plain" | "hospitality" | "passage" | "spite") {
  return (ctx: ActionCtx) => {
    const { state, c } = ctx;
    const allyTarget = ctx.target("Дар фей");
    if (allyTarget.id === c.id || !friendly(c, allyTarget) || !alive(allyTarget)) {
      throw new EngineError("Выберите живого союзника");
    }
    ctx.pay();
    applyEffect(state, allyTarget.id, { condition: "helped", durationRounds: 1 }, c.id);

    if (mode === "hospitality") {
      const temp = rollOf("1d6") + (c.profBonus || 2);
      grantTempHp(state, c.id, temp);
      grantTempHp(state, allyTarget.id, temp);
      log(state, c, `${c.name}: Дар фей (Радушие) — Помощь и +${temp} временных хитов для ${c.name} и ${allyTarget.name}`);
      return result(`${allyTarget.name} получает Помощь и +${temp} временных хитов`);
    }
    if (mode === "passage") {
      applyEffect(state, c.id, { condition: "hobgoblin_passage", durationRounds: 2 }, c.id);
      applyEffect(state, allyTarget.id, { condition: "hobgoblin_passage", durationRounds: 2 }, c.id);
      log(state, c, `${c.name}: Дар фей (Проход) — Помощь и +10 фт к скорости для ${c.name} и ${allyTarget.name}`);
      return result(`${allyTarget.name} получает Помощь и +10 фт к скорости`);
    }
    if (mode === "spite") {
      applyEffect(state, allyTarget.id, { condition: "hobgoblin_spite_buff", durationRounds: 2 }, c.id);
      log(state, c, `${c.name}: Дар фей (Злость) — Помощь и проклятие помехи на первое попадание ${allyTarget.name}`);
      return result(`${allyTarget.name} получает Помощь («Злость»)`);
    }

    log(state, c, `${c.name}: Дар фей — Помощь для ${allyTarget.name} бонусным действием`);
    return result(`${allyTarget.name} получает преимущество на следующую атаку`);
  };
}

registerKit({
  id: "races-mpmm",

  stances: {
    ...mpmmAasimarStances,
    "race/tabaxi-mpmm/koshache-provorstvo": felineAgilityStance,
    "race/shifter-mpmm/smena-formy": {
      condition: "shifter_shifted",
      rounds: 10,
      text: (c) => `${c.name} принимает звериный облик («Смена формы»)`,
    },
  },

  endsWhenDown: [
    ...AASIMAR_FORMS.map((f) => f.condition),
    "aasimar_shroud_fear_aura",
    "kobold_draconic_cry_aura",
    "feline_agility",
    "tortle_shell",
    "shifter_shifted",
  ],

  conditionStart: {
    "race/aasimar-mpmm/siyayushchaya-dusha": {
      condition: "aasimar_radiant_soul",
      run: (_state, c) => setFlySpeed(c, c.speed || 30, "aasimar_fly_prev"),
    },
    "race/shifter-mpmm/smena-formy": {
      condition: "shifter_shifted",
      run: (state, c) => {
        const baseTemp = 2 * (c.profBonus || 2);
        const isBeasthide =
          Boolean(abilityByKey(c, "race/shifter-mpmm/beasthide")) ||
          Boolean(c.racialVariants?.includes("beasthide"));
        const extraTemp = isBeasthide ? rollOf("1d6") : 0;
        const total = baseTemp + extraTemp;
        grantTempHp(state, c.id, total);
        return `получает ${total} временных хитов`;
      },
    },
  },

  conditionEnd: {
    "race/aasimar-mpmm/siyayushchaya-dusha": {
      condition: "aasimar_radiant_soul",
      run: (state, c) => restoreFlySpeed(state, c, "aasimar_fly_prev"),
    },
    "race/aasimar-mpmm/savan-smerti": {
      condition: "aasimar_shroud_fear_aura",
      run: (state, c) => clearConditionBySource(state, "frightened", c.id),
    },
    "race/kobold-mpmm/rev-drakona": {
      condition: "kobold_draconic_cry_aura",
      run: (state, c) => clearConditionBySource(state, "kobold_draconic_cry", c.id),
    },
  },

  startTurn: {
    "race/shadar-kai-mpmm/blagoslovenie-korolevy-voronov": clearRavenQueenBlessing,
    "race/firbolg-mpmm/nezrimaya-postup": clearHiddenStep,
    "race/hobgoblin-mpmm/dar-fey": (state, c) => {
      clearConditionBySource(state, "hobgoblin_passage", c.id);
      clearConditionBySource(state, "hobgoblin_spite_buff", c.id);
    },
  },

  endTurn: {
    "race/aasimar-mpmm/ispuskanie-siyaniya": (state, c) =>
      aasimarRadiantConsumptionEndTurn(state, c, c.profBonus || 2),
    "race/tabaxi-mpmm/koshache-provorstvo": felineAgilityEndTurn,
  },

  afterAbility: {
    "race/firbolg-mpmm/nezrimaya-postup": (state, c, _ability, usedKey) =>
      hiddenStepAfterAbility(state, c, usedKey, "race/firbolg-mpmm/nezrimaya-postup"),
  },

  afterAttack: {
    "race/firbolg-mpmm/nezrimaya-postup": clearHiddenStep,
  },

  actions: {
    // Аасимар MPMM: Исцеляющие руки (profBonus * d4) + Саван смерти
    "race/aasimar-mpmm/istselyayushchie-ruki": (ctx) => {
      const target = ctx.opts.targetIds?.[0] ? ctx.state.require(ctx.opts.targetIds[0]) : ctx.c;
      if (!friendly(ctx.c, target) || !alive(target)) {
        throw new EngineError("Выберите живого союзника или себя");
      }
      if (distanceFt(ctx.c, target) > 5) {
        throw new EngineError(`${target.name} дальше 5 фт`);
      }
      ctx.pay();
      const diceCount = ctx.c.profBonus || 2;
      const amount = rollOf(`${diceCount}d4`);
      heal(ctx.state, target.id, amount);
      log(ctx.state, ctx.c, `${ctx.c.name}: Исцеляющие руки — ${target.name} восстанавливает ${amount} хитов (${diceCount}к4)`);
      return result(`${target.name} восстанавливает ${amount} хитов`, [{ name: target.name, amount }]);
    },
    "race/aasimar-mpmm/savan-smerti": makeAasimarShroudAction({ hostilesOnly: true }),

    // Гоблин MPMM: Шустрый побег
    "race/goblin-mpmm/nimble-disengage": nimbleDisengageAction,
    "race/goblin-mpmm/nimble-hide": makeNimbleHideAction(attemptHide),

    // Голиаф MPMM: Выносливость камня (БМ/длинный отдых)
    "race/goliath-mpmm/vynoslivost-kamnya": stoneEnduranceAction,

    // Дженази земли MPMM: Слияние с камнем (Защита от оружия бонусным действием до конца следующего хода)
    "race/earth-genasi/sliyanie-s-kamnem": (ctx) => {
      const { state, c } = ctx;
      ctx.pay();
      applyEffect(state, c.id, { condition: "blade_ward", durationRounds: 2 }, c.id);
      log(state, c, `${c.name}: Слияние с камнем — получает сопротивление дробящему, колющему и рубящему урону от атак оружием до конца следующего хода`);
      return result(`${c.name} применяет «Защиту от оружия» («Слияние с камнем»)`);
    },

    // Зайцегон MPMM: Кроличий прыжок
    "race/harengon-mpmm/krolichiy-pryzhok": rabbitHopAction,

    // Кентавр MPMM: Разбег (1d6+STR)
    "race/centaur-mpmm/razbeg": (ctx) => centaurChargeAction(ctx, "1d6"),

    // Кобольд MPMM: Рёв дракона (вы и союзники получают преимущество по врагам в 10 фт, которые слышали)
    "race/kobold-mpmm/rev-drakona": (ctx) => {
      const { state, c } = ctx;
      ctx.pay();
      applyEffect(state, c.id, { condition: "kobold_draconic_cry_aura", durationRounds: 2 }, c.id);
      fireConditionStart(state, c, "kobold_draconic_cry_aura", ctx.opts);
      const foes = hostilesOf(state, c, 10).filter((t) => !hasCondition(t, "deafened"));
      for (const f of foes) {
        applyEffect(state, f.id, { condition: "kobold_draconic_cry" }, c.id);
      }
      log(state, c, `${c.name}: Рёв дракона — вы и союзники получаете преимущество по ${foes.map((f) => f.name).join(", ") || "врагам рядом"}`);
      return result(
        `${c.name} издаёт «Рёв дракона»`,
        foes.map((f) => ({ name: f.name, amount: 0 }))
      );
    },

    // Людоящер MPMM: Голодная пасть (рубящий 1d6+STR + временные хиты = БМ)
    "race/lizardfolk-mpmm/golodnaya-past": (ctx) =>
      hungryJawsAction(ctx, "slashing", (c) => c.profBonus || 2),

    // Минотавр MPMM
    "race/minotaur-mpmm/pronzayushchiy-natisk": minotaurGoringRushAction,
    "race/minotaur-mpmm/sokrushitelnye-roga": minotaurHammeringHornsAction,

    // Орк MPMM: Выброс адреналина (Рывок + БМ временных хитов)
    "race/orc-mpmm/vybros-adrenalina": (ctx) => {
      const { state, c } = ctx;
      ctx.pay();
      applyEffect(state, c.id, { condition: "dashing", durationRounds: 1 }, c.id);
      const temp = c.profBonus || 2;
      grantTempHp(state, c.id, temp);
      log(state, c, `${c.name}: Выброс адреналина — Рывок и +${temp} временных хитов`);
      return result(`${c.name} применяет «Выброс адреналина» (+${temp} временных хитов)`);
    },

    // Тортл MPMM: Панцирная защита
    "race/tortle-mpmm/pantsirnaya-zashchita": tortleShellDefenseAction,

    // Фирболг MPMM: Незримая поступь
    "race/firbolg-mpmm/nezrimaya-postup": hiddenStepAction,

    // Хобгоблин MPMM: Дар фей (база и 3 варианта с 3 уровня)
    "race/hobgoblin-mpmm/dar-fey": hobgoblinHelpAction("plain"),
    "race/hobgoblin-mpmm/fey-gift-hospitality": hobgoblinHelpAction("hospitality"),
    "race/hobgoblin-mpmm/fey-gift-passage": hobgoblinHelpAction("passage"),
    "race/hobgoblin-mpmm/fey-gift-spite": hobgoblinHelpAction("spite"),

    // Шадар-кай MPMM и Эладрин MPMM
    "race/shadar-kai-mpmm/blagoslovenie-korolevy-voronov": shadarKaiBlessingAction,
    "race/eladrin-mpmm/feyskiy-shag": eladrinFeyStepAction(
      eladrinSeason,
      (c) => c.profBonus || 2,
      (_c, ctx) => ctx.dc
    ),

    // Шифтер MPMM (Длиннозуб)
    "race/shifter-mpmm/longtooth": (ctx) =>
      naturalStrikeAction(ctx, "Укус длиннозуба", longtoothBiteAttackFor(ctx.c), () => {
        if (!hasCondition(ctx.c, "shifter_shifted")) {
          throw new EngineError("Укус длиннозуба доступен только во время «Смены формы»");
        }
      }),
  },

  riders: {
    ...mpmmAasimarRiders,

    // Багбир MPMM: +2к6 на КАЖДОМ попадании в 1-м раунде по цели, которая ещё не ходила
    "race/bugbear-mpmm/vnezapnoe-napadenie": {
      attacks: "any",
      ownTurn: true,
      when: (ctx) => ctx.state.round === 1 && !ctx.target.hasActed,
      apply: (ctx) => {
        const extra = ctx.roll("2d6");
        ctx.add(extra);
        return `, Внезапное нападение +${extra}`;
      },
    },

    // Гоблин MPMM: Ярость мелкого (+БМ урона 1/ход по цели крупнее себя)
    "race/goblin-mpmm/yarost-melkogo": {
      attacks: "any",
      armed: true,
      oncePerTurn: true,
      spendUse: true,
      when: (ctx) => sizeLarger(ctx.target, ctx.attacker),
      apply: (ctx) => {
        const bonus = ctx.attacker.profBonus || 2;
        ctx.add(bonus);
        return `, Ярость мелкого +${bonus}`;
      },
    },

    // Кентавр и Минотавр MPMM
    "race/centaur-mpmm/razbeg": {
      attacks: "melee",
      ownTurn: true,
      when: (ctx) => ctx.attacker.movementUsed >= 30,
      apply: (ctx) => {
        markTurn(ctx.state, ctx.attacker, "centaur_charge_hit");
        return "";
      },
    },
    "race/minotaur-mpmm/sokrushitelnye-roga": {
      attacks: "melee",
      ownTurn: true,
      apply: (ctx) => {
        markTurn(ctx.state, ctx.attacker, "minotaur_melee_hit");
        return "";
      },
    },
  },

  reductions: {
    "race/goliath-mpmm/vynoslivost-kamnya": stoneEnduranceReduction,
  },

  onDrop: {
    "race/orc-mpmm/nepokolebimaya-stoykost": relentlessEnduranceOnDrop,
  },
});

registerClassModule({
  id: "races-mpmm-hooks",

  hitRiders(state: CombatState, attacker: Combatant, target: Combatant, _attack, res) {
    if (!res.hit) return "";
    const spite = attacker.conditions.find((x) => x.type === "hobgoblin_spite_buff");
    if (!spite) return "";
    attacker.conditions = attacker.conditions.filter((x) => x !== spite);
    applyEffect(state, target.id, { condition: "spite_disadvantage", durationRounds: 10 }, attacker.id);
    state.mark(attacker.id);
    state.mark(target.id);
    log(state, attacker, `${target.name} получает помеху на следующую атаку (Дар фей: Злость)`);
    return ", Дар фей (Злость)";
  },

  saveFailed(state, c, ability, dc, _reroll, failedSave) {
    if (!failedSave || failedSave.success || failedSave.autoFail) return null;

    const hob = allyCountSaveRescueFailed(
      state,
      c,
      dc,
      failedSave,
      "race/hobgoblin-mpmm/udacha-mnozhestva",
      3,
      "Удача множества"
    );
    if (hob) return hob;

    return dexSaveRescueFailed(
      state,
      c,
      ability,
      dc,
      failedSave,
      "race/harengon-mpmm/udachnyy-manevr",
      "Удачный манёвр"
    );
  },

  endTurn(state, current, phase) {
    if (phase !== "before") return;
    runSwiftstrideEndTurn(state, current, ["race/shifter-mpmm/swiftstride"]);
  },
});
