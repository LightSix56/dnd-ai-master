// Боевая механика подклассов Воина: умения работают в движке сами, мастер не нужен.
//
// Устройство:
//  • «Заряженные» умения (приёмы, магические выстрелы, Псионический удар, руны): игрок нажимает кнопку
//    до атаки, умение заряжается до конца хода, и при ближайшем подходящем попадании движок сам
//    тратит кость или использование, бросает урон и накладывает эффект (rider в fighter-pool.ts).
//  • Действия по кнопке (Сплочение, Финт, Захват, Эхо…): handler в ACTIONS разыгрывает всё целиком.
//  • Реакции и срабатывающие умения (Парирование, Ответный удар, Защитное поле…): включаются сами из
//    хуков движка — урон, промах противника, перемещение, конец хода.
//
// Движок вызывает функции этого файла из engine.ts; сам файл берёт у движка урон, эффекты и атаки.

import { rollDice, rollD20 } from "@/lib/dnd/dice";
import { getLineCells, isCellBlocked } from "./movement";
import { distanceFt } from "./grid";
import { canAct, canPayForAttack, computeAttackAdvantage, checkReach, effectiveAC, hasCondition, payForAttack, resolveAttack, rollDamage, type AttackResolution, type DamagePart } from "./rules";
import {
  EngineError,
  applyEffect,
  dealDamage,
  grantTempHp,
  heal,
  lastAttackThisTurn,
  payActionCost,
  performAttack,
  pushCombatantAway,
  rollEffectSave,
  spendAbilityUse,
  turnKey,
  type CastResult,
  type CombatState,
} from "./engine";
import {
  ARCANE_SHOT_POOL,
  PSIONIC_POOL,
  RIDER_COND,
  SUPERIORITY_POOL,
  abilityByKey,
  armRider,
  armedRiders,
  disarmRider,
  poolFaces,
  poolLeft,
  rollDiceCrit,
  spendPool,
} from "./fighter-pool";
import { isHostile, type AbilityKey, type ActionParameters, type Attack, type CombatAbility, type Combatant } from "./types";

// ============ ОБЩЕЕ ============

/** Разбор попадания, который меняют умения: урон и его части те же, что у движка */
export interface HitResolution {
  hit: boolean;
  crit: boolean;
  damage: number;
  damageParts: DamagePart[];
  roll: { total: number; natural: number };
}

const SIZE_ORDER = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;
const largeOrSmaller = (c: Combatant) => SIZE_ORDER.indexOf(c.size ?? "medium") <= SIZE_ORDER.indexOf("large");

const modOf = (c: Combatant, a: AbilityKey) => c.abilityMods?.[a] ?? 0;
const dcOf = (params: ActionParameters | undefined, fallback: number) => params?.saveDC ?? fallback;
const alive = (c: Combatant) => c.hpCurrent > 0 && !hasCondition(c, "dead");
const friendly = (a: Combatant, b: Combatant) => !isHostile(a.type, b.type);

/** Урон от умения прибавляется к попаданию: части урона — того же типа, что у оружия */
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

function hostilesOf(state: CombatState, c: Combatant): Combatant[] {
  return state.combatants.filter((t) => t.id !== c.id && alive(t) && isHostile(c.type, t.type));
}

function alliesOf(state: CombatState, c: Combatant): Combatant[] {
  return state.combatants.filter((t) => t.id !== c.id && alive(t) && friendly(c, t));
}

function pickTarget(state: CombatState, opts: { targetIds?: string[] }, index: number): Combatant | undefined {
  const id = opts.targetIds?.[index];
  return id ? state.get(id) : undefined;
}

/** Лучшая атака оружием, которой боец достаёт до цели (для реакций и чужих атак) */
function bestAttackReaching(state: CombatState, c: Combatant, target: Combatant, kind?: "melee" | "ranged"): Attack | undefined {
  return c.attacks
    .filter((a) => a.kind !== "spell" && !a.usesSpellAttack && !a.id.startsWith("__") && (!kind || a.kind === kind))
    .filter((a) => checkReach(c, target, a, state.mapElements).ok)
    .sort((a, b) => {
      const avg = (x: Attack) => x.damage.reduce((s, d) => s + (d.dice ? Number(d.dice.split("d")[0]) * (Number(d.dice.split("d")[1]) + 1) / 2 : 0) + d.mod, 0);
      return avg(b) - avg(a);
    })[0];
}

function log(state: CombatState, c: Combatant, text: string, kind = "ability"): void {
  state.addLog(text, kind as never, c.name);
}

/** Метка «уже было в этом ходу» (не чаще раза за ход) */
function usedThisTurn(state: CombatState, c: Combatant, marker: string): boolean {
  const key = turnKey(state);
  return c.conditions.some((x) => x.type === marker && x.source === key);
}

function markTurn(state: CombatState, c: Combatant, marker: string): void {
  c.conditions = [...c.conditions.filter((x) => x.type !== marker), { type: marker, source: turnKey(state) }];
}

const isBowAttack = (a: Attack) => a.kind === "ranged" && /лук|bow/i.test(a.name);

function bowAttack(c: Combatant): Attack | undefined {
  return c.attacks.find((a) => isBowAttack(a) && !a.id.startsWith("__"));
}

/** Сколько кубов у 2к6-эффектов Магического выстрела: 2 (4 на 18 уровне) */
const arrowDice = (c: Combatant) => (c.level >= 18 ? 4 : 2);

/** Мало ли хитов осталось у цели, чтобы реакция того стоила */
const worthIt = (target: Combatant, amount: number, frac: number) => amount >= Math.max(1, target.hpCurrent * frac);

// ============ ЗАРЯЖЕННЫЕ УМЕНИЯ ============

interface HitCtx {
  state: CombatState;
  attacker: Combatant;
  target: Combatant;
  attack: Attack;
  res: HitResolution;
  /** Размер кости запаса (кость превосходства: 8, 10, 12) */
  faces: number;
  dc: number;
  params: ActionParameters;
  /** Бросок кости умения; при крите кости удваиваются */
  die: (count?: number) => number;
  add: (amount: number, type?: string, magical?: boolean) => void;
}

interface RiderDef {
  /** Запас, из которого списывается заряд при срабатывании; у рун запаса нет — тратится само умение */
  pool?: string;
  /** Только рукопашная / только дальнобойная атака оружием */
  weapon?: "melee" | "ranged";
  /** Только из лука (Магический выстрел) */
  bow?: boolean;
  /** Не чаще раза за ход: метка состояния, по которой это проверяется */
  once?: string;
  /** Дальность до цели в футах (Псионический удар — 30) */
  maxRange?: number;
  /** Применяется при попадании; возвращает текст для журнала атаки */
  apply: (ctx: HitCtx) => string;
}

const dmgType = (ctx: HitCtx) => ctx.res.damageParts[0]?.type ?? ctx.attack.damage[0]?.type ?? "";

/** Спасбросок цели против умения; текст результата и успех */
function saveAgainst(ctx: HitCtx, ability: AbilityKey, label: string): { saved: boolean; text: string } {
  const save = rollEffectSave(ctx.state, ctx.target, ability, ctx.dc, false, label);
  ctx.state.addLog(`${ctx.target.name}: ${save.text} против «${label}»`, "save", ctx.target.name);
  return { saved: save.success, text: save.text };
}

/** Приём, который просто добавляет кость превосходства к урону */
const bonusDie = (label: string, extra?: (ctx: HitCtx, die: number) => string): RiderDef["apply"] => (ctx) => {
  const d = ctx.die();
  ctx.add(d);
  return `, ${label} +${d}${extra ? extra(ctx, d) : ""}`;
};

const RIDERS: Record<string, RiderDef> = {
  "battlemaster/lunging-attack": {
    pool: SUPERIORITY_POOL,
    weapon: "melee",
    apply: bonusDie("Атака с выпадом"),
  },
  "battlemaster/maneuvering-attack": {
    pool: SUPERIORITY_POOL,
    apply: bonusDie("Атака с манёвром", (ctx) => {
      // Союзник может реакцией отойти на половину скорости без провоцированных атак
      const ally = alliesOf(ctx.state, ctx.attacker)
        .filter((a) => distanceFt(a, ctx.attacker) <= 30)
        .sort((a, b) => distanceFt(a, ctx.attacker) - distanceFt(b, ctx.attacker))[0];
      if (!ally) return "";
      applyEffect(ctx.state, ally.id, { condition: "disengaging", durationRounds: 1 }, ctx.attacker.id);
      return `; ${ally.name} может переместиться без провоцированных атак`;
    }),
  },
  "battlemaster/menacing-attack": {
    pool: SUPERIORITY_POOL,
    apply: (ctx) => {
      const d = ctx.die();
      ctx.add(d);
      const s = saveAgainst(ctx, "WIS", "Атака с угрозой");
      if (!s.saved) applyEffect(ctx.state, ctx.target.id, { condition: "frightened", durationRounds: 1 }, ctx.attacker.id);
      return `, Атака с угрозой +${d}; ${ctx.target.name} ${s.saved ? "не поддаётся страху" : "испуган до конца своего хода"}`;
    },
  },
  "battlemaster/disarming-attack": {
    pool: SUPERIORITY_POOL,
    apply: (ctx) => {
      const d = ctx.die();
      ctx.add(d);
      const s = saveAgainst(ctx, "STR", "Обезоруживающая атака");
      if (!s.saved) applyEffect(ctx.state, ctx.target.id, { condition: "disarmed", durationRounds: 1 }, ctx.attacker.id);
      return `, Обезоруживающая атака +${d}; ${ctx.target.name} ${s.saved ? "удерживает оружие" : "роняет оружие (помеха на атаки)"}`;
    },
  },
  "battlemaster/trip-attack": {
    pool: SUPERIORITY_POOL,
    apply: (ctx) => {
      const d = ctx.die();
      ctx.add(d);
      if (!largeOrSmaller(ctx.target)) return `, Опрокидывающая атака +${d}; ${ctx.target.name} слишком велик, чтобы его сбить`;
      const s = saveAgainst(ctx, "STR", "Опрокидывающая атака");
      if (!s.saved) applyEffect(ctx.state, ctx.target.id, { condition: "prone" }, ctx.attacker.id);
      return `, Опрокидывающая атака +${d}; ${ctx.target.name} ${s.saved ? "устоял" : "сбит с ног"}`;
    },
  },
  "battlemaster/distracting-strike": {
    pool: SUPERIORITY_POOL,
    apply: (ctx) => {
      const d = ctx.die();
      ctx.add(d);
      // До начала следующего хода воина: первая атака по цели от другого существа идёт с преимуществом
      applyEffect(ctx.state, ctx.target.id, { condition: "distracted", durationRounds: 2 }, ctx.attacker.id);
      return `, Отвлекающий удар +${d}; следующая атака по ${ctx.target.name} от союзника — с преимуществом`;
    },
  },
  "battlemaster/goading-attack": {
    pool: SUPERIORITY_POOL,
    apply: (ctx) => {
      const d = ctx.die();
      ctx.add(d);
      const s = saveAgainst(ctx, "WIS", "Провоцирующая атака");
      if (!s.saved) applyEffect(ctx.state, ctx.target.id, { condition: "goaded", durationRounds: 1 }, ctx.attacker.id);
      return `, Провоцирующая атака +${d}; ${ctx.target.name} ${s.saved ? "не поддаётся" : "атакует всех, кроме воина, с помехой"}`;
    },
  },
  "battlemaster/pushing-attack": {
    pool: SUPERIORITY_POOL,
    apply: (ctx) => {
      const d = ctx.die();
      ctx.add(d);
      if (!largeOrSmaller(ctx.target)) return `, Толкающая атака +${d}; ${ctx.target.name} слишком велик, чтобы его толкнуть`;
      const s = saveAgainst(ctx, "STR", "Толкающая атака");
      if (!s.saved) pushCombatantAway(ctx.state, ctx.target, { x: ctx.attacker.x, y: ctx.attacker.y }, 3);
      return `, Толкающая атака +${d}; ${ctx.target.name} ${s.saved ? "устоял" : "отброшен на 15 фт"}`;
    },
  },
  "battlemaster/sweeping-attack": {
    pool: SUPERIORITY_POOL,
    weapon: "melee",
    apply: (ctx) => {
      // Тот же бросок атаки по другому существу рядом с целью и в досягаемости воина
      const d = ctx.die();
      const other = hostilesOf(ctx.state, ctx.attacker)
        .filter((t) => t.id !== ctx.target.id && distanceFt(t, ctx.target) <= 5 && distanceFt(t, ctx.attacker) <= 5)
        .sort((a, b) => a.hpCurrent - b.hpCurrent)[0];
      if (!other) return `, Широкая атака: рядом нет второй цели`;
      const hits = ctx.res.roll.total >= (other.ac ?? 10);
      if (!hits) return `, Широкая атака: бросок ${ctx.res.roll.total} не пробивает КД ${other.name}`;
      dealDamage(ctx.state, other.id, d, {
        damageType: dmgType(ctx),
        isAttack: true,
        attackerId: ctx.attacker.id,
        source: ctx.attacker.id,
      });
      return `, Широкая атака: ${other.name} получает ${d} урона`;
    },
  },
  "battlemaster/precision-attack": {
    // Работает в броске атаки (rules.ts → spendPrecisionAttack); при попадании без нужды кость не тратится
    pool: SUPERIORITY_POOL,
    apply: () => "",
  },
};

/** Приёмы, которые не входят в RIDERS как отдельные «выстрелы по цели»: готовые заряженные состояния */
const PREPAID_RIDER_KEYS = new Set([
  "battlemaster/commanders-strike",
  "battlemaster/riposte",
  "battlemaster/brace",
  "battlemaster/quick-toss",
]);

/** Кость, уже оплаченная при активации (Ответный удар, Готовность, Метание…): добавляется к урону при попадании */
function prepaidDie(ctx: Omit<HitCtx, "faces" | "dc" | "params" | "die" | "add">, faces: number): number {
  return rollDiceCrit(`1d${faces}`, ctx.res.crit);
}

export function isRiderKey(key: string | undefined): boolean {
  return !!key && key in RIDERS;
}

/**
 * Срабатывание заряженных умений при попадании оружием. Вызывается из applyWeaponHitRiders.
 * Возвращает текст, который дописывается к строке атаки.
 */
export function fighterHitRiders(
  state: CombatState,
  attacker: Combatant,
  target: Combatant,
  attack: Attack,
  res: HitResolution
): string {
  if (attack.kind === "spell" || attack.usesSpellAttack) return "";
  let text = "";

  for (const cond of armedRiders(attacker)) {
    const key = cond.source ?? "";
    const prepaid = typeof cond.value === "number";

    // Оплаченные заранее приёмы (Ответный удар и т.п.): кость уже потрачена
    if (prepaid && PREPAID_RIDER_KEYS.has(key)) {
      const d = prepaidDie({ state, attacker, target, attack, res }, cond.value as number);
      addDamage(res, attack, d);
      text += `, ${abilityName(key)} +${d}`;
      disarmRider(attacker, key);
      continue;
    }

    const def = RIDERS[key];
    if (!def || key === "battlemaster/precision-attack") continue;
    if (def.weapon && attack.kind !== def.weapon) continue;
    if (def.bow && !isBowAttack(attack)) continue;
    if (def.maxRange && distanceFt(attacker, target) > def.maxRange) continue;

    const ability = abilityByKey(attacker, key);
    if (!ability) {
      disarmRider(attacker, key);
      continue;
    }
    if (def.once && usedThisTurn(state, attacker, def.once)) {
      log(state, attacker, `${attacker.name}: «${ability.name}» уже применялся в этом ходу`, "system");
      disarmRider(attacker, key);
      continue;
    }
    let faces = 0;
    if (def.pool) {
      faces = poolFaces(attacker, def.pool);
      if (!spendPool(attacker, def.pool)) {
        log(state, attacker, `${attacker.name}: «${ability.name}» не сработал — запас исчерпан`, "system");
        disarmRider(attacker, key);
        continue;
      }
    } else if (ability.usesMax > 0 && ability.usesUsed >= ability.usesMax) {
      log(state, attacker, `${attacker.name}: «${ability.name}» не сработал — использования закончились`, "system");
      disarmRider(attacker, key);
      continue;
    }
    if (ability.usesMax > 0) spendAbilityUse(attacker, ability);
    if (def.once) markTurn(state, attacker, def.once);
    disarmRider(attacker, key);

    const ctx: HitCtx = {
      state,
      attacker,
      target,
      attack,
      res,
      faces,
      dc: dcOf(ability.parameters, 8 + attacker.profBonus + Math.max(modOf(attacker, "STR"), modOf(attacker, "DEX"))),
      params: ability.parameters as ActionParameters,
      die: (count = 1) => rollDiceCrit(`${count}d${faces}`, res.crit),
      add: (amount, type, magical) => addDamage(res, attack, amount, type, magical),
    };
    text += def.apply(ctx);
  }

  // Финт: заранее оплаченная кость превосходства добавляется к урону первой удавшейся атаки по цели
  const feint = attacker.conditions.find((x) => x.type === "feint" && x.targetId === target.id);
  if (feint && typeof feint.value === "number") {
    const d = prepaidDie({ state, attacker, target, attack, res }, feint.value);
    addDamage(res, attack, d);
    text += `, Атака с финтом +${d}`;
    attacker.conditions = attacker.conditions.filter((x) => x !== feint);
  }

  text += passiveHitRiders(state, attacker, target, attack, res);
  return text;
}

function abilityName(key: string): string {
  return (
    {
      "battlemaster/commanders-strike": "Удар командующего",
      "battlemaster/riposte": "Ответный удар",
      "battlemaster/brace": "Готовность",
      "battlemaster/quick-toss": "Быстрый бросок",
    } as Record<string, string>
  )[key] ?? key;
}

/** Состояния, которые тратятся на атаку: финт, отвлечение, Активное уклонение (после боя движение закончено) */
export function fighterAfterAttack(state: CombatState, attacker: Combatant, target: Combatant): void {
  const feint = attacker.conditions.find((x) => x.type === "feint" && x.targetId === target.id);
  if (feint) attacker.conditions = attacker.conditions.filter((x) => x !== feint);
  // Стремительный удар: преимущество потрачено на дополнительную атаку
  attacker.conditions = attacker.conditions.filter((x) => !(x.type === "rapid_strike" && x.targetId === target.id));
  if (hasCondition(attacker, "evasive_footwork")) {
    attacker.conditions = attacker.conditions.filter((x) => x.type !== "evasive_footwork");
  }
  // «Отвлечён» тратится первой атакой по цели от другого существа
  const distracted = target.conditions.find((x) => x.type === "distracted" && x.source !== attacker.id);
  if (distracted) target.conditions = target.conditions.filter((x) => x !== distracted);
  state.mark(attacker.id);
}

// ============ ДЕЙСТВИЯ ПО КНОПКЕ ============

type Handler = (
  state: CombatState,
  c: Combatant,
  ability: CombatAbility,
  params: ActionParameters,
  opts: { targetIds?: string[]; center?: { x: number; y: number } | null }
) => CastResult;

const result = (text: string, targets: CastResult["targets"] = []): CastResult => ({ text, targets });

/** Зарядка умения: ничего не тратит до попадания, а прошлый приём того же запаса заменяет */
function armHandler(label: string): Handler {
  return (state, c, ability, params, opts) => {
    const def = RIDERS[params.srdKey ?? ""];
    if (!def) throw new EngineError(`«${label}»: нет правила`);
    if (def.pool && poolLeft(c, def.pool) < 1) throw new EngineError(`«${label}»: не хватает «${abilityByKey(c, def.pool)?.name ?? "запаса"}»`);
    if (def.bow && !bowAttack(c)) throw new EngineError(`«${label}»: нужен короткий или длинный лук`);
    if (def.once && usedThisTurn(state, c, def.once)) throw new EngineError(`«${label}»: в этом ходу уже применён Магический выстрел`);
    payActionCost(state, c, params.actionCost);
    // Один приём на атаку: прежний заряженный приём того же запаса снимается
    for (const cond of armedRiders(c)) {
      const other = RIDERS[cond.source ?? ""];
      if (def.pool && other && other.pool === def.pool && cond.source !== params.srdKey) disarmRider(c, cond.source as string);
    }
    armRider(c, params.srdKey as string, opts.targetIds?.[0]);
    state.mark(c.id);
    log(state, c, `${c.name} готовит «${label}»: сработает при попадании в этом ходу`);
    return result(`${c.name} готовит «${label}». Тратится при попадании.`);
  };
}

/** Дальность лечения и боевых бонусов союзникам */
const SUPPORT_RANGE = 30;

const ACTIONS: Record<string, Handler> = {
  // ---- Мастер боевых искусств ----
  "battlemaster/evasive-footwork": (state, c, ability, params) => {
    const faces = poolFaces(c, SUPERIORITY_POOL);
    const d = rollDice(`1d${faces}`).total;
    payActionCost(state, c, params.actionCost);
    c.conditions = [...c.conditions.filter((x) => x.type !== "evasive_footwork"), { type: "evasive_footwork", value: d, duration: 1 }];
    state.mark(c.id);
    log(state, c, `${c.name}: Активное уклонение — КД +${d} на время перемещения`);
    return result(`${c.name} уклоняется на ходу: КД +${d} (кость превосходства)`);
  },

  "battlemaster/rally": (state, c, ability, params, opts) => {
    const ally = pickTarget(state, opts, 0) ?? c;
    if (!friendly(c, ally)) throw new EngineError("«Сплочение» — на союзника");
    const faces = poolFaces(c, SUPERIORITY_POOL);
    const d = rollDice(`1d${faces}`).total;
    const total = Math.max(1, d + modOf(c, "CHA"));
    payActionCost(state, c, params.actionCost);
    grantTempHp(state, ally.id, total);
    log(state, c, `${c.name}: Сплочение — ${ally.name} получает ${total} временных хитов (${d} + мод. Харизмы)`);
    return result(`${ally.name} получает ${total} временных хитов`, [{ name: ally.name, amount: total }]);
  },

  "battlemaster/ambush": (state, c, ability, params) => {
    const d = rollDice(`1d${poolFaces(c, SUPERIORITY_POOL)}`).total;
    payActionCost(state, c, params.actionCost);
    c.conditions = [...c.conditions.filter((x) => x.type !== "ambush"), { type: "ambush", value: d, duration: 2 }];
    state.mark(c.id);
    log(state, c, `${c.name}: Засада — +${d} к ближайшей проверке Скрытности`);
    return result(`${c.name} готовит засаду: +${d} к проверке Скрытности`);
  },

  "battlemaster/feinting-attack": (state, c, ability, params, opts) => {
    const target = pickTarget(state, opts, 0);
    if (!target || !isHostile(c.type, target.type) || !alive(target)) throw new EngineError("«Атака с финтом» — на врага рядом");
    if (distanceFt(c, target) > 5) throw new EngineError("Финт возможен против существа в пределах 5 футов");
    payActionCost(state, c, params.actionCost);
    c.conditions = [
      ...c.conditions.filter((x) => x.type !== "feint"),
      { type: "feint", targetId: target.id, value: poolFaces(c, SUPERIORITY_POOL), duration: 1 },
    ];
    state.mark(c.id);
    log(state, c, `${c.name} делает финт против ${target.name}: следующая атака по цели — с преимуществом`);
    return result(`${c.name} делает финт против ${target.name}`, [{ name: target.name, amount: 0 }]);
  },

  "battlemaster/grappling-strike": (state, c, ability, params, opts) => {
    const last = lastAttackThisTurn(state, c);
    if (!last || !last.hit || last.kind !== "melee") {
      throw new EngineError("«Атака с захватом» — сразу после попадания рукопашной атакой в этом ходу");
    }
    const target = pickTarget(state, opts, 0) ?? state.get(last.targetId);
    if (!target || !alive(target)) throw new EngineError("Нет цели для захвата");
    payActionCost(state, c, params.actionCost);
    const faces = poolFaces(c, SUPERIORITY_POOL);
    const bonus = rollDice(`1d${faces}`).total;
    const mine = rollD20(modOf(c, "STR") + c.profBonus + bonus, hasCondition(c, "giants_might"), false);
    const theirMod = Math.max(modOf(target, "STR"), modOf(target, "DEX"));
    const theirs = rollD20(theirMod, false, false);
    const won = mine.total >= theirs.total;
    log(
      state,
      c,
      `${c.name}: Атака с захватом — Атлетика ${mine.total} (с костью +${bonus}) против ${theirs.total}: ${won ? `${target.name} схвачен` : "захват не удался"}`
    );
    if (won) applyEffect(state, target.id, { condition: "grappled" }, c.id);
    return result(won ? `${target.name} схвачен` : "Захват не удался", [{ name: target.name, saved: !won, amount: 0 }]);
  },

  "battlemaster/quick-toss": (state, c, ability, params, opts) => {
    const target = pickTarget(state, opts, 0);
    if (!target || !isHostile(c.type, target.type) || !alive(target)) throw new EngineError("«Быстрый бросок» — по врагу");
    const thrown =
      c.attacks.find((a) => a.thrown && a.kind !== "spell") ??
      c.attacks.find((a) => /метательн|топорик|дротик|копь[её]|javelin|handaxe|dart|dagger|кинжал/i.test(a.name));
    if (!thrown) throw new EngineError("Нет метательного оружия");
    const faces = poolFaces(c, SUPERIORITY_POOL);
    const temp: Attack = {
      ...thrown,
      id: "__quick_toss",
      name: `${thrown.name} (бросок)`,
      kind: "ranged",
      range: { normal: 20, long: 60 },
      actionCost: "bonus",
    };
    c.attacks = [...c.attacks, temp];
    armRider(c, "battlemaster/quick-toss");
    const arm = c.conditions.find((x) => x.type === RIDER_COND && x.source === "battlemaster/quick-toss");
    if (arm) arm.value = faces;
    try {
      const out = performAttack(state, c.id, target.id, temp.id, { skipTurnCheck: true });
      return result(out.text, [{ name: target.name, hit: out.hit, amount: out.damage }]);
    } finally {
      disarmRider(c, "battlemaster/quick-toss");
      c.attacks = c.attacks.filter((a) => a.id !== "__quick_toss");
    }
  },

  "battlemaster/commanders-strike": (state, c, ability, params, opts) => {
    const ally = pickTarget(state, opts, 0);
    if (!ally || ally.id === c.id || !friendly(c, ally) || !alive(ally)) throw new EngineError("«Удар командующего» — на союзника");
    if (ally.reactionUsed || !canAct(ally)) throw new EngineError(`${ally.name} не может использовать реакцию`);
    if (c.actionUsed && c.attacksMadeThisAction >= c.attacksPerAction) {
      throw new EngineError("Удар командующего заменяет одну из ваших атак — атак в этом Действии не осталось");
    }
    const enemy =
      pickTarget(state, opts, 1) ??
      hostilesOf(state, ally)
        .filter((t) => bestAttackReaching(state, ally, t))
        .sort((a, b) => a.hpCurrent - b.hpCurrent)[0];
    if (!enemy) throw new EngineError(`${ally.name} не достаёт ни до одного врага`);
    const atk = bestAttackReaching(state, ally, enemy);
    if (!atk) throw new EngineError(`${ally.name} не достаёт до ${enemy.name}`);

    payActionCost(state, c, params.actionCost);
    // Отказ от одной из атак: Действие считается начатым
    if (!c.actionUsed) c.actionUsed = true;
    c.attacksMadeThisAction = Math.min(c.attacksPerAction, Math.max(c.attacksMadeThisAction, 0) + 1);
    ally.reactionUsed = true;
    armRider(ally, "battlemaster/commanders-strike");
    const arm = ally.conditions.find((x) => x.type === RIDER_COND && x.source === "battlemaster/commanders-strike");
    if (arm) arm.value = poolFaces(c, SUPERIORITY_POOL);
    log(state, c, `${c.name}: Удар командующего — ${ally.name} атакует ${enemy.name} реакцией`);
    try {
      const out = performAttack(state, ally.id, enemy.id, atk.id, { skipTurnCheck: true, skipCost: true });
      return result(out.text, [{ name: enemy.name, hit: out.hit, amount: out.damage }]);
    } finally {
      disarmRider(ally, "battlemaster/commanders-strike");
    }
  },

  "battlemaster/bait-and-switch": (state, c, ability, params, opts) => {
    const other = pickTarget(state, opts, 0);
    if (!other || other.id === c.id || !alive(other) || !friendly(c, other)) throw new EngineError("«Подмена» — на союзника в пределах 5 футов");
    if (distanceFt(c, other) > 5) throw new EngineError("Подмена — с существом в пределах 5 футов");
    if (hasCondition(other, "stunned") || hasCondition(other, "paralyzed") || hasCondition(other, "incapacitated") || hasCondition(other, "unconscious")) {
      throw new EngineError(`${other.name} недееспособен и не может поменяться местами`);
    }
    if (c.movementUsed + 5 > c.speed * (hasCondition(c, "dashing") ? 2 : 1)) {
      throw new EngineError("Не хватает перемещения (нужно 5 футов)");
    }
    const faces = poolFaces(c, SUPERIORITY_POOL);
    const d = rollDice(`1d${faces}`).total;
    [c.x, other.x] = [other.x, c.x];
    [c.y, other.y] = [other.y, c.y];
    c.movementUsed += 5;
    payActionCost(state, c, params.actionCost);
    // Кость добавляется к КД воина или союзника до начала следующего хода — тому, кто стоит в большей опасности (с меньшим КД)
    const who = other.ac < c.ac ? other : c;
    who.conditions = [...who.conditions.filter((x) => x.type !== "bait_and_switch"), { type: "bait_and_switch", value: d, duration: 1, source: c.id }];
    state.mark(c.id);
    state.mark(other.id);
    log(state, c, `${c.name} меняется местами с ${other.name} (Подмена); КД ${who.name} +${d}`);
    return result(`${c.name} и ${other.name} меняются местами; КД ${who.name} +${d}`, [{ name: other.name, amount: 0 }]);
  },
};

// Приёмы, которые заряжаются до атаки
for (const [key, label] of [
  ["battlemaster/lunging-attack", "Атака с выпадом"],
  ["battlemaster/maneuvering-attack", "Атака с манёвром"],
  ["battlemaster/menacing-attack", "Атака с угрозой"],
  ["battlemaster/disarming-attack", "Обезоруживающая атака"],
  ["battlemaster/trip-attack", "Опрокидывающая атака"],
  ["battlemaster/distracting-strike", "Отвлекающий удар"],
  ["battlemaster/goading-attack", "Провоцирующая атака"],
  ["battlemaster/pushing-attack", "Толкающая атака"],
  ["battlemaster/sweeping-attack", "Широкая атака"],
  ["battlemaster/precision-attack", "Точная атака"],
] as const) {
  ACTIONS[key] = armHandler(label);
}

/** Умения, которые движок выполняет сам: по кнопке (ACTIONS) или заряжая атаку */
export function isFighterAction(key: string | undefined): boolean {
  return !!key && key in ACTIONS;
}

/** Точка входа для useClassFeature: null — умение не из этого модуля */
export function useFighterFeature(
  state: CombatState,
  c: Combatant,
  ability: CombatAbility,
  params: ActionParameters,
  opts: { targetIds?: string[]; center?: { x: number; y: number } | null }
): CastResult | null {
  const handler = ACTIONS[params.srdKey ?? ""];
  if (!handler) return null;
  // Умение, которое возвращается тратой кости (Телекинетическое передвижение, Пси-прыжок): после бесплатного раза платим кость
  const free = !(ability.usesMax > 0 && ability.usesUsed >= ability.usesMax);
  if (!free) {
    if (!params.dieFallback || poolLeft(c, params.dieFallback) < 1) throw new EngineError(`«${ability.name}»: использования закончились`);
  }
  const out = handler(state, c, ability, params, opts);
  if (!free && params.dieFallback) spendPool(c, params.dieFallback);
  // Уровень «использований» самого умения (раз в ход и т. п.)
  if (free && !params.deferCost && ability.usesMax > 0) spendAbilityUse(c, ability);
  state.mark(c.id);
  return out;
}

// ============ РЕАКЦИИ И СРАБАТЫВАЮЩИЕ УМЕНИЯ ============

/** Умение-реакция бойца готово: есть реакция, он дееспособен, остался заряд запаса */
function reactionReady(c: Combatant, key: string, pool?: string): CombatAbility | null {
  const ability = abilityByKey(c, key);
  if (!ability || c.reactionUsed || !alive(c) || !canAct(c)) return null;
  if (ability.usesMax > 0 && ability.usesUsed >= ability.usesMax) return null;
  if (pool && poolLeft(c, pool) < 1) return null;
  return ability;
}

/**
 * Урон уменьшают реакции: Парирование и Защитное поле. Вызывается из dealDamage после сопротивлений.
 * Возвращает уменьшенный урон.
 */
export function fighterReduceDamage(
  state: CombatState,
  target: Combatant,
  amount: number,
  opts: { isAttack?: boolean; attackerId?: string }
): number {
  if (amount <= 0) return amount;
  const attacker = opts.attackerId ? state.get(opts.attackerId) : undefined;

  // Ослабляющая стрела: атаки оружием ослабленного наносят вдвое меньше урона
  if (opts.isAttack && attacker && hasCondition(attacker, "enfeebled")) {
    amount = Math.floor(amount / 2);
    if (amount <= 0) return 0;
  }

  // Защитное поле воина-псиоников: реакция любого воина-псионика в 30 футах от получившего урон
  if (amount >= 6) {
    for (const k of state.combatants) {
      if (!alive(k) || !friendly(k, target) || distanceFt(k, target) > 30) continue;
      const field = reactionReady(k, "psi-warrior/protective-field", PSIONIC_POOL);
      if (!field) continue;
      const faces = poolFaces(k, PSIONIC_POOL);
      spendPool(k, PSIONIC_POOL);
      k.reactionUsed = true;
      const d = rollDice(`1d${faces}`).total;
      const cut = Math.min(amount, d + Math.max(1, modOf(k, "INT")));
      log(state, k, `🛡️ ${k.name}: Защитное поле — урон по ${target.name} уменьшен на ${cut} (${amount} → ${amount - cut})`);
      amount -= cut;
      state.mark(k.id);
      if (amount <= 0) return 0;
      break;
    }
  }

  // Парирование: урон от рукопашной атаки уменьшается на кость + мод. Ловкости
  const parry = reactionReady(target, "battlemaster/parry", SUPERIORITY_POOL);
  if (parry && opts.isAttack && attacker && attacker.id !== target.id && distanceFt(attacker, target) <= 5) {
    const faces = poolFaces(target, SUPERIORITY_POOL);
    spendPool(target, SUPERIORITY_POOL);
    const d = rollDice(`1d${faces}`).total;
    const cut = Math.min(amount, d + modOf(target, "DEX"));
    target.reactionUsed = true;
    log(state, target, `🛡️ ${target.name}: Парирование — урон уменьшен на ${cut} (${amount} → ${amount - cut})`);
    amount -= cut;
    state.mark(target.id);
    if (amount <= 0) return 0;
  }

  return amount;
}

/**
 * Реакции после броска вражеской атаки по бойцу: Ответный удар после промаха.
 * Вызывается из performAttackUnmarked; возвращает текст для журнала.
 */
export function fighterOnAttackResolved(
  state: CombatState,
  attacker: Combatant,
  target: Combatant,
  attack: Attack,
  res: HitResolution
): string {
  let text = "";
  if (res.hit || attack.kind !== "melee" || attack.usesSpellAttack) return text;

  // Ответный удар: существо промахнулось по воину рукопашной атакой
  const riposte = reactionReady(target, "battlemaster/riposte", SUPERIORITY_POOL);
  if (riposte && alive(attacker) && attacker.id !== target.id && isHostile(target.type, attacker.type)) {
    const counter = bestAttackReaching(state, target, attacker, "melee");
    if (counter) {
      const faces = poolFaces(target, SUPERIORITY_POOL);
      spendPool(target, SUPERIORITY_POOL);
      target.reactionUsed = true;
      armRider(target, "battlemaster/riposte");
      const arm = target.conditions.find((x) => x.type === RIDER_COND && x.source === "battlemaster/riposte");
      if (arm) arm.value = faces;
      log(state, target, `${target.name}: Ответный удар по ${attacker.name}`);
      try {
        performAttack(state, target.id, attacker.id, counter.id, { skipTurnCheck: true, skipCost: true });
      } finally {
        disarmRider(target, "battlemaster/riposte");
      }
      text += `, ${target.name} отвечает Ответным ударом`;
    }
  }
  return text;
}


// ============ ПОДКЛАССЫ: МИСТИЧЕСКИЙ ЛУЧНИК ============

const arrowSave = (ctx: HitCtx, ability: AbilityKey, label: string) => saveAgainst(ctx, ability, label);

/** 2к6 (4к6 на 18 уровне) урона стрелы заданного типа; при крите кубы удваиваются */
function arrowDamage(ctx: HitCtx, type: string): number {
  const d = rollDiceCrit(`${arrowDice(ctx.attacker)}d6`, ctx.res.crit);
  ctx.add(d, type, true);
  return d;
}

Object.assign(RIDERS, {
  "arcane-archer/bursting-arrow": {
    pool: ARCANE_SHOT_POOL,
    bow: true,
    once: "arcane_shot_used",
    apply: (ctx) => {
      const d = arrowDamage(ctx, "force");
      const hit: string[] = [];
      for (const t of ctx.state.combatants) {
        if (t.id === ctx.target.id || !alive(t) || distanceFt(t, ctx.target) > 10) continue;
        dealDamage(ctx.state, t.id, d, { damageType: "force", isAttack: false, attackerId: ctx.attacker.id, source: ctx.attacker.id });
        hit.push(t.name);
      }
      return `, Взрывная стрела +${d} силовым полем${hit.length ? `; взрыв задел: ${hit.join(", ")} (${d} каждому)` : ""}`;
    },
  },
  "arcane-archer/banishing-arrow": {
    pool: ARCANE_SHOT_POOL,
    bow: true,
    once: "arcane_shot_used",
    apply: (ctx) => {
      let extra = "";
      if (ctx.attacker.level >= 18) extra = ` +${arrowDamageFixed(ctx, "force")} силовым полем`;
      const s = arrowSave(ctx, "CHA", "Изгоняющая стрела");
      if (!s.saved) applyEffect(ctx.state, ctx.target.id, { condition: "banished", durationRounds: 1 }, ctx.attacker.id);
      return `, Изгоняющая стрела${extra}; ${ctx.target.name} ${s.saved ? "остаётся на месте" : "изгнан до конца своего следующего хода"}`;
    },
  },
  "arcane-archer/beguiling-arrow": {
    pool: ARCANE_SHOT_POOL,
    bow: true,
    once: "arcane_shot_used",
    apply: (ctx) => {
      const d = arrowDamage(ctx, "psychic");
      const ally = alliesOf(ctx.state, ctx.attacker)
        .filter((a) => distanceFt(a, ctx.target) <= 30)
        .sort((a, b) => distanceFt(a, ctx.target) - distanceFt(b, ctx.target))[0];
      if (!ally) return `, Обманная стрела +${d} психической энергией; рядом с целью нет союзника для очарования`;
      const s = arrowSave(ctx, "WIS", "Обманная стрела");
      if (!s.saved) applyEffect(ctx.state, ctx.target.id, { condition: "charmed", durationRounds: 1 }, ally.id);
      return `, Обманная стрела +${d} психической энергией; ${ctx.target.name} ${s.saved ? "не поддаётся" : `очарован существом ${ally.name}`}`;
    },
  },
  "arcane-archer/enfeebling-arrow": {
    pool: ARCANE_SHOT_POOL,
    bow: true,
    once: "arcane_shot_used",
    apply: (ctx) => {
      const d = arrowDamage(ctx, "necrotic");
      const s = arrowSave(ctx, "CON", "Ослабляющая стрела");
      if (!s.saved) applyEffect(ctx.state, ctx.target.id, { condition: "enfeebled", durationRounds: 1 }, ctx.attacker.id);
      return `, Ослабляющая стрела +${d} некротической энергией; ${ctx.target.name} ${s.saved ? "выдерживает" : "ослаблен: урон его атак оружием вдвое меньше"}`;
    },
  },
  "arcane-archer/grasping-arrow": {
    pool: ARCANE_SHOT_POOL,
    bow: true,
    once: "arcane_shot_used",
    apply: (ctx) => {
      const d = arrowDamage(ctx, "poison");
      // Колючие кусты держатся минуту; прежние кусты этого стрелка исчезают
      for (const t of ctx.state.combatants) {
        t.conditions = t.conditions.filter((x) => !(x.type === "grasping_briars" && x.source === ctx.attacker.id));
      }
      applyEffect(ctx.state, ctx.target.id, { condition: "grasping_briars", durationRounds: 10, value: ctx.dc }, ctx.attacker.id);
      return `, Сжимающая стрела +${d} ядом; ${ctx.target.name} опутан колючими кустами (скорость −10, ${arrowDice(ctx.attacker)}к6 рубящего за первое движение в ход)`;
    },
  },
  "arcane-archer/shadow-arrow": {
    pool: ARCANE_SHOT_POOL,
    bow: true,
    once: "arcane_shot_used",
    apply: (ctx) => {
      const d = arrowDamage(ctx, "psychic");
      const s = arrowSave(ctx, "WIS", "Теневая стрела");
      if (!s.saved) applyEffect(ctx.state, ctx.target.id, { condition: "shadow_veil", durationRounds: 1 }, ctx.attacker.id);
      return `, Теневая стрела +${d} психической энергией; ${ctx.target.name} ${s.saved ? "видит ясно" : "не видит дальше 5 футов"}`;
    },
  },
} satisfies Record<string, RiderDef>);

/** Фиксированный дополнительный урон 2к6 (на 18 уровне Изгоняющей стрелы): тоже удваивается при крите */
function arrowDamageFixed(ctx: HitCtx, type: string): number {
  const d = rollDiceCrit("2d6", ctx.res.crit);
  ctx.add(d, type, true);
  return d;
}

for (const [key, label] of [
  ["arcane-archer/bursting-arrow", "Взрывная стрела"],
  ["arcane-archer/banishing-arrow", "Изгоняющая стрела"],
  ["arcane-archer/beguiling-arrow", "Обманная стрела"],
  ["arcane-archer/enfeebling-arrow", "Ослабляющая стрела"],
  ["arcane-archer/grasping-arrow", "Сжимающая стрела"],
  ["arcane-archer/shadow-arrow", "Теневая стрела"],
] as const) {
  ACTIONS[key] = armHandler(label);
}

/** Стрела без броска атаки (Ищущая, Пронзающая): тратит одну атаку из действия Атака и заряд выстрела */
function payArrow(state: CombatState, c: Combatant, bow: Attack): void {
  if (usedThisTurn(state, c, "arcane_shot_used")) throw new EngineError("В этом ходу уже применён Магический выстрел");
  if (poolLeft(c, ARCANE_SHOT_POOL) < 1) throw new EngineError("Магический выстрел: использования закончились");
  const pay = canPayForAttack(c, bow);
  if (!pay.ok) throw new EngineError(pay.reason ?? "Нельзя выпустить стрелу");
  Object.assign(c, payForAttack(c, bow));
  spendPool(c, ARCANE_SHOT_POOL);
  markTurn(state, c, "arcane_shot_used");
}

/** Урон оружия стрелы без броска атаки + 1к6 (2к6 на 18 уровне) заданного типа; на 7+ уровне стрела магическая */
function arrowBaseDamage(c: Combatant, bow: Attack, extraType: string): { parts: DamagePart[]; roll: ReturnType<typeof rollDamage> } {
  const roll = rollDamage(bow.damage, false);
  const magical = c.level >= 7;
  const parts: DamagePart[] = roll.parts.map((p) => ({ ...p, magical: p.magical || magical }));
  const extra = rollDice(`${c.level >= 18 ? 2 : 1}d6`).total;
  parts.push({ amount: extra, type: extraType, magical: true });
  return { parts, roll };
}

function applyArrowToTarget(state: CombatState, c: Combatant, target: Combatant, parts: DamagePart[], saved: boolean): number {
  const final = saved ? parts.map((p) => ({ ...p, amount: Math.floor(p.amount / 2) })) : parts;
  const total = final.reduce((s, p) => s + p.amount, 0);
  dealDamage(state, target.id, total, { damageType: final[0]?.type, parts: final, isAttack: false, attackerId: c.id, source: c.id });
  return total;
}

ACTIONS["arcane-archer/seeking-arrow"] = (state, c, ability, params, opts) => {
  const bow = bowAttack(c);
  if (!bow) throw new EngineError("Ищущая стрела: нужен короткий или длинный лук");
  const target = pickTarget(state, opts, 0);
  if (!target || !alive(target) || !isHostile(c.type, target.type)) throw new EngineError("Ищущая стрела — по врагу");
  const range = bow.range.long ?? bow.range.normal;
  if (distanceFt(c, target) > range) throw new EngineError("Цель вне дальности лука");
  payArrow(state, c, bow);
  const dc = dcOf(params, 8 + c.profBonus + modOf(c, "INT"));
  const { parts } = arrowBaseDamage(c, bow, "force");
  const save = rollEffectSave(state, target, "DEX", dc, false, "Ищущая стрела");
  const total = applyArrowToTarget(state, c, target, parts, save.success);
  log(state, c, `${c.name}: Ищущая стрела → ${target.name}: ${save.text}, ${save.success ? "половина урона" : "полный урон"} ${total}`);
  return result(`Ищущая стрела: ${target.name} получает ${total} урона`, [{ name: target.name, saved: save.success, amount: total }]);
};

ACTIONS["arcane-archer/piercing-arrow"] = (state, c, ability, params, opts) => {
  const bow = bowAttack(c);
  if (!bow) throw new EngineError("Пронзающая стрела: нужен короткий или длинный лук");
  const aim = pickTarget(state, opts, 0);
  if (!aim && !opts.center) throw new EngineError("Пронзающая стрела: укажите направление (цель или клетку)");
  const to = aim ? { x: aim.x, y: aim.y } : (opts.center as { x: number; y: number });
  if (to.x === c.x && to.y === c.y) throw new EngineError("Нужно направление стрелы");
  payArrow(state, c, bow);
  // Линия длиной 30 футов (6 клеток) в направлении цели
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  const len = Math.max(Math.abs(dx), Math.abs(dy));
  const end = { x: Math.round(c.x + (dx * 6) / len), y: Math.round(c.y + (dy * 6) / len) };
  const line = getLineCells({ x: c.x, y: c.y }, end).slice(1, 7);
  const dc = dcOf(params, 8 + c.profBonus + modOf(c, "INT"));
  const { parts } = arrowBaseDamage(c, bow, "piercing");
  const hit: CastResult["targets"] = [];
  for (const t of state.combatants) {
    if (t.id === c.id || !alive(t) || !line.some((cell) => cell.x === t.x && cell.y === t.y)) continue;
    const save = rollEffectSave(state, t, "DEX", dc, false, "Пронзающая стрела");
    const total = applyArrowToTarget(state, c, t, parts, save.success);
    log(state, c, `${c.name}: Пронзающая стрела → ${t.name}: ${save.text}, урон ${total}`);
    hit.push({ name: t.name, saved: save.success, amount: total });
  }
  return result(hit.length ? `Пронзающая стрела задела: ${hit.map((h) => h.name).join(", ")}` : "Пронзающая стрела никого не задела", hit);
};

ACTIONS["arcane-archer/curving-shot"] = (state, c, ability, params, opts) => {
  const last = lastAttackThisTurn(state, c);
  if (!last || last.hit || last.kind !== "ranged") throw new EngineError("Странствующая стрела — после промаха дальнобойной атакой в этом ходу");
  const bow = bowAttack(c);
  if (!bow) throw new EngineError("Нужен короткий или длинный лук");
  const original = state.get(last.targetId);
  const target = pickTarget(state, opts, 0);
  if (!target || !alive(target) || !isHostile(c.type, target.type) || target.id === last.targetId) {
    throw new EngineError("Странствующая стрела — на другого врага в пределах 60 футов от первой цели");
  }
  if (original && distanceFt(original, target) > 60) throw new EngineError("Новая цель дальше 60 футов от первой");
  payActionCost(state, c, params.actionCost);
  const out = performAttack(state, c.id, target.id, bow.id, { skipTurnCheck: true, skipCost: true });
  return result(`Странствующая стрела: ${out.text}`, [{ name: target.name, hit: out.hit, amount: out.damage }]);
};


// ============ ПОДКЛАССЫ: ПОЛЕ БОЯ ============

/** Клетка свободна: в пределах карты, без местности-преграды, бойцов и эха */
function cellIsFree(state: CombatState, cell: { x: number; y: number }, ignoreId?: string): boolean {
  if (cell.x < 0 || cell.y < 0 || cell.x >= state.gridWidth || cell.y >= state.gridHeight) return false;
  if (isCellBlocked(cell, state.mapElements, state.combatants, ignoreId)) return false;
  return !state.combatants.some((k) => echoesOf(k).some((e) => e.x === cell.x && e.y === cell.y));
}

/** Ближайшая свободная клетка к точке в пределах радиуса (в клетках) */
function freeCellNear(state: CombatState, near: { x: number; y: number }, radius: number, ignoreId?: string): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const cell = { x: near.x + dx, y: near.y + dy };
      if ((dx === 0 && dy === 0) || !cellIsFree(state, cell, ignoreId)) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist < bestDist) {
        best = cell;
        bestDist = dist;
      }
    }
  }
  return best;
}

// ---- Эхо рыцаря: условие «echo», координаты в source «x,y» ----

interface EchoPos {
  x: number;
  y: number;
}

function echoesOf(c: Combatant): EchoPos[] {
  return c.conditions
    .filter((x) => x.type === "echo" && x.source)
    .map((x) => {
      const [px, py] = (x.source as string).split(",").map(Number);
      return { x: px, y: py };
    });
}

function setEchoes(c: Combatant, list: EchoPos[]): void {
  c.conditions = [...c.conditions.filter((x) => x.type !== "echo"), ...list.map((e) => ({ type: "echo", source: `${e.x},${e.y}` }))];
}

/** Атака с позиции эха: боец на время атаки «стоит» в клетке эха */
function attackFromEcho(
  state: CombatState,
  c: Combatant,
  echo: EchoPos,
  target: Combatant,
  opts: { skipCost: boolean; kind?: "melee" | "ranged" }
): { text: string; hit: boolean; damage: number } {
  const home = { x: c.x, y: c.y };
  c.x = echo.x;
  c.y = echo.y;
  try {
    const atk = bestAttackReaching(state, c, target, opts.kind);
    if (!atk) throw new EngineError(`С позиции эха не достать до ${target.name}`);
    return performAttack(state, c.id, target.id, atk.id, { skipTurnCheck: true, skipCost: opts.skipCost });
  } finally {
    c.x = home.x;
    c.y = home.y;
    state.mark(c.id);
  }
}

// ---- Воин-псионик ----

RIDERS["psi-warrior/psionic-strike"] = {
  pool: PSIONIC_POOL,
  once: "psionic_strike_used",
  maxRange: 30,
  apply: (ctx) => {
    const mod = modOf(ctx.attacker, "INT");
    const d = ctx.die() + mod;
    ctx.add(Math.max(0, d), "force", true);
    let extra = "";
    const thrust = abilityByKey(ctx.attacker, "psi-warrior/telekinetic-thrust");
    if (thrust) {
      const s = saveAgainst({ ...ctx, dc: dcOf(thrust.parameters, 8 + ctx.attacker.profBonus + mod) }, "STR", "Телекинетический толчок");
      if (!s.saved) {
        if (ctx.attack.kind === "melee" && largeOrSmaller(ctx.target)) {
          applyEffect(ctx.state, ctx.target.id, { condition: "prone" }, ctx.attacker.id);
          extra = `; ${ctx.target.name} сбит с ног`;
        } else {
          pushCombatantAway(ctx.state, ctx.target, { x: ctx.attacker.x, y: ctx.attacker.y }, 2);
          extra = `; ${ctx.target.name} отброшен на 10 фт`;
        }
      } else extra = `; ${ctx.target.name} устоял`;
    }
    return `, Псионический удар +${Math.max(0, d)} силовым полем${extra}`;
  },
};
ACTIONS["psi-warrior/psionic-strike"] = armHandler("Псионический удар");

ACTIONS["psi-warrior/telekinetic-movement"] = (state, c, ability, params, opts) => {
  const ally = pickTarget(state, opts, 0);
  if (!ally || ally.id === c.id || !alive(ally) || !friendly(c, ally)) throw new EngineError("Телекинетическое передвижение — на согласное существо (не на вас)");
  if (distanceFt(c, ally) > 30) throw new EngineError("Цель дальше 30 футов");
  const dest = opts.center;
  if (!dest) throw new EngineError("Укажите клетку, куда переместить цель (до 30 футов)");
  if (distanceFt(ally, dest) > 30) throw new EngineError("Клетка дальше 30 футов от цели");
  if (!cellIsFree(state, dest, ally.id)) throw new EngineError("Клетка занята");
  payActionCost(state, c, params.actionCost);
  ally.x = dest.x;
  ally.y = dest.y;
  state.mark(ally.id);
  log(state, c, `${c.name}: Телекинетическое передвижение — ${ally.name} перенесён в (${dest.x}, ${dest.y})`);
  return result(`${ally.name} перемещён телекинезом`, [{ name: ally.name, amount: 0 }]);
};

ACTIONS["psi-warrior/psi-powered-leap"] = (state, c, ability, params) => {
  payActionCost(state, c, params.actionCost);
  c.conditions = [...c.conditions.filter((x) => x.type !== "psi_leap"), { type: "psi_leap", duration: 1 }];
  state.mark(c.id);
  log(state, c, `${c.name}: Усиленный пси-прыжок — скорость полёта вдвое больше скорости ходьбы до конца хода`);
  return result(`${c.name} поднимается в воздух (скорость ×2 до конца хода)`);
};

ACTIONS["psi-warrior/bulwark-of-force"] = (state, c, ability, params, opts) => {
  const count = Math.max(1, modOf(c, "INT"));
  const chosen: Combatant[] = [c];
  for (const id of opts.targetIds ?? []) {
    const t = state.get(id);
    if (t && t.id !== c.id && alive(t) && friendly(c, t) && distanceFt(c, t) <= 30 && chosen.length < count) chosen.push(t);
  }
  // Не выбрано вручную — защищаем ближайших союзников
  for (const a of alliesOf(state, c).sort((x, y) => distanceFt(c, x) - distanceFt(c, y))) {
    if (chosen.length >= count) break;
    if (distanceFt(c, a) <= 30 && !chosen.includes(a) && !(opts.targetIds?.length)) chosen.push(a);
  }
  payActionCost(state, c, params.actionCost);
  for (const t of chosen) {
    t.conditions = [...t.conditions.filter((x) => x.type !== "bulwark_of_force"), { type: "bulwark_of_force", duration: 10, source: c.id }];
    state.mark(t.id);
  }
  log(state, c, `${c.name}: Оплот силы — укрытие наполовину (КД +2, Лов. +2) у ${chosen.map((t) => t.name).join(", ")} на минуту`);
  return result(`Оплот силы защищает: ${chosen.map((t) => t.name).join(", ")}`, chosen.map((t) => ({ name: t.name, amount: 0 })));
};

ACTIONS["psi-warrior/telekinetic-master"] = (state, c, ability, params, opts) => {
  const target = pickTarget(state, opts, 0);
  if (!target || !alive(target) || !isHostile(c.type, target.type)) throw new EngineError("Мастер телекинеза — на врага в пределах 60 футов");
  if (distanceFt(c, target) > 60) throw new EngineError("Цель дальше 60 футов");
  payActionCost(state, c, params.actionCost);
  const dc = 8 + c.profBonus + modOf(c, "INT");
  const save = rollEffectSave(state, target, "STR", dc, true, "Телекинез");
  if (!save.success) applyEffect(state, target.id, { condition: "restrained", durationRounds: 10 }, c.id);
  c.conditions = [...c.conditions.filter((x) => x.type !== "telekinetic_master"), { type: "telekinetic_master", duration: 10 }];
  state.mark(c.id);
  log(state, c, `${c.name}: Телекинез по ${target.name}: ${save.text} — ${save.success ? "удерживается силой воли" : "поднят и обездвижен"}`);
  return result(`${target.name} ${save.success ? "сопротивляется телекинезу" : "обездвижен телекинезом"}; каждый ход можно атаковать бонусным действием`, [
    { name: target.name, saved: save.success, amount: 0 },
  ]);
};

ACTIONS["psi-warrior/telekinetic-master-strike"] = (state, c, ability, params, opts) => {
  if (!hasCondition(c, "telekinetic_master")) throw new EngineError("Нужен действующий Телекинез");
  const target = pickTarget(state, opts, 0);
  if (!target || !alive(target) || !isHostile(c.type, target.type)) throw new EngineError("Атака — по врагу");
  const atk = bestAttackReaching(state, c, target);
  if (!atk) throw new EngineError("Цель недосягаема для оружия");
  payActionCost(state, c, params.actionCost);
  const out = performAttack(state, c.id, target.id, atk.id, { skipTurnCheck: true, skipCost: true });
  return result(out.text, [{ name: target.name, hit: out.hit, amount: out.damage }]);
};

// ---- Рунный рыцарь ----

ACTIONS["rune-knight/giants-might"] = (state, c, ability, params) => {
  payActionCost(state, c, params.actionCost);
  const original = c.size ?? "medium";
  const grown = c.level >= 18 ? "huge" : "large";
  const wasSmaller = SIZE_ORDER.indexOf(original as (typeof SIZE_ORDER)[number]) < SIZE_ORDER.indexOf(grown);
  if (wasSmaller) c.size = grown;
  c.conditions = [
    ...c.conditions.filter((x) => x.type !== "giants_might"),
    { type: "giants_might", duration: 10, source: wasSmaller ? original : undefined },
  ];
  state.mark(c.id);
  log(state, c, `${c.name}: Мощь великана — ${wasSmaller ? "размер увеличен, " : ""}преимущество на проверки и спасброски Силы, дополнительный урон раз в ход`);
  return result(`${c.name} наполняется силой великана на минуту`);
};

ACTIONS["rune-knight/frost-rune"] = (state, c, ability, params) => {
  payActionCost(state, c, params.actionCost);
  c.conditions = [...c.conditions.filter((x) => x.type !== "frost_rune"), { type: "frost_rune", duration: 100 }];
  state.mark(c.id);
  log(state, c, `${c.name}: Ледяная руна — +2 к проверкам и спасброскам Силы и Телосложения на 10 минут`);
  return result(`${c.name}: Ледяная руна пробуждена`);
};

ACTIONS["rune-knight/hill-rune"] = (state, c, ability, params) => {
  payActionCost(state, c, params.actionCost);
  c.conditions = [...c.conditions.filter((x) => x.type !== "hill_rune"), { type: "hill_rune", duration: 10 }];
  state.mark(c.id);
  log(state, c, `${c.name}: Холмовая руна — сопротивление дробящему, рубящему и колющему урону на минуту`);
  return result(`${c.name}: Холмовая руна пробуждена`);
};

RIDERS["rune-knight/fire-rune"] = {
  apply: (ctx) => {
    const d = rollDiceCrit("2d6", ctx.res.crit);
    ctx.add(d, "fire", true);
    const s = saveAgainst(ctx, "STR", "Огненная руна");
    if (!s.saved) {
      applyEffect(ctx.state, ctx.target.id, { condition: "fire_shackles", durationRounds: 10, saveType: "STR", saveDC: ctx.dc }, ctx.attacker.id);
    }
    return `, Огненная руна +${d} огнём; ${ctx.target.name} ${s.saved ? "вырывается из кандалов" : "опутан огненными кандалами"}`;
  },
};
ACTIONS["rune-knight/fire-rune"] = armHandler("Огненная руна");

// ---- Самурай ----

ACTIONS["samurai/fighting-spirit"] = (state, c, ability, params) => {
  payActionCost(state, c, params.actionCost);
  c.conditions = [...c.conditions.filter((x) => x.type !== "fighting_spirit"), { type: "fighting_spirit", duration: 1 }];
  const temp = params.featureValue ?? 5;
  grantTempHp(state, c.id, temp);
  log(state, c, `${c.name}: Боевой дух — преимущество на атаки оружием до конца хода, ${temp} временных хитов`);
  return result(`${c.name}: преимущество на атаки и ${temp} временных хитов`, [{ name: c.name, amount: temp }]);
};

ACTIONS["samurai/rapid-strike"] = (state, c, ability, params, opts) => {
  const target = pickTarget(state, opts, 0);
  if (!target || !alive(target) || !isHostile(c.type, target.type)) throw new EngineError("Стремительный удар — на врага, по которому есть преимущество");
  if (!c.actionUsed || c.attacksMadeThisAction < 1) throw new EngineError("Стремительный удар — в ходе действия Атака");
  const atk = bestAttackReaching(state, c, target);
  if (!atk) throw new EngineError("Цель недосягаема");
  const adv = computeAttackAdvantage(c, target, atk, {}, { distanceFt: distanceFt(c, target), allCombatants: state.combatants });
  if (!adv.advantage || adv.disadvantage) throw new EngineError("Нет преимущества на атаку по этой цели");
  // Преимущество отдано: следующая атака по цели идёт без него, зато попыток на одну больше
  c.attacksPerAction += 1;
  c.conditions = [...c.conditions.filter((x) => x.type !== "rapid_strike"), { type: "rapid_strike", targetId: target.id, duration: 1 }];
  state.mark(c.id);
  log(state, c, `${c.name}: Стремительный удар — отказ от преимущества ради дополнительной атаки по ${target.name}`);
  return result(`Следующая атака по ${target.name} — без преимущества, но добавлена ещё одна атака`, [{ name: target.name, amount: 0 }]);
};

// ---- Кавалерист ----

ACTIONS["cavalier/unwavering-mark"] = (state, c, ability, params, opts) => {
  const punish = c.conditions.filter((x) => x.type === "mark_punish" && x.targetId);
  const target = pickTarget(state, opts, 0) ?? (punish[0]?.targetId ? state.get(punish[0].targetId) : undefined);
  if (!target || !alive(target) || !punish.some((x) => x.targetId === target.id)) {
    throw new EngineError("Особая атака — по помеченному существу, которое навредило не вам");
  }
  const atk = bestAttackReaching(state, c, target, "melee");
  if (!atk) throw new EngineError("Помеченный враг вне досягаемости");
  payActionCost(state, c, params.actionCost);
  const bonus = Math.floor(c.level / 2);
  c.conditions = [...c.conditions.filter((x) => x.type !== "mark_strike"), { type: "mark_strike", value: bonus, targetId: target.id, duration: 1 }];
  try {
    const out = performAttack(state, c.id, target.id, atk.id, { skipTurnCheck: true, skipCost: true, manualAdvantage: true });
    c.conditions = c.conditions.filter((x) => !(x.type === "mark_punish" && x.targetId === target.id));
    return result(`Особая атака по метке: ${out.text}`, [{ name: target.name, hit: out.hit, amount: out.damage }]);
  } finally {
    c.conditions = c.conditions.filter((x) => x.type !== "mark_strike");
  }
};

// ---- Рыцарь Эха ----

ACTIONS["echo-knight/manifest-echo"] = (state, c, ability, params, opts) => {
  const dest =
    opts.center ??
    (() => {
      const foe = hostilesOf(state, c).sort((a, b) => distanceFt(c, a) - distanceFt(c, b))[0];
      return freeCellNear(state, foe ? { x: Math.round((c.x + foe.x) / 2), y: Math.round((c.y + foe.y) / 2) } : { x: c.x, y: c.y }, 3, c.id);
    })();
  if (!dest) throw new EngineError("Нет свободного места для эха");
  if (distanceFt(c, dest) > 15) throw new EngineError("Эхо появляется в пределах 15 футов");
  if (!cellIsFree(state, dest)) throw new EngineError("Клетка занята");
  payActionCost(state, c, params.actionCost);
  const maxEchoes = c.level >= 18 ? 2 : 1;
  const current = echoesOf(c);
  setEchoes(c, current.length >= maxEchoes ? [dest] : [...current, dest]);
  state.mark(c.id);
  log(state, c, `${c.name}: Манифест эха — эхо появляется в (${dest.x}, ${dest.y})`);
  return result(`${c.name} проявляет эхо в (${dest.x}, ${dest.y})`);
};

ACTIONS["echo-knight/echo-move"] = (state, c, ability, params, opts) => {
  const echoes = echoesOf(c);
  if (!echoes.length) throw new EngineError("Нет эха");
  const dest = opts.center;
  if (!dest) throw new EngineError("Укажите клетку, куда сместить эхо (до 30 футов)");
  // Ближайшее к клетке эхо, которое ещё не двигалось в этом ходу
  const used = c.conditions.filter((x) => x.type === "echo_moved" && x.source === turnKey(state)).length;
  if (used >= echoes.length) throw new EngineError("Эхо уже двигалось в этом ходу");
  const candidates = echoes.map((e, i) => ({ e, i })).sort((a, b) => distanceFt(a.e, dest) - distanceFt(b.e, dest));
  const pick = candidates.find((x) => distanceFt(x.e, dest) <= 30);
  if (!pick) throw new EngineError("Эхо перемещается не дальше чем на 30 футов");
  if (!cellIsFree(state, dest)) throw new EngineError("Клетка занята");
  echoes[pick.i] = { x: dest.x, y: dest.y };
  setEchoes(c, echoes);
  c.conditions = [...c.conditions, { type: "echo_moved", source: turnKey(state) }];
  state.mark(c.id);
  log(state, c, `${c.name}: эхо перемещается в (${dest.x}, ${dest.y})`);
  return result(`Эхо переместилось в (${dest.x}, ${dest.y})`);
};

ACTIONS["echo-knight/echo-swap"] = (state, c, ability, params, opts) => {
  const echoes = echoesOf(c);
  if (!echoes.length) throw new EngineError("Нет эха");
  if (c.movementUsed + 15 > c.speed * (hasCondition(c, "dashing") ? 2 : 1)) throw new EngineError("Не хватает перемещения (нужно 15 футов)");
  const idx = opts.center ? echoes.findIndex((e) => e.x === opts.center!.x && e.y === opts.center!.y) : 0;
  const e = echoes[idx < 0 ? 0 : idx];
  payActionCost(state, c, params.actionCost);
  const home = { x: c.x, y: c.y };
  c.x = e.x;
  c.y = e.y;
  echoes[idx < 0 ? 0 : idx] = home;
  setEchoes(c, echoes);
  c.movementUsed += 15;
  state.mark(c.id);
  log(state, c, `${c.name} меняется местами с эхом (−15 фт перемещения)`);
  return result(`${c.name} телепортируется на место эха`);
};

ACTIONS["echo-knight/echo-strike"] = (state, c, ability, params, opts) => {
  const target = pickTarget(state, opts, 0);
  if (!target || !alive(target) || !isHostile(c.type, target.type)) throw new EngineError("Атака из позиции эха — по врагу");
  const echoes = echoesOf(c).sort((a, b) => distanceFt(a, target) - distanceFt(b, target));
  if (!echoes.length) throw new EngineError("Нет эха");
  const out = attackFromEcho(state, c, echoes[0], target, { skipCost: false });
  return result(`Атака из позиции эха: ${out.text}`, [{ name: target.name, hit: out.hit, amount: out.damage }]);
};

ACTIONS["echo-knight/unleash-incarnation"] = (state, c, ability, params, opts) => {
  if (!c.actionUsed) throw new EngineError("Раскрыть потенциал — в ходе действия Атака");
  const target = pickTarget(state, opts, 0);
  if (!target || !alive(target) || !isHostile(c.type, target.type)) throw new EngineError("Раскрыть потенциал — по врагу");
  const echoes = echoesOf(c).sort((a, b) => distanceFt(a, target) - distanceFt(b, target));
  if (!echoes.length) throw new EngineError("Нет эха");
  const out = attackFromEcho(state, c, echoes[0], target, { skipCost: true, kind: "melee" });
  return result(`Дополнительная атака с позиции эха: ${out.text}`, [{ name: target.name, hit: out.hit, amount: out.damage }]);
};

ACTIONS["echo-knight/echo-avatar"] = (state, c, ability, params) => {
  const on = hasCondition(c, "echo_avatar");
  if (on) {
    c.conditions = c.conditions.filter((x) => x.type !== "echo_avatar" && !(x.type === "blinded" && x.source === "echo_avatar"));
    log(state, c, `${c.name}: возвращает сознание из эха`);
    state.mark(c.id);
    return result(`${c.name} снова видит собственными глазами`);
  }
  if (!echoesOf(c).length) throw new EngineError("Нет эха");
  payActionCost(state, c, params.actionCost);
  c.conditions = [
    ...c.conditions,
    { type: "echo_avatar", duration: 100 },
    { type: "blinded", source: "echo_avatar", duration: 100 },
  ];
  state.mark(c.id);
  log(state, c, `${c.name}: Аватар эха — смотрит глазами эха, сам слеп и глух`);
  return result(`${c.name} переносит сознание в эхо (ослеплён)`);
};

// ---- Мистический рыцарь ----

ACTIONS["eldritch-knight/war-magic-strike"] = (state, c, ability, params, opts) => {
  if (!hasCondition(c, "war_magic_ready")) throw new EngineError("Боевая магия — сразу после заклинания в этом ходу");
  const target = pickTarget(state, opts, 0);
  if (!target || !alive(target) || !isHostile(c.type, target.type)) throw new EngineError("Атака оружием — по врагу");
  const atk = bestAttackReaching(state, c, target);
  if (!atk) throw new EngineError("Цель недосягаема для оружия");
  payActionCost(state, c, params.actionCost);
  c.conditions = c.conditions.filter((x) => x.type !== "war_magic_ready");
  const out = performAttack(state, c.id, target.id, atk.id, { skipTurnCheck: true, skipCost: true });
  return result(out.text, [{ name: target.name, hit: out.hit, amount: out.damage }]);
};

ACTIONS["eldritch-knight/arcane-charge"] = (state, c, ability, params, opts) => {
  if (!c.conditions.some((x) => x.type === "action_surge_used" && x.source === turnKey(state))) {
    throw new EngineError("Мистический натиск — сразу после Всплеска действий");
  }
  const dest = opts.center;
  if (!dest) throw new EngineError("Укажите клетку (до 30 футов)");
  if (distanceFt(c, dest) > 30) throw new EngineError("Телепортация — не дальше 30 футов");
  if (!cellIsFree(state, dest, c.id)) throw new EngineError("Клетка занята");
  c.x = dest.x;
  c.y = dest.y;
  state.mark(c.id);
  log(state, c, `${c.name}: Мистический натиск — телепортируется в (${dest.x}, ${dest.y})`);
  return result(`${c.name} телепортируется в (${dest.x}, ${dest.y})`);
};


// ============ СРАБАТЫВАЮЩИЕ УМЕНИЯ ПОДКЛАССОВ (ХУКИ ДВИЖКА) ============

/** Умения, которые срабатывают при попадании сами и ничего не заряжают */
function passiveHitRiders(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack, res: HitResolution): string {
  if (attack.kind === "spell" || attack.usesSpellAttack) return "";
  let text = "";

  // Зачарованная стрела: стрелы из лука считаются магическими
  if (isBowAttack(attack) && abilityByKey(attacker, "arcane-archer/magic-arrow") && res.damageParts[0]) {
    res.damageParts[0] = { ...res.damageParts[0], magical: true };
  }

  // Мощь великана: раз в ход дополнительный урон
  if (hasCondition(attacker, "giants_might") && !usedThisTurn(state, attacker, "giants_might_hit")) {
    markTurn(state, attacker, "giants_might_hit");
    const faces = attacker.level >= 18 ? 10 : attacker.level >= 10 ? 8 : 6;
    const d = rollDiceCrit(`1d${faces}`, res.crit);
    addDamage(res, attack, d);
    text += `, Мощь великана +${d}`;
  }

  // Особая атака по метке: дополнительный урон от половины уровня
  const strike = attacker.conditions.find((x) => x.type === "mark_strike" && x.targetId === target.id);
  if (strike?.value) {
    addDamage(res, attack, strike.value);
    text += `, удар по метке +${strike.value}`;
  }

  // Непоколебимая метка: рукопашное попадание помечает цель
  if (attack.kind === "melee" && abilityByKey(attacker, "cavalier/unwavering-mark")) {
    for (const t of state.combatants) {
      if (t.id !== target.id) t.conditions = t.conditions.filter((x) => !(x.type === "unwavering_mark" && x.source === attacker.id));
    }
    const ownTurn = state.current()?.id === attacker.id;
    target.conditions = [
      ...target.conditions.filter((x) => x.type !== "unwavering_mark"),
      { type: "unwavering_mark", source: attacker.id, value: ownTurn ? 1 : 0 },
    ];
    state.mark(target.id);
    text += `; ${target.name} помечен Непоколебимой меткой`;
  }

  // Свирепый натиск: разбег не менее 10 футов по прямой — цель сбивается с ног
  const charger = abilityByKey(attacker, "cavalier/ferocious-charger");
  const charge = attacker.conditions.find((x) => x.type === "charged" && (x.value ?? 0) >= 10);
  if (charger && charge && charger.usesUsed < charger.usesMax) {
    spendAbilityUse(attacker, charger);
    const dc = dcOf(charger.parameters, 8 + attacker.profBonus + modOf(attacker, "STR"));
    const save = rollEffectSave(state, target, "STR", dc, false, "Свирепый натиск");
    state.addLog(`${target.name}: ${save.text} против «Свирепый натиск»`, "save", target.name);
    if (!save.success) applyEffect(state, target.id, { condition: "prone" }, attacker.id);
    text += `; Свирепый натиск: ${target.name} ${save.success ? "устоял" : "сбит с ног"}`;
  }

  // Мистический удар: помеха на следующий спасбросок цели против заклинания рыцаря
  if (abilityByKey(attacker, "eldritch-knight/eldritch-strike")) {
    target.conditions = [
      ...target.conditions.filter((x) => !(x.type === "eldritch_struck" && x.source === attacker.id)),
      { type: "eldritch_struck", source: attacker.id, duration: 2 },
    ];
    state.mark(target.id);
    text += `; ${target.name}: помеха на следующий спасбросок против заклинания`;
  }

  return text;
}

function randomPick<T>(list: T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Защитные реакции после броска вражеской атаки, пока урон ещё не нанесён.
 * Меняют исход броска: Рунический щит (перебросить к20), Защитный манёвр (КД + сопротивление),
 * Облачная руна (сменить цель). Возвращает цель, по которой атака идёт дальше.
 */
export function fighterDefense(
  state: CombatState,
  attacker: Combatant,
  target: Combatant,
  attack: Attack,
  res: AttackResolution,
  allowRedirect = true
): Combatant {
  if (!res.hit) return target;
  const toMiss = (why: string) => {
    res.hit = false;
    res.crit = false;
    res.damage = 0;
    res.damageParts = [];
    res.text += ` → ${why}`;
  };
  const dealt = () => res.damage;

  // Рунический щит: союзник в пределах 60 футов от рыцаря — атакующий перебрасывает к20
  for (const k of state.combatants) {
    if (!alive(k) || k.id === target.id || k.id === attacker.id || !friendly(k, target)) continue;
    const shield = reactionReady(k, "rune-knight/runic-shield");
    if (!shield || distanceFt(k, target) > 60) continue;
    if (!res.crit && !worthIt(target, dealt(), 0.2)) continue;
    k.reactionUsed = true;
    spendAbilityUse(k, shield);
    const bonus = res.roll.total - res.roll.natural;
    const re = rollD20(bonus, false, false);
    log(state, k, `${k.name}: Рунический щит — ${attacker.name} перебрасывает атаку по ${target.name}: ${res.roll.natural} → ${re.natural}`);
    res.roll = { ...res.roll, total: re.total, natural: re.natural };
    const stillHits = re.natural === 20 || (re.natural !== 1 && re.total >= res.targetAC);
    if (!stillHits) {
      toMiss(`Рунический щит: бросок ${re.total} не пробивает КД ${res.targetAC}`);
      return target;
    }
    break;
  }

  // Защитный манёвр кавалериста: +1к8 к КД цели, а если удар всё равно попал — сопротивление урону
  for (const k of state.combatants) {
    if (!alive(k) || !friendly(k, target)) continue;
    const ward = reactionReady(k, "cavalier/warding-maneuver");
    if (!ward || distanceFt(k, target) > 5) continue;
    if (!k.attacks.some((a) => a.kind === "melee" && !a.id.startsWith("__"))) continue;
    if (!worthIt(target, dealt(), 0.15)) continue;
    k.reactionUsed = true;
    spendAbilityUse(k, ward);
    const d = rollDice("1d8").total;
    if (res.roll.natural !== 20 && res.roll.total < res.targetAC + d) {
      log(state, k, `${k.name}: Защитный манёвр (+${d} к КД) — атака по ${target.name} не попадает`);
      toMiss(`Защитный манёвр: КД ${res.targetAC} + ${d}`);
      return target;
    }
    res.damageParts = res.damageParts.map((p) => ({ ...p, amount: Math.floor(p.amount / 2) }));
    res.damage = res.damageParts.reduce((s, p) => s + p.amount, 0);
    log(state, k, `${k.name}: Защитный манёвр (+${d} к КД) не спас от попадания, но ${target.name} получает половину урона`);
    break;
  }

  // Облачная руна: удар перенаправляется на другое существо в пределах 30 футов
  if (allowRedirect) {
    for (const k of state.combatants) {
      if (!alive(k) || !friendly(k, target)) continue;
      const rune = reactionReady(k, "rune-knight/cloud-rune");
      if (!rune || distanceFt(k, target) > 30) continue;
      if (!worthIt(target, dealt(), 0.3)) continue;
      const options = state.combatants.filter(
        (t) => alive(t) && t.id !== attacker.id && t.id !== target.id && distanceFt(k, t) <= 30 && friendly(attacker, t)
      );
      // Лучший вариант: существо, в которое удар не попадёт; иначе — союзник нападающего
      const miss = options.filter((t) => res.roll.natural !== 20 && res.roll.total < effectiveAC(t)).sort((a, b) => effectiveAC(b) - effectiveAC(a))[0];
      const redirectTo = miss ?? randomPick(options);
      if (!redirectTo) continue;
      k.reactionUsed = true;
      spendAbilityUse(k, rune);
      log(state, k, `${k.name}: Облачная руна — удар по ${target.name} переходит на ${redirectTo.name}`);
      const hitsNew = res.roll.natural === 20 || (res.roll.natural !== 1 && res.roll.total >= effectiveAC(redirectTo));
      if (!hitsNew) {
        toMiss(`Облачная руна: на ${redirectTo.name} бросок ${res.roll.total} не попадает`);
        return target;
      }
      state.mark(redirectTo.id);
      return redirectTo;
    }
  }
  return target;
}

/** Эхо принимает удар вместо союзника (Эхо-мученик): вызывается до броска атаки */
export function fighterPreAttack(
  state: CombatState,
  attacker: Combatant,
  target: Combatant,
  attack: Attack
): { text: string } | null {
  if (!isHostile(attacker.type, target.type)) return null;
  for (const k of state.combatants) {
    if (!alive(k) || k.id === target.id || !friendly(k, target)) continue;
    const martyr = reactionReady(k, "echo-knight/shadow-martyr");
    const echoes = echoesOf(k);
    if (!martyr || !echoes.length) continue;
    if (target.hpCurrent > target.hpMax * 0.6) continue;
    k.reactionUsed = true;
    spendAbilityUse(k, martyr);
    // Эхо телепортируется к нападающему и принимает бросок на себя
    const spot = freeCellNear(state, { x: attacker.x, y: attacker.y }, 1, k.id) ?? echoes[0];
    const dummy: Combatant = { ...k, id: `${k.id}__echo`, name: `Эхо (${k.name})`, ac: 14 + k.profBonus, conditions: [], x: spot.x, y: spot.y };
    const roll = resolveAttack(attacker, dummy, attack, { distanceFt: Math.max(5, distanceFt(attacker, spot)), allCombatants: state.combatants });
    let text = `${attacker.name} → Эхо (${k.name}): ${roll.text}`;
    if (roll.hit) {
      setEchoes(k, echoes.slice(1));
      text += ` — эхо разрушено`;
      const reclaim = abilityByKey(k, "echo-knight/reclaim-potential");
      if (reclaim && reclaim.usesUsed < reclaim.usesMax && k.hpTemp <= 0) {
        spendAbilityUse(k, reclaim);
        const temp = rollDice("2d6").total + modOf(k, "CON");
        grantTempHp(state, k.id, Math.max(0, temp));
        text += `; Поглотить потенциал: ${Math.max(0, temp)} временных хитов`;
      }
    } else {
      setEchoes(k, [spot, ...echoes.slice(1)]);
      text += ` — мимо, эхо остаётся рядом с нападающим`;
    }
    log(state, k, `${k.name}: Эхо-мученик — эхо подставляется под удар за ${target.name}`);
    state.mark(k.id);
    return { text };
  }
  return null;
}

/** Урон нанесён: помеченный Кавалеристом навредил не рыцарю — рыцарь вправе ответить особой атакой */
export function fighterNoteDamage(state: CombatState, attackerId: string | undefined, targetId: string): void {
  if (!attackerId || attackerId === targetId) return;
  const dealer = state.get(attackerId);
  if (!dealer) return;
  const mark = dealer.conditions.find((x) => x.type === "unwavering_mark" && x.source && x.source !== targetId);
  if (!mark?.source) return;
  const knight = state.get(mark.source);
  if (!knight || !alive(knight) || !abilityByKey(knight, "cavalier/unwavering-mark")) return;
  if (knight.conditions.some((x) => x.type === "mark_punish" && x.targetId === dealer.id)) return;
  knight.conditions = [...knight.conditions, { type: "mark_punish", targetId: dealer.id, duration: 1 }];
  state.mark(knight.id);
  log(state, knight, `${dealer.name} навредил не ${knight.name}: бонусным действием можно ударить по метке`, "system");
}

/** Самурай «Стойкость перед смертью»: хиты упали до 0 (но не убили) — сознание держится до дополнительного хода */
export function fighterOnDrop(state: CombatState, target: Combatant, hpBefore: number, amount: number): boolean {
  if (amount - hpBefore >= target.hpMax) return false; // мгновенная смерть
  // Хиты уже 0, поэтому canAct не годится: проверяем реакцию и недееспособность по состояниям
  const ability = abilityByKey(target, "samurai/strength-before-death");
  if (!ability || target.reactionUsed || ability.usesUsed >= ability.usesMax) return false;
  if (target.conditions.some((x) => ["incapacitated", "stunned", "paralyzed", "unconscious", "petrified"].includes(x.type))) return false;
  target.reactionUsed = true;
  spendAbilityUse(target, ability);
  target.hpCurrent = 0;
  target.conditions = [...target.conditions.filter((x) => x.type !== "strength_before_death"), { type: "strength_before_death", value: 1 }];
  // Дополнительный ход сразу после текущего
  state.turnOrder.splice(state.currentTurnIndex + 1, 0, target.id);
  state.markCombat();
  state.mark(target.id);
  log(state, target, `${target.name}: Стойкость перед смертью — не теряет сознание и получит дополнительный ход`);
  return true;
}

/** Пока рыцарь ждёт дополнительного хода, урон по нему не считается (он ещё не «при 0 хитов» по правилу) */
export function fighterShield(target: Combatant): boolean {
  return target.hpCurrent <= 0 && target.conditions.some((x) => x.type === "strength_before_death" && x.value === 1);
}

/** Перемещение закончено: разбег, колючие кусты, Держать строй, Эхо, Бдительный защитник */
export function fighterOnMove(state: CombatState, mover: Combatant, start: { x: number; y: number }, path: Array<{ x: number; y: number }>): void {
  if (!path.length || !alive(mover)) return;
  const full = [start, ...path];
  // Прямой отрезок в конце маршрута (клетки с одинаковым направлением шага)
  let run = 0;
  const lastStep = { dx: full[full.length - 1].x - full[full.length - 2].x, dy: full[full.length - 1].y - full[full.length - 2].y };
  for (let i = full.length - 1; i > 0; i--) {
    const step = { dx: full[i].x - full[i - 1].x, dy: full[i].y - full[i - 1].y };
    if (step.dx !== lastStep.dx || step.dy !== lastStep.dy) break;
    run += 5;
  }
  if (abilityByKey(mover, "cavalier/ferocious-charger")) {
    mover.conditions = [...mover.conditions.filter((x) => x.type !== "charged"), { type: "charged", value: run, duration: 1 }];
  }

  // Колючие кусты: 2к6 рубящего за первое движение в ход
  const briars = mover.conditions.find((x) => x.type === "grasping_briars");
  if (briars && !usedThisTurn(state, mover, "briars_hit")) {
    markTurn(state, mover, "briars_hit");
    const archer = briars.source ? state.get(briars.source) : undefined;
    const dice = (archer?.level ?? 3) >= 18 ? 4 : 2;
    const d = rollDice(`${dice}d6`).total;
    log(state, mover, `${mover.name} рвётся сквозь колючие кусты: ${d} рубящего урона`, "damage");
    dealDamage(state, mover.id, d, { damageType: "slashing", isAttack: false, attackerId: archer?.id, source: archer?.id, kindLabel: "Колючие кусты" });
    if (!alive(mover)) return;
  }

  for (const k of state.combatants) {
    if (k.id === mover.id || !alive(k) || !isHostile(k.type, mover.type) || !canAct(k)) continue;

    // Держать строй: враг двигается, оставаясь в пределах досягаемости — провоцированная атака, при попадании скорость 0
    const hold = abilityByKey(k, "cavalier/hold-the-line");
    if (hold && distanceFt(k, start) <= 5 && distanceFt(k, mover) <= 5 && distanceFt(start, mover) >= 5) {
      const vigilant =
        k.reactionUsed && abilityByKey(k, "cavalier/vigilant-defender") && !usedThisTurn(state, k, "vigilant_used");
      if (!k.reactionUsed || vigilant) {
        const atk = bestAttackReaching(state, k, mover, "melee");
        if (atk) {
          if (vigilant) markTurn(state, k, "vigilant_used");
          else k.reactionUsed = true;
          log(state, k, `${k.name}: ${vigilant ? "Бдительный защитник" : "Держать строй"} — провоцированная атака по ${mover.name}`);
          const out = performAttack(state, k.id, mover.id, atk.id, { skipTurnCheck: true, skipCost: true });
          if (out.hit) {
            mover.movementUsed = Math.max(mover.movementUsed, mover.speed * (hasCondition(mover, "dashing") ? 2 : 1));
            state.mark(mover.id);
            log(state, k, `${mover.name} останавливается: скорость 0 до конца хода`, "system");
          }
          if (!alive(mover)) return;
        }
      }
    }

    // Эхо: враг уходит от эха на 5+ футов — провоцированная атака с позиции эха
    if (!k.reactionUsed) {
      for (const e of echoesOf(k)) {
        if (distanceFt(e, start) <= 5 && distanceFt(e, mover) > 5 && !k.reactionUsed && alive(mover)) {
          k.reactionUsed = true;
          log(state, k, `${k.name}: провоцированная атака с позиции эха по ${mover.name}`);
          // Атака разыгрывается там, где враг был в момент ухода
          const end = { x: mover.x, y: mover.y };
          mover.x = start.x;
          mover.y = start.y;
          try {
            attackFromEcho(state, k, e, mover, { skipCost: true, kind: "melee" });
          } catch {
            k.reactionUsed = false;
          } finally {
            mover.x = end.x;
            mover.y = end.y;
          }
        }
      }
    }
  }
}

/** Начало хода: Защищённый разум снимает очарование и испуг за кость; Стойкость перед смертью выходит на сцену */
export function fighterStartTurn(state: CombatState, c: Combatant): void {
  if (abilityByKey(c, "psi-warrior/guarded-mind") && (hasCondition(c, "charmed") || hasCondition(c, "frightened")) && poolLeft(c, PSIONIC_POOL) > 0) {
    spendPool(c, PSIONIC_POOL);
    c.conditions = c.conditions.filter((x) => x.type !== "charmed" && x.type !== "frightened");
    log(state, c, `${c.name}: Защищённый разум — очарование и испуг сняты ценой кости псионической энергии`);
  }
  const sbd = c.conditions.find((x) => x.type === "strength_before_death" && x.value === 1);
  if (sbd) {
    sbd.value = 0; // с этого момента урон считается как при 0 хитов
    log(state, c, `${c.name}: Стойкость перед смертью — дополнительный ход при 0 хитов`);
  }
}

/** Конец хода: before — до тиков таймеров, after — после */
export function fighterEndTurn(state: CombatState, c: Combatant, phase: "before" | "after"): void {
  if (phase === "before") {
    // Мощь великана заканчивается — возвращается прежний размер
    const gm = c.conditions.find((x) => x.type === "giants_might");
    if (gm && gm.source && (gm.duration ?? 1) <= 1) {
      c.size = gm.source as Combatant["size"];
    }
    // Непоколебимая метка рыцаря держится до конца его следующего хода
    if (abilityByKey(c, "cavalier/unwavering-mark")) {
      for (const t of state.combatants) {
        const m = t.conditions.find((x) => x.type === "unwavering_mark" && x.source === c.id);
        if (!m) continue;
        if (!alive(c) || !canAct(c) || (m.value ?? 0) === 0) t.conditions = t.conditions.filter((x) => x !== m);
        else m.value = 0;
      }
    }
    // Эхо дальше 30 футов от рыцаря в конце его хода рассеивается
    const echoes = echoesOf(c);
    if (echoes.length && !hasCondition(c, "echo_avatar")) {
      const near = echoes.filter((e) => distanceFt(e, c) <= 30);
      if (near.length !== echoes.length) {
        setEchoes(c, near);
        log(state, c, `${c.name}: эхо слишком далеко и рассеивается`, "system");
      }
    }
    // Стойкость перед смертью: ход закончен — боец теряет сознание
    const sbd = c.conditions.find((x) => x.type === "strength_before_death" && x.value === 0);
    if (sbd) {
      c.conditions = [...c.conditions.filter((x) => x !== sbd && x.type !== "unconscious" && x.type !== "prone"), { type: "unconscious" }, { type: "prone" }];
      // Дополнительная запись очереди убирается: в обычной очереди рыцарь ходит один раз за раунд
      const idx = state.turnOrder.indexOf(c.id);
      const last = state.turnOrder.lastIndexOf(c.id);
      if (idx !== last) {
        state.turnOrder.splice(state.currentTurnIndex, 1);
        state.currentTurnIndex -= 1;
      }
      log(state, c, `${c.name} теряет сознание: дополнительный ход окончен`, "damage");
    }
    return;
  }

  // Эхо исчезает, когда рыцарь недееспособен
  if (echoesOf(c).length && (!alive(c) || !canAct(c))) setEchoes(c, []);

  // Каменная руна: существо закончило ход рядом с рыцарем — реакцией очаровываем его
  if (!alive(c)) return;
  for (const k of state.combatants) {
    if (k.id === c.id || !alive(k) || !isHostile(k.type, c.type)) continue;
    const rune = reactionReady(k, "rune-knight/stone-rune");
    if (!rune || distanceFt(k, c) > 30 || hasCondition(c, "stone_trance")) continue;
    k.reactionUsed = true;
    spendAbilityUse(k, rune);
    const dc = dcOf(rune.parameters, 8 + k.profBonus + modOf(k, "CON"));
    const save = rollEffectSave(state, c, "WIS", dc, true, "Каменная руна");
    state.addLog(`${c.name}: ${save.text} против «Каменная руна»`, "save", c.name);
    if (!save.success) {
      applyEffect(state, c.id, { condition: "stone_trance", durationRounds: 11, saveType: "WIS", saveDC: dc }, k.id);
      log(state, k, `${k.name}: Каменная руна — ${c.name} околдован, скорость 0 и недееспособен`);
    }
    break;
  }
}

/** Побочные эффекты после умения: Сплочающий крик, Вдохновляющий всплеск */
export function fighterAfterAbility(state: CombatState, c: Combatant, srdKey: string | undefined): void {
  if (srdKey === "fighter/second-wind") {
    const cry = abilityByKey(c, "banneret/rallying-cry");
    if (cry) {
      const wounded = alliesOf(state, c)
        .filter((a) => distanceFt(a, c) <= 60 && a.hpCurrent < a.hpMax && canAct(a))
        .sort((a, b) => a.hpCurrent / a.hpMax - b.hpCurrent / b.hpMax)
        .slice(0, 3);
      for (const a of wounded) heal(state, a.id, c.level);
      if (wounded.length) log(state, c, `${c.name}: Сплочающий крик — ${wounded.map((a) => a.name).join(", ")} восстанавливают по ${c.level} хитов`);
    }
  }
  if (srdKey === "fighter/action-surge") {
    const surge = abilityByKey(c, "banneret/inspiring-surge");
    if (surge) {
      const count = c.level >= 18 ? 2 : 1;
      const candidates = alliesOf(state, c).filter((a) => distanceFt(a, c) <= 60 && !a.reactionUsed && canAct(a));
      let done = 0;
      for (const ally of candidates) {
        if (done >= count) break;
        const foe = hostilesOf(state, ally)
          .filter((t) => bestAttackReaching(state, ally, t))
          .sort((a, b) => a.hpCurrent - b.hpCurrent)[0];
        const atk = foe && bestAttackReaching(state, ally, foe);
        if (!foe || !atk) continue;
        ally.reactionUsed = true;
        log(state, c, `${c.name}: Вдохновляющий всплеск — ${ally.name} атакует ${foe.name} реакцией`);
        performAttack(state, ally.id, foe.id, atk.id, { skipTurnCheck: true, skipCost: true });
        done += 1;
      }
    }
  }
}

/** После заклинания: Боевая магия даёт атаку оружием бонусным действием */
export function fighterAfterSpell(state: CombatState, caster: Combatant, spellLevel: number): void {
  const wm = abilityByKey(caster, "eldritch-knight/war-magic");
  const improved = abilityByKey(caster, "eldritch-knight/improved-war-magic");
  if ((wm && spellLevel === 0) || improved) {
    caster.conditions = [...caster.conditions.filter((x) => x.type !== "war_magic_ready"), { type: "war_magic_ready", duration: 1 }];
    state.mark(caster.id);
    log(state, caster, `${caster.name}: Боевая магия — можно атаковать оружием бонусным действием`, "system");
  }
}
