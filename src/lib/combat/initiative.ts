// Инициатива и очередь ходов.
// Порядок фиксируется один раз в Combat.turnOrder (массив id) — иначе при равной
// инициативе сортировка недетерминирована и "чей ход" разъезжается между
// сервером и клиентом.
import { rollD20 } from "@/lib/dnd/dice";
import type { Combatant } from "./types";

export interface InitiativeRoll {
  id: string;
  initiative: number;
  /** Случайный tiebreak: при равной инициативе порядок стабилен, но непредсказуем */
  tiebreak: number;
}

export function rollInitiativeFor(c: Pick<Combatant, "dexMod">): number {
  const mod = typeof c.dexMod === "number" && Number.isFinite(c.dexMod) ? c.dexMod : 0;
  const roll = rollD20(mod).total;
  return Number.isFinite(roll) ? Math.round(roll) : 10;
}

export function rollInitiativeForAll(
  combatants: Array<Pick<Combatant, "id" | "dexMod">>
): InitiativeRoll[] {
  return combatants.map((c) => ({
    id: c.id,
    initiative: rollInitiativeFor(c),
    tiebreak: Math.floor(Math.random() * 1_000_000),
  }));
}

type Sortable = Pick<Combatant, "id" | "initiative" | "dexMod" | "initiativeTiebreak">;

/**
 * Сортировка: инициатива → модификатор ЛОВ → сохранённый tiebreak → id.
 * Последние два звена гарантируют, что порядок не меняется между вызовами.
 */
export function sortByInitiative<T extends Sortable>(combatants: T[]): T[] {
  return [...combatants].sort((a, b) => {
    const initA = Number.isFinite(a.initiative) ? a.initiative : 0;
    const initB = Number.isFinite(b.initiative) ? b.initiative : 0;
    if (initB !== initA) return initB - initA;

    const dexA = Number.isFinite(a.dexMod) ? a.dexMod : 0;
    const dexB = Number.isFinite(b.dexMod) ? b.dexMod : 0;
    if (dexB !== dexA) return dexB - dexA;

    const tieA = Number.isFinite(a.initiativeTiebreak) ? a.initiativeTiebreak : 0;
    const tieB = Number.isFinite(b.initiativeTiebreak) ? b.initiativeTiebreak : 0;
    if (tieB !== tieA) return tieB - tieA;

    return (a.id || "").localeCompare(b.id || "");
  });
}

/** Строит массив id в порядке ходов */
export function buildTurnOrder<T extends Sortable>(combatants: T[]): string[] {
  return sortByInitiative(combatants).map((c) => c.id);
}

/**
 * Приводит turnOrder в соответствие с текущим составом боя:
 * новые бойцы вставляются по инициативе, удалённые выкидываются.
 * Возвращает также скорректированный индекс, чтобы ход не перескочил.
 */
export function reconcileTurnOrder<T extends Sortable>(
  turnOrder: string[],
  combatants: T[],
  currentTurnIndex: number
): { turnOrder: string[]; currentTurnIndex: number } {
  const byId = new Map(combatants.map((c) => [c.id, c]));
  const currentId = turnOrder[currentTurnIndex];

  // Убираем тех, кого больше нет в бою
  const kept = turnOrder.filter((id) => byId.has(id));

  // Добавляем новых и пересортировываем целиком, сохраняя стабильность
  const missing = combatants.filter((c) => !kept.includes(c.id)).map((c) => c.id);
  const merged = [...kept, ...missing];

  const sorted = sortByInitiative(
    merged.map((id) => byId.get(id)!).filter(Boolean)
  ).map((c) => c.id);

  // Пытаемся удержать ход на том же бойце
  let idx = currentId ? sorted.indexOf(currentId) : 0;
  if (idx < 0) idx = Math.min(currentTurnIndex, Math.max(0, sorted.length - 1));

  return { turnOrder: sorted, currentTurnIndex: Math.max(0, idx) };
}

export function getCombatantAtTurn<T extends { id: string }>(
  turnOrder: string[],
  combatants: T[],
  turnIndex: number
): T | null {
  if (turnOrder.length === 0) return null;
  const id = turnOrder[turnIndex % turnOrder.length];
  return combatants.find((c) => c.id === id) ?? null;
}

export interface NextTurnResult {
  nextIndex: number;
  nextRound: number;
  nextId: string | null;
  /** Сколько раз пересекли конец очереди — раунд увеличивается максимум на 1 */
  wrapped: boolean;
}

/**
 * Следующий ход: пропускает мёртвых, увеличивает раунд ровно один раз
 * при полном обороте очереди.
 */
export function getNextTurn<T extends { id: string; hpCurrent: number }>(
  turnOrder: string[],
  combatants: T[],
  currentTurnIndex: number,
  currentRound: number
): NextTurnResult {
  if (turnOrder.length === 0) {
    return { nextIndex: 0, nextRound: currentRound, nextId: null, wrapped: false };
  }

  const byId = new Map(combatants.map((c) => [c.id, c]));
  const isAlive = (id: string) => (byId.get(id)?.hpCurrent ?? 0) > 0;

  if (!turnOrder.some(isAlive)) {
    return {
      nextIndex: currentTurnIndex,
      nextRound: currentRound,
      nextId: null,
      wrapped: false,
    };
  }

  let idx = currentTurnIndex;
  let wrapped = false;

  // Ищем следующего живого, отмечая пересечение конца очереди
  for (let step = 0; step < turnOrder.length; step++) {
    idx += 1;
    if (idx >= turnOrder.length) {
      idx = 0;
      wrapped = true;
    }
    if (isAlive(turnOrder[idx])) break;
  }

  return {
    nextIndex: idx,
    nextRound: wrapped ? currentRound + 1 : currentRound,
    nextId: turnOrder[idx],
    wrapped,
  };
}
