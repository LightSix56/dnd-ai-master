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
import { distanceFt } from "./grid";
import { canAct, checkReach, hasCondition, type DamagePart } from "./rules";
import {
  EngineError,
  applyEffect,
  dealDamage,
  grantTempHp,
  lastAttackThisTurn,
  payActionCost,
  performAttack,
  pushCombatantAway,
  rollEffectSave,
  spendAbilityUse,
  type CastResult,
  type CombatState,
} from "./engine";
import {
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
  /** Запас, из которого списывается заряд при срабатывании */
  pool: string;
  /** Только рукопашная / только дальнобойная атака оружием */
  weapon?: "melee" | "ranged";
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

    const ability = abilityByKey(attacker, key);
    if (!ability) {
      disarmRider(attacker, key);
      continue;
    }
    const faces = poolFaces(attacker, def.pool);
    if (!spendPool(attacker, def.pool)) {
      log(state, attacker, `${attacker.name}: «${ability.name}» не сработал — запас исчерпан`, "system");
      disarmRider(attacker, key);
      continue;
    }
    if (ability.usesMax > 0) spendAbilityUse(attacker, ability);
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
    if (poolLeft(c, def.pool) < 1) throw new EngineError(`«${label}»: не хватает «${abilityByKey(c, def.pool)?.name ?? "запаса"}»`);
    payActionCost(state, c, params.actionCost);
    // Один приём на атаку: прежний заряженный приём того же запаса снимается
    for (const cond of armedRiders(c)) {
      const other = RIDERS[cond.source ?? ""];
      if (other && other.pool === def.pool && cond.source !== params.srdKey) disarmRider(c, cond.source as string);
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
  const out = handler(state, c, ability, params, opts);
  // Уровень «использований» самого умения (раз в ход и т. п.)
  if (!params.deferCost && ability.usesMax > 0) spendAbilityUse(c, ability);
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
