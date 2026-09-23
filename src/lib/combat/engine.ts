// Ядро боя: операции над снимком (CombatState), которыми пользуются
// и игрок (через API), и бот. Никаких обращений к БД — роут сам сохраняет
// изменённых бойцов. Это единственное место, где меняется состояние боя.

import { rollDice, rollD20 } from "@/lib/dnd/dice";
import { distanceFt } from "./grid";
import {
  applyDamage,
  applyHealing,
  canPayForAttack,
  canAct,
  checkReach,
  consumeAttackConditions,
  effectiveSpeed,
  payForAttack,
  remainingMovement,
  resolveAttack,
  rollConcentrationSave,
  rollDamage,
  rollDeathSave,
  rollSave,
} from "./rules";
import {
  buildTurnOrder,
  getNextTurn,
  rollInitiativeForAll,
  reconcileTurnOrder,
} from "./initiative";
import {
  computeVisibilityStatus,
  determineFacingTowards,
  findOpportunityAttackers,
  findPath,
  getAoeCells,
  hasLineOfSight,
  isInVisionCone,
  isCellBlocked,
  isTerrainBlocked,
  isWaterTerrain,
  isLavaTerrain,
} from "./movement";
import { cantripDiceMultiplier, sneakAttackDice } from "./library-data";
import { getBeastFormById } from "./beast-forms";
import { triggerAILegendaryActions } from "./legendary";
import {
  CONDITION_EFFECTS,
  isHostile,
  type AbilityKey,
  type ActionParameters,
  type AppliedEffect,
  type Attack,
  type Cell,
  type Combat,
  type Combatant,
  type CombatAbility,
  type DamageRoll,
  type FacingDirection,
  type LogEntry,
  type MapElement,
  type MapElementProperties,
  type CreatureSize,
  type CombatStatus,
  type CombatPotion,
} from "./types";

// ============ СНИМОК БОЯ ============

/**
 * Мутабельная копия боя. Все операции меняют её, помечая изменённых бойцов,
 * чтобы роут записал в БД ровно то, что поменялось.
 */
export class CombatState {
  id: string;
  name: string;
  status: CombatStatus;
  combatants: Combatant[];
  mapElements: MapElement[];
  round: number;
  turnOrder: string[];
  currentTurnIndex: number;
  log: LogEntry[];
  gridWidth: number;
  gridHeight: number;

  private dirty = new Set<string>();
  private combatDirty = false;

  constructor(combat: Combat) {
    this.id = combat.id;
    this.name = combat.name;
    this.status = combat.status;
    this.combatants = combat.combatants.map((c) => ({ ...c }));
    this.mapElements = combat.mapElements;
    this.round = combat.round;
    this.turnOrder = [...combat.turnOrder];
    this.currentTurnIndex = combat.currentTurnIndex;
    this.log = [...combat.log];
    this.gridWidth = combat.gridWidth;
    this.gridHeight = combat.gridHeight;
  }

  get(id: string): Combatant | undefined {
    return this.combatants.find((c) => c.id === id);
  }

  require(id: string): Combatant {
    const c = this.get(id);
    if (!c) throw new EngineError(`Боец не найден: ${id}`);
    return c;
  }

  mark(id: string): void {
    this.dirty.add(id);
  }

  markCombat(): void {
    this.combatDirty = true;
  }

  get dirtyIds(): string[] {
    return [...this.dirty];
  }

  get isCombatDirty(): boolean {
    return this.combatDirty;
  }

  /** Боец, чей сейчас ход */
  current(): Combatant | null {
    const id = this.turnOrder[this.currentTurnIndex];
    return id ? this.get(id) ?? null : null;
  }

  addLog(text: string, kind: LogEntry["kind"], actor?: string): void {
    this.log.push({ round: this.round, actor, text, kind });
    // Лог не растим бесконечно — старые записи никому не нужны
    if (this.log.length > 400) this.log = this.log.slice(-400);
    this.combatDirty = true;
  }
}

/** Ошибка правил: роут превращает её в 400, а не в 500 */
export class EngineError extends Error {}

function assertTurn(state: CombatState, id: string): void {
  const current = state.current();
  if (!current) throw new EngineError("Очередь ходов не определена — бросьте инициативу");
  if (current.id !== id) {
    throw new EngineError(`Сейчас ход ${current.name}, а не этого бойца`);
  }
}

// ============ ВСПОМОГАТЕЛЬНОЕ: КУБЫ ============

/** Умножает количество кубов: "1d10" ×3 → "3d10". Модификатор в нотации сохраняется. */
function scaleDice(dice: string, multiplier: number): string {
  if (!dice || multiplier <= 1) return dice;
  const m = dice.toLowerCase().replace(/к/g, "d").match(/^(\d*)d(\d+)(.*)$/);
  if (!m) return dice;
  const count = (m[1] ? parseInt(m[1], 10) : 1) * multiplier;
  return `${count}d${m[2]}${m[3] ?? ""}`;
}

/** Добавляет кубы того же типа: "2d6" + 3 куба → "5d6" */
function addDiceCount(dice: string, extra: number): string {
  if (!dice || extra <= 0) return dice;
  const m = dice.toLowerCase().replace(/к/g, "d").match(/^(\d*)d(\d+)(.*)$/);
  if (!m) return dice;
  const count = (m[1] ? parseInt(m[1], 10) : 1) + extra;
  return `${count}d${m[2]}${m[3] ?? ""}`;
}

// ============ УРОН / ЛЕЧЕНИЕ / СОСТОЯНИЯ ============

export function dealDamage(
  state: CombatState,
  targetId: string,
  amount: number,
  opts: {
    source?: string;
    kindLabel?: string;
    damageType?: string;
    isAttack?: boolean;
    attackerId?: string;
    isMagicalAttack?: boolean;
    isCritical?: boolean;
  } = {}
): void {
  const target = state.require(targetId);
  if (amount <= 0) return;

  // Доспех Агатиса: если цель имеет временные хиты и состояние armor_of_agathys,
  // при получении урона от рукопашной атаки (в пределах 5 фт), атакующий получает урон холодом
  const agathysCond = target.conditions.find((c) => c.type === "armor_of_agathys");
  const hadTempHp = target.hpTemp > 0;
  const attackerId = opts.attackerId || opts.source;
  if (agathysCond && hadTempHp && opts.isAttack && attackerId && attackerId !== target.id) {
    const attacker = state.get(attackerId);
    if (attacker && distanceFt(target, attacker) <= 5) {
      const coldDmg = agathysCond.value ?? 5;
      state.addLog(
        `❄️ «Доспех Агатиса» наносит ${attacker.name} ${coldDmg} урона холодом в ответ на атаку!`,
        "damage",
        target.name
      );
      dealDamage(state, attacker.id, coldDmg, { damageType: "cold", isAttack: false, attackerId: target.id });
    }
  }

  let actualAmount = amount;
  if (opts.damageType) {
    const type = opts.damageType.toLowerCase();
    const isPhysical = ["slashing", "piercing", "bludgeoning", "рубящий", "колющий", "дробящий"].some((p) =>
      type.includes(p)
    );
    const isNonmagical = opts.isAttack && !opts.isMagicalAttack;

    // Подавление регенерации уроном огнем или кислотой
    if (type.includes("fire") || type.includes("огонь") || type.includes("acid") || type.includes("кислот")) {
      target.suppressRegenerationUntilRound = state.round + 1;
    }

    const hasImmunity = target.damageImmunities?.some((imm) => {
      const immLower = imm.toLowerCase();
      if (immLower === type) return true;
      if (isPhysical && isNonmagical && (immLower.includes("немагическ") || immLower.includes("nonmagical"))) return true;
      return false;
    });

    if (hasImmunity) {
      state.addLog(`${target.name} имеет иммунитет к урону «${opts.damageType}» (0 урона)`, "system", target.name);
      return;
    }

    const hasResistance = target.damageResistances?.some((res) => {
      const resLower = res.toLowerCase();
      if (resLower === type) return true;
      if (isPhysical && isNonmagical && (resLower.includes("немагическ") || resLower.includes("nonmagical"))) return true;
      return false;
    });

    if (hasResistance) {
      actualAmount = Math.floor(actualAmount / 2);
      state.addLog(`${target.name} имеет сопротивление к «${opts.damageType}» (урон: ${amount} → ${actualAmount})`, "system", target.name);
    } else if (target.damageVulnerabilities?.some((vuln) => vuln.toLowerCase() === type)) {
      actualAmount = actualAmount * 2;
      state.addLog(`${target.name} имеет уязвимость к «${opts.damageType}» (урон удвоен: ${amount} → ${actualAmount})`, "system", target.name);
    }
  }

  // Невероятное уклонение (Плут 5 ур): реакцией уполовинивает урон от атаки
  const hasUncannyDodge =
    (target.level >= 5 && (target.className?.toLowerCase().includes("плут") || target.className?.toLowerCase().includes("rogue"))) ||
    target.abilities.some((a) => a.name.includes("Невероятное уклонение") || a.name.includes("Uncanny Dodge"));

  if (hasUncannyDodge && !target.reactionUsed && opts.isAttack && actualAmount > 1) {
    const halved = Math.floor(actualAmount / 2);
    target.reactionUsed = true;
    state.addLog(
      `🛡️ ${target.name} использует «Невероятное уклонение» реакцией! (урон снижен вдвое: ${actualAmount} → ${halved})`,
      "ability",
      target.name
    );
    actualAmount = halved;
  }

  if (actualAmount <= 0) return;

  // Дикий облик: урон поглощается пулом хитов формы зверя
  if (target.wildShape) {
    const beastHp = target.hpCurrent;
    if (actualAmount < beastHp) {
      target.hpCurrent = beastHp - actualAmount;
      state.mark(targetId);
      state.addLog(
        `${target.name} (Облик: ${target.wildShape.formName}) получает ${actualAmount} урона (Осталось ${target.hpCurrent}/${target.hpMax} HP зверя)`,
        "damage",
        target.name
      );
      // Проверка концентрации в облике зверя
      if (target.concentration) {
        const save = rollConcentrationSave(target, actualAmount);
        if (!save.success) {
          state.addLog(
            `${target.name} теряет концентрацию на «${target.concentration.spellName}» (${save.text})`,
            "save",
            target.name
          );
          target.concentration = null;
          dropConcentrationEffects(state, targetId);
        } else {
          state.addLog(`${target.name} удерживает концентрацию (${save.text})`, "save", target.name);
        }
      }
      return;
    } else {
      const overflow = actualAmount - beastHp;
      revertWildShape(state, targetId, { overflowDamage: overflow });
      return;
    }
  }

  const res = applyDamage(target, actualAmount);
  const wasAlive = target.hpCurrent > 0;
  target.hpCurrent = res.hpCurrent;
  target.hpTemp = res.hpTemp;
  state.mark(targetId);

  // Снятие Доспеха Агатиса при исчерпании временных хитов
  if (target.hpTemp <= 0 && target.conditions.some((c) => c.type === "armor_of_agathys")) {
    target.conditions = target.conditions.filter((c) => c.type !== "armor_of_agathys");
    state.addLog(`❄️ «Доспех Агатиса» на ${target.name} рассеивается (временные хиты исчерпаны)`, "system", target.name);
  }

  if (res.absorbed > 0) {
    state.addLog(
      `${target.name}: ${res.absorbed} поглощено временными хитами`,
      "damage",
      target.name
    );
  }

  // Концентрация проверяется от полного полученного урона
  if (target.concentration && target.hpCurrent > 0) {
    const save = rollConcentrationSave(target, actualAmount);
    if (!save.success) {
      state.addLog(
        `${target.name} теряет концентрацию на «${target.concentration.spellName}» (${save.text})`,
        "save",
        target.name
      );
      target.concentration = null;
      dropConcentrationEffects(state, targetId);
    } else {
      state.addLog(`${target.name} удерживает концентрацию (${save.text})`, "save", target.name);
    }
  }

  if (wasAlive && target.hpCurrent <= 0) {
    // Стойкость нежити (Undead Fortitude): спасбросок ТЕЛ Сл 5 + урон, если урон не излучением и не критический
    const hasUndeadFortitude = target.monsterTraits?.some((t) => {
      const n = (t.name || "").toLowerCase();
      return n.includes("стойкость нежити") || n.includes("undead fortitude");
    });
    const dt = (opts.damageType || "").toLowerCase();
    const isRadiant = dt.includes("radiant") || dt.includes("излучение") || dt.includes("свет");
    const isCrit = !!opts.isCritical;

    if (hasUndeadFortitude && !isRadiant && !isCrit) {
      const dc = 5 + actualAmount;
      const save = rollSave(target, "CON", dc);
      if (save.success) {
        target.hpCurrent = 1;
        state.addLog(
          `💀 ${target.name} использует «Стойкость нежити» и остаётся с 1 HP! (${save.text})`,
          "ability",
          target.name
        );
        state.mark(targetId);
        return;
      } else {
        state.addLog(
          `💀 ${target.name}: «Стойкость нежити» провалена (${save.text})`,
          "ability",
          target.name
        );
      }
    }

    // При 0 HP концентрация сбрасывается автоматически
    if (target.concentration) {
      state.addLog(
        `${target.name} падает без сознания и теряет концентрацию на «${target.concentration.spellName}»`,
        "system",
        target.name
      );
      target.concentration = null;
      dropConcentrationEffects(state, targetId);
    }
    target.conditions = [
      ...target.conditions.filter((c) => c.type !== "unconscious" && c.type !== "stable"),
      { type: "unconscious" },
    ];
    state.addLog(`${target.name} падает без сознания!`, "damage", target.name);
  } else if (!wasAlive && target.hpCurrent <= 0) {
    // Урон по персонажу с 0 HP: добавляет провал спасброска от смерти
    let dsCond = target.conditions.find((cond) => cond.type === "death_save");
    let successes = dsCond?.duration ?? 0;
    let failures = (dsCond?.value ?? 0) + 1;
    target.conditions = target.conditions.filter((cond) => cond.type !== "stable");
    if (failures >= 3) {
      target.conditions = [
        ...target.conditions.filter((cond) => cond.type !== "death_save"),
        { type: "dead" },
      ];
      state.addLog(`${target.name} погибает от полученного урона!`, "damage", target.name);
    } else {
      target.conditions = [
        ...target.conditions.filter((cond) => cond.type !== "death_save"),
        { type: "death_save", duration: successes, value: failures },
      ];
      state.addLog(
        `${target.name} получает урон при 0 HP: +1 провал спасброска от смерти (${failures}/3)!`,
        "damage",
        target.name
      );
    }
  }
}

/** Снимает эффекты, которые держались концентрацией погибшего/сбитого заклинателя */
function dropConcentrationEffects(state: CombatState, casterId: string): void {
  for (const c of state.combatants) {
    const before = c.conditions.length;
    c.conditions = c.conditions.filter((cond) => cond.source !== casterId);
    if (c.conditions.length !== before) state.mark(c.id);

    if (c.id === casterId) {
      const beforeAb = c.abilities.length;
      c.abilities = c.abilities.filter((a) => !a.id.startsWith("conc_") && a.id !== "heat_metal_burn");
      if (c.abilities.length !== beforeAb) state.mark(c.id);

      const beforeAtk = c.attacks.length;
      c.attacks = c.attacks.filter((a) => a.id !== "shadow_blade_attack" && a.id !== "flame_blade_attack");
      if (c.attacks.length !== beforeAtk) state.mark(c.id);
    }
  }
}

export function heal(state: CombatState, targetId: string, amount: number): void {
  const target = state.require(targetId);
  if (amount <= 0) return;
  const before = target.hpCurrent;
  target.hpCurrent = applyHealing(target, amount);
  // Лечение выше 0 поднимает на ноги и сбрасывает спасброски от смерти
  if (before <= 0 && target.hpCurrent > 0) {
    target.conditions = target.conditions.filter(
      (c) => c.type !== "unconscious" && c.type !== "stable" && c.type !== "death_save"
    );
  }
  state.mark(targetId);
}

export function grantTempHp(state: CombatState, targetId: string, amount: number): void {
  const target = state.require(targetId);
  // Временные хиты не складываются — берётся большее значение
  target.hpTemp = Math.max(target.hpTemp, amount);
  state.mark(targetId);
}

/**
 * Использование зелья в бою (стоит ровно 1 бонусное действие по правилам D&D 5e).
 */
export function drinkPotion(
  state: CombatState,
  combatantId: string,
  potionId?: string
): {
  potion: CombatPotion;
  hpHealed: number;
  tempHp?: number;
  buffEffect?: string;
  effectSummary: string;
} {
  const c = state.require(combatantId);

  if (c.hpCurrent <= 0) {
    throw new EngineError("Боец без сознания не может пить зелье");
  }

  if (c.bonusActionUsed) {
    throw new EngineError("Бонусное действие уже использовано в этом раунде");
  }

  if (!c.potions || c.potions.length === 0) {
    throw new EngineError("Зелье не найдено или закончилось");
  }

  const potionIndex = c.potions.findIndex(
    (p) =>
      (potionId && (p.id === potionId || p.name.toLowerCase() === potionId.toLowerCase())) ||
      (!potionId && p.quantity > 0)
  );

  if (potionIndex === -1 || c.potions[potionIndex].quantity <= 0) {
    throw new EngineError("Зелье не найдено или закончилось");
  }

  const potion = c.potions[potionIndex];
  potion.quantity -= 1;
  c.bonusActionUsed = true;

  let hpHealed = 0;
  let tempHp = potion.tempHp;
  let buffEffect = potion.buffEffect;
  const effectSummaries: string[] = [];

  // Эффект лечения
  if (potion.type === "heal" || potion.formula) {
    const formula = potion.formula || "2d4+2";
    let rolled = 0;
    try {
      rolled = rollDice(formula).total;
    } catch {
      rolled = 7;
    }
    const beforeHp = c.hpCurrent;
    heal(state, c.id, rolled);
    hpHealed = c.hpCurrent - beforeHp;
    effectSummaries.push(`восстановлено ${hpHealed} HP (бросок: ${rolled}) [${c.hpCurrent}/${c.hpMax}]`);
  }

  // Временные хиты
  if (potion.tempHp) {
    grantTempHp(state, c.id, potion.tempHp);
    tempHp = c.hpTemp;
    effectSummaries.push(`временные хиты: ${c.hpTemp}`);
  }

  // Бафф / Состояние
  if (potion.buffEffect) {
    if (!c.conditions.some((cond) => cond.type === potion.buffEffect)) {
      applyEffect(state, c.id, {
        condition: potion.buffEffect,
        durationRounds: 10,
      }, c.id);
    }
    buffEffect = potion.buffEffect;
    effectSummaries.push(`эффект «${potion.buffEffect}»`);
  }

  const effectSummary = effectSummaries.length > 0 ? effectSummaries.join(", ") : "эффект применён";
  state.addLog(`🧪 ${c.name} выпивает «${potion.name}» (Бонусное действие): ${effectSummary}`, "system");
  state.mark(c.id);

  return {
    potion,
    hpHealed,
    tempHp,
    buffEffect,
    effectSummary,
  };
}

export function applyEffect(
  state: CombatState,
  targetId: string,
  effect: AppliedEffect,
  sourceId?: string
): void {
  const target = state.require(targetId);
  if (target.conditionImmunities?.some((imm) => imm.toLowerCase() === effect.condition.toLowerCase())) {
    state.addLog(`${target.name} имеет иммунитет к состоянию «${effect.condition}»`, "system", target.name);
    return;
  }
  const label = CONDITION_EFFECTS[effect.condition]?.name ?? effect.condition;

  target.conditions = [
    ...target.conditions.filter((c) => c.type !== effect.condition),
    {
      type: effect.condition,
      duration: effect.durationRounds,
      source: sourceId,
      saveType: effect.saveType,
      saveDC: effect.saveDC,
      value: effect.value,
    },
  ];

  // Специфические эффекты зачарования оружия и заклинаний
  if (effect.condition === "shillelagh") {
    const wisMod = target.abilityMods.WIS ?? (target.abilityMods.CHA ?? (target.abilityMods.INT ?? 0));
    const atkBonus = target.profBonus + wisMod;
    const existingAtk = target.attacks.find((a) => a.id === "shillelagh_attack");
    if (existingAtk) {
      existingAtk.attackBonus = atkBonus;
      existingAtk.damage = [{ dice: "1d8", mod: wisMod, type: "bludgeoning", magical: true }];
    } else {
      target.attacks.unshift({
        id: "shillelagh_attack",
        name: "Дубинка / Посох (Шиллейла)",
        kind: "melee",
        attackBonus: atkBonus,
        damage: [{ dice: "1d8", mod: wisMod, type: "bludgeoning", magical: true }],
        range: { normal: 5 },
        actionCost: "action",
        description: "Магический урон 1к8 + мод. МУД. Усилено заклинанием «Дубинка».",
      });
    }
    state.addLog(`✨ Оружие ${target.name} зачаровано силой природы (1к8+${wisMod} маг. урона)!`, "spell", target.name);
  } else if (effect.condition === "flame_blade") {
    const mod = target.abilityMods[target.spells.spellcastingAbility as AbilityKey] ?? (target.abilityMods.WIS ?? 0);
    const atkBonus = target.profBonus + mod;
    const existingAtk = target.attacks.find((a) => a.id === "flame_blade_attack");
    if (!existingAtk) {
      target.attacks.unshift({
        id: "flame_blade_attack",
        name: "Пламенеющий клинок",
        kind: "melee",
        attackBonus: atkBonus,
        damage: [{ dice: "3d6", mod: 0, type: "fire", magical: true }],
        range: { normal: 5 },
        actionCost: "action",
        description: "Огненный клинок: 3к6 урона огнём за Действие.",
      });
    }
    state.addLog(`🔥 В руке ${target.name} вспыхивает пламенеющий клинок (3к6 огня)!`, "spell", target.name);
  } else if (effect.condition === "shadow_blade") {
    const dexMod = target.abilityMods.DEX ?? 0;
    const strMod = target.abilityMods.STR ?? 0;
    const mod = Math.max(dexMod, strMod);
    const atkBonus = target.profBonus + mod;
    const existingAtk = target.attacks.find((a) => a.id === "shadow_blade_attack");
    if (!existingAtk) {
      target.attacks.unshift({
        id: "shadow_blade_attack",
        name: "Теневой клинок",
        kind: "melee",
        finesse: true,
        attackBonus: atkBonus,
        damage: [{ dice: "2d8", mod, type: "psychic", magical: true }],
        range: { normal: 5, long: 60 },
        actionCost: "action",
        description: "Теневой клинок: 2к8 психического урона + мод. ЛОВ. Фехтовальное, метательное (20/60 фт).",
      });
    }
    state.addLog(`🌑 В руке ${target.name} материализуется клинок из теней (2к8 психического урона)!`, "spell", target.name);
  }

  state.mark(targetId);
  state.addLog(`${target.name}: наложено «${label}»`, "ability", target.name);
}

export function removeCondition(state: CombatState, targetId: string, type: string): void {
  const target = state.require(targetId);
  target.conditions = target.conditions.filter((c) => c.type !== type);
  if (type === "shillelagh") {
    target.attacks = target.attacks.filter((a) => a.id !== "shillelagh_attack");
    state.addLog(`Действие зачарования «Дубинка» у ${target.name} рассеялось`, "system", target.name);
  } else if (type === "flame_blade") {
    target.attacks = target.attacks.filter((a) => a.id !== "flame_blade_attack");
  } else if (type === "shadow_blade") {
    target.attacks = target.attacks.filter((a) => a.id !== "shadow_blade_attack");
  }
  state.mark(targetId);
}

// ============ АТАКА ============

export interface AttackOutcome {
  hit: boolean;
  crit: boolean;
  damage: number;
  text: string;
  targetHp: number;
  attackerId?: string;
  targetId?: string;
  attack?: Attack;
}

/** Есть ли дееспособный союзник атакующего вплотную (5 фт / 1 клетка) к цели — условие Скрытой атаки */
function allyAdjacentTo(state: CombatState, attacker: Combatant, target: Combatant): boolean {
  return state.combatants.some(
    (c) =>
      c.id !== attacker.id &&
      c.id !== target.id &&
      c.hpCurrent > 0 &&
      !isHostile(attacker.type, c.type) &&
      isHostile(c.type, target.type) &&
      !c.conditions.some((cond) => ["unconscious", "paralyzed", "petrified", "stunned"].includes(cond.type)) &&
      distanceFt(c, target) <= 5
  );
}

/** Готовая к применению Скрытая атака, если условия соблюдены (D&D 5e) */
function findSneakAttack(
  state: CombatState,
  attacker: Combatant,
  target: Combatant,
  attack: Attack,
  advantage: boolean,
  hasDisadvantage: boolean
): { dice: string; ability?: CombatAbility } | null {
  const isRogue =
    attacker.className?.toLowerCase().includes("плут") ||
    attacker.className?.toLowerCase().includes("rogue") ||
    attacker.abilities.some((a) => a.name.startsWith("Скрытая атака") || a.id === "sneak_attack");

  if (!isRogue) return null;

  const ability = attacker.abilities.find((a) => a.name.startsWith("Скрытая атака") || a.id === "sneak_attack");
  if (ability && ability.usesMax > 0 && ability.usesUsed >= ability.usesMax) return null;

  // 1. По правилам D&D 5e: при наличии Помехи Скрытая атака НЕ работает ни при каких условиях
  if (hasDisadvantage) return null;

  // 2. Только фехтовальным (finesse) или дальнобойным (ranged) оружием
  const eligible = attack.finesse || attack.kind === "ranged";
  if (!eligible) return null;

  // 3. Условие срабатывания: Преимущество ИЛИ дееспособный союзник в 5 фт от цели
  const hasAllyAdjacent = allyAdjacentTo(state, attacker, target);
  if (!advantage && !hasAllyAdjacent) return null;

  const dice = ability?.parameters?.damage?.[0]?.dice || sneakAttackDice(attacker.level || 1);
  return { dice, ability };
}

export function performAttack(
  state: CombatState,
  attackerId: string,
  targetId: string,
  attackId: string,
  opts: {
    manualAdvantage?: boolean;
    manualDisadvantage?: boolean;
    skipTurnCheck?: boolean;
    skipCost?: boolean;
  } = {}
): AttackOutcome {
  if (!opts.skipTurnCheck) assertTurn(state, attackerId);

  const attacker = state.require(attackerId);
  const target = state.require(targetId);

  if (target.hpCurrent <= 0) throw new EngineError(`${target.name} уже выведен из боя`);

  const attack = attacker.attacks.find((a) => a.id === attackId);
  if (!attack) throw new EngineError("Атака не найдена");

  if (!opts.skipCost) {
    const pay = canPayForAttack(attacker, attack);
    if (!pay.ok) throw new EngineError(pay.reason ?? "Нельзя совершить атаку");
  }

  const reach = checkReach(attacker, target, attack, state.mapElements);
  if (!reach.ok) throw new EngineError(reach.reason ?? "Цель недосягаема");

  const isDualAttack =
    attack.actionCost === "action+bonus" ||
    (attack.damage.length >= 2 &&
      (attack.name.toLowerCase().includes("парн") ||
        attack.name.toLowerCase().includes("двойн") ||
        attack.name.toLowerCase().includes("залп")));

  if (isDualAttack) {
    // ======== ДВОЙНАЯ АТАКА (КАЖДЫЙ УДАР РАССЧИТЫВАЕТСЯ ОТДЕЛЬНО ПО D&D 5e) ========
    const isRanged =
      attack.kind === "ranged" ||
      attack.name.toLowerCase().includes("арбалет") ||
      attack.name.toLowerCase().includes("лук") ||
      attack.name.toLowerCase().includes("залп") ||
      attack.name.toLowerCase().includes("выстрел") ||
      attack.name.toLowerCase().includes("дротик");
    const isBow = attack.name.toLowerCase().includes("лук");
    const isXbow = attack.name.toLowerCase().includes("арбалет");

    const label1 = isXbow ? "1-й болт" : isBow ? "1-я стрела" : isRanged ? "1-й выстрел" : "1-й удар";
    const label2 = isXbow ? "2-й болт" : isBow ? "2-я стрела" : isRanged ? "2-й выстрел" : "2-й удар";

    const dmg1 = [attack.damage[0]];
    const dmg2 = [attack.damage[1] ?? attack.damage[0]];

    const strike1Attack: Attack = {
      ...attack,
      name: `${attack.name} (${label1}: Основная рука)`,
      damage: dmg1,
    };

    const strike2Attack: Attack = {
      ...attack,
      name: `${attack.name} (${label2}: Вторая рука)`,
      damage: dmg2,
    };

    // 1. ПЕРВЫЙ УДАР / ВЫСТРЕЛ (Основная рука)
    const res1 = resolveAttack(attacker, target, strike1Attack, {
      manualAdvantage: opts.manualAdvantage,
      manualDisadvantage: opts.manualDisadvantage,
      distanceFt: reach.distanceFt,
      allCombatants: state.combatants,
    });

    let extra1 = "";
    let sneakUsedOn1 = false;
    if (res1.hit) {
      const sneak = findSneakAttack(
        state,
        attacker,
        target,
        strike1Attack,
        res1.roll.mode === "advantage",
        res1.hasDisadvantage
      );
      if (sneak) {
        const bonus = rollDamage(
          [{ dice: sneak.dice, mod: 0, type: dmg1[0]?.type ?? "piercing" }],
          res1.crit
        );
        res1.damage += bonus.total;
        if (sneak.ability) {
          sneak.ability.usesUsed += 1;
        }
        sneakUsedOn1 = true;
        extra1 += `, скрытая атака ${sneak.dice}${res1.crit ? " (удвоена критом)" : ""} = ${bonus.total}`;
      }

      const mark = target.conditions.find(
        (c) => c.type === "hunters_mark" && c.source === attackerId
      );
      if (mark) {
        const bonus = rollDamage([{ dice: "1d6", mod: 0, type: "force" }], res1.crit);
        res1.damage += bonus.total;
        extra1 += `, метка охотника 1к6 = ${bonus.total}`;
      }
    }

    // Скрытность и временные эффекты спадают после первого выстрела/удара
    if (attacker.isHidden) {
      attacker.isHidden = false;
      state.addLog(`${attacker.name} раскрывает свою позицию!`, "system", attacker.name);
    }
    if (attacker.conditions.some((c) => c.type === "invisible")) {
      attacker.conditions = attacker.conditions.filter((c) => c.type !== "invisible");
      state.addLog(`${attacker.name}: невидимость спадает после атаки`, "system", attacker.name);
    }
    const consumed = consumeAttackConditions(attacker.conditions);
    if (consumed.length !== attacker.conditions.length) {
      attacker.conditions = consumed;
    }

    // 2. ВТОРОЙ УДАР / ВЫСТРЕЛ (Вторая рука)
    const res2 = resolveAttack(attacker, target, strike2Attack, {
      manualAdvantage: opts.manualAdvantage,
      manualDisadvantage: opts.manualDisadvantage,
      distanceFt: reach.distanceFt,
      allCombatants: state.combatants,
    });

    let extra2 = "";
    if (res2.hit) {
      // Скрытая атака применяется ко второму удару ТОЛЬКО если не сработала на первом
      if (!sneakUsedOn1) {
        const sneak = findSneakAttack(
          state,
          attacker,
          target,
          strike2Attack,
          res2.roll.mode === "advantage",
          res2.hasDisadvantage
        );
        if (sneak) {
          const bonus = rollDamage(
            [{ dice: sneak.dice, mod: 0, type: dmg2[0]?.type ?? "piercing" }],
            res2.crit
          );
          res2.damage += bonus.total;
          if (sneak.ability) {
            sneak.ability.usesUsed += 1;
          }
          extra2 += `, скрытая атака ${sneak.dice}${res2.crit ? " (удвоена критом)" : ""} = ${bonus.total}`;
        }
      }

      const mark = target.conditions.find(
        (c) => c.type === "hunters_mark" && c.source === attackerId
      );
      if (mark) {
        const bonus = rollDamage([{ dice: "1d6", mod: 0, type: "force" }], res2.crit);
        res2.damage += bonus.total;
        extra2 += `, метка охотника 1к6 = ${bonus.total}`;
      }
    }

    // 3. ИТОГОВЫЙ РАСЧЕТ И СПИСАНИЕ РЕСУРСОВ
    if (!opts.skipCost) {
      const paid = payForAttack(attacker, attack);
      Object.assign(attacker, paid);
    }
    attacker.facing = determineFacingTowards(attacker, target);
    state.mark(attackerId);

    const totalDamage = (res1.hit ? res1.damage : 0) + (res2.hit ? res2.damage : 0);
    const anyHit = res1.hit || res2.hit;
    const anyCrit = res1.crit || res2.crit;

    const text1 = res1.text + extra1;
    const text2 = res2.text + extra2;

    const logText =
      `${attacker.name} → ${target.name}: ${attack.name}: ` +
      `[${label1}: ${res1.hit ? `${res1.damage} ур.` : "промах"} | ${label2}: ${res2.hit ? `${res2.damage} ур.` : "промах"}]` +
      ` — ${anyHit ? `итого ${totalDamage} урона` : isRanged ? "промах обоими выстрелами" : "промах обоими ударами"}\n` +
      `  • ${label1}: ${text1}\n` +
      `  • ${label2}: ${text2}`;

    state.addLog(logText, "attack", attacker.name);

    if (target.hpCurrent > 0 && !target.conditions.some((c) => c.type === "paralyzed" || c.type === "unconscious")) {
      target.facing = determineFacingTowards(target, attacker);
      state.mark(targetId);
    }

    if (res1.hit && res1.damage > 0) {
      dealDamage(state, targetId, res1.damage, {
        damageType: dmg1[0]?.type,
        isAttack: true,
        attackerId: attacker.id,
        source: attacker.id,
      });
    }
    if (res2.hit && res2.damage > 0) {
      dealDamage(state, targetId, res2.damage, {
        damageType: dmg2[0]?.type,
        isAttack: true,
        attackerId: attacker.id,
        source: attacker.id,
      });
    }

    return {
      hit: anyHit,
      crit: anyCrit,
      damage: totalDamage,
      text: logText,
      targetHp: state.require(targetId).hpCurrent,
    };
  }

  // ======== ОДИНАРНАЯ АТАКА (ОСНОВНАЯ ИЛИ БОНУСНАЯ РУКА) ========
  const resolution = resolveAttack(attacker, target, attack, {
    manualAdvantage: opts.manualAdvantage,
    manualDisadvantage: opts.manualDisadvantage,
    distanceFt: reach.distanceFt,
    allCombatants: state.combatants,
  });

  let extraText = "";
  if (resolution.hit) {
    const sneak = findSneakAttack(
      state,
      attacker,
      target,
      attack,
      resolution.roll.mode === "advantage",
      resolution.hasDisadvantage
    );
    if (sneak) {
      const bonus = rollDamage([{ dice: sneak.dice, mod: 0, type: attack.damage[0]?.type ?? "piercing" }], resolution.crit);
      resolution.damage += bonus.total;
      if (sneak.ability) {
        sneak.ability.usesUsed += 1;
      }
      extraText += `, скрытая атака ${sneak.dice}${resolution.crit ? " (удвоена критом)" : ""} = ${bonus.total}`;
    }

    // Метка охотника: доп. урон от того, кто её поставил
    const mark = target.conditions.find(
      (c) => c.type === "hunters_mark" && c.source === attackerId
    );
    if (mark) {
      const bonus = rollDamage([{ dice: "1d6", mod: 0, type: "force" }], resolution.crit);
      resolution.damage += bonus.total;
      extraText += `, метка охотника 1к6 = ${bonus.total}`;
    }

    // Поглощение стихий: доп. 1к6 урона (масштабируется от круга) к первой рукопашной атаке
    const absorbCond = attacker.conditions.find((c) => c.type === "absorb_elements");
    if (absorbCond && (attack.kind === "melee" || !attack.kind)) {
      const diceCount = absorbCond.value ?? 1;
      const bonus = rollDamage([{ dice: `${diceCount}d6`, mod: 0, type: "elemental" }], resolution.crit);
      resolution.damage += bonus.total;
      extraText += `, поглощение стихий ${diceCount}к6 = ${bonus.total}`;
      attacker.conditions = attacker.conditions.filter((c) => c.type !== "absorb_elements");
    }
  }

  // Если атакующий был скрыт — атака раскрывает его позицию
  if (attacker.isHidden) {
    attacker.isHidden = false;
    state.addLog(`${attacker.name} раскрывает свою позицию!`, "system", attacker.name);
  }

  // Обычная невидимость спадает после совершения атаки
  if (attacker.conditions.some((c) => c.type === "invisible")) {
    attacker.conditions = attacker.conditions.filter((c) => c.type !== "invisible");
    state.addLog(`${attacker.name}: невидимость спадает после атаки`, "system", attacker.name);
  }

  // Помощь союзника расходуется независимо от результата
  const consumed = consumeAttackConditions(attacker.conditions);
  if (consumed.length !== attacker.conditions.length) {
    attacker.conditions = consumed;
  }

  if (!opts.skipCost) {
    const paid = payForAttack(attacker, attack);
    Object.assign(attacker, paid);
  }
  // Атакующий поворачивается лицом к цели (разворот взглядом)
  attacker.facing = determineFacingTowards(attacker, target);
  state.mark(attackerId);

  // Строку атаки пишем до урона, иначе «падает без сознания» встаёт в логе раньше удара
  const text = `${attacker.name} → ${target.name}: ${resolution.text}${extraText}`;
  state.addLog(text, "attack", attacker.name);

  // Цель сразу поворачивается лицом к источнику атаки (если дееспособна)
  if (target.hpCurrent > 0 && !target.conditions.some((c) => c.type === "paralyzed" || c.type === "unconscious")) {
    target.facing = determineFacingTowards(target, attacker);
    state.mark(targetId);
  }

  if (resolution.hit && resolution.damage > 0) {
    dealDamage(state, targetId, resolution.damage, {
      damageType: attack.damage[0]?.type,
      isAttack: true,
      attackerId: attacker.id,
      source: attacker.id,
    });
  }

  return {
    hit: resolution.hit,
    crit: resolution.crit,
    damage: resolution.damage,
    text,
    targetHp: state.require(targetId).hpCurrent,
  };
}

export interface MultiattackResult {
  totalHits: number;
  totalDamage: number;
  attacks: Array<{
    attackId: string;
    attackName: string;
    hit: boolean;
    critical: boolean;
    damage: number;
  }>;
}

export function performMultiattack(
  state: CombatState,
  attackerId: string,
  targetId: string,
  opts: { skipTurnCheck?: boolean } = {}
): MultiattackResult {
  if (!opts.skipTurnCheck) assertTurn(state, attackerId);
  const attacker = state.require(attackerId);
  if (!canAct(attacker)) throw new EngineError(`${attacker.name} не может действовать`);
  if (attacker.actionUsed) throw new EngineError("Действие уже использовано в этом ходу");
  if (!attacker.multiattack || attacker.multiattack.attacks.length === 0) {
    throw new EngineError(`${attacker.name} не имеет способности «Мультиатака»`);
  }

  const target = state.require(targetId);
  if (target.hpCurrent <= 0) throw new EngineError(`${target.name} уже выведен из боя`);

  attacker.actionUsed = true;
  state.mark(attacker.id);

  state.addLog(
    `⚔️ ${attacker.name} проводит «${attacker.multiattack.name}» по ${target.name}!`,
    "attack",
    attacker.name
  );

  const results: MultiattackResult = {
    totalHits: 0,
    totalDamage: 0,
    attacks: [],
  };

  for (const option of attacker.multiattack.attacks) {
    const attack = attacker.attacks.find((a) => a.id === option.attackId);
    if (!attack) continue;

    for (let i = 0; i < option.count; i++) {
      const currentTarget = state.get(targetId);
      if (!currentTarget || currentTarget.hpCurrent <= 0) break;

      const beforeHp = currentTarget.hpCurrent;
      try {
        const attackRes = performAttack(state, attacker.id, targetId, attack.id, {
          skipTurnCheck: true,
          skipCost: true,
        });

        const afterTarget = state.get(targetId);
        const dmgDealt = afterTarget ? Math.max(0, beforeHp - afterTarget.hpCurrent) : 0;
        const wasHit = attackRes.hit;

        if (wasHit) {
          results.totalHits += 1;
          results.totalDamage += dmgDealt;
        }

        results.attacks.push({
          attackId: attack.id,
          attackName: attack.name,
          hit: wasHit,
          critical: attackRes.crit,
          damage: dmgDealt,
        });
      } catch (e: any) {
        state.addLog(`Атака ${attack.name}: промах/недоступно (${e.message})`, "system", attacker.name);
      }
    }
  }

  return results;
}

// ============ ДВИЖЕНИЕ ============

export interface MoveOutcome {
  path: Cell[];
  costFt: number;
  remainingFt: number;
  opportunityAttacks: AttackOutcome[];
}

export function moveCombatant(
  state: CombatState,
  combatantId: string,
  target: Cell,
  opts: { skipTurnCheck?: boolean } = {}
): MoveOutcome {
  if (!opts.skipTurnCheck) assertTurn(state, combatantId);

  const mover = state.require(combatantId);
  if (!canAct(mover) && effectiveSpeed(mover) <= 0) {
    throw new EngineError(`${mover.name} не может двигаться`);
  }

  const budget = remainingMovement(mover);
  const result = findPath(
    mover,
    target,
    budget,
    state.mapElements,
    state.combatants,
    state.gridWidth,
    state.gridHeight
  );
  if (!result.ok) throw new EngineError(result.reason ?? "Путь не найден");

  // Провокации ищем до перемещения — по фактическому маршруту
  const disengaging = mover.conditions.some((c) => c.type === "disengaging");
  const attackers = disengaging
    ? []
    : findOpportunityAttackers(mover, result.path, state.combatants, 5, state.mapElements);

  const initialMovementUsed = mover.movementUsed;
  mover.movementUsed += result.costFt;
  state.mark(combatantId);
  state.addLog(
    `${mover.name} перемещается на ${result.costFt} фт (осталось ${remainingMovement(mover)} фт)`,
    "move",
    mover.name
  );

  // Провокации разрешаем, пока боец ещё в исходной клетке: checkReach меряет
  // расстояние по текущим координатам, а из конечной точки атака была бы «далеко»
  const opportunityAttacks: AttackOutcome[] = [];
  let movementInterrupted = false;

  for (const attacker of attackers) {
    const melee = attacker.attacks.find((a) => a.kind === "melee");
    if (!melee) continue;
    // Реакция расходуется вне очереди ходов, поэтому экономику действий обходим
    const reach = checkReach(attacker, mover, melee, state.mapElements);
    if (!reach.ok) continue;

    const resolution = resolveAttack(attacker, mover, melee, {
      distanceFt: reach.distanceFt,
    });
    attacker.reactionUsed = true;
    state.mark(attacker.id);

    const text = `Провоцированная атака: ${attacker.name} → ${mover.name}: ${resolution.text}`;
    state.addLog(text, "attack", attacker.name);
    if (resolution.hit && resolution.damage > 0) {
      dealDamage(state, mover.id, resolution.damage, {
        damageType: melee.damage[0]?.type,
        isAttack: true,
        attackerId: attacker.id,
        source: attacker.id,
      });
    }
    opportunityAttacks.push({
      attackerId: attacker.id,
      targetId: mover.id,
      attack: melee,
      hit: resolution.hit,
      crit: resolution.crit,
      damage: resolution.damage,
      text,
      targetHp: state.require(mover.id).hpCurrent,
    });

    if (mover.hpCurrent <= 0) {
      mover.movementUsed = initialMovementUsed;
      if (!mover.conditions.some((c) => c.type === "prone")) {
        mover.conditions.push({ type: "prone" });
      }
      state.addLog(
        `${mover.name} падает без сознания от провоцированной атаки и прерывает движение!`,
        "damage",
        mover.name
      );
      state.mark(mover.id);
      movementInterrupted = true;
      break;
    }

    if (resolution.hit) {
      const hasSentinel =
        attacker.monsterTraits?.some((t) => {
          const n = (t.name || "").toLowerCase();
          return n.includes("страж") || n.includes("sentinel");
        }) ||
        attacker.conditions.some((c) => {
          const t = (c.type || "").toLowerCase();
          return t === "sentinel" || t === "страж";
        }) ||
        Boolean((melee as any).stopsSpeed);

      if (hasSentinel) {
        mover.movementUsed = effectiveSpeed(mover);
        state.addLog(
          `${attacker.name} («Страж») останавливает ${mover.name} на месте!`,
          "system",
          attacker.name
        );
        state.mark(mover.id);
        movementInterrupted = true;
        break;
      }
    }
  }

  if (movementInterrupted) {
    return {
      path: [],
      costFt: 0,
      remainingFt: remainingMovement(state.require(combatantId)),
      opportunityAttacks,
    };
  }

  mover.x = target.x;
  mover.y = target.y;

  // D&D 5e: Громовой резонанс (Booming Blade) — урон при перемещении в другую клетку
  if (result.costFt > 0) {
    const boomCond = mover.conditions.find((c) => c.type === "booming_resonance");
    if (boomCond && mover.hpCurrent > 0) {
      const val = boomCond.value ?? mover.level ?? 1;
      const dice = `${cantripDiceMultiplier(val)}d8`;
      const thunderDmg = rollDice(dice).total;
      mover.conditions = mover.conditions.filter((c) => c.type !== "booming_resonance");
      state.mark(mover.id);
      state.addLog(
        `⚡ ${mover.name} перемещается под действием «Громового клинка» и получает ${thunderDmg} урона звуком (${dice})!`,
        "damage",
        mover.name
      );
      dealDamage(state, mover.id, thunderDmg, {
        damageType: "thunder",
        isAttack: false,
        attackerId: boomCond.source,
        source: boomCond.source,
      });
    }
  }

  // D&D 5e: Проверка лавы и воды при перемещении
  const enteredLava =
    result.path.some((cell) => isLavaTerrain(cell, state.mapElements)) ||
    isLavaTerrain(target, state.mapElements);

  if (enteredLava && mover.hpCurrent > 0) {
    const fireDmg = rollDice("2d10").total;
    dealDamage(state, mover.id, fireDmg, { isAttack: false, damageType: "fire" });
    state.addLog(`🔥 ${mover.name} ступает в раскаленную лаву и получает ${fireDmg} урона огнём!`, "damage", mover.name);
  }

  const enteredWater =
    result.path.some((cell) => isWaterTerrain(cell, state.mapElements)) ||
    isWaterTerrain(target, state.mapElements);

  if (enteredWater) {
    const hasWaterWalk =
      mover.conditions.some((c) => c.type === "water_walking" || c.type === "water_walk") ||
      mover.abilities.some((a) => a.id.includes("water_walk") || a.name.toLowerCase().includes("водохожд"));

    if (hasWaterWalk) {
      state.addLog(`💧 ${mover.name} легко ступает по глади воды благодаря водохождению`, "move", mover.name);
    } else {
      state.addLog(`🌊 ${mover.name} входит в воду (перемещение вплавь, удвоенная стоимость)`, "move", mover.name);
    }
  }

  return {
    path: result.path,
    costFt: result.costFt,
    remainingFt: remainingMovement(state.require(combatantId)),
    opportunityAttacks,
  };
}

// ============ ЭФФЕКТЫ ЗАКЛИНАНИЙ И СПОСОБНОСТЕЙ ============

interface CastContext {
  casterId: string;
  params: ActionParameters;
  targetIds: string[];
  center?: Cell | null;
  slotLevel?: number;
  /** Название для лога */
  label: string;
}

interface CastResult {
  targets: Array<{ name: string; saved?: boolean; hit?: boolean; amount: number }>;
  text: string;
}

/** Готовит массив урона с учётом масштабирования заговоров и апкаста */
function prepareDamage(
  params: ActionParameters,
  caster: Combatant,
  slotLevel: number
): DamageRoll[] {
  const base = (params.damage ?? []).map((d) => ({ ...d }));
  if (base.length === 0) return base;

  if (params.cantripScaling) {
    const mult = cantripDiceMultiplier(caster.level);
    if (mult > 1) base[0].dice = scaleDice(base[0].dice, mult);
  }

  const baseLevel = params.spellSlotLevel ?? 0;
  if (params.upcast?.perLevel && slotLevel > baseLevel) {
    const levels = slotLevel - baseLevel;
    const m = params.upcast.perLevel.toLowerCase().replace(/к/g, "d").match(/^(\d*)d(\d+)/);
    if (m) {
      const perLevel = m[1] ? parseInt(m[1], 10) : 1;
      base[0].dice = addDiceCount(base[0].dice, perLevel * levels);
    }
  }

  if (params.addSpellMod && caster.spells.spellcastingAbility) {
    const mod = caster.abilityMods?.[caster.spells.spellcastingAbility] ?? 0;
    base[0].mod += mod;
  }

  return base;
}

/** Цели заклинания: явно выбранные или все в области */
function resolveTargets(
  state: CombatState,
  caster: Combatant,
  params: ActionParameters,
  targetIds: string[],
  center?: Cell | null
): Combatant[] {
  if (params.targeting === "self") return [caster];

  if (params.aoe && !center) {
    throw new EngineError("Нужно указать точку в области — выбери клетку на карте");
  }

  if (params.aoe && center) {
    const cells = getAoeCells(
      center,
      params.aoe.shape,
      params.aoe.size,
      { x: caster.x, y: caster.y },
      state.gridWidth,
      state.gridHeight
    );
    const keys = new Set(cells.map((c) => `${c.x},${c.y}`));
    return state.combatants.filter((c) => {
      if (c.hpCurrent <= 0) return false;
      if (!keys.has(`${c.x},${c.y}`)) return false;
      // Без friendlyFire союзники в область не попадают
      if (!params.friendlyFire && !isHostile(caster.type, c.type) && c.id !== caster.id) {
        return false;
      }
      return true;
    });
  }

  const chosen = targetIds
    .map((id) => state.get(id))
    .filter((c): c is Combatant => !!c);
  const max = params.maxTargets ?? 1;
  return chosen.slice(0, max);
}

function checkSpellRange(
  state: CombatState,
  caster: Combatant,
  params: ActionParameters,
  point: Cell,
  targetCombatant?: Combatant
): void {
  const range = params.range ?? { type: "self" };
  const type = range.type;
  if (type === "self") return;
  const max = type === "touch" ? 5 : range.value ?? 5;
  const dist = distanceFt(caster, point);
  if (dist > max) {
    throw new EngineError(`Слишком далеко: ${dist} фт, дальность ${max} фт`);
  }
  if (!hasLineOfSight(caster, point, state.mapElements)) {
    throw new EngineError("Нет линии видимости до цели");
  }
  // Если точечное заклинание нацелено на скрытое существо вне зоны касания и вне сектора взгляда
  if (targetCombatant && targetCombatant.isHidden && dist > 5) {
    if (!isInVisionCone(caster, targetCombatant)) {
      throw new EngineError("Цель скрыта от вашего взгляда и не может быть выбрана точечной целью заклинания");
    }
  }
}

/** Отталкивает существо от источника на указанное число клеток */
function pushCombatantAway(state: CombatState, target: Combatant, origin: Cell, cellsCount: number): void {
  const dx = Math.sign(target.x - origin.x);
  const dy = Math.sign(target.y - origin.y);
  if (dx === 0 && dy === 0) return;
  for (let i = 0; i < cellsCount; i++) {
    const nextCell = { x: target.x + dx, y: target.y + dy };
    if (nextCell.x < 0 || nextCell.x >= state.gridWidth || nextCell.y < 0 || nextCell.y >= state.gridHeight) break;
    if (isTerrainBlocked(nextCell, state.mapElements)) break;
    if (isCellBlocked(nextCell, state.mapElements, state.combatants, target.id)) break;
    target.x = nextCell.x;
    target.y = nextCell.y;
    state.mark(target.id);
  }
}

/** Притягивает существо к источнику на указанное число клеток */
function pullCombatantTowards(state: CombatState, target: Combatant, origin: Cell, cellsCount: number): void {
  for (let i = 0; i < cellsCount; i++) {
    const dist = Math.max(Math.abs(target.x - origin.x), Math.abs(target.y - origin.y));
    if (dist <= 1) break;
    const dx = Math.sign(origin.x - target.x);
    const dy = Math.sign(origin.y - target.y);
    const nextCell = { x: target.x + dx, y: target.y + dy };
    if (nextCell.x < 0 || nextCell.x >= state.gridWidth || nextCell.y < 0 || nextCell.y >= state.gridHeight) break;
    if (isTerrainBlocked(nextCell, state.mapElements)) break;
    if (isCellBlocked(nextCell, state.mapElements, state.combatants, target.id)) break;
    target.x = nextCell.x;
    target.y = nextCell.y;
    state.mark(target.id);
  }
}

/**
 * Общее применение параметров действия — используется и заклинаниями,
 * и способностями, чтобы правила урона/спасбросков/эффектов были одни.
 */
function applyActionParameters(state: CombatState, ctx: CastContext): CastResult {
  const caster = state.require(ctx.casterId);
  const { params } = ctx;
  const slotLevel = ctx.slotLevel ?? params.spellSlotLevel ?? 0;
  const actLower = (params.name || ctx.label || "").toLowerCase();

  // 1. Громовой шаг (Thunder Step)
  const isThunderStep = actLower.includes("громовой шаг") || actLower.includes("thunder step");
  if (isThunderStep) {
    if (!ctx.center) {
      throw new EngineError("Выберите точку на сетке для телепортации");
    }
    const maxRange = 90 + Math.max(0, slotLevel - 3) * 30;
    const dist = distanceFt(caster, ctx.center);
    if (dist > maxRange) {
      throw new EngineError(`Слишком далеко для телепортации: ${dist} фт (максимум ${maxRange} фт)`);
    }
    if (!hasLineOfSight(caster, ctx.center, state.mapElements)) {
      throw new EngineError("Нет линии видимости до точки телепортации");
    }
    if (isCellBlocked(ctx.center, state.mapElements, state.combatants, caster.id)) {
      if (isTerrainBlocked(ctx.center, state.mapElements)) {
        throw new EngineError("Нельзя переместиться в стену или препятствие");
      }
      throw new EngineError("Целевая клетка занята другим существом");
    }

    const origPos = { x: caster.x, y: caster.y };
    caster.x = ctx.center.x;
    caster.y = ctx.center.y;
    state.mark(caster.id);
    state.addLog(`${caster.name} телепортируется на ${dist} фт («Громовой шаг»)`, "move", caster.name);

    const fallbackAbility = (caster.spells.spellcastingAbility as AbilityKey) || "CHA";
    const saveDC =
      params.saveDC ||
      caster.spells.spellSaveDC ||
      8 + (caster.abilityMods[fallbackAbility] ?? 0) + caster.profBonus;

    const extraDice = Math.max(0, slotLevel - 3);
    const dice = addDiceCount("3d10", extraDice);
    const results: CastResult["targets"] = [];

    const affected = state.combatants.filter(
      (c) => c.id !== caster.id && c.hpCurrent > 0 && distanceFt(origPos, c) <= 10
    );

    for (const target of affected) {
      const save = rollSave(target, "CON", saveDC);
      state.addLog(`${target.name}: ${save.text} против «Громового шага»`, "save", target.name);
      const dmgRoll = rollDamage([{ dice, mod: 0, type: "thunder", save: "half" }], false, {
        halfOnSave: save.success,
      });
      dealDamage(state, target.id, dmgRoll.total, {
        damageType: "thunder",
        isAttack: false,
        attackerId: caster.id,
        source: caster.id,
      });
      results.push({ name: target.name, saved: save.success, amount: dmgRoll.total });
    }

    return { targets: results, text: `${caster.name} совершает «Громовой шаг»` };
  }

  // 2. Вихрь искривления (Vortex Warp)
  const isVortexWarp = actLower.includes("вихрь искривления") || actLower.includes("vortex warp");
  if (isVortexWarp) {
    if (!ctx.center) {
      throw new EngineError("Выберите точку на сетке для перемещения существа");
    }
    const chosenTargets = resolveTargets(state, caster, params, ctx.targetIds, null);
    const target = chosenTargets[0];
    if (!target) {
      throw new EngineError("Выберите цель для «Вихря искривления»");
    }
    const maxRange = 90 + Math.max(0, slotLevel - 2) * 30;
    const targetDist = distanceFt(caster, target);
    if (targetDist > maxRange) {
      throw new EngineError(`Цель слишком далеко: ${targetDist} фт (максимум ${maxRange} фт)`);
    }
    const centerDist = distanceFt(caster, ctx.center);
    if (centerDist > maxRange) {
      throw new EngineError(`Точка назначения слишком далеко: ${centerDist} фт (максимум ${maxRange} фт)`);
    }
    if (!hasLineOfSight(caster, ctx.center, state.mapElements)) {
      throw new EngineError("Нет линии видимости до точки назначения");
    }
    if (isCellBlocked(ctx.center, state.mapElements, state.combatants, target.id)) {
      if (isTerrainBlocked(ctx.center, state.mapElements)) {
        throw new EngineError("Нельзя переместить в стену или препятствие");
      }
      throw new EngineError("Целевая клетка занята другим существом");
    }

    const isEnemy = isHostile(caster.type, target.type);
    let saved = false;
    if (isEnemy) {
      const fallbackAbility = (caster.spells.spellcastingAbility as AbilityKey) || "INT";
      const saveDC =
        params.saveDC ||
        caster.spells.spellSaveDC ||
        8 + (caster.abilityMods[fallbackAbility] ?? 0) + caster.profBonus;
      const save = rollSave(target, "CON", saveDC);
      saved = save.success;
      state.addLog(`${target.name}: ${save.text} против «Вихря искривления»`, "save", target.name);
    }

    if (saved) {
      state.addLog(`${target.name} сопротивляется действию «Вихря искривления»`, "spell", caster.name);
      return {
        targets: [{ name: target.name, saved: true, hit: false, amount: 0 }],
        text: `${target.name} избегает перемещения «Вихрем искривления»`,
      };
    }

    target.x = ctx.center.x;
    target.y = ctx.center.y;
    state.mark(target.id);
    state.addLog(
      `🌀 «Вихрь искривления» переносит ${target.name} на клетку (${ctx.center.x}, ${ctx.center.y})`,
      "move",
      caster.name
    );
    return {
      targets: [{ name: target.name, saved: false, hit: true, amount: 0 }],
      text: `${target.name} перемещён «Вихрем искривления»`,
    };
  }

  // 3. Доспех Агатиса (Armor of Agathys)
  const isArmorOfAgathys = actLower.includes("доспех агатиса") || actLower.includes("armor of agathys");
  if (isArmorOfAgathys) {
    const tempHp = 5 * slotLevel;
    grantTempHp(state, caster.id, tempHp);
    caster.conditions = caster.conditions.filter((c) => c.type !== "armor_of_agathys");
    applyEffect(state, caster.id, { condition: "armor_of_agathys", durationRounds: 600, value: tempHp }, caster.id);
    state.addLog(
      `❄️ ${caster.name} окружает себя Доспехом Агатиса (+${tempHp} врем. HP, ${tempHp} возвратного урона холодом)`,
      "spell",
      caster.name
    );
    return {
      targets: [{ name: caster.name, amount: tempHp }],
      text: `${caster.name} получает ${tempHp} временных хитов от «Доспеха Агатиса»`,
    };
  }

  // 4. Поглощение стихий (Absorb Elements)
  const isAbsorbElements = actLower.includes("поглощение стихий") || actLower.includes("absorb elements");
  if (isAbsorbElements) {
    if (!caster.damageResistances) caster.damageResistances = [];
    if (!caster.damageResistances.includes("fire")) {
      caster.damageResistances.push("fire");
    }
    applyEffect(state, caster.id, { condition: "absorb_elements", durationRounds: 1, value: slotLevel }, caster.id);
    state.addLog(
      `🛡️ ${caster.name} активирует «Поглощение стихий» (сопротивление огню, +${slotLevel}к6 урона к следующей рукопашной атаке)`,
      "spell",
      caster.name
    );
    return {
      targets: [{ name: caster.name, amount: 0 }],
      text: `${caster.name} активирует «Поглощение стихий»`,
    };
  }

  // 5. Громовой клинок (Booming Blade)
  const isBoomingBlade = actLower.includes("громовой клинок") || actLower.includes("booming blade");
  if (isBoomingBlade) {
    const chosenTargets = resolveTargets(state, caster, params, ctx.targetIds, ctx.center);
    const target = chosenTargets[0];
    if (!target) {
      throw new EngineError("Выберите цель для «Громового клинка»");
    }
    const dist = distanceFt(caster, target);
    if (dist > 5) {
      throw new EngineError(`Цель слишком далеко для атаки клинком: ${dist} фт (максимум 5 фт)`);
    }

    const fallbackAbility = (caster.spells.spellcastingAbility as AbilityKey) || "CHA";
    const attackBonus =
      params.attackBonus ??
      (caster.spells.spellAttackBonus ||
        (caster.abilityMods[fallbackAbility] ?? 0) + caster.profBonus);

    const meleeWeapon = caster.attacks.find((a) => a.kind === "melee") ?? {
      id: "melee_weapon",
      name: "Оружие ближнего боя",
      attackBonus,
      damage: [{ dice: "1d8", mod: caster.abilityMods.STR ?? 0, type: "slashing" }],
      kind: "melee" as const,
      range: { normal: 5 },
      actionCost: "action" as const,
    };

    const resolution = resolveAttack(caster, target, meleeWeapon, {
      distanceFt: dist,
      allCombatants: state.combatants,
    });
    state.addLog(`${caster.name} → ${target.name}: ${resolution.text} («Громовой клинок»)`, "attack", caster.name);

    if (!resolution.hit) {
      return {
        targets: [{ name: target.name, hit: false, amount: 0 }],
        text: `${caster.name} промахивается «Громовым клинком» по ${target.name}`,
      };
    }

    let totalDamage = resolution.damage;
    dealDamage(state, target.id, resolution.damage, {
      damageType: meleeWeapon.damage[0]?.type,
      isAttack: true,
      attackerId: caster.id,
      source: caster.id,
    });

    const mult = cantripDiceMultiplier(caster.level);
    const bonusDiceCount = mult - 1;
    if (bonusDiceCount > 0) {
      const thunderBonus = rollDamage(
        [{ dice: `${bonusDiceCount}d8`, mod: 0, type: "thunder" }],
        resolution.crit
      ).total;
      dealDamage(state, target.id, thunderBonus, {
        damageType: "thunder",
        isAttack: true,
        attackerId: caster.id,
        source: caster.id,
      });
      totalDamage += thunderBonus;
      state.addLog(`⚡ Дополнительный урон звуком при ударе: ${thunderBonus}`, "damage", target.name);
    }

    applyEffect(
      state,
      target.id,
      { condition: "booming_resonance", durationRounds: 1, value: caster.level },
      caster.id
    );
    state.addLog(
      `⚡ ${target.name} охвачен громовым резонансом! Если цель переместится, она получит урон звуком.`,
      "system",
      target.name
    );

    return {
      targets: [{ name: target.name, hit: true, amount: totalDamage }],
      text: `${caster.name} поражает ${target.name} «Громовым клинком» (${totalDamage} урона)`,
    };
  }

  // 6. Клинок зелёного пламени (Green-Flame Blade)
  const isGreenFlameBlade =
    actLower.includes("клинок зелёного пламени") ||
    actLower.includes("клинок зеленого пламени") ||
    actLower.includes("green-flame blade");
  if (isGreenFlameBlade) {
    const chosenTargets = resolveTargets(state, caster, params, ctx.targetIds, ctx.center);
    const target = chosenTargets[0];
    if (!target) {
      throw new EngineError("Выберите цель для «Клинка зелёного пламени»");
    }
    const dist = distanceFt(caster, target);
    if (dist > 5) {
      throw new EngineError(`Цель слишком далеко для атаки клинком: ${dist} фт (максимум 5 фт)`);
    }

    const fallbackAbility = (caster.spells.spellcastingAbility as AbilityKey) || "CHA";
    const attackBonus =
      params.attackBonus ??
      (caster.spells.spellAttackBonus ||
        (caster.abilityMods[fallbackAbility] ?? 0) + caster.profBonus);

    const meleeWeapon = caster.attacks.find((a) => a.kind === "melee") ?? {
      id: "melee_weapon",
      name: "Оружие ближнего боя",
      attackBonus,
      damage: [{ dice: "1d8", mod: caster.abilityMods.STR ?? 0, type: "slashing" }],
      kind: "melee" as const,
      range: { normal: 5 },
      actionCost: "action" as const,
    };

    const resolution = resolveAttack(caster, target, meleeWeapon, {
      distanceFt: dist,
      allCombatants: state.combatants,
    });
    state.addLog(`${caster.name} → ${target.name}: ${resolution.text} («Клинок зелёного пламени»)`, "attack", caster.name);

    if (!resolution.hit) {
      return {
        targets: [{ name: target.name, hit: false, amount: 0 }],
        text: `${caster.name} промахивается «Клинком зелёного пламени» по ${target.name}`,
      };
    }

    let totalDamage = resolution.damage;
    dealDamage(state, target.id, resolution.damage, {
      damageType: meleeWeapon.damage[0]?.type,
      isAttack: true,
      attackerId: caster.id,
      source: caster.id,
    });

    const mult = cantripDiceMultiplier(caster.level);
    const bonusDiceCount = mult - 1;
    if (bonusDiceCount > 0) {
      const fireBonus = rollDamage(
        [{ dice: `${bonusDiceCount}d8`, mod: 0, type: "fire" }],
        resolution.crit
      ).total;
      dealDamage(state, target.id, fireBonus, {
        damageType: "fire",
        isAttack: true,
        attackerId: caster.id,
        source: caster.id,
      });
      totalDamage += fireBonus;
      state.addLog(`🔥 Дополнительный урон огнём по первой цели: ${fireBonus}`, "damage", target.name);
    }

    // Вторая цель в пределах 5 фт от первой
    const secondary =
      chosenTargets[1] ??
      state.combatants.find(
        (c) =>
          c.id !== target.id &&
          c.id !== caster.id &&
          c.hpCurrent > 0 &&
          isHostile(caster.type, c.type) &&
          distanceFt(target, c) <= 5
      );

    const results: CastResult["targets"] = [{ name: target.name, hit: true, amount: totalDamage }];

    if (secondary) {
      const spellMod = caster.spells.spellcastingAbility
        ? (caster.abilityMods[caster.spells.spellcastingAbility as AbilityKey] ?? 0)
        : (caster.abilityMods.CHA ?? caster.abilityMods.INT ?? 0);

      const splashDice = bonusDiceCount > 0 ? `${bonusDiceCount}d8` : "";
      const splashDamage = (splashDice ? rollDice(splashDice).total : 0) + spellMod;

      if (splashDamage > 0) {
        dealDamage(state, secondary.id, splashDamage, {
          damageType: "fire",
          isAttack: false,
          attackerId: caster.id,
          source: caster.id,
        });
        state.addLog(
          `🔥 Зелёное пламя перекидывается на ${secondary.name} и наносит ${splashDamage} урона огнём!`,
          "damage",
          secondary.name
        );
        results.push({ name: secondary.name, amount: splashDamage });
      }
    }

    return {
      targets: results,
      text: `${caster.name} поражает ${target.name} «Клинком зелёного пламени»`,
    };
  }

  // 7. Ледяной кинжал (Ice Knife)
  const isIceKnife = actLower.includes("ледяной кинжал") || actLower.includes("ice knife");
  if (isIceKnife) {
    const chosenTargets = resolveTargets(state, caster, params, ctx.targetIds, ctx.center);
    const target = chosenTargets[0];
    if (!target) {
      throw new EngineError("Выберите цель для «Ледяного кинжала»");
    }
    const dist = distanceFt(caster, target);
    const maxRange = params.range?.value ?? 60;
    if (dist > maxRange) {
      throw new EngineError(`Цель слишком далеко: ${dist} фт (максимум ${maxRange} фт)`);
    }

    const fallbackAbility = (caster.spells.spellcastingAbility as AbilityKey) || "INT";
    const attackBonus =
      params.attackBonus ??
      (caster.spells.spellAttackBonus ||
        (caster.abilityMods[fallbackAbility] ?? 0) + caster.profBonus);
    const saveDC =
      params.saveDC ||
      caster.spells.spellSaveDC ||
      8 + (caster.abilityMods[fallbackAbility] ?? 0) + caster.profBonus;

    // 1. Дистанционная атака заклинанием
    const attackResolution = resolveAttack(
      caster,
      target,
      {
        id: "ice_knife_pierce",
        name: "Ледяной кинжал (Осколок)",
        attackBonus,
        damage: [{ dice: "1d10", mod: 0, type: "piercing" }],
        kind: "spell",
        range: { normal: maxRange },
        actionCost: params.actionCost,
      },
      { distanceFt: dist, allCombatants: state.combatants }
    );
    state.addLog(`${caster.name} → ${target.name}: ${attackResolution.text} (Ледяной кинжал)`, "spell", caster.name);

    if (attackResolution.hit && attackResolution.damage > 0) {
      dealDamage(state, target.id, attackResolution.damage, {
        damageType: "piercing",
        isAttack: true,
        attackerId: caster.id,
        source: caster.id,
      });
    }

    // 2. Взрыв осколка льда (2d6 + 1d6 за апкаст выше 1-го) в радиусе 5 фт от цели
    const extraDice = Math.max(0, slotLevel - 1);
    const coldDice = addDiceCount("2d6", extraDice);

    const aoeTargets = state.combatants.filter(
      (c) => c.hpCurrent > 0 && distanceFt(target, c) <= 5
    );

    const results: CastResult["targets"] = [
      { name: target.name, hit: attackResolution.hit, amount: attackResolution.hit ? attackResolution.damage : 0 },
    ];

    for (const victim of aoeTargets) {
      const save = rollSave(victim, "DEX", saveDC);
      state.addLog(`${victim.name}: ${save.text} (Взрыв осколка ледяного кинжала)`, "save", victim.name);
      if (!save.success) {
        const coldDmg = rollDice(coldDice).total;
        dealDamage(state, victim.id, coldDmg, {
          damageType: "cold",
          isAttack: false,
          attackerId: caster.id,
          source: caster.id,
        });
        state.addLog(`❄️ ${victim.name} получает ${coldDmg} урона холодом от взрыва осколка!`, "damage", victim.name);
        if (victim.id !== target.id) {
          results.push({ name: victim.name, saved: false, amount: coldDmg });
        } else {
          results[0].amount += coldDmg;
        }
      } else {
        if (victim.id !== target.id) {
          results.push({ name: victim.name, saved: true, amount: 0 });
        }
      }
    }

    return {
      targets: results,
      text: `${caster.name} применяет «Ледяной кинжал»`,
    };
  }

  // Телепортация (Теневой шаг, Туманный шаг, Шаг сквозь тень, Телепорт)
  const isTeleportAction =
    ctx.label.toLowerCase().includes("шаг") ||
    ctx.label.toLowerCase().includes("телепорт") ||
    ctx.label.toLowerCase().includes("teleport") ||
    params.name?.toLowerCase().includes("шаг") ||
    params.name?.toLowerCase().includes("teleport");

  if (isTeleportAction) {
    if (!ctx.center) {
      throw new EngineError("Выберите точку на сетке для телепортации");
    }
    const maxRange = params.range?.value ?? 30;
    const dist = distanceFt(caster, ctx.center);
    if (dist > maxRange) {
      throw new EngineError(`Слишком далеко для телепортации: ${dist} фт (максимум ${maxRange} фт)`);
    }
    if (!hasLineOfSight(caster, ctx.center, state.mapElements)) {
      throw new EngineError("Нет линии видимости до точки телепортации");
    }
    if (isCellBlocked(ctx.center, state.mapElements, state.combatants, caster.id)) {
      if (isTerrainBlocked(ctx.center, state.mapElements)) {
        throw new EngineError("Нельзя переместиться в стену или препятствие");
      }
      throw new EngineError("Целевая клетка занята другим существом");
    }

    const wasHidden = caster.isHidden;
    caster.x = ctx.center.x;
    caster.y = ctx.center.y;
    state.mark(caster.id);
    state.addLog(`${caster.name} телепортируется на ${dist} фт (${ctx.label})`, "move", caster.name);

    for (const eff of params.selfEffects ?? []) {
      applyEffect(state, caster.id, eff, caster.id);
    }

    if (wasHidden) {
      const enemies = state.combatants.filter((other) => other.hpCurrent > 0 && isHostile(caster.type, other.type));
      const seenAtDest = enemies.some(
        (e) => isInVisionCone(e, ctx.center!) && hasLineOfSight(e, ctx.center!, state.mapElements)
      );
      if (seenAtDest) {
        caster.isHidden = false;
        state.addLog(`${caster.name} выходит из теней на виду у врагов и раскрывает свою позицию!`, "system", caster.name);
      } else {
        caster.isHidden = true;
        state.addLog(`${caster.name} бесшумно перемещается по теням, оставаясь незамеченным`, "system", caster.name);
      }
    }

    return { targets: [], text: `${caster.name} телепортируется на ${dist} фт` };
  }

  const targets = resolveTargets(state, caster, params, ctx.targetIds, ctx.center);
  const damage = prepareDamage(params, caster, slotLevel);
  // Если у бойца не задана СЛ (лист без магии, ручное создание) — считаем от статов,
  // иначе спасброски проходят автоматически против СЛ 0
  const fallbackAbility = (caster.spells.spellcastingAbility as AbilityKey) || "WIS";
  const saveDC =
    params.saveDC ||
    caster.spells.spellSaveDC ||
    8 + (caster.abilityMods[fallbackAbility] ?? 0) + caster.profBonus;
  const attackBonus =
    params.attackBonus ??
    (caster.spells.spellAttackBonus ||
      (caster.abilityMods[fallbackAbility] ?? 0) + caster.profBonus);
  const isHealing = damage[0]?.type === "healing";

  // Проверка дальности: по точке AoE или по каждой цели
  if (ctx.center) checkSpellRange(state, caster, params, ctx.center);
  else for (const t of targets) if (t.id !== caster.id) checkSpellRange(state, caster, params, t, t);

  const results: CastResult["targets"] = [];

  for (const target of targets) {
    let saved: boolean | undefined;
    let hit: boolean | undefined;
    let amount = 0;

    const isTollTheDead = actLower.includes("погребальный звон") || actLower.includes("toll the dead");
    let targetDamage = damage;
    if (isTollTheDead) {
      const mult = cantripDiceMultiplier(caster.level);
      const dice = target.hpCurrent < target.hpMax ? `${mult}d12` : `${mult}d8`;
      targetDamage = [{ dice, mod: 0, type: "necrotic", save: "none" as const }];

      const save = rollSave(target, "WIS", saveDC);
      saved = save.success;
      state.addLog(`${target.name}: ${save.text} против «Погребального звона»`, "save", target.name);
      if (!save.success) {
        amount = rollDamage(targetDamage, false).total;
      } else {
        amount = 0;
      }
    } else if (params.saveType) {
      const save = rollSave(target, params.saveType as AbilityKey, saveDC);
      saved = save.success;
      state.addLog(`${target.name}: ${save.text}`, "save", target.name);
      if (damage.length > 0) {
        const halfOnSave = damage.some((d) => d.save === "half");
        const noSave = damage.some((d) => d.save === "none");
        if (noSave) {
          amount = rollDamage(damage, false).total;
        } else if (!save.success || halfOnSave) {
          amount = rollDamage(damage, false, { halfOnSave: save.success && halfOnSave }).total;
        }
      }
    } else if (params.attackType && attackBonus && !isHealing) {
      const resolution = resolveAttack(
        caster,
        target,
        {
          id: "spell",
          name: ctx.label,
          attackBonus,
          damage: targetDamage,
          kind: "spell",
          range: { normal: params.range?.value ?? 60 },
          actionCost: params.actionCost,
        },
        { distanceFt: distanceFt(caster, target), allCombatants: state.combatants }
      );
      hit = resolution.hit;
      amount = resolution.damage;
      state.addLog(`${caster.name} → ${target.name}: ${resolution.text}`, "spell", caster.name);
    } else if (targetDamage.length > 0) {
      amount = rollDamage(targetDamage, false).total;
    }

    if (amount > 0) {
      if (isHealing) {
        if (targetDamage[0]?.temp) grantTempHp(state, target.id, amount);
        else heal(state, target.id, amount);
        state.addLog(
          `${target.name}: ${targetDamage[0]?.temp ? "+" + amount + " временных хитов" : "восстановлено " + amount + " хитов"}`,
          "spell",
          target.name
        );
      } else {
        // Урон от бросков атаки уже описан в строке resolveAttack — не дублируем
        if (hit === undefined) {
          state.addLog(
            `${target.name} получает ${amount} урона${saved ? " (половина, спасся)" : ""}`,
            "damage",
            target.name
          );
        }
        dealDamage(state, target.id, amount, {
          damageType: targetDamage[0]?.type,
          isAttack: params.attackType !== undefined,
          attackerId: caster.id,
          source: caster.id,
        });
        const actionLabel = (params.name || ctx.label || "").toLowerCase();
        if (actionLabel.includes("вампирск") || actionLabel.includes("vampiric")) {
          const drainHeal = Math.max(1, Math.floor(amount / 2));
          heal(state, caster.id, drainHeal);
          state.addLog(`${caster.name} поглощает жизненные силы цели (+${drainHeal} HP)`, "spell", caster.name);
        }
      }
    }

    // Эффекты накладываются при провале спасброска или при попадании
    const effectApplies = saved === undefined ? hit !== false : !saved;
    if (effectApplies) {
      for (const eff of params.effects ?? []) {
        applyEffect(state, target.id, eff, caster.id);
      }
      
      // Специфические эффекты перемещения
      const actionName = (params.name || ctx.label || "").toLowerCase();
      if (actionName.includes("волна грома")) {
        pushCombatantAway(state, target, { x: caster.x, y: caster.y }, 2);
        state.addLog(`${target.name} отброшен ударной волной на 10 фт`, "system", target.name);
      } else if (actionName.includes("терновый кнут") && hit) {
        pullCombatantTowards(state, target, { x: caster.x, y: caster.y }, 2);
        state.addLog(`${target.name} притянут терновым кнутом на 10 фт ближе`, "system", target.name);
      } else if (actionName.includes("порыв ветра")) {
        pushCombatantAway(state, target, { x: caster.x, y: caster.y }, actionName.includes("заговор") ? 1 : 3);
        state.addLog(`${target.name} отброшен порывом ветра`, "system", target.name);
      } else if (actionName.includes("хватающие лианы")) {
        pullCombatantTowards(state, target, { x: caster.x, y: caster.y }, 4);
        state.addLog(`${target.name} притянут лианами на 20 фт`, "system", target.name);
      }
    }

    if (!isHealing && target.id !== caster.id && target.hpCurrent > 0 && !target.conditions.some((c) => c.type === "paralyzed" || c.type === "unconscious")) {
      target.facing = determineFacingTowards(target, caster);
      state.mark(target.id);
    }

    results.push({ name: target.name, saved, hit, amount });
  }

  // Если кастер был скрыт — применение заклинания/способности раскрывает его
  if (caster.isHidden) {
    caster.isHidden = false;
    state.addLog(`${caster.name} раскрывает свою позицию!`, "system", caster.name);
  }

  // Обычная невидимость спадает при касте (если это не сам каст невидимости)
  const isCastingInvisibility = params.effects?.some((e) => e.condition === "invisible") || params.selfEffects?.some((e) => e.condition === "invisible");
  if (caster.conditions.some((c) => c.type === "invisible") && !isCastingInvisibility) {
    caster.conditions = caster.conditions.filter((c) => c.type !== "invisible");
    state.addLog(`${caster.name}: невидимость спадает после совершения действия`, "system", caster.name);
  }

  // Эффекты на себя
  for (const eff of params.selfEffects ?? []) {
    applyEffect(state, caster.id, eff, caster.id);
  }

  if (params.name === "Выход из панциря" || ctx.label === "Выход из панциря") {
    caster.conditions = caster.conditions.filter((c) => c.type !== "shelled" && c.type !== "prone");
    state.mark(caster.id);
    state.addLog(`${caster.name} выходит из панциря и встает на ноги`, "ability", caster.name);
  }

  if (params.selfHeal) {
    const rolled = rollDice(params.selfHeal.dice).total + params.selfHeal.mod;
    const total = rolled + (params.selfHeal.addLevel ? caster.level : 0);
    heal(state, caster.id, total);
    state.addLog(`${caster.name}: восстановлено ${total} хитов`, "ability", caster.name);
  }

  if (params.grantsExtraAction) {
    caster.extraActions += 1;
    state.mark(caster.id);
    state.addLog(`${caster.name} получает дополнительное Действие`, "ability", caster.name);
  }

  if (params.grantsAllyAdvantage) {
    for (const target of targets) {
      if (target.id === caster.id) continue;
      applyEffect(state, target.id, { condition: "helped", durationRounds: 1 }, caster.id);
    }
  }

  // Концентрация: новая заменяет старую
  if (params.concentration) {
    if (caster.concentration) {
      state.addLog(
        `${caster.name} прекращает концентрацию на «${caster.concentration.spellName}»`,
        "system",
        caster.name
      );
      dropConcentrationEffects(state, caster.id);
    }
    const rounds = params.duration ? Math.max(1, Math.ceil(parseInt(params.duration, 10) / 6)) : 10;
    caster.concentration = {
      spellId: ctx.label,
      spellName: ctx.label,
      targetId: targets[0]?.id,
      durationRounds: Number.isFinite(rounds) ? rounds : 10,
    };

    const actionLabel = (params.name || ctx.label || "").toLowerCase();
    if (actionLabel.includes("раскален") || actionLabel.includes("heat metal")) {
      const targetId = targets[0]?.id;
      if (targetId) {
        applyEffect(state, targetId, { condition: "heat_metal", durationRounds: rounds }, caster.id);
      }
      const hasHeatAbility = caster.abilities.some((a) => a.id === "heat_metal_burn");
      if (!hasHeatAbility) {
        caster.abilities.push({
          id: "heat_metal_burn",
          name: "Раскалённый металл (Ожог)",
          usesMax: 0,
          usesUsed: 0,
          refresh: "turn",
          parameters: {
            name: "Раскалённый металл (Ожог)",
            type: "ability",
            actionCost: "bonus",
            range: { type: "ranged", value: 60 },
            targeting: "creature",
            damage: [{ dice: "2d8", mod: 0, type: "fire", save: "none" }],
            saveType: "CON",
            effects: [{ condition: "disadvantage", durationRounds: 1 }],
            description: "Бонусное действие: повторный ожог раскаленного металла (2к8 огнём) по цели под действием заклинания.",
          },
        });
      }
    }

    state.mark(caster.id);
  }

  const summary =
    results.length > 0
      ? results
          .map((r) => {
            const parts = [r.name];
            if (r.saved !== undefined) parts.push(r.saved ? "спасся" : "провалил");
            if (r.hit !== undefined) parts.push(r.hit ? "попадание" : "промах");
            if (r.amount) parts.push(`${r.amount}`);
            return parts.join(" ");
          })
          .join("; ")
      : "без целей";

  return { targets: results, text: summary };
}

/** Платит за действие согласно actionCost */
function payActionCost(state: CombatState, c: Combatant, cost: ActionParameters["actionCost"]): void {
  if (cost === "action" || cost === "action+bonus") {
    if (c.actionUsed && c.extraActions <= 0) {
      throw new EngineError("Действие уже использовано");
    }
    if (c.actionUsed && c.extraActions > 0) {
      c.extraActions -= 1;
      c.attacksMadeThisAction = 0;
    } else {
      c.actionUsed = true;
    }
    // Действие целиком израсходовано — атаки за него больше не доступны
    c.attacksMadeThisAction = c.attacksPerAction;
  }
  if (cost === "bonus" || cost === "action+bonus") {
    if (c.bonusActionUsed) throw new EngineError("Бонусное действие уже использовано");
    c.bonusActionUsed = true;
  }
  if (cost === "reaction") {
    if (c.reactionUsed) throw new EngineError("Реакция уже использована");
    c.reactionUsed = true;
  }
  state.mark(c.id);
}

export interface SpellDefinitionLike {
  id: string;
  name: string;
  level: number;
  parameters: ActionParameters;
}

export function castSpell(
  state: CombatState,
  casterId: string,
  spell: SpellDefinitionLike,
  opts: {
    targetIds?: string[];
    center?: Cell | null;
    slotLevel?: number;
    skipTurnCheck?: boolean;
  } = {}
): CastResult {
  if (!opts.skipTurnCheck) assertTurn(state, casterId);
  const caster = state.require(casterId);
  if (!canAct(caster)) throw new EngineError(`${caster.name} не может действовать`);
  if (caster.wildShape) throw new EngineError("Нельзя сотворять заклинания в облике зверя!");

  const params = spell.parameters;
  const slotLevel = opts.slotLevel ?? spell.level;

  // Ячейка списывается до применения — заговоры бесплатны
  if (slotLevel > 0) {
    if (slotLevel < spell.level) {
      throw new EngineError(`Нужна ячейка не ниже ${spell.level} круга`);
    }
    const slot = caster.spells.slots[slotLevel];
    if (!slot || slot.used >= slot.max) {
      throw new EngineError(`Нет свободных ячеек ${slotLevel} круга`);
    }
    caster.spells = {
      ...caster.spells,
      slots: { ...caster.spells.slots, [slotLevel]: { ...slot, used: slot.used + 1 } },
    };
  }

  payActionCost(state, caster, params.actionCost);
  // Поворот заклинателя лицом к цели или к области
  if (opts.targetIds && opts.targetIds.length > 0) {
    const firstTarget = state.get(opts.targetIds[0]);
    if (firstTarget && firstTarget.id !== casterId) {
      caster.facing = determineFacingTowards(caster, firstTarget);
    }
  } else if (opts.center) {
    caster.facing = determineFacingTowards(caster, opts.center);
  }

  // Заголовок до применения, чтобы спасброски и урон шли в логе после него
  state.addLog(
    `${caster.name} читает «${spell.name}»${slotLevel > spell.level ? ` (${slotLevel} круг)` : ""}`,
    "spell",
    caster.name
  );

  const result = applyActionParameters(state, {
    casterId,
    params,
    targetIds: opts.targetIds ?? [],
    center: opts.center ?? null,
    slotLevel,
    label: spell.name,
  });

  state.mark(casterId);
  return result;
}

export function useAbility(
  state: CombatState,
  combatantId: string,
  abilityId: string,
  opts: { targetIds?: string[]; center?: Cell | null; skipTurnCheck?: boolean } = {}
): CastResult {
  if (!opts.skipTurnCheck) assertTurn(state, combatantId);
  const c = state.require(combatantId);

  const ability = c.abilities.find((a) => a.id === abilityId);
  if (!ability) throw new EngineError("Способность не найдена");
  if (ability.usesMax > 0 && ability.usesUsed >= ability.usesMax) {
    throw new EngineError(`«${ability.name}»: использования закончились`);
  }

  const params = ability.parameters;
  if (!params) throw new EngineError(`«${ability.name}» без параметров — нечего применять`);
  if (!canAct(c) && params.actionCost !== "free") {
    throw new EngineError(`${c.name} не может действовать`);
  }

  if (abilityId === "revert_wild_shape" || ability.name.toLowerCase().includes("выйти из облика")) {
    payActionCost(state, c, params.actionCost);
    revertWildShape(state, combatantId);
    state.mark(combatantId);
    return { targets: [], text: `${c.name} возвращается в истинный облик` };
  }

  // --- ХИТРОУМНЫЕ ДЕЙСТВИЯ ПЛУТА (CUNNING ACTION) ---
  const lowId = abilityId.toLowerCase();
  const lowName = ability.name.toLowerCase();
  if (lowId.includes("cunning_action_hide") || (lowName.includes("скрытность") && (params.actionCost === "bonus" || c.className?.toLowerCase().includes("плут")))) {
    payActionCost(state, c, params.actionCost || "bonus");
    const hideRes = attemptHide(state, combatantId, { skipTurnCheck: opts.skipTurnCheck });
    if (ability.usesMax > 0) {
      ability.usesUsed += 1;
      c.abilities = [...c.abilities];
    }
    state.mark(combatantId);
    return { targets: [], text: hideRes.text };
  }

  if (lowId.includes("cunning_action_dash") || (lowName.includes("рывок") && (params.actionCost === "bonus" || c.className?.toLowerCase().includes("плут")))) {
    payActionCost(state, c, params.actionCost || "bonus");
    if (!c.conditions.some((cond) => cond.type === "dashing")) {
      c.conditions.push({ type: "dashing", duration: 1 });
    }
    if (ability.usesMax > 0) {
      ability.usesUsed += 1;
      c.abilities = [...c.abilities];
    }
    state.mark(combatantId);
    state.addLog(`${c.name} совершает Рывок бонусным действием (Хитроумное действие)`, "move", c.name);
    return { targets: [], text: `${c.name} совершает Рывок (удваивает скорость на ход)` };
  }

  if (lowId.includes("cunning_action_disengage") || (lowName.includes("отход") && (params.actionCost === "bonus" || c.className?.toLowerCase().includes("плут")))) {
    payActionCost(state, c, params.actionCost || "bonus");
    if (!c.conditions.some((cond) => cond.type === "disengaging")) {
      c.conditions.push({ type: "disengaging", duration: 1 });
    }
    if (ability.usesMax > 0) {
      ability.usesUsed += 1;
      c.abilities = [...c.abilities];
    }
    state.mark(combatantId);
    state.addLog(`${c.name} совершает Отход бонусным действием (Хитроумное действие)`, "ability", c.name);
    return { targets: [], text: `${c.name} совершает Отход (движение не провоцирует атак)` };
  }

  payActionCost(state, c, params.actionCost);
  // Поворот бойца лицом к цели или к области
  if (opts.targetIds && opts.targetIds.length > 0) {
    const firstTarget = state.get(opts.targetIds[0]);
    if (firstTarget && firstTarget.id !== combatantId) {
      c.facing = determineFacingTowards(c, firstTarget);
    }
  } else if (opts.center) {
    c.facing = determineFacingTowards(c, opts.center);
  }

  // Заголовок пишем до применения, иначе эффекты («+действие», хиты) встают в логе раньше
  state.addLog(`${c.name} применяет «${ability.name}»`, "ability", c.name);

  const result = applyActionParameters(state, {
    casterId: combatantId,
    params,
    targetIds: opts.targetIds ?? [],
    center: opts.center ?? null,
    label: ability.name,
  });

  if (ability.usesMax > 0) {
    ability.usesUsed += 1;
    c.abilities = [...c.abilities];
  }
  state.mark(combatantId);
  return result;
}

// ============ ДИКИЙ ОБЛИК ДРУИДА (WILD SHAPE) ============

export function transformWildShape(
  state: CombatState,
  combatantId: string,
  formId: string,
  opts: { skipTurnCheck?: boolean } = {}
): void {
  if (!opts.skipTurnCheck) assertTurn(state, combatantId);
  const c = state.require(combatantId);

  if (!canAct(c)) throw new EngineError(`${c.name} не может действовать`);
  if (c.wildShape) throw new EngineError(`${c.name} уже находится в облике зверя`);

  const form = getBeastFormById(formId);
  if (!form) throw new EngineError(`Форма зверя «${formId}» не найдена`);

  // Проверяем способность «Дикий облик» (2 раза на отдых)
  const wildShapeAbility = c.abilities.find(
    (a) => a.id === "wild_shape" || a.id.includes("wild_shape") || a.name.toLowerCase().includes("дикий облик")
  );
  if (wildShapeAbility && wildShapeAbility.usesMax > 0 && wildShapeAbility.usesUsed >= wildShapeAbility.usesMax) {
    throw new EngineError("Использования «Дикого облика» исчерпаны (требуется короткий или длинный отдых)");
  }

  // Круг Луны превращается Бонусным действием, остальные — Основным Действием
  const isMoonDruid =
    c.className?.toLowerCase().includes("лун") ||
    c.className?.toLowerCase().includes("moon") ||
    c.abilities.some((a) => a.id.includes("combat_wild_shape") || a.name.toLowerCase().includes("боевой дикий облик"));

  const cost = isMoonDruid ? "bonus" : "action";
  payActionCost(state, c, cost);

  if (wildShapeAbility && wildShapeAbility.usesMax > 0) {
    wildShapeAbility.usesUsed += 1;
    c.abilities = [...c.abilities];
  }

  // Сохраняем исходные параметры друида
  c.wildShape = {
    formId: form.id,
    formName: form.name,
    formNameEn: form.nameEn,
    icon: form.icon,
    originalHpMax: c.hpMax,
    originalHpCurrent: c.hpCurrent,
    originalHpTemp: c.hpTemp,
    originalAc: c.ac,
    originalSpeed: c.speed,
    originalDexMod: c.dexMod,
    originalAbilityMods: { ...c.abilityMods },
    originalAttacks: [...c.attacks],
    originalAbilities: [...c.abilities],
    originalSize: c.size,
    originalName: c.name,
  };

  // Применяем параметры зверя
  c.hpMax = form.hpMax;
  c.hpCurrent = form.hpMax;
  c.hpTemp = 0;
  c.ac = form.ac;
  c.speed = form.speed;
  c.size = form.size;
  c.dexMod = form.abilityMods.DEX;
  c.abilityMods = {
    ...c.abilityMods,
    STR: form.abilityMods.STR,
    DEX: form.abilityMods.DEX,
    CON: form.abilityMods.CON,
  };

  // Атаки зверя
  c.attacks = form.attacks.map((atk) => ({
    ...atk,
    id: `${form.id}_${atk.id}`,
  }));

  // Добавляем способность выхода из облика
  const hasRevert = c.abilities.some((a) => a.id === "revert_wild_shape");
  if (!hasRevert) {
    c.abilities = [
      ...c.abilities,
      {
        id: "revert_wild_shape",
        name: "Выйти из облика зверя",
        usesMax: 0,
        usesUsed: 0,
        refresh: "none",
        parameters: {
          name: "Выйти из облика зверя",
          type: "ability",
          actionCost: "bonus",
          range: { type: "self" },
          damage: [],
          targeting: "self",
          description: "Бонусное действие: вернуться в свой истинный облик друида.",
        },
      },
    ];
  }

  // Состояние
  c.conditions = [
    ...c.conditions.filter((cond) => cond.type !== "wild_shape"),
    { type: "wild_shape", duration: 600 },
  ];

  state.addLog(
    `🌿 ${c.name} принимает Дикий облик: ${form.icon} ${form.name} (${form.hpMax} HP, КД ${form.ac}, Скорость ${form.speed} фт)!`,
    "ability",
    c.name
  );
  state.mark(c.id);
}

export function revertWildShape(
  state: CombatState,
  combatantId: string,
  options?: { overflowDamage?: number; skipTurnCheck?: boolean }
): void {
  const c = state.require(combatantId);
  if (!c.wildShape) return;

  const ws = c.wildShape;
  const overflow = options?.overflowDamage ?? 0;

  // Восстанавливаем параметры друида
  c.hpMax = ws.originalHpMax;
  c.hpCurrent = Math.max(0, ws.originalHpCurrent - overflow);
  c.hpTemp = ws.originalHpTemp;
  c.ac = ws.originalAc;
  c.speed = ws.originalSpeed;
  c.dexMod = ws.originalDexMod;
  c.abilityMods = ws.originalAbilityMods;
  c.attacks = ws.originalAttacks;
  c.abilities = ws.originalAbilities.filter((a) => a.id !== "revert_wild_shape");
  if (ws.originalSize) c.size = ws.originalSize as any;
  c.wildShape = null;
  c.conditions = c.conditions.filter((cond) => cond.type !== "wild_shape");

  if (overflow > 0) {
    state.addLog(
      `🐾 Облик «${ws.formName}» разрушен! ${c.name} возвращается в истинный облик, получив ${overflow} остаточного урона (Осталось ${c.hpCurrent}/${c.hpMax} HP)`,
      "damage",
      c.name
    );
    // Проверка спасброска концентрации от остаточного урона, если заклинатель концентрировался
    if (c.concentration && c.hpCurrent > 0) {
      const save = rollConcentrationSave(c, overflow);
      if (!save.success) {
        state.addLog(
          `${c.name} теряет концентрацию на «${c.concentration.spellName}» (${save.text})`,
          "save",
          c.name
        );
        c.concentration = null;
        dropConcentrationEffects(state, c.id);
      } else {
        state.addLog(`${c.name} удерживает концентрацию (${save.text})`, "save", c.name);
      }
    }
  } else {
    state.addLog(
      `🌿 ${c.name} возвращается в истинный облик друида (${c.hpCurrent}/${c.hpMax} HP)`,
      "ability",
      c.name
    );
  }

  state.mark(c.id);
}

// ============ ЦИКЛ ХОДОВ ============

export function rollInitiative(state: CombatState): void {
  if (!state.combatants || state.combatants.length === 0) {
    state.turnOrder = [];
    state.currentTurnIndex = 0;
    state.round = 1;
    state.markCombat();
    state.addLog("Нет участников для броска инициативы.", "system");
    return;
  }
  const rolls = rollInitiativeForAll(state.combatants);
  for (const r of rolls) {
    const c = state.get(r.id);
    if (!c) continue;
    c.initiative = Number.isFinite(r.initiative) ? Math.round(r.initiative) : 0;
    c.initiativeTiebreak = Number.isFinite(r.tiebreak) ? Math.round(r.tiebreak) : 0;
    c.hasActed = false;
    state.mark(c.id);
  }
  state.turnOrder = buildTurnOrder(state.combatants);
  state.currentTurnIndex = 0;
  state.round = 1;
  state.markCombat();

  const order = state.turnOrder
    .map((id, i) => `${i + 1}. ${state.get(id)?.name ?? "Боец"} (${state.get(id)?.initiative ?? 0})`)
    .join(", ");
  state.addLog(`Инициатива брошена: ${order}`, "system");
  startTurn(state);
}

/** Синхронизирует очередь с составом боя — вызывается после добавления/удаления */
export function syncTurnOrder(state: CombatState): void {
  const { turnOrder, currentTurnIndex } = reconcileTurnOrder(
    state.turnOrder,
    state.combatants,
    state.currentTurnIndex
  );
  state.turnOrder = turnOrder;
  state.currentTurnIndex = currentTurnIndex;
  state.markCombat();
}

/** Начало хода: сброс ресурсов, спасброски от смерти, урон от состояний */
export function startTurn(state: CombatState): void {
  const c = state.current();
  if (!c) return;

  c.movementUsed = 0;
  c.actionUsed = false;
  c.bonusActionUsed = false;
  // Реакция восстанавливается в начале хода самого бойца (правило D&D 5e)
  c.reactionUsed = false;
  c.attacksMadeThisAction = 0;
  c.extraActions = 0;
  c.hasActed = false;
  // Реакция «Щит» держится до начала следующего хода носителя
  c.conditions = c.conditions.filter((cond) => cond.type !== "shielded");
  // Способности, обновляющиеся каждый ход (Скрытая атака)
  c.abilities = c.abilities.map((a) => (a.refresh === "turn" ? { ...a, usesUsed: 0 } : a));

  // Восстановление очков легендарных действий босса
  if (c.legendaryState) {
    c.legendaryState.remainingActions = c.legendaryState.actionsPerRound;
  }

  // Перезарядка способностей монстра (бросок 1d6)
  if (c.rechargeAbilities && c.rechargeAbilities.length > 0) {
    for (const ability of c.rechargeAbilities) {
      if (!ability.isCharged) {
        const d6 = rollDice("1d6").total;
        const required = ability.recharge === "6" ? 6 : 5;
        if (d6 >= required) {
          ability.isCharged = true;
          state.addLog(`⚡ Способность «${ability.name}» восстановила заряд (бросок d6: ${d6})!`, "system", c.name);
        }
      }
    }
  }

  // Регенерация монстра
  if (c.hpCurrent > 0 && c.hpCurrent < c.hpMax) {
    const regenTrait = c.monsterTraits?.find((t) => {
      const n = (t.name || "").toLowerCase();
      return n.includes("регенерация") || n.includes("regeneration");
    });
    if (regenTrait) {
      if ((c.suppressRegenerationUntilRound || 0) <= state.round) {
        const match = regenTrait.description.match(/(\d+)\s*(хит|hp|жизн)/i) || regenTrait.description.match(/(\d+)/);
        const regenAmount = match ? parseInt(match[1], 10) : 10;
        const healed = Math.min(c.hpMax - c.hpCurrent, regenAmount);
        c.hpCurrent += healed;
        state.addLog(`💚 ${c.name} восстанавливает ${healed} HP благодаря Регенерации (${c.hpCurrent}/${c.hpMax})`, "ability", c.name);
      } else {
        state.addLog(`🔥 Регенерация ${c.name} временно подавлена уроном огнём или кислотой!`, "system", c.name);
      }
    }
  }

  state.mark(c.id);

  state.addLog(`— Ход ${c.name} (раунд ${state.round}) —`, "turn", c.name);

  // Спасбросок от смерти при 0 HP (если не стабилизирован и не погиб)
  if (
    c.hpCurrent <= 0 &&
    !c.conditions.some((cond) => cond.type === "stable" || cond.type === "dead")
  ) {
    const ds = rollDeathSave(c);
    state.addLog(`${c.name}: ${ds.text}`, "save", c.name);
    if (ds.criticalSuccess) {
      c.hpCurrent = 1;
      c.conditions = c.conditions.filter(
        (cond) => cond.type !== "unconscious" && cond.type !== "death_save"
      );
      state.addLog(`${c.name} восстанавливает 1 HP и приходит в себя!`, "system", c.name);
    } else {
      const dsCond = c.conditions.find((cond) => cond.type === "death_save");
      let successes = dsCond?.duration ?? 0;
      let failures = dsCond?.value ?? 0;
      if (ds.success) successes += 1;
      else failures += ds.criticalFailure ? 2 : 1;

      if (failures >= 3) {
        c.conditions = [
          ...c.conditions.filter((cond) => cond.type !== "death_save"),
          { type: "dead" },
        ];
        state.addLog(`💀 ${c.name} погибает (3 проваленных спасброска от смерти)!`, "damage", c.name);
      } else if (successes >= 3) {
        c.conditions = [
          ...c.conditions.filter((cond) => cond.type !== "death_save"),
          { type: "stable" },
        ];
        state.addLog(`🛡️ ${c.name} стабилизируется (3 успешных спасброска от смерти)!`, "system", c.name);
      } else {
        c.conditions = [
          ...c.conditions.filter((cond) => cond.type !== "death_save"),
          { type: "death_save", duration: successes, value: failures },
        ];
        state.addLog(
          `${c.name}: спасброски от смерти: ${successes}/3 успехов, ${failures}/3 провалов`,
          "system",
          c.name
        );
      }
    }
  }

  // Урон от состояний вроде «Горит»
  for (const cond of [...c.conditions]) {
    const dmg = CONDITION_EFFECTS[cond.type]?.effects.damagePerTurn;
    if (!dmg) continue;
    const rolled = rollDice(dmg.dice).total;
    state.addLog(
      `${c.name} получает ${rolled} урона (${CONDITION_EFFECTS[cond.type].name})`,
      "damage",
      c.name
    );
    dealDamage(state, c.id, rolled);
  }

  // D&D 5e: Урон от лавы в начале хода (DMG p.249)
  if (isLavaTerrain({ x: c.x, y: c.y }, state.mapElements) && c.hpCurrent > 0) {
    const lavaDmg = rollDice("2d10").total;
    dealDamage(state, c.id, lavaDmg, { isAttack: false, damageType: "fire" });
    state.addLog(`🔥 ${c.name} начинает ход в раскаленной лаве и получает ${lavaDmg} урона огнём!`, "damage", c.name);
  }
}

/** Конец хода: спасброски на снятие эффектов (Save Ends), тикают таймеры */
export function endTurn(state: CombatState): { nextId: string | null } {
  const current = state.current();
  if (current) {
    current.hasActed = true;

    // Повторные спасброски для снятия эффектов (Save Ends) по правилам D&D 5e
    if (current.hpCurrent > 0) {
      for (const cond of [...current.conditions]) {
        if (cond.saveType && cond.saveDC) {
          const save = rollSave(current, cond.saveType, cond.saveDC);
          const label = CONDITION_EFFECTS[cond.type]?.name || cond.type;
          state.addLog(
            `${current.name}: спасбросок от «${label}» (${save.text})`,
            "save",
            current.name
          );
          if (save.success) {
            current.conditions = current.conditions.filter((c) => c !== cond);
            state.addLog(`✨ ${current.name} избавляется от «${label}»!`, "system", current.name);
          }
        }
      }
    }

    // Состояние "surprised" (Застигнут врасплох) спадает в конце первого хода существа
    current.conditions = current.conditions
      .filter((cond) => cond.type !== "surprised")
      .map((cond) =>
        cond.duration !== undefined ? { ...cond, duration: cond.duration - 1 } : cond
      )
      .filter((cond) => cond.duration === undefined || cond.duration > 0);
    state.mark(current.id);

    if (current.concentration) {
      const left = current.concentration.durationRounds - 1;
      if (left <= 0) {
        state.addLog(
          `${current.name}: «${current.concentration.spellName}» закончилось`,
          "system",
          current.name
        );
        current.concentration = null;
        dropConcentrationEffects(state, current.id);
      } else {
        current.concentration = { ...current.concentration, durationRounds: left };
      }
    }
  }

  // Легендарные действия ИИ-боссов в конце хода других существ
  if (current) {
    triggerAILegendaryActions(state, current.id);
  }

  const next = getNextTurn(
    state.turnOrder,
    state.combatants,
    state.currentTurnIndex,
    state.round
  );

  const newRound = next.nextRound > state.round;
  state.currentTurnIndex = next.nextIndex;
  state.round = next.nextRound;
  state.markCombat();

  if (newRound) {
    state.addLog(`=== Раунд ${state.round} ===`, "system");
  }

  startTurn(state);
  return { nextId: next.nextId };
}

/** Бой закончен, если у одной из сторон не осталось стоящих на ногах */
export function checkCombatOver(state: CombatState): "players" | "enemies" | null {
  const aliveEnemies = state.combatants.filter((c) => c.type === "enemy" && c.hpCurrent > 0);
  const aliveOthers = state.combatants.filter((c) => c.type !== "enemy" && c.hpCurrent > 0);
  if (aliveEnemies.length === 0 && aliveOthers.length > 0) return "players";
  if (aliveOthers.length === 0 && aliveEnemies.length > 0) return "enemies";
  return null;
}

// ============ СКРЫТНОСТЬ, ПОВОРОТ, ПАДЕНИЕ И ВСТАВАНИЕ ============

export function attemptHide(
  state: CombatState,
  combatantId: string,
  opts: { skipTurnCheck?: boolean } = {}
): { success: boolean; text: string } {
  if (!opts.skipTurnCheck) assertTurn(state, combatantId);
  const c = state.require(combatantId);
  if (!canAct(c)) throw new EngineError(`${c.name} не может действовать`);
  if (c.isHidden) {
    throw new EngineError("Персонаж уже находится в скрытности");
  }

  const vis = computeVisibilityStatus(c, state.combatants, state.mapElements);

  if (vis.status === "visible") {
    throw new EngineError(`«${c.name}» на виду у врагов (${vis.seenBy.join(", ")}) — спрятаться нельзя!`);
  }

  const isRogue = c.className?.toLowerCase().includes("плут") || c.className?.toLowerCase().includes("rogue");
  const hasCunningAction = (c.level >= 2 && isRogue) || c.abilities.some((a) => a.name.includes("Хитрое действие"));

  let spentBonus = false;
  if (hasCunningAction && !c.bonusActionUsed) {
    c.bonusActionUsed = true;
    spentBonus = true;
  } else {
    if (c.actionUsed && c.extraActions <= 0) {
      throw new EngineError("Действие уже использовано");
    }
    if (c.actionUsed && c.extraActions > 0) {
      c.extraActions -= 1;
    } else {
      c.actionUsed = true;
    }
    c.attacksMadeThisAction = c.attacksPerAction;
  }

  const actionSuffix = spentBonus ? " (Хитрое действие)" : "";

  if (vis.status === "unseen") {
    c.isHidden = true;
    state.mark(c.id);
    const text = `${c.name} успешно скрывается${actionSuffix} (вне поля зрения врагов)`;
    state.addLog(text, "ability", c.name);
    return { success: true, text };
  }

  // vis.status === "cover" -> бросок d20 + DEX (+ prof) против пассивной внимательности врагов
  let highestPerception = 10;
  for (const enemy of state.combatants) {
    if (enemy.hpCurrent > 0 && isHostile(c.type, enemy.type)) {
      const wisMod = enemy.abilityMods?.WIS ?? 0;
      const enemyPassive = 10 + wisMod + enemy.profBonus;
      if (enemyPassive > highestPerception) highestPerception = enemyPassive;
    }
  }

  const dexMod = c.abilityMods?.DEX ?? 0;
  const stealthBonus = dexMod + (isRogue ? c.profBonus * 2 : c.profBonus);
  const roll = rollD20(stealthBonus);

  if (roll.total >= highestPerception) {
    c.isHidden = true;
    state.mark(c.id);
    const text = `${c.name} прячется в укрытии${actionSuffix}: Скрытность ${roll.total} ([${roll.natural}]+${stealthBonus}) против Внимательности СЛ ${highestPerception} — УСПЕШНО!`;
    state.addLog(text, "ability", c.name);
    return { success: true, text };
  } else {
    state.mark(c.id);
    const text = `${c.name} пытается спрятаться в укрытии${actionSuffix}: Скрытность ${roll.total} ([${roll.natural}]+${stealthBonus}) против Внимательности СЛ ${highestPerception} — ЗАМЕЧЕН!`;
    state.addLog(text, "ability", c.name);
    return { success: false, text };
  }
}

export function standUp(state: CombatState, combatantId: string, opts: { skipTurnCheck?: boolean } = {}): void {
  if (!opts.skipTurnCheck) assertTurn(state, combatantId);
  const c = state.require(combatantId);
  if (!c.conditions.some((cond) => cond.type === "prone")) {
    throw new EngineError(`${c.name} не лежит`);
  }
  const speed = effectiveSpeed(c);
  const cost = Math.floor(speed / 2);
  const left = remainingMovement(c);
  if (left < cost) {
    throw new EngineError(`Не хватает перемещения, чтобы встать (требуется ${cost} фт, осталось ${left} фт)`);
  }
  c.movementUsed += cost;
  c.conditions = c.conditions.filter((cond) => cond.type !== "prone");
  state.mark(c.id);
  state.addLog(`${c.name} поднимается на ноги (потрачено ${cost} фт движения)`, "move", c.name);
}

export function dropProne(state: CombatState, combatantId: string, opts: { skipTurnCheck?: boolean } = {}): void {
  if (!opts.skipTurnCheck) assertTurn(state, combatantId);
  const c = state.require(combatantId);
  if (c.conditions.some((cond) => cond.type === "prone")) return;
  c.conditions = [...c.conditions, { type: "prone" }];
  state.mark(c.id);
  state.addLog(`${c.name} падает ничком (Лежит)`, "move", c.name);
}

export function setFacing(state: CombatState, combatantId: string, facing: FacingDirection): void {
  const c = state.require(combatantId);
  c.facing = facing;
  state.mark(c.id);
}

export function teleportCombatant(
  state: CombatState,
  combatantId: string,
  target: Cell,
  maxRangeFt = 30,
  opts: { skipTurnCheck?: boolean } = {}
): void {
  if (!opts.skipTurnCheck) assertTurn(state, combatantId);
  const c = state.require(combatantId);
  const dist = distanceFt(c, target);
  if (dist > maxRangeFt) {
    throw new EngineError(`Слишком далеко для телепортации: ${dist} фт (максимум ${maxRangeFt} фт)`);
  }
  if (!hasLineOfSight(c, target, state.mapElements)) {
    throw new EngineError("Нет линии видимости до точки телепортации");
  }
  const blocked = state.combatants.some(
    (other) => other.id !== c.id && other.hpCurrent > 0 && other.x === target.x && other.y === target.y
  );
  if (blocked) {
    throw new EngineError("Целевая клетка занята другим существом");
  }
  c.x = target.x;
  c.y = target.y;
  state.mark(c.id);
  state.addLog(`${c.name} мгновенно телепортируется на ${dist} фт`, "move", c.name);

  // Проверка попадания в лаву при телепортации
  if (isLavaTerrain(target, state.mapElements) && c.hpCurrent > 0) {
    const lavaDmg = rollDice("2d10").total;
    dealDamage(state, c.id, lavaDmg, { isAttack: false, damageType: "fire" });
    state.addLog(`🔥 ${c.name} телепортируется прямо в раскаленную лаву и получает ${lavaDmg} урона огнём!`, "damage", c.name);
  }
}

export interface ToggleDoorOutcome {
  elementId: string;
  isOpen: boolean;
  text: string;
}

/**
 * Интерактивное открытие/закрытие двери на тактической карте
 */
export function toggleDoor(
  state: CombatState,
  elementId: string,
  opts: { actorId?: string; skipReachCheck?: boolean } = {}
): ToggleDoorOutcome {
  const element = state.mapElements.find((e) => e.id === elementId);
  if (!element) throw new EngineError(`Элемент карты ${elementId} не найден`);
  if (element.type !== "door") throw new EngineError(`Элемент ${elementId} не является дверью`);

  const props = (element.properties || {}) as MapElementProperties;
  if (props.isLocked) {
    throw new EngineError("Дверь заперта на замок");
  }

  if (opts.actorId && !opts.skipReachCheck) {
    const actor = state.require(opts.actorId);
    const distCells = Math.max(
      Math.abs(actor.x - element.x),
      Math.abs(actor.y - element.y)
    );
    if (distCells > 1) {
      throw new EngineError(`${actor.name} слишком далеко от двери (нужно быть в пределах 5 фт)`);
    }
  }

  const newState = !props.isOpen;
  element.properties = {
    ...props,
    isOpen: newState,
    label: newState ? "Дверь (открыта)" : "Дверь (закрыта)",
  };

  state.markCombat();
  const actorName = opts.actorId ? state.get(opts.actorId)?.name : undefined;
  const logText = actorName
    ? `${actorName} ${newState ? "открывает" : "закрывает"} дверь`
    : `Дверь ${newState ? "открыта" : "закрыта"}`;
  state.addLog(logText, "system", actorName);

  return {
    elementId,
    isOpen: newState,
    text: logText,
  };
}

export interface ShoveOutcome {
  success: boolean;
  shoveType: "push" | "prone";
  text: string;
  pushedTo?: Cell;
  lavaDamage?: number;
}

/**
 * Действие «Толчок» (Shove) по правилам D&D 5e: сбить с ног или оттолкнуть на 5 фт (в т.ч. в лаву)
 */
export function shoveCombatant(
  state: CombatState,
  shoverId: string,
  targetId: string,
  shoveType: "push" | "prone",
  opts: {
    skipTurnCheck?: boolean;
    pushDirection?: { dx: number; dy: number };
  } = {}
): ShoveOutcome {
  if (!opts.skipTurnCheck) assertTurn(state, shoverId);

  const shover = state.require(shoverId);
  const target = state.require(targetId);

  // Дистанция: цель должна быть в пределах 5 фт
  const dist = distanceFt(shover, target);
  if (dist > 5) {
    throw new EngineError(`Цель слишком далеко для толчка (${dist} фт, максимум 5 фт)`);
  }

  // Проверка размера (D&D 5e: не более чем на 1 категорию больше)
  const sizeRank: Record<CreatureSize, number> = {
    tiny: 0,
    small: 1,
    medium: 2,
    large: 3,
    huge: 4,
    gargantuan: 5,
  };
  if (sizeRank[target.size] > sizeRank[shover.size] + 1) {
    throw new EngineError(`${target.name} слишком велик(а), чтобы сдвинуть его толчком`);
  }

  // Встречная проверка: Атлетика толкающего против Атлетики или Акробатики цели
  const shoverMod = (shover as any).strMod ?? shover.dexMod ?? 0;
  const targetMod = Math.max((target as any).strMod ?? 0, target.dexMod ?? 0);

  const shoverRoll = rollD20(shoverMod).total;
  const targetRoll = rollD20(targetMod).total;

  const success = shoverRoll >= targetRoll;

  // Экономика действий: толчок заменяет одну атаку
  shover.attacksMadeThisAction += 1;
  if (shover.attacksMadeThisAction >= shover.attacksPerAction) {
    shover.actionUsed = true;
  }
  state.mark(shover.id);

  if (!success) {
    const text = `${shover.name} пытается толкнуть ${target.name}, но ${target.name} удерживает равновесие (${shoverRoll} против ${targetRoll})!`;
    state.addLog(text, "attack", shover.name);
    return { success: false, shoveType, text };
  }

  let text = "";
  let pushedTo: Cell | undefined;
  let lavaDamage: number | undefined;

  if (shoveType === "prone") {
    if (!target.conditions.some((c) => c.type === "prone")) {
      target.conditions.push({ type: "prone" });
    }
    state.mark(target.id);
    text = `💥 ${shover.name} сбивает ${target.name} с ног (ничком)! (${shoverRoll} против ${targetRoll})`;
    state.addLog(text, "attack", shover.name);
  } else {
    // push: толкаем на 5 фт от толкающего
    const dx = opts.pushDirection?.dx ?? Math.sign(target.x - shover.x);
    const dy = opts.pushDirection?.dy ?? Math.sign(target.y - shover.y);
    const dest: Cell = { x: target.x + dx, y: target.y + dy };

    const blocked =
      dest.x < 0 ||
      dest.x >= state.gridWidth ||
      dest.y < 0 ||
      dest.y >= state.gridHeight ||
      isTerrainBlocked(dest, state.mapElements) ||
      state.combatants.some((c) => c.id !== target.id && c.hpCurrent > 0 && c.x === dest.x && c.y === dest.y);

    if (blocked) {
      text = `💥 ${shover.name} толкает ${target.name}, но препятствие мешает сместиться! (${shoverRoll} против ${targetRoll})`;
      state.addLog(text, "attack", shover.name);
    } else {
      target.x = dest.x;
      target.y = dest.y;
      pushedTo = dest;
      state.mark(target.id);
      text = `💥 ${shover.name} отталкивает ${target.name} на 5 фт! (${shoverRoll} против ${targetRoll})`;
      state.addLog(text, "attack", shover.name);

      // Проверка падения в лаву
      if (isLavaTerrain(dest, state.mapElements) && target.hpCurrent > 0) {
        lavaDamage = rollDice("2d10").total;
        dealDamage(state, target.id, lavaDamage, { isAttack: false, damageType: "fire" });
        state.addLog(`🔥 ${target.name} столкнут(а) в лаву и получает ${lavaDamage} урона огнём!`, "damage", target.name);
      }
    }
  }

  return {
    success: true,
    shoveType,
    text,
    pushedTo,
    lavaDamage,
  };
}
