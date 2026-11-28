// Боевая механика рас PHB 2014: дыхание драконорождённых, телепортации эльфов,
// Бдительный страж, Мстительное нападение, Непоколебимая стойкость и Свирепые атаки.

import { distanceFt } from "../grid";
import { getAoeCells } from "../movement";
import { canAct, checkReach, hasCondition, hasNoReactions } from "../rules";
import {
  EngineError,
  applyEffect,
  dealDamage,
  performAttack,
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
  friendly,
  hostilesOf,
  inReach,
  log,
  modOf,
  registerKit,
  result,
  rollOf,
  saves,
  strike,
  weaponOf,
  type ActionCtx,
} from "../class-kit";
import { isHostile, type AbilityKey, type Combatant } from "../types";
import { dragonbornAncestry, eladrinSeason, ftdBreathDice, phbBreathDice } from "./core-phb";
import {
  clearRavenQueenBlessing,
  eladrinFeyStepAction,
  relentlessEnduranceOnDrop,
  restoreFlySpeed,
  setFlySpeed,
  shadarKaiBlessingAction,
} from "./race-combat";

const singleDie = (dice: string) => dice.replace(/^\d*d/i, "1d");

/** Определяет точку направления AoE (либо из center, либо из первой цели) */
function resolveAoeCenter(ctx: ActionCtx) {
  if (ctx.opts.center) return ctx.opts.center;
  const target = ctx.opts.targetIds?.[0] ? ctx.state.get(ctx.opts.targetIds[0]) : undefined;
  if (target) return { x: target.x, y: target.y };
  throw new EngineError(`Укажите точку или цель для «${ctx.ability.name}»`);
}

function coneTargets(state: CombatState, c: Combatant, center: { x: number; y: number }, shape: "cone" | "line", sizeFt: number): Combatant[] {
  if (center.x === c.x && center.y === c.y) {
    throw new EngineError("Выберите направление или клетку в стороне от себя");
  }
  const cells = getAoeCells(center, shape, sizeFt, { x: c.x, y: c.y }, state.gridWidth, state.gridHeight);
  const cellSet = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  return state.combatants.filter((t) => t.id !== c.id && alive(t) && cellSet.has(`${t.x},${t.y}`));
}

function breathWeaponAction(scaleMode: "phb" | "ftd") {
  return (ctx: ActionCtx) => {
    const { state, c, ability } = ctx;
    const center = resolveAoeCenter(ctx);
    const ancestry = dragonbornAncestry(c);
    const targets = coneTargets(state, c, center, ancestry.shape, ancestry.sizeFt);
    ctx.pay();

    const dice = scaleMode === "phb" ? phbBreathDice(c.level || 1) : ftdBreathDice(c.level || 1);
    const rolled = rollOf(dice);
    const dc = dcBy(c, "CON");
    const outcomes: Array<{ name: string; saved: boolean; amount: number }> = [];

    for (const t of targets) {
      const saved = saves(state, t, ancestry.save, dc, ability.name);
      const dmg = saved ? Math.floor(rolled / 2) : rolled;
      if (dmg > 0) {
        dealDamage(state, t.id, dmg, {
          damageType: ancestry.damageType,
          attackerId: c.id,
          source: c.id,
        });
      }
      outcomes.push({ name: t.name, saved, amount: dmg });
    }

    const summary =
      outcomes.length > 0
        ? outcomes.map((o) => `${o.name}: ${o.amount}${o.saved ? " (успех)" : ""}`).join(", ")
        : "никого в зоне";
    log(state, c, `${c.name}: ${ability.name} (${ancestry.damageType}, ${dice}=${rolled}, СЛ ${dc}) — ${summary}`);
    return result(`${ability.name}: ${summary}`, outcomes);
  };
}

function metallicBreathAction(mode: "enervating" | "repulsion") {
  return (ctx: ActionCtx) => {
    const { state, c, ability } = ctx;
    const center = resolveAoeCenter(ctx);
    const targets = coneTargets(state, c, center, "cone", 15);
    ctx.pay();

    const dc = dcBy(c, "CON");
    const saveAbility: AbilityKey = mode === "enervating" ? "CON" : "STR";
    const outcomes: Array<{ name: string; saved: boolean; amount: number }> = [];

    for (const t of targets) {
      const saved = saves(state, t, saveAbility, dc, ability.name);
      if (!saved) {
        if (mode === "enervating") {
          applyEffect(state, t.id, { condition: "incapacitated", durationRounds: 1 }, c.id);
        } else {
          pushCombatantAway(state, t, { x: c.x, y: c.y }, 4);
          applyEffect(state, t.id, { condition: "prone" }, c.id);
        }
      }
      outcomes.push({ name: t.name, saved, amount: 0 });
    }

    const summary =
      outcomes.length > 0
        ? outcomes.map((o) => `${o.name}: ${o.saved ? "устоял" : mode === "enervating" ? "недееспособен" : "отброшен и ничком"}`).join(", ")
        : "никого в конусе";
    log(state, c, `${c.name}: ${ability.name} (СЛ ${dc}) — ${summary}`);
    return result(`${ability.name}: ${summary}`, outcomes);
  };
}

registerKit({
  id: "races-phb",

  stances: {
    "race/gem-dragonborn/polet-samotsvetnogo-drakona": {
      condition: "gem_flight",
      rounds: 10,
      text: (c) => `${c.name} раскрывает призрачные крылья (полёт ${c.speed || 30} фт)`,
    },
  },

  conditionStart: {
    "race/gem-dragonborn/polet-samotsvetnogo-drakona": {
      condition: "gem_flight",
      run: (_state, c) => setFlySpeed(c, c.speed || 30, "gem_flight_prev"),
    },
  },

  conditionEnd: {
    "race/gem-dragonborn/polet-samotsvetnogo-drakona": {
      condition: "gem_flight",
      run: (state, c) => restoreFlySpeed(state, c, "gem_flight_prev"),
    },
  },

  startTurn: {
    "race/shadar-kai/blagoslovenie-korolevy-voronov": clearRavenQueenBlessing,
  },

  actions: {
    // Шадар-кай: Благословение Королевы воронов
    "race/shadar-kai/blagoslovenie-korolevy-voronov": shadarKaiBlessingAction,

    // Эладрин: Фейский шаг + сезоны с 3 уровня
    "race/eladrin/feyskiy-shag": eladrinFeyStepAction(
      eladrinSeason,
      (c) => Math.max(1, modOf(c, "CHA")),
      (c) => dcBy(c, "CHA")
    ),

    // Драконорождённые: Оружие дыхания (PHB + FTD) и Защита цветного дракона
    "race/dragonborn/oruzhie-dykhaniya": breathWeaponAction("phb"),
    "race/chromatic-dragonborn/oruzhie-dykhaniya": breathWeaponAction("ftd"),
    "race/metallic-dragonborn/oruzhie-dykhaniya": breathWeaponAction("ftd"),
    "race/gem-dragonborn/oruzhie-dykhaniya": breathWeaponAction("ftd"),
    "race/metallic-dragonborn/metallic-enervating": metallicBreathAction("enervating"),
    "race/metallic-dragonborn/metallic-repulsion": metallicBreathAction("repulsion"),
    "race/chromatic-dragonborn/zashchita-tsvetnogo-drakona": (ctx) => {
      const { state, c, ability } = ctx;
      const elem = dragonbornAncestry(c).damageType;
      ctx.pay();
      applyEffect(state, c.id, { condition: "chromatic_warding", durationRounds: 100 }, c.id);
      log(state, c, `${c.name}: ${ability.name} — иммунитет к урону (${elem}) на 1 минуту`);
      return result(`${c.name} получает иммунитет к урону (${elem})`);
    },

    // Равенит: ручной вызов реакции, если игрок кликает кнопку
    "race/ravenite/mstitelnoe-napadenie": (ctx) => {
      const target = ctx.target("Мстительное нападение");
      if (!isHostile(ctx.c.type, target.type) || !alive(target)) {
        throw new EngineError("Выберите живого врага");
      }
      const weapon = weaponOf(ctx.c, "melee") ?? weaponOf(ctx.c);
      if (!weapon || !checkReach(ctx.c, target, weapon, ctx.state.mapElements).ok) {
        throw new EngineError(`${target.name} вне досягаемости оружия`);
      }
      ctx.pay();
      const hit = strike(ctx.state, ctx.c, target, weapon);
      return result(`Мстительное нападение: ${hit.text}`, [hit]);
    },

    // Человек (Метка стража): ручной вызов обмена местами с союзником в 5 фт
    "race/mark-of-sentinel/bditelnyy-strazh": (ctx) => {
      const allyTarget = ctx.target("Бдительный страж");
      if (allyTarget.id === ctx.c.id || !friendly(ctx.c, allyTarget) || !alive(allyTarget)) {
        throw new EngineError("Выберите союзника");
      }
      if (distanceFt(ctx.c, allyTarget) > 5) {
        throw new EngineError(`${allyTarget.name} дальше 5 фт`);
      }
      ctx.pay();
      const gx = ctx.c.x;
      const gy = ctx.c.y;
      ctx.c.x = allyTarget.x;
      ctx.c.y = allyTarget.y;
      allyTarget.x = gx;
      allyTarget.y = gy;
      ctx.state.mark(allyTarget.id);
      log(ctx.state, ctx.c, `${ctx.c.name}: Бдительный страж — меняется местами с ${allyTarget.name}`);
      return result(`${ctx.c.name} меняется местами с ${allyTarget.name}`);
    },
  },

  riders: {
    // Полуорк: Свирепые атаки — +1 кость урона оружия при критическом попадании в ближнем бою
    "race/half-orc/svirepye-ataki": {
      attacks: "melee",
      when: ({ res, attack }) => res.crit && Boolean(attack.damage[0]?.dice),
      apply: (ctx) => {
        const die = singleDie(ctx.attack.damage[0].dice);
        const extra = rollOf(die);
        ctx.add(extra, ctx.attack.damage[0].type, ctx.res.damageParts[0]?.magical);
        return `, Свирепые атаки +${extra}`;
      },
    },
  },

  damaged: {
    // Драконорождённый (Равенит): Мстительное нападение реакцией при получении урона
    "race/ravenite/mstitelnoe-napadenie": (ctx) => {
      const { state, owner, ability, attacker } = ctx;
      if (!attacker || attacker.id === owner.id || !alive(attacker) || !isHostile(owner.type, attacker.type)) return;
      if (!alive(owner) || !canAct(owner) || owner.reactionUsed || hasNoReactions(owner)) return;
      if (ability.usesMax > 0 && ability.usesUsed >= ability.usesMax) return;
      const weapon = weaponOf(owner, "melee") ?? weaponOf(owner);
      if (!weapon || !inReach(state, owner, attacker, weapon)) return;
      owner.reactionUsed = true;
      spendAbilityUse(owner, ability);
      log(state, owner, `${owner.name}: Мстительное нападение по ${attacker.name}`);
      performAttack(state, owner.id, attacker.id, weapon.id, { skipTurnCheck: true, skipCost: true });
    },
  },

  onDrop: {
    // Полуорк: Непоколебимая стойкость — остаётся с 1 хитом 1/длинный отдых (если не мгновенная смерть)
    "race/half-orc/nepokolebimaya-stoykost": relentlessEnduranceOnDrop,
  },
});

// Метка стража (Бдительный страж): союзник в 5 фт реакцией меняется местами с целью попадания и принимает удар на себя
registerClassModule({
  id: "races-phb-defense",
  defense(state, _attacker, target, _attack, res, allowRedirect = true) {
    if (!allowRedirect || !res.hit) return target;
    for (const guardian of state.combatants) {
      if (guardian.id === target.id || !alive(guardian) || !friendly(guardian, target)) continue;
      if (guardian.reactionUsed || hasNoReactions(guardian) || !canAct(guardian) || distanceFt(guardian, target) > 5) continue;
      const ability = abilityByKey(guardian, "race/mark-of-sentinel/bditelnyy-strazh");
      if (!ability || (ability.usesMax > 0 && ability.usesUsed >= ability.usesMax)) continue;

      const gx = guardian.x;
      const gy = guardian.y;
      guardian.x = target.x;
      guardian.y = target.y;
      target.x = gx;
      target.y = gy;
      guardian.reactionUsed = true;
      spendAbilityUse(guardian, ability);
      state.mark(guardian.id);
      state.mark(target.id);
      log(state, guardian, `${guardian.name}: Бдительный страж — меняется местами с ${target.name} и принимает удар на себя`);
      return guardian;
    }
    return target;
  },
});
