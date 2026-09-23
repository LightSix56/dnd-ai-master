// Ядро правил боя: преимущества/помехи от состояний, атаки, спасброски, урон.
// Здесь нет обращений к БД — только чистые расчёты над снимком боя,
// чтобы одну и ту же логику использовали и игрок, и бот.

import { rollD20, rollDice, formatD20Roll, type D20Roll } from "@/lib/dnd/dice";
import { distanceFt } from "./grid";
import {
  CONDITION_EFFECTS,
  isHostile,
  type AbilityKey,
  type Attack,
  type Combatant,
  type Condition,
  type ConditionEffect,
  type DamageRoll,
  type MapElement,
} from "./types";
import { hasLineOfSight, isInVisionCone } from "./movement";

// ============ СОСТОЯНИЯ ============

export function getConditionEffects(conditions: Condition[]): ConditionEffect[] {
  return conditions
    .map((c) => CONDITION_EFFECTS[c.type]?.effects)
    .filter((e): e is ConditionEffect => !!e);
}

export function hasCondition(c: Combatant, type: string): boolean {
  return c.conditions.some((cond) => cond.type === type);
}

/** Может ли боец вообще совершать действия */
export function canAct(c: Combatant): boolean {
  if (c.hpCurrent <= 0) return false;
  return !getConditionEffects(c.conditions).some((e) => e.noActions);
}

/** Итоговый AC с учётом бонусов от состояний (Щит, Ускорение, Укрытия) */
export function effectiveAC(c: Combatant): number {
  const bonus = getConditionEffects(c.conditions).reduce(
    (sum, e) => sum + (e.acBonus ?? 0),
    0
  );
  return c.ac + bonus;
}

/** Итоговая скорость с учётом состояний и Рывка */
export function effectiveSpeed(c: Combatant): number {
  const effects = getConditionEffects(c.conditions);
  // speedSetTo = 0 (опутан, схвачен, оглушён, лежит без сознания) перебивает всё
  const setTo = effects.find((e) => e.speedSetTo !== undefined)?.speedSetTo;
  if (setTo !== undefined) return setTo;

  let speed = c.speed;
  for (const e of effects) {
    if (e.speedMultiplier) speed = Math.floor(speed * e.speedMultiplier);
  }
  if (hasCondition(c, "dashing")) speed *= 2;
  return speed;
}

export function remainingMovement(c: Combatant): number {
  return Math.max(0, effectiveSpeed(c) - Math.max(0, c.movementUsed));
}

// ============ ПРЕИМУЩЕСТВА / ПОМЕХИ ============

export interface AdvantageResult {
  advantage: boolean;
  disadvantage: boolean;
  /** Причины — показываем в логе, чтобы было видно откуда взялось */
  reasons: string[];
}

/**
 * Собирает все источники преимущества и помехи на атаку.
 * manual — ручной переключатель игрока (например, обстоятельства на усмотрение ведущего).
 */
export function computeAttackAdvantage(
  attacker: Combatant,
  target: Combatant,
  attack: Attack,
  manual: { advantage?: boolean; disadvantage?: boolean } = {},
  context: { distanceFt?: number; hasCover?: boolean; allCombatants?: Combatant[] } = {}
): AdvantageResult {
  const reasons: string[] = [];
  let adv = false;
  let dis = false;

  if (manual.advantage) {
    adv = true;
    reasons.push("вручную: преимущество");
  }
  if (manual.disadvantage) {
    dis = true;
    reasons.push("вручную: помеха");
  }

  // Состояния атакующего
  for (const cond of attacker.conditions) {
    const e = CONDITION_EFFECTS[cond.type]?.effects;
    if (!e) continue;
    if (e.attackDisadvantage) {
      dis = true;
      reasons.push(`${CONDITION_EFFECTS[cond.type].name} (атакующий)`);
    }
    if (e.attackAdvantage) {
      adv = true;
      reasons.push(CONDITION_EFFECTS[cond.type].name);
    }
  }

  // Состояния цели
  const isMelee = attack.kind === "melee";
  for (const cond of target.conditions) {
    const e = CONDITION_EFFECTS[cond.type]?.effects;
    if (!e) continue;
    const label = CONDITION_EFFECTS[cond.type].name;
    if (e.attackAdvantageAgainst) {
      adv = true;
      reasons.push(`цель: ${label}`);
    }
    if (e.attackDisadvantageAgainst) {
      dis = true;
      reasons.push(`цель: ${label}`);
    }
    if (e.meleeAdvantageAgainst && isMelee) {
      adv = true;
      reasons.push(`цель: ${label} (вблизи)`);
    }
    if (e.rangedDisadvantageAgainst && !isMelee) {
      dis = true;
      reasons.push(`цель: ${label} (издалека)`);
    }
  }

  // Скрытность атакующего (атака из засады или состояние hidden)
  if (attacker.isHidden || hasCondition(attacker, "hidden")) {
    adv = true;
    reasons.push("скрыт (атака из тени)");
  }

  // Ликвидация (Ассасин/Плут-Убийца): преимущество против любого существа, которое ещё не совершало ход в этом бою
  const isAssassin =
    attacker.abilities?.some((a) => {
      const n = (a.name || "").toLowerCase();
      const id = (a.id || "").toLowerCase();
      return n.includes("ликвидация") || n.includes("assassinate") || id.includes("assassin");
    }) ||
    ((attacker.className?.toLowerCase().includes("ассасин") || attacker.className?.toLowerCase().includes("убийца")) &&
      (attacker.level ?? 1) >= 3);

  if (isAssassin && !target.hasActed) {
    adv = true;
    reasons.push("Ликвидация (цель ещё не ходила)");
  }

  // Тактика стаи (Pack Tactics): преимущество, если рядом с целью есть дееспособный союзник атакующего в пределах 5 фт
  const hasPackTactics = attacker.monsterTraits?.some((t) => {
    const n = (t.name || "").toLowerCase();
    return n.includes("тактика стаи") || n.includes("pack tactics");
  });

  if (hasPackTactics && context.allCombatants && context.allCombatants.length > 0) {
    const allyNearby = context.allCombatants.some(
      (c) =>
        c.id !== attacker.id &&
        c.type === attacker.type &&
        c.hpCurrent > 0 &&
        !getConditionEffects(c.conditions).some((e) => e.noActions) &&
        distanceFt(c, target) <= 5
    );
    if (allyNearby) {
      adv = true;
      reasons.push("Тактика стаи (союзник в 5 фт)");
    }
  }

  // Скрытность цели
  if (target.isHidden) {
    dis = true;
    reasons.push("цель скрыта");
  }

  // Дальний бой на большой дистанции — помеха
  const dist = context.distanceFt;
  if (attack.kind !== "melee" && dist !== undefined && attack.range.long) {
    if (dist > attack.range.normal && dist <= attack.range.long) {
      dis = true;
      reasons.push("за пределами эффективной дальности");
    }
  }

  // Стрельба в упор — помеха: по правилам 5e, если ЛЮБОЙ дееспособный враг находится в 5 фт от стрелка
  if (attack.kind === "ranged") {
    const hasCrossbowExpert =
      attacker.abilities?.some((a) => {
        const n = (a.name || "").toLowerCase();
        const id = (a.id || "").toLowerCase();
        return (
          n.includes("crossbow expert") ||
          n.includes("эксперт в арбалетах") ||
          id.includes("crossbow_expert") ||
          id.includes("xbow_expert")
        );
      }) ||
      attacker.attacks?.some((a) => {
        const n = (a.name || "").toLowerCase();
        const id = (a.id || "").toLowerCase();
        return (
          n.includes("crossbow expert") ||
          id.includes("xbow_bonus") ||
          id.includes("silas_xbow") ||
          n.includes("эксперт в арбалетах")
        );
      }) ||
      (attacker.name || "").toLowerCase().includes("силас") ||
      (attacker as any).hasCrossbowExpert === true;

    let enemyAdjacent = false;
    if (context.allCombatants && context.allCombatants.length > 0) {
      enemyAdjacent = context.allCombatants.some(
        (c) =>
          c.id !== attacker.id &&
          c.hpCurrent > 0 &&
          isHostile(attacker.type, c.type) &&
          !getConditionEffects(c.conditions).some((e) => e.noActions) &&
          distanceFt(attacker, c) <= 5
      );
    } else if (dist !== undefined && dist <= 5) {
      enemyAdjacent = true;
    }

    if (enemyAdjacent) {
      if (!hasCrossbowExpert) {
        dis = true;
        reasons.push("стрельба в упор (враг в 5 фт)");
      } else {
        reasons.push("Эксперт в арбалетах (нет помехи в упор)");
      }
    }
  }

  return { advantage: adv, disadvantage: dis, reasons };
}

/**
 * Помеченные как consumedOnAttack состояния (Помощь) снимаются после атаки.
 * Возвращает список conditions без израсходованных.
 */
export function consumeAttackConditions(conditions: Condition[]): Condition[] {
  return conditions.filter(
    (c) => !CONDITION_EFFECTS[c.type]?.effects.consumedOnAttack
  );
}

// ============ ДОСЯГАЕМОСТЬ ============

export interface ReachCheck {
  ok: boolean;
  distanceFt: number;
  /** true если дистанция в пределах long, но за normal — попадёт с помехой */
  atLongRange: boolean;
  reason?: string;
}

/**
 * Проверяет, достаёт ли атака до цели: дистанция + линия видимости.
 */
export function checkReach(
  attacker: Combatant,
  target: Combatant,
  attack: Attack,
  mapElements: MapElement[]
): ReachCheck {
  const dist = distanceFt(attacker, target);
  const max = attack.range.long ?? attack.range.normal;

  if (dist > max) {
    return {
      ok: false,
      distanceFt: dist,
      atLongRange: false,
      reason: `Слишком далеко: ${dist} фт, дальность ${max} фт`,
    };
  }

  // Ближний бой и дальний бой требуют отсутствия глухой стены
  if (!hasLineOfSight(attacker, target, mapElements)) {
    return {
      ok: false,
      distanceFt: dist,
      atLongRange: false,
      reason: "Нет линии видимости — препятствие мешает",
    };
  }

  // Если цель скрытна (isHidden): нельзя атаковать напрямую, если цель вне зоны ближнего боя (5 фт) и вне сектора взгляда
  if (target.isHidden && dist > 5) {
    if (!isInVisionCone(attacker, target)) {
      return {
        ok: false,
        distanceFt: dist,
        atLongRange: false,
        reason: "Цель скрыта от вашего взгляда и не может быть выбрана прямой целью атаки",
      };
    }
  }

  return {
    ok: true,
    distanceFt: dist,
    atLongRange: dist > attack.range.normal,
  };
}

// ============ СПАСБРОСКИ ============

export interface SaveResult {
  success: boolean;
  roll: D20Roll;
  dc: number;
  ability: AbilityKey;
  autoFail: boolean;
  text: string;
  advantage?: boolean;
}

/**
 * Спасбросок. saves[ability].mod уже содержит бонус мастерства,
 * поэтому profBonus здесь повторно НЕ добавляется.
 */
export function rollSave(
  c: Combatant,
  ability: AbilityKey,
  dc: number,
  opts: { isSpell?: boolean; advantage?: boolean; disadvantage?: boolean } = {}
): SaveResult {
  const effects = getConditionEffects(c.conditions);

  // Автопровал СИЛ/ЛОВ спасбросков (парализован, оглушён, без сознания)
  const autoFail =
    (ability === "STR" && effects.some((e) => e.autoFailStrSave)) ||
    (ability === "DEX" && effects.some((e) => e.autoFailDexSave));

  const saveData = c.saves?.[ability];
  let bonus = saveData ? saveData.mod : c.abilityMods?.[ability] ?? 0;

  // Бонус к спасброскам ЛОВ от укрытий (полуукрытие +2, 3/4 укрытие +5)
  if (ability === "DEX") {
    if (hasCondition(c, "cover_three_quarters")) bonus += 5;
    else if (hasCondition(c, "cover_half")) bonus += 2;
  }

  let adv = effects.some((e) => e.saveAdvantage?.includes(ability)) || !!opts.advantage;
  let dis = effects.some((e) => e.saveDisadvantage?.includes(ability)) || !!opts.disadvantage;

  // Магическое сопротивление (Magic Resistance): преимущество на спасброски против заклинаний
  if (opts.isSpell) {
    const hasMagicResistance = c.monsterTraits?.some((t) => {
      const n = (t.name || "").toLowerCase();
      return n.includes("магическое сопротивление") || n.includes("magic resistance");
    });
    if (hasMagicResistance) {
      adv = true;
    }
  }

  // Благословение: +1к4 к спасброскам
  const blessDice = effects.find((e) => e.attackBonusDice)?.attackBonusDice;
  const blessBonus = blessDice ? rollDice(blessDice).total : 0;

  const roll = rollD20(bonus + blessBonus, adv, dis);

  if (autoFail) {
    return {
      success: false,
      roll,
      dc,
      ability,
      autoFail: true,
      text: `спасбросок ${ability} автопровал (недееспособен)`,
      advantage: adv,
    };
  }

  const success = roll.total >= dc;
  return {
    success,
    roll,
    dc,
    ability,
    autoFail: false,
    text: `${roll.total} vs DC ${dc} (${success ? "Успех" : "Провал"})`,
    advantage: adv,
  };
}

// ============ СПАСБРОСКИ ОТ СМЕРТИ (DEATH SAVES) ============

export interface DeathSaveResult {
  success: boolean;
  criticalSuccess: boolean;
  criticalFailure: boolean;
  roll: D20Roll;
  text: string;
}

/**
 * Спасбросок от смерти при 0 HP (правило D&D 5e: d20 без модификаторов).
 * 20: крит. успех — восстанавливает 1 HP и встает на ноги.
 * 1: крит. провал — сразу 2 провала.
 * 10+: 1 успех.
 * <10: 1 провал.
 */
export function rollDeathSave(c: Combatant): DeathSaveResult {
  const roll = rollD20(0);
  const nat = roll.natural;
  const criticalSuccess = nat === 20;
  const criticalFailure = nat === 1;
  const success = criticalSuccess || (!criticalFailure && nat >= 10);

  let text = `спасбросок от смерти [${nat}] — `;
  if (criticalSuccess) text += "КРИТИЧЕСКИЙ УСПЕХ (натуральная 20! Восстанавливает 1 HP)";
  else if (criticalFailure) text += "КРИТИЧЕСКИЙ ПРОВАЛ (2 провала)";
  else text += success ? "успех" : "провал";

  return { success, criticalSuccess, criticalFailure, roll, text };
}

// ============ УРОН ============

export interface DamageResult {
  total: number;
  breakdown: string[];
}

/**
 * Кидает урон. При крите удваиваются только кубы, не модификаторы (правило 5e).
 */
export function rollDamage(
  damage: DamageRoll[],
  crit = false,
  options: { halfOnSave?: boolean; extraDice?: string } = {}
): DamageResult {
  let total = 0;
  const breakdown: string[] = [];

  const allDamage = [...damage];
  if (options.extraDice) {
    allDamage.push({ dice: options.extraDice, mod: 0, type: damage[0]?.type ?? "force" });
  }

  for (const dmg of allDamage) {
    let sum = 0;
    const doubleDice = crit && !dmg.noCrit;

    if (dmg.dice) {
      const first = rollDice(dmg.dice);
      const diceSum = first.rolls.reduce((a, b) => a + b, 0);
      sum += diceSum;
      if (doubleDice) {
        // Крит: второй раз кидаем только кубы
        const second = rollDice(dmg.dice);
        const secondDiceSum = second.rolls.reduce((a, b) => a + b, 0);
        sum += secondDiceSum;
      }
      // Если модификатор был в строке нотации (например "1d6+3"), а dmg.mod равен 0
      if (dmg.mod === 0 && first.modifier !== 0) {
        sum += first.modifier;
      }
    }
    sum += dmg.mod;

    if (sum < 0) sum = 0;
    total += sum;
    breakdown.push(
      `${dmg.dice || "—"}${doubleDice ? "×2" : ""}${dmg.mod ? (dmg.mod > 0 ? `+${dmg.mod}` : dmg.mod) : ""} = ${sum} (${dmg.type})`
    );
  }

  if (options.halfOnSave) {
    total = Math.floor(total / 2);
    breakdown.push(`половина при успешном спасброске → ${total}`);
  }

  return { total, breakdown };
}

/**
 * Применяет урон с учётом временных хитов.
 * Возвращает новые значения, не трогая БД.
 */
export function applyDamage(
  target: { hpCurrent: number; hpTemp: number },
  amount: number
): { hpCurrent: number; hpTemp: number; absorbed: number } {
  let remaining = amount;
  let hpTemp = target.hpTemp;

  if (hpTemp > 0) {
    const absorbed = Math.min(hpTemp, remaining);
    hpTemp -= absorbed;
    remaining -= absorbed;
    return {
      hpCurrent: Math.max(0, target.hpCurrent - remaining),
      hpTemp,
      absorbed,
    };
  }

  return {
    hpCurrent: Math.max(0, target.hpCurrent - remaining),
    hpTemp,
    absorbed: 0,
  };
}

export function applyHealing(
  target: { hpCurrent: number; hpMax: number },
  amount: number
): number {
  return Math.min(target.hpMax, target.hpCurrent + amount);
}

// ============ АТАКА ============

export interface AttackResolution {
  hit: boolean;
  crit: boolean;
  fumble: boolean;
  hasDisadvantage: boolean;
  roll: D20Roll;
  targetAC: number;
  damage: number;
  damageBreakdown: string[];
  advantageReasons: string[];
  text: string;
}

/**
 * Полный расчёт одной атаки. Крит определяется по натуральному значению
 * выбранного кубика — это важно при преимуществе/помехе.
 */
export function resolveAttack(
  attacker: Combatant,
  target: Combatant,
  attack: Attack,
  options: {
    manualAdvantage?: boolean;
    manualDisadvantage?: boolean;
    distanceFt?: number;
    extraDamageDice?: string;
    allCombatants?: Combatant[];
  } = {}
): AttackResolution {
  // Эффект Дубинки (Shillelagh): посох/дубинка атакуют от Мудрости и наносят 1d8+МУД урона
  let attackToUse = attack;
  if (hasCondition(attacker, "shillelagh")) {
    const isStaffOrClub = /посох|дубинк|staff|club/i.test(attack.name || attack.id);
    if (isStaffOrClub) {
      const wisMod = attacker.abilityMods?.WIS ?? 0;
      const prof = attacker.profBonus ?? 2;
      const newBonus = Math.max(attack.attackBonus, wisMod + prof);
      const newDmg: DamageRoll[] = [
        { dice: "1d8", mod: Math.max(attack.damage[0]?.mod ?? 0, wisMod), type: "bludgeoning" },
      ];
      attackToUse = {
        ...attack,
        attackBonus: newBonus,
        damage: newDmg,
      };
    }
  }

  const advResult = computeAttackAdvantage(
    attacker,
    target,
    attackToUse,
    { advantage: options.manualAdvantage, disadvantage: options.manualDisadvantage },
    { distanceFt: options.distanceFt, allCombatants: options.allCombatants }
  );

  // Благословение добавляет 1к4 к броску атаки
  const effects = getConditionEffects(attacker.conditions);
  const blessDice = effects.find((e) => e.attackBonusDice)?.attackBonusDice;
  const blessBonus = blessDice ? rollDice(blessDice).total : 0;

  const roll = rollD20(
    attackToUse.attackBonus + blessBonus,
    advResult.advantage,
    advResult.disadvantage
  );

  const targetAC = effectiveAC(target);
  const natCrit = roll.natural === 20;
  const fumble = roll.natural === 1;
  const inMeleeRange = (options.distanceFt ?? 5) <= 5;
  const isHelpless = hasCondition(target, "paralyzed") || hasCondition(target, "unconscious");
  const isAssassin =
    attacker.abilities?.some((a) => {
      const n = (a.name || "").toLowerCase();
      const id = (a.id || "").toLowerCase();
      return n.includes("ликвидация") || n.includes("assassinate") || id.includes("assassin");
    }) ||
    ((attacker.className?.toLowerCase().includes("ассасин") || attacker.className?.toLowerCase().includes("убийца")) &&
      (attacker.level ?? 1) >= 3);
  const isSurprised = hasCondition(target, "surprised");

  const hit = natCrit || (!fumble && roll.total >= targetAC);
  const crit = natCrit || (hit && isHelpless && inMeleeRange) || (hit && isAssassin && isSurprised);

  let damage = 0;
  let damageBreakdown: string[] = [];
  if (hit) {
    const dmg = rollDamage(attack.damage, crit, { extraDice: options.extraDamageDice });
    damage = dmg.total;
    damageBreakdown = dmg.breakdown;
  }

  let text = `${attack.name}: ${formatD20Roll(roll)} против КД ${targetAC}`;
  if (crit) {
    if (isAssassin && isSurprised && !natCrit) text += " — АВТО-КРИТ (Ликвидация: застигнут врасплох)!";
    else if (isHelpless && !natCrit) text += " — АВТО-КРИТ (беспомощная цель в 5 фт)!";
    else text += " — КРИТ!";
  } else if (fumble) text += " — критический промах";
  else text += hit ? " — попадание" : " — промах";
  if (hit) text += `, ${damage} урона`;
  if (advResult.reasons.length) text += ` (${advResult.reasons.join(", ")})`;

  return {
    hit,
    crit,
    fumble,
    hasDisadvantage: advResult.disadvantage,
    roll,
    targetAC,
    damage,
    damageBreakdown,
    advantageReasons: advResult.reasons,
    text,
  };
}

// ============ КОНЦЕНТРАЦИЯ ============

/**
 * Спасбросок концентрации при получении урона.
 * СЛ = максимум(10, половина полученного урона). Используется ТЕЛ цели.
 */
export function rollConcentrationSave(
  target: Combatant,
  damageTaken: number
): SaveResult {
  const dc = Math.max(10, Math.floor(damageTaken / 2));
  const result = rollSave(target, "CON", dc);
  return {
    ...result,
    text: `концентрация: ${result.text}`,
  };
}

// ============ ЭКОНОМИКА ДЕЙСТВИЙ ============

export interface ActionCostCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Проверяет, может ли боец заплатить за действие.
 * Множественная атака: пока не израсходованы все атаки текущего Действия,
 * повторная атака не требует нового Действия.
 */
export function canPayForAttack(c: Combatant, attack: Attack): ActionCostCheck {
  if (!canAct(c)) return { ok: false, reason: "Не может действовать" };

  if (attack.actionCost === "action+bonus") {
    if (c.actionUsed && c.extraActions <= 0) {
      return { ok: false, reason: "Действие уже использовано" };
    }
    if (c.bonusActionUsed) {
      return { ok: false, reason: "Бонусное действие уже использовано" };
    }
    return { ok: true };
  }

  if (attack.actionCost === "bonus") {
    if (c.bonusActionUsed) {
      return { ok: false, reason: "Бонусное действие уже использовано" };
    }
    return { ok: true };
  }

  // Обычная атака за Действие
  const midAction = c.attacksMadeThisAction > 0 && c.attacksMadeThisAction < c.attacksPerAction;
  if (midAction) return { ok: true };

  if (c.actionUsed && c.extraActions <= 0) {
    return { ok: false, reason: "Действие уже использовано" };
  }
  return { ok: true };
}

/**
 * Считает, как изменятся ресурсы после атаки.
 * Возвращает поля для записи в БД.
 */
export function payForAttack(
  c: Combatant,
  attack: Attack
): {
  actionUsed: boolean;
  bonusActionUsed: boolean;
  extraActions: number;
  attacksMadeThisAction: number;
} {
  let { actionUsed, bonusActionUsed, extraActions, attacksMadeThisAction } = c;

  const spendAction = () => {
    // Порыв действия: сначала тратим дополнительные Действия
    if (actionUsed && extraActions > 0) {
      extraActions -= 1;
      attacksMadeThisAction = 0;
    } else {
      actionUsed = true;
    }
  };

  if (attack.actionCost === "action+bonus") {
    spendAction();
    bonusActionUsed = true;
    // Двойной удар считается как полностью израсходованное Действие
    attacksMadeThisAction = c.attacksPerAction;
    return { actionUsed, bonusActionUsed, extraActions, attacksMadeThisAction };
  }

  if (attack.actionCost === "bonus") {
    bonusActionUsed = true;
    return { actionUsed, bonusActionUsed, extraActions, attacksMadeThisAction };
  }

  const midAction = attacksMadeThisAction > 0 && attacksMadeThisAction < c.attacksPerAction;
  if (!midAction) {
    spendAction();
    attacksMadeThisAction = 1;
  } else {
    attacksMadeThisAction += 1;
  }

  return { actionUsed, bonusActionUsed, extraActions, attacksMadeThisAction };
}
