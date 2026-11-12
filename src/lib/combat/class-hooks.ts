// Точки подключения классов к боевому движку.
//
// Движок не знает о конкретных классах: в нужных местах (до атаки, при попадании, при уроне, в начале
// и конце хода…) он вызывает функции этого файла, а они обходят зарегистрированные модули классов.
// Чтобы добавить класс, достаточно зарегистрировать его модуль (см. class-kit.ts и classes/*-combat.ts) —
// engine.ts править не нужно.
//
// Здесь только типы и реестр: ни движок, ни классы не импортируются, поэтому циклов нет.

import type { CastResult, CombatState } from "./engine";
import type { AttackResolution, SaveResult } from "./rules";
import type { AbilityKey, ActionParameters, Attack, CombatAbility, Combatant } from "./types";

export type FeatureOpts = { targetIds?: string[]; center?: { x: number; y: number } | null };

/** Разбор попадания, который меняют умения: урон и его части те же, что у движка */
export type HitResolution = Pick<AttackResolution, "hit" | "crit" | "damage" | "damageParts"> & {
  roll: { total: number; natural: number };
};

export interface ClassModule {
  id: string;
  /** Умение по кнопке; null — умение не из этого модуля */
  useFeature?(state: CombatState, c: Combatant, ability: CombatAbility, params: ActionParameters, opts: FeatureOpts): CastResult | null;
  /** До броска атаки: умение может забрать атаку на себя (Эхо-мученик) */
  preAttack?(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack): { text: string } | null;
  /** После броска атаки, до урона: защитные реакции. Может сменить цель и сам разбор атаки */
  defense?(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack, res: AttackResolution, allowRedirect?: boolean): Combatant;
  /** Попадание оружием: добавки к урону и эффекты. Возвращает текст для строки атаки */
  hitRiders?(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack, res: HitResolution): string;
  /** Атака разыграна (попала или нет), урон уже нанесён */
  attackResolved?(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack, res: HitResolution): void;
  /** После атаки: расход временных состояний */
  afterAttack?(state: CombatState, attacker: Combatant, target: Combatant, attack?: Attack): void;
  /** Уменьшение урона реакциями и умениями; возвращает новый урон */
  reduceDamage?(state: CombatState, target: Combatant, amount: number, opts: { isAttack?: boolean; attackerId?: string; damageType?: string }): number;
  /** Урон по бойцу не засчитывается вовсе */
  shield?(target: Combatant): boolean;
  /** Урон прошёл сопротивления и будет нанесён */
  noteDamage?(state: CombatState, attackerId: string | undefined, targetId: string): void;
  /** Урон нанесён: ответные умения (Ответный удар, шипы) */
  damaged?(state: CombatState, target: Combatant, attacker: Combatant | undefined, amount: number, opts: { isAttack?: boolean; damageType?: string }): void;
  /** Хиты упали до 0; true — умение удержало бойца на ногах, дальше движок ничего не делает */
  onDrop?(state: CombatState, target: Combatant, hpBefore: number, amount: number): boolean;
  /** Спасбросок провален: умение может перебросить его. Возвращает новый результат или null */
  saveFailed?(state: CombatState, c: Combatant, ability: AbilityKey, dc: number, reroll: () => SaveResult): SaveResult | null;
  onMove?(state: CombatState, mover: Combatant, start: { x: number; y: number }, path: Array<{ x: number; y: number }>): void;
  startTurn?(state: CombatState, c: Combatant): void;
  /** Первый ход бойца в бою (бросок инициативы) */
  battleStart?(state: CombatState, c: Combatant): void;
  /** before — до тиканья таймеров состояний, after — после */
  endTurn?(state: CombatState, c: Combatant, phase: "before" | "after"): void;
  afterAbility?(state: CombatState, c: Combatant, srdKey: string | undefined): void;
  afterSpell?(state: CombatState, caster: Combatant, spellLevel: number): void;
  /**
   * Скрытая атака разрешена и без преимущества и без союзника у цели (Лихая удаль, Проницательный бой).
   * Помеха на бросок по-прежнему запрещает её. Возвращает причину для журнала или null
   */
  sneakAllowed?(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack): string | null;
  /** Скрытая атака нанесла урон: умения, срабатывающие после неё (Загробные вопли, Раздирание разума). Возвращает текст для строки атаки */
  sneakDealt?(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack, info: SneakInfo): string;
  /** Боец упал до 0 хитов (для существ вне игроков — погиб): Жетон души */
  creatureDown?(state: CombatState, target: Combatant): void;
  /** Спрятаться: умение даёт преимущество на проверку Скрытности (Высокая скрытность) */
  hideAdvantage?(state: CombatState, c: Combatant): string | null;
  /** Помеха на спасброски цели против заклинания, которое накладывает caster (Магическая засада) */
  castSaveDisadvantage?(state: CombatState, caster: Combatant, target: Combatant): string | null;
}

/** Сведения о сработавшей Скрытой атаке */
export interface SneakInfo {
  /** Кости урона, например «3d6» */
  dice: string;
  /** Выпавший урон Скрытой атаки */
  amount: number;
  crit: boolean;
}

const MODULES: ClassModule[] = [];

export function registerClassModule(mod: ClassModule): void {
  const at = MODULES.findIndex((m) => m.id === mod.id);
  if (at >= 0) MODULES[at] = mod;
  else MODULES.push(mod);
}

export const classHooks = {
  useFeature(state: CombatState, c: Combatant, ability: CombatAbility, params: ActionParameters, opts: FeatureOpts): CastResult | null {
    for (const m of MODULES) {
      const out = m.useFeature?.(state, c, ability, params, opts);
      if (out) return out;
    }
    return null;
  },
  preAttack(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack): { text: string } | null {
    for (const m of MODULES) {
      const out = m.preAttack?.(state, attacker, target, attack);
      if (out) return out;
    }
    return null;
  },
  defense(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack, res: AttackResolution, allowRedirect = true): Combatant {
    let current = target;
    for (const m of MODULES) current = m.defense?.(state, attacker, current, attack, res, allowRedirect) ?? current;
    return current;
  },
  hitRiders(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack, res: HitResolution): string {
    let text = "";
    for (const m of MODULES) text += m.hitRiders?.(state, attacker, target, attack, res) ?? "";
    return text;
  },
  attackResolved(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack, res: HitResolution): void {
    for (const m of MODULES) m.attackResolved?.(state, attacker, target, attack, res);
  },
  afterAttack(state: CombatState, attacker: Combatant, target: Combatant, attack?: Attack): void {
    for (const m of MODULES) m.afterAttack?.(state, attacker, target, attack);
  },
  reduceDamage(state: CombatState, target: Combatant, amount: number, opts: { isAttack?: boolean; attackerId?: string; damageType?: string }): number {
    let left = amount;
    for (const m of MODULES) {
      if (left <= 0) return 0;
      left = m.reduceDamage?.(state, target, left, opts) ?? left;
    }
    return Math.max(0, left);
  },
  shield(target: Combatant): boolean {
    return MODULES.some((m) => m.shield?.(target));
  },
  noteDamage(state: CombatState, attackerId: string | undefined, targetId: string): void {
    for (const m of MODULES) m.noteDamage?.(state, attackerId, targetId);
  },
  damaged(state: CombatState, target: Combatant, attacker: Combatant | undefined, amount: number, opts: { isAttack?: boolean; damageType?: string }): void {
    for (const m of MODULES) m.damaged?.(state, target, attacker, amount, opts);
  },
  onDrop(state: CombatState, target: Combatant, hpBefore: number, amount: number): boolean {
    return MODULES.some((m) => m.onDrop?.(state, target, hpBefore, amount));
  },
  saveFailed(state: CombatState, c: Combatant, ability: AbilityKey, dc: number, reroll: () => SaveResult): SaveResult | null {
    for (const m of MODULES) {
      const out = m.saveFailed?.(state, c, ability, dc, reroll);
      if (out) return out;
    }
    return null;
  },
  onMove(state: CombatState, mover: Combatant, start: { x: number; y: number }, path: Array<{ x: number; y: number }>): void {
    for (const m of MODULES) m.onMove?.(state, mover, start, path);
  },
  startTurn(state: CombatState, c: Combatant): void {
    for (const m of MODULES) m.startTurn?.(state, c);
  },
  battleStart(state: CombatState, c: Combatant): void {
    for (const m of MODULES) m.battleStart?.(state, c);
  },
  endTurn(state: CombatState, c: Combatant, phase: "before" | "after"): void {
    for (const m of MODULES) m.endTurn?.(state, c, phase);
  },
  afterAbility(state: CombatState, c: Combatant, srdKey: string | undefined): void {
    for (const m of MODULES) m.afterAbility?.(state, c, srdKey);
  },
  afterSpell(state: CombatState, caster: Combatant, spellLevel: number): void {
    for (const m of MODULES) m.afterSpell?.(state, caster, spellLevel);
  },
  sneakAllowed(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack): string | null {
    for (const m of MODULES) {
      const out = m.sneakAllowed?.(state, attacker, target, attack);
      if (out) return out;
    }
    return null;
  },
  sneakDealt(state: CombatState, attacker: Combatant, target: Combatant, attack: Attack, info: SneakInfo): string {
    let text = "";
    for (const m of MODULES) text += m.sneakDealt?.(state, attacker, target, attack, info) ?? "";
    return text;
  },
  creatureDown(state: CombatState, target: Combatant): void {
    for (const m of MODULES) m.creatureDown?.(state, target);
  },
  hideAdvantage(state: CombatState, c: Combatant): string | null {
    for (const m of MODULES) {
      const out = m.hideAdvantage?.(state, c);
      if (out) return out;
    }
    return null;
  },
  castSaveDisadvantage(state: CombatState, caster: Combatant, target: Combatant): string | null {
    for (const m of MODULES) {
      const out = m.castSaveDisadvantage?.(state, caster, target);
      if (out) return out;
    }
    return null;
  },
};
