// Варвар в бою: Ярость и умения девяти путей работают в движке сами.
//
// Механика собрана из типовых форм конструктора (class-kit.ts): Ярость — стойка, Божественная ярость
// и Стихийное оружие — добавки к попаданию, Духовный щит — уменьшение урона реакцией и т. д.
// Заряды, цели и СЛ заданы правилами в barbarian.ts; сопротивления и бонусы — там же поправками.

import { rollDice } from "@/lib/dnd/dice";
import { distanceFt } from "../grid";
import { isCellBlocked } from "../movement";
import { rageDamageBonus } from "../ability-uses";
import { canAct, hasCondition } from "../rules";
import { EngineError, grantTempHp, heal, lastAttackThisTurn, performAttack, pushCombatantAway, type CombatState } from "../engine";
import {
  abilityByKey,
  alive,
  alliesOf,
  applyEffect,
  dcBy,
  dealDamage,
  hostilesOf,
  inReach,
  isOwnTurn,
  log,
  markTurn,
  modOf,
  registerKit,
  removeConditions,
  result,
  rollOf,
  saves,
  strike,
  strikeWith,
  usedThisTurn,
  weaponOf,
  type ActionCtx,
} from "../class-kit";
import { isHostile, type Attack, type Combatant } from "../types";
import { CLEAVER_TYPES, RAGE, spiritShieldDice, stormAuraAmount, stormEnv, stormSeaDice, type StormEnv } from "./barbarian";

const raging = (c: Combatant) => hasCondition(c, RAGE);

function requireRage(c: Combatant, name: string): void {
  if (!raging(c)) throw new EngineError(`«${name}» — только в Ярости`);
}

const SIZE_ORDER = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;
const sizeAtMost = (c: Combatant, size: (typeof SIZE_ORDER)[number]) =>
  SIZE_ORDER.indexOf(c.size ?? "medium") <= SIZE_ORDER.indexOf(size);

const nearest = (from: Combatant, list: Combatant[]) => [...list].sort((a, b) => distanceFt(a, from) - distanceFt(b, from))[0];

function requireFoe(ctx: ActionCtx, rangeFt: number): Combatant {
  const target = ctx.target();
  if (target.id === ctx.c.id || !isHostile(ctx.c.type, target.type)) throw new EngineError(`«${ctx.ability.name}»: выберите врага`);
  if (!alive(target)) throw new EngineError(`${target.name} уже выведен из боя`);
  if (distanceFt(ctx.c, target) > rangeFt) throw new EngineError(`${target.name} дальше ${rangeFt} фт`);
  return target;
}

/** Рывок бонусным действием (Орёл, Шипастый рывок) */
const rageDash = (ctx: ActionCtx) => {
  requireRage(ctx.c, ctx.ability.name);
  ctx.pay();
  if (!hasCondition(ctx.c, "dashing")) ctx.c.conditions = [...ctx.c.conditions, { type: "dashing", duration: 1 }];
  log(ctx.state, ctx.c, `${ctx.c.name} совершает Рывок бонусным действием (${ctx.ability.name})`, "move");
  return result(`${ctx.c.name} совершает Рывок: скорость на этот ход удвоена`);
};

// ============ ВЕСТНИК БУРИ ============

const ENV_NAMES: Record<StormEnv, string> = { desert: "Пустыня", sea: "Море", tundra: "Тундра" };

/** Эффект Ауры бури: при входе в ярость и по кнопке. Возвращает текст для журнала */
function stormAura(state: CombatState, c: Combatant, env: StormEnv, targetId?: string): string {
  const dc = dcBy(c, "CON");
  // Запоминаем стихию: по ней считаются сопротивления Штормовой души
  c.conditions = [...c.conditions.filter((x) => x.type !== "storm_aura"), { type: "storm_aura", source: env }];
  state.mark(c.id);
  let text = `Аура бури (${ENV_NAMES[env]})`;

  if (env === "desert") {
    const amount = stormAuraAmount(c.level);
    const others = state.combatants.filter((t) => t.id !== c.id && alive(t) && distanceFt(c, t) <= 10);
    for (const t of others) dealDamage(state, t.id, amount, { damageType: "fire", attackerId: c.id, source: c.id });
    text += others.length ? `: ${others.map((t) => t.name).join(", ")} — ${amount} урона огнём` : ": в ауре никого нет";
  } else if (env === "sea") {
    const picked = targetId ? state.get(targetId) : undefined;
    const target = picked && picked.id !== c.id && alive(picked) && distanceFt(c, picked) <= 10 ? picked : nearest(c, hostilesOf(state, c, 10));
    if (!target) {
      text += ": в ауре нет цели";
    } else {
      const saved = saves(state, target, "DEX", dc, "Аура бури");
      const rolled = rollOf(`${stormSeaDice(c.level)}d6`);
      const amount = saved ? Math.floor(rolled / 2) : rolled;
      if (amount > 0) dealDamage(state, target.id, amount, { damageType: "lightning", attackerId: c.id, source: c.id });
      text += `: ${target.name} — ${amount} урона молнией${saved ? " (спасбросок, половина)" : ""}`;
    }
  } else {
    const amount = stormAuraAmount(c.level);
    const friends = [c, ...alliesOf(state, c, 10)];
    for (const t of friends) grantTempHp(state, t.id, amount);
    text += `: ${friends.map((t) => t.name).join(", ")} — ${amount} временных хитов`;
    // Ярость бури (14 ур.): ближайший враг в ауре останавливается
    if (abilityByKey(c, "storm-herald/raging-storm")) {
      const foe = nearest(c, hostilesOf(state, c, 10));
      if (foe && !saves(state, foe, "STR", dc, "Ярость бури")) {
        applyEffect(state, foe.id, { condition: "storm_frozen", durationRounds: 1 }, c.id);
        text += `; ${foe.name} скован льдом (скорость 0)`;
      }
    }
  }
  log(state, c, `${c.name}: ${text}`);
  return text;
}

const auraAction = (env: StormEnv) => (ctx: ActionCtx) => {
  requireRage(ctx.c, ctx.ability.name);
  ctx.pay();
  return result(stormAura(ctx.state, ctx.c, env, ctx.opts.targetIds?.[0]));
};

// ============ ПУТЬ ЗВЕРЯ ============

const BEAST_ATTACKS = ["beast_bite", "beast_claws", "beast_tail"];
const isNaturalWeapon = (a: Attack) => BEAST_ATTACKS.includes(a.id);

function beastForm(variant: 1 | 2 | 3) {
  return (ctx: ActionCtx) => {
    const { state, c } = ctx;
    requireRage(c, ctx.ability.name);
    if (hasCondition(c, "beast_form")) throw new EngineError("Форма зверя уже выбрана на эту ярость");
    const str = modOf(c, "STR");
    const magical = !!abilityByKey(c, "beast/bestial-soul");
    const base = { kind: "melee" as const, attackBonus: (c.profBonus || 2) + str, actionCost: "action" as const, magical };
    const attack: Attack =
      variant === 1
        ? { ...base, id: "beast_bite", name: "Укус (Форма зверя)", range: { normal: 5 }, damage: [{ dice: "1d8", mod: str, type: "piercing" }] }
        : variant === 2
          ? { ...base, id: "beast_claws", name: "Когти (Форма зверя)", range: { normal: 5 }, damage: [{ dice: "1d6", mod: str, type: "slashing" }] }
          : { ...base, id: "beast_tail", name: "Хвост (Форма зверя)", range: { normal: 10 }, damage: [{ dice: "1d8", mod: str, type: "piercing" }] };
    c.attacks = [attack, ...c.attacks.filter((a) => !isNaturalWeapon(a))];
    c.conditions = [...c.conditions, { type: "beast_form", value: variant }];
    state.mark(c.id);
    log(state, c, `${c.name} принимает Форму зверя: ${attack.name}`);
    return result(`${c.name}: появилась атака «${attack.name}» до конца ярости`);
  };
}

// ============ ДИКАЯ МАГИЯ ============

const surgeOf = (c: Combatant) => c.conditions.find((x) => x.type === "wild_surge")?.value ?? 0;

function surgeExplosion(state: CombatState, c: Combatant, center: Combatant): string {
  const dc = dcBy(c, "CON");
  const hit = [center, ...hostilesOf(state, c).filter((t) => t.id !== center.id && distanceFt(t, center) <= 5)];
  const parts: string[] = [];
  for (const t of hit) {
    if (saves(state, t, "DEX", dc, "Взрыв духа")) {
      parts.push(`${t.name} уклоняется`);
      continue;
    }
    const d = rollOf("1d6");
    dealDamage(state, t.id, d, { damageType: "force", attackerId: c.id, source: c.id });
    parts.push(`${t.name} — ${d} урона силовым полем`);
  }
  return `дух взрывается: ${parts.join(", ")}`;
}

function surgeBolt(state: CombatState, c: Combatant, target: Combatant): string {
  if (saves(state, target, "CON", dcBy(c, "CON"), "Луч света")) return `луч света: ${target.name} устоял`;
  const d = rollOf("1d6");
  dealDamage(state, target.id, d, { damageType: "radiant", attackerId: c.id, source: c.id });
  if (alive(target)) applyEffect(state, target.id, { condition: "blinded", durationRounds: 1 }, c.id);
  return `луч света: ${target.name} — ${d} урона излучением и ослеплён`;
}

/** Бросок по таблице Дикой магии и немедленный эффект. Возвращает текст для журнала */
function wildSurge(state: CombatState, c: Combatant): string {
  const n = rollDice("1d8").total;
  c.conditions = [...c.conditions.filter((x) => x.type !== "wild_surge"), { type: "wild_surge", value: n }];
  state.mark(c.id);
  const dc = dcBy(c, "CON");
  let text: string;
  switch (n) {
    case 1: {
      const parts: string[] = [];
      for (const t of hostilesOf(state, c, 30)) {
        if (saves(state, t, "CON", dc, "Всплеск дикой магии")) continue;
        const d = rollOf("1d12");
        dealDamage(state, t.id, d, { damageType: "necrotic", attackerId: c.id, source: c.id });
        parts.push(`${t.name} — ${d}`);
      }
      const temp = rollOf("1d12");
      grantTempHp(state, c.id, temp);
      text = `некротическая волна${parts.length ? ` (${parts.join(", ")})` : ""}, ${temp} временных хитов`;
      break;
    }
    case 2:
      text = "телепортация: бонусным действием можно переноситься до 30 футов (кнопка «Всплеск: телепортация»)";
      break;
    case 3: {
      const foe = nearest(c, hostilesOf(state, c, 30));
      text = foe ? surgeExplosion(state, c, foe) : "дух появляется, но врагов в 30 футах нет";
      break;
    }
    case 4:
      text = "оружие наполнено магией: урон силовым полем";
      break;
    case 5:
      text = "ответный шип: попавший по варвару атакой получает 1к6 урона силовым полем";
      break;
    case 6:
      text = "защитный свет: +1 к КД варвару и союзникам в 10 футах";
      break;
    case 7:
      text = "цветы и лозы: земля в 15 футах — труднопроходимая местность для врагов (отыгрывает мастер)";
      break;
    default: {
      const foe = nearest(c, hostilesOf(state, c, 30));
      text = foe ? surgeBolt(state, c, foe) : "луч света не находит цели";
    }
  }
  const full = `Всплеск дикой магии (${n}): ${text}`;
  log(state, c, `${c.name}: ${full}`);
  return full;
}

function requireSurge(ctx: ActionCtx, n: number): void {
  requireRage(ctx.c, ctx.ability.name);
  if (surgeOf(ctx.c) !== n) throw new EngineError(`«${ctx.ability.name}» доступно только при всплеске ${n}`);
}

/** Существо для Подпитки магией: себя или союзника в касании */
function bolsterTarget(ctx: ActionCtx): Combatant {
  const target = ctx.opts.targetIds?.[0] ? ctx.state.require(ctx.opts.targetIds[0]) : ctx.c;
  if (target.id !== ctx.c.id && distanceFt(ctx.c, target) > 5) throw new EngineError(`${target.name} слишком далеко — нужно касание`);
  return target;
}

// ============ ВЕЛИКАН ============

const cleaverType = (c: Combatant) => c.conditions.find((x) => x.type === "elemental_cleaver")?.source;

function setCleaver(state: CombatState, c: Combatant, type: string): void {
  c.conditions = [...c.conditions.filter((x) => x.type !== "elemental_cleaver"), { type: "elemental_cleaver", source: type }];
  state.mark(c.id);
}

// ============ ОПИСАНИЕ КЛАССА ============

registerKit({
  id: "barbarian",

  stances: {
    "barbarian/rage": {
      condition: RAGE,
      rounds: 10,
      value: (c) => rageDamageBonus(c.level || 1),
      breaksConcentration: true,
      text: (c) => `${c.name} впадает в Ярость (+${rageDamageBonus(c.level || 1)} к урону, сопротивление физическому урону)`,
    },
  },

  // Ярость обрывается, когда варвар теряет сознание
  endsWhenDown: [RAGE],

  conditionStart: {
    "storm-herald/storm-aura": {
      condition: RAGE,
      run: (state, c) => {
        const env = stormEnv(c);
        return env ? stormAura(state, c, env) : "Аура бури: выберите стихию кнопкой";
      },
    },
    "wild-magic/wild-surge": { condition: RAGE, run: (state, c) => wildSurge(state, c) },
    "giant/elemental-cleaver": {
      condition: RAGE,
      run: (state, c) => {
        const type = cleaverType(c) ?? "fire";
        setCleaver(state, c, type);
        return `Стихийное оружие: ${CLEAVER_TYPES.find((t) => t.type === type)?.name ?? type}`;
      },
    },
    "zealot/fanatical-focus": { condition: RAGE, run: (state, c) => removeConditions(state, c, "fanatical_used") },
  },

  conditionEnd: {
    "barbarian/rage": {
      condition: RAGE,
      run: (state, c) => {
        removeConditions(state, c, "rage_fed", "beast_form", "wild_surge", "fanatical_used");
        if (c.attacks.some(isNaturalWeapon)) c.attacks = c.attacks.filter((a) => !isNaturalWeapon(a));
        log(state, c, `${c.name}: Ярость закончилась`, "system");
      },
    },
  },

  // Ярость держится, пока варвар атакует врагов или получает урон (до Непрекращающейся ярости на 15 ур.)
  endTurn: {
    "barbarian/rage": (state, c) => {
      if (!raging(c)) return;
      const fed = hasCondition(c, "rage_fed");
      removeConditions(state, c, "rage_fed");
      if (fed || abilityByKey(c, "barbarian/persistent-rage")) return;
      removeConditions(state, c, RAGE);
      log(state, c, `${c.name}: Ярость угасла — с прошлого хода варвар не атаковал врагов и не получал урона`, "system");
    },
  },

  afterAttack: {
    "barbarian/rage": (state, c, _ability, target) => {
      if (raging(c) && isHostile(c.type, target.type) && !hasCondition(c, "rage_fed")) {
        c.conditions = [...c.conditions, { type: "rage_fed" }];
        state.mark(c.id);
      }
    },
    // Когти: раз в ход, атаковав когтями, варвар бьёт ими ещё раз
    "beast/form-of-the-beast": (state, c, _ability, target, attack) => {
      if (attack.id !== "beast_claws" || !isOwnTurn(state, c) || usedThisTurn(state, c, "claws_extra")) return;
      const claws = c.attacks.find((a) => a.id === "beast_claws");
      const next = alive(target) ? target : nearest(c, hostilesOf(state, c, 5));
      if (!claws || !next || !inReach(state, c, next, claws)) return;
      markTurn(state, c, "claws_extra");
      log(state, c, `${c.name}: Когти — дополнительная атака`);
      performAttack(state, c.id, next.id, claws.id, { skipTurnCheck: true, skipCost: true });
    },
  },

  afterAbility: {
    // Яростный таран: Безрассудная атака в ярости даёт временные хиты
    "battlerager/reckless-abandon": (state, c, _ability, usedKey) => {
      if (usedKey !== "barbarian/reckless-attack" || !raging(c)) return;
      const amount = Math.max(1, modOf(c, "CON"));
      grantTempHp(state, c.id, amount);
      log(state, c, `${c.name}: Яростный таран — ${amount} временных хитов`);
    },
  },

  actions: {
    // ---- Тотемный воин ----
    "totem-warrior/spirit-eagle": rageDash,
    "totem-warrior/attune-wolf": (ctx) => {
      requireRage(ctx.c, ctx.ability.name);
      const target = requireFoe(ctx, 5);
      const last = lastAttackThisTurn(ctx.state, ctx.c);
      if (!last || !last.hit || last.kind !== "melee" || last.targetId !== target.id) {
        throw new EngineError("Гармония волка — после попадания рукопашной атакой по этой цели в этом ходу");
      }
      if (!sizeAtMost(target, "large")) throw new EngineError(`${target.name} слишком велик, чтобы его сбить`);
      ctx.pay();
      applyEffect(ctx.state, target.id, { condition: "prone" }, ctx.c.id);
      return result(`${ctx.c.name} сбивает ${target.name} с ног`, [{ name: target.name, amount: 0 }]);
    },
    "totem-warrior/attune-elk": (ctx) => {
      requireRage(ctx.c, ctx.ability.name);
      const target = requireFoe(ctx, 5);
      if (!sizeAtMost(target, "large")) throw new EngineError(`${target.name} слишком велик`);
      ctx.pay();
      if (saves(ctx.state, target, "STR", ctx.params.saveDC ?? dcBy(ctx.c, "STR"), ctx.ability.name)) {
        return result(`${target.name} устоял перед натиском лося`, [{ name: target.name, saved: true, amount: 0 }]);
      }
      const d = rollOf("1d12") + modOf(ctx.c, "STR");
      applyEffect(ctx.state, target.id, { condition: "prone" }, ctx.c.id);
      dealDamage(ctx.state, target.id, d, { damageType: "bludgeoning", attackerId: ctx.c.id, source: ctx.c.id });
      return result(`${target.name} сбит с ног и получает ${d} дробящего урона`, [{ name: target.name, saved: false, amount: d }]);
    },
    "totem-warrior/attune-tiger": (ctx) => {
      requireRage(ctx.c, ctx.ability.name);
      if (ctx.c.movementUsed < 20) throw new EngineError("Гармония тигра — после 20 футов движения к цели в этом ходу");
      const weapon = weaponOf(ctx.c, "melee");
      if (!weapon) throw new EngineError("Нужно рукопашное оружие");
      const target = requireFoe(ctx, weapon.range.normal);
      ctx.pay();
      const r = strike(ctx.state, ctx.c, target, weapon);
      return result(`Гармония тигра: ${r.text}`, [r]);
    },

    // ---- Буйствующий ----
    "battlerager/spiked-armor": (ctx) => {
      requireRage(ctx.c, ctx.ability.name);
      const target = requireFoe(ctx, 5);
      ctx.pay();
      const str = modOf(ctx.c, "STR");
      const r = strikeWith(ctx.state, ctx.c, target, {
        id: "__armor_spikes",
        name: "Шипы доспеха",
        kind: "melee",
        range: { normal: 5 },
        attackBonus: (ctx.c.profBonus || 2) + str,
        damage: [{ dice: "1d4", mod: str, type: "piercing" }],
        actionCost: "bonus",
      });
      return result(`Шипастая броня: ${r.text}`, [r]);
    },
    "battlerager/battlerager-charge": rageDash,

    // ---- Вестник бури ----
    "storm-herald/aura-desert": auraAction("desert"),
    "storm-herald/aura-sea": auraAction("sea"),
    "storm-herald/aura-tundra": auraAction("tundra"),

    // ---- Ревнитель ----
    "zealot/zealous-presence": (ctx) => {
      const allies = alliesOf(ctx.state, ctx.c, 60)
        .filter((a) => canAct(a))
        .slice(0, 10);
      if (allies.length === 0) throw new EngineError("В 60 футах нет союзников");
      ctx.pay();
      for (const a of allies) applyEffect(ctx.state, a.id, { condition: "zealous_presence", durationRounds: 1 }, ctx.c.id);
      log(ctx.state, ctx.c, `${ctx.c.name} издаёт боевой клич: ${allies.map((a) => a.name).join(", ")} получают преимущество на атаки и спасброски`);
      return result(
        `Ревностное воодушевление: ${allies.map((a) => a.name).join(", ")}`,
        allies.map((a) => ({ name: a.name, amount: 0 }))
      );
    },

    // ---- Зверь ----
    "beast/form-bite": beastForm(1),
    "beast/form-claws": beastForm(2),
    "beast/form-tail": beastForm(3),

    // ---- Дикая магия ----
    "wild-magic/surge-teleport": (ctx) => {
      requireSurge(ctx, 2);
      const cell = ctx.opts.center;
      if (!cell) throw new EngineError("Выберите клетку для телепортации");
      if (distanceFt(ctx.c, cell) > 30) throw new EngineError("Клетка дальше 30 футов");
      if (isCellBlocked(cell, ctx.state.mapElements, ctx.state.combatants, ctx.c.id)) throw new EngineError("Клетка занята");
      ctx.pay();
      ctx.c.x = cell.x;
      ctx.c.y = cell.y;
      ctx.state.mark(ctx.c.id);
      log(ctx.state, ctx.c, `${ctx.c.name} телепортируется (Всплеск дикой магии)`, "move");
      return result(`${ctx.c.name} телепортируется`);
    },
    "wild-magic/surge-spirit": (ctx) => {
      requireSurge(ctx, 3);
      const target = requireFoe(ctx, 30);
      ctx.pay();
      const text = surgeExplosion(ctx.state, ctx.c, target);
      log(ctx.state, ctx.c, `${ctx.c.name}: ${text}`);
      return result(text);
    },
    "wild-magic/surge-bolt": (ctx) => {
      requireSurge(ctx, 8);
      const target = requireFoe(ctx, 30);
      ctx.pay();
      const text = surgeBolt(ctx.state, ctx.c, target);
      log(ctx.state, ctx.c, `${ctx.c.name}: ${text}`);
      return result(text);
    },
    "wild-magic/bolster-attack": (ctx) => {
      const target = bolsterTarget(ctx);
      ctx.pay();
      applyEffect(ctx.state, target.id, { condition: "bolstered", durationRounds: 100 }, ctx.c.id);
      return result(`${target.name}: +1к3 к броскам атаки и проверкам характеристик на 10 минут`, [{ name: target.name, amount: 0 }]);
    },
    "wild-magic/bolster-slot": (ctx) => {
      const target = bolsterTarget(ctx);
      const spent = (lvl: number) => (target.spells?.slots?.[lvl]?.used ?? 0) > 0;
      if (![1, 2, 3].some(spent)) throw new EngineError(`У ${target.name} нет потраченных ячеек 1–3 круга`);
      ctx.pay();
      const roll = rollOf("1d3");
      const level = [3, 2, 1].find((lvl) => lvl <= roll && spent(lvl));
      if (!level) return result(`Подпитка магией: выпало ${roll} — у ${target.name} нет потраченных ячеек такого круга или ниже`);
      const slot = target.spells.slots[level];
      target.spells = { ...target.spells, slots: { ...target.spells.slots, [level]: { ...slot, used: slot.used - 1 } } };
      ctx.state.mark(target.id);
      log(ctx.state, ctx.c, `${ctx.c.name}: Подпитка магией — ${target.name} восстанавливает ячейку ${level} круга (выпало ${roll})`);
      return result(`${target.name} восстанавливает ячейку ${level} круга`, [{ name: target.name, amount: 0 }]);
    },

    // ---- Великан ----
    ...Object.fromEntries(
      CLEAVER_TYPES.map((t) => [
        `giant/cleaver-${t.id}`,
        (ctx: ActionCtx) => {
          requireRage(ctx.c, ctx.ability.name);
          ctx.pay();
          setCleaver(ctx.state, ctx.c, t.type);
          log(ctx.state, ctx.c, `${ctx.c.name}: Стихийное оружие — ${t.name}`);
          return result(`Оружие наполнено стихией: ${t.name}`);
        },
      ])
    ),
    "giant/mighty-impel": (ctx) => {
      requireRage(ctx.c, ctx.ability.name);
      const colossus = !!abilityByKey(ctx.c, "giant/demiurgic-colossus");
      const target = requireFoe(ctx, colossus ? 15 : 10);
      if (!sizeAtMost(target, colossus ? "large" : "medium")) throw new EngineError(`${target.name} слишком велик для броска`);
      ctx.pay();
      if (saves(ctx.state, target, "STR", ctx.params.saveDC ?? dcBy(ctx.c, "STR"), ctx.ability.name)) {
        return result(`${target.name} устоял`, [{ name: target.name, saved: true, amount: 0 }]);
      }
      pushCombatantAway(ctx.state, target, { x: ctx.c.x, y: ctx.c.y }, 6);
      log(ctx.state, ctx.c, `${ctx.c.name} швыряет ${target.name} на 30 футов`);
      return result(`${target.name} отброшен на 30 футов`, [{ name: target.name, saved: false, amount: 0 }]);
    },
  },

  riders: {
    // Ревнитель: первое попадание оружием в свой ход в ярости
    "zealot/divine-fury": {
      whileCondition: RAGE,
      ownTurn: true,
      oncePerTurn: true,
      apply: (ctx) => {
        const type = ctx.ability.parameters?.featureValue === 1 ? "necrotic" : "radiant";
        const d = ctx.roll("1d6") + Math.floor((ctx.attacker.level || 1) / 2);
        ctx.add(d, type, true);
        return `, Божественная ярость +${d}`;
      },
    },
    // Хранитель предков: первое существо, по которому варвар попал в свой ход
    "ancestral-guardian/ancestral-protectors": {
      attacks: "any",
      whileCondition: RAGE,
      ownTurn: true,
      oncePerTurn: true,
      apply: (ctx) => {
        applyEffect(ctx.state, ctx.target.id, { condition: "ancestral_mark", durationRounds: 1 }, ctx.attacker.id);
        return `, духи предков окружают ${ctx.target.name}`;
      },
    },
    // Вестник бури, Море (14 ур.): реакцией сбить с ног существо в ауре
    "storm-herald/raging-storm": {
      whileCondition: RAGE,
      reaction: true,
      when: (ctx) => stormEnv(ctx.attacker) === "sea" && distanceFt(ctx.attacker, ctx.target) <= 10 && !hasCondition(ctx.target, "prone"),
      apply: (ctx) => {
        if (ctx.save("STR", dcBy(ctx.attacker, "CON"), "Ярость бури")) return `, Ярость бури: ${ctx.target.name} устоял`;
        applyEffect(ctx.state, ctx.target.id, { condition: "prone" }, ctx.attacker.id);
        return `, Ярость бури: ${ctx.target.name} сбит с ног`;
      },
    },
    // Зверь: укус лечит при хитах меньше половины
    "beast/form-of-the-beast": {
      attacks: "melee",
      ownTurn: true,
      oncePerTurn: true,
      when: (ctx) => ctx.attack.id === "beast_bite" && ctx.attacker.hpCurrent < ctx.attacker.hpMax / 2,
      apply: (ctx) => {
        const amount = ctx.attacker.profBonus || 2;
        heal(ctx.state, ctx.attacker.id, amount);
        return `, укус восстанавливает ${amount} хитов`;
      },
    },
    "beast/infectious-fury": {
      attacks: "melee",
      whileCondition: RAGE,
      armed: true,
      spendUse: true,
      when: (ctx) => isNaturalWeapon(ctx.attack),
      apply: (ctx) => {
        if (ctx.save("WIS", ctx.ability.parameters?.saveDC ?? dcBy(ctx.attacker, "CON"), "Заразная ярость")) {
          return `, Заразная ярость: ${ctx.target.name} устоял`;
        }
        const d = ctx.roll("2d12");
        ctx.add(d, "psychic", true);
        return `, Заразная ярость +${d} психического урона`;
      },
    },
    // Великан: стихия оружия
    "giant/elemental-cleaver": {
      whileCondition: RAGE,
      when: (ctx) => !!cleaverType(ctx.attacker),
      apply: (ctx) => {
        const d = ctx.roll(`${ctx.ability.parameters?.featureValue ?? 1}d6`);
        ctx.add(d, cleaverType(ctx.attacker), true);
        return `, Стихийное оружие +${d}`;
      },
    },
    // Дикая магия, всплеск 4: урон оружия — силовым полем
    "wild-magic/wild-surge": {
      whileCondition: RAGE,
      when: (ctx) => surgeOf(ctx.attacker) === 4,
      apply: (ctx) => {
        if (ctx.res.damageParts[0]) ctx.res.damageParts[0] = { ...ctx.res.damageParts[0], type: "force", magical: true };
        return ", урон силовым полем (Всплеск дикой магии)";
      },
    },
  },

  reductions: {
    // Духовный щит: реакцией уменьшить урон по союзнику в 30 футах
    "ancestral-guardian/spirit-shield": {
      by: "ally",
      range: 30,
      whileCondition: RAGE,
      when: (ctx) => ctx.amount >= 5 || ctx.amount >= ctx.target.hpCurrent,
      reduce: (ctx) => rollOf(`${spiritShieldDice(ctx.owner.level)}d6`),
      after: (ctx, cut) => {
        // Мстительные предки (14 ур.): нападавший получает столько же урона силовым полем
        if (!ctx.attacker || !alive(ctx.attacker) || !abilityByKey(ctx.owner, "ancestral-guardian/vengeful-ancestors")) return;
        log(ctx.state, ctx.owner, `${ctx.owner.name}: Мстительные предки — ${ctx.attacker.name} получает ${cut} урона силовым полем`);
        dealDamage(ctx.state, ctx.attacker.id, cut, { damageType: "force", attackerId: ctx.owner.id, source: ctx.owner.id });
      },
    },
    // Защитники предков: урон атак помеченного по всем, кроме варвара, уменьшается вдвое
    "ancestral-guardian/ancestral-protectors": {
      by: "ally",
      range: 1000,
      reaction: false,
      when: (ctx) => ctx.isAttack && !!ctx.attacker?.conditions.some((x) => x.type === "ancestral_mark" && x.source === ctx.owner.id),
      reduce: (ctx) => ctx.amount - Math.floor(ctx.amount / 2),
    },
  },

  damaged: {
    "barbarian/rage": (ctx) => {
      if (raging(ctx.owner) && ctx.amount > 0 && !hasCondition(ctx.owner, "rage_fed")) {
        ctx.owner.conditions = [...ctx.owner.conditions, { type: "rage_fed" }];
        ctx.state.mark(ctx.owner.id);
      }
    },
    // Ответный удар берсерка: реакцией рукопашная атака по тому, кто нанёс урон в 5 футах
    "path-of-the-berserker/retaliation": (ctx) => {
      const { state, owner, attacker } = ctx;
      if (!attacker || attacker.id === owner.id || !alive(attacker) || !isHostile(owner.type, attacker.type)) return;
      if (!alive(owner) || !canAct(owner) || owner.reactionUsed || distanceFt(owner, attacker) > 5) return;
      const weapon = weaponOf(owner, "melee");
      if (!weapon || !inReach(state, owner, attacker, weapon)) return;
      owner.reactionUsed = true;
      log(state, owner, `${owner.name}: Ответный удар по ${attacker.name}`);
      performAttack(state, owner.id, attacker.id, weapon.id, { skipTurnCheck: true, skipCost: true });
    },
    // Острые шипы буйствующего
    "battlerager/spiked-retribution": (ctx) => {
      const { state, owner, attacker } = ctx;
      if (!ctx.isAttack || !attacker || !alive(attacker) || !raging(owner) || !alive(owner) || !canAct(owner)) return;
      if (distanceFt(owner, attacker) > 5) return;
      log(state, owner, `${owner.name}: Острые шипы — ${attacker.name} получает 3 колющего урона`);
      dealDamage(state, attacker.id, 3, { damageType: "piercing", attackerId: owner.id, source: owner.id });
    },
    // Вестник бури, Пустыня (14 ур.): реакцией опалить попавшего в ауре
    "storm-herald/raging-storm": (ctx) => {
      const { state, owner, attacker } = ctx;
      if (!ctx.isAttack || !attacker || !alive(attacker) || !raging(owner) || stormEnv(owner) !== "desert") return;
      if (!alive(owner) || !canAct(owner) || owner.reactionUsed || distanceFt(owner, attacker) > 10) return;
      owner.reactionUsed = true;
      if (saves(state, attacker, "DEX", dcBy(owner, "CON"), "Ярость бури")) return;
      const amount = Math.floor((owner.level || 1) / 2);
      log(state, owner, `${owner.name}: Ярость бури — ${attacker.name} получает ${amount} урона огнём`);
      dealDamage(state, attacker.id, amount, { damageType: "fire", attackerId: owner.id, source: owner.id });
    },
    // Дикая магия, всплеск 5: попавший атакой получает 1к6 урона силовым полем
    "wild-magic/wild-surge": (ctx) => {
      const { state, owner, attacker } = ctx;
      if (!ctx.isAttack || !attacker || !alive(attacker) || !raging(owner) || surgeOf(owner) !== 5) return;
      const d = rollOf("1d6");
      log(state, owner, `${owner.name}: ответный шип — ${attacker.name} получает ${d} урона силовым полем`);
      dealDamage(state, attacker.id, d, { damageType: "force", attackerId: owner.id, source: owner.id });
    },
    // Нестабильный отклик: реакцией новый бросок по таблице, когда прошлый эффект уже отыгран
    "wild-magic/unstable-backlash": (ctx) => {
      const { state, owner } = ctx;
      if (!raging(owner) || !alive(owner) || !canAct(owner) || owner.reactionUsed) return;
      if (![1, 7].includes(surgeOf(owner))) return;
      owner.reactionUsed = true;
      log(state, owner, `${owner.name}: Нестабильный отклик — новый всплеск дикой магии`);
      wildSurge(state, owner);
    },
  },

  // Хвост зверя: реакцией +1к8 к КД против попавшей атаки существа в 10 футах
  defense: {
    "beast/form-of-the-beast": ({ state, owner, attacker, res }) => {
      if (!owner.conditions.some((x) => x.type === "beast_form" && x.value === 3) || !raging(owner)) return;
      if (owner.reactionUsed || !canAct(owner) || distanceFt(owner, attacker) > 10) return;
      // Натуральная 20 попадает всегда; кость не поможет, если запас попадания больше 8
      if (res.crit || res.roll.total - res.targetAC >= 8) return;
      owner.reactionUsed = true;
      const d = rollOf("1d8");
      state.mark(owner.id);
      if (res.roll.total >= res.targetAC + d) {
        res.text += ` (хвост: КД +${d}, не помогло)`;
        return;
      }
      res.hit = false;
      res.damage = 0;
      res.damageParts = [];
      res.text += ` — хвост отбивает удар (КД +${d})`;
    },
  },

  saveRerolls: {
    "zealot/fanatical-focus": { whileCondition: RAGE, marker: "fanatical_used" },
  },
});
