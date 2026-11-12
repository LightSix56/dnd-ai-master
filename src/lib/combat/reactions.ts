// Окно выбора реакции (как в Baldur's Gate 3).
//
// Движок синхронный, а решение игрока приходит отдельным запросом. Поэтому действие, в котором
// герою игрока доступна реакция, выполняется так:
//   1. Роут выполняет действие с воспроизводимым генератором случайных чисел (`src/lib/rng.ts`).
//   2. В точке, где реакция сработала бы сама, движок бросает `ReactionPrompt`; состояние не
//      сохраняется, ожидающее решение пишется в `Combat.pendingReaction` вместе с запросом и seed.
//   3. Игрок отвечает; роут повторяет то же действие с тем же seed и записанным решением.
//      До окна результат тот же (те же броски), после — по выбору игрока.
//
// Вне контекста (тесты, ИИ-бойцы, бой без роута) реакции срабатывают сами, как и раньше.
//
// Два способа спросить:
//  - `askReaction` — одно явное решение «да/нет» (атака по возможности, Невероятное уклонение);
//  - `openScope` — вокруг вызова модулей классов (`class-hooks.ts`): реакция, которую модуль
//    потратил сам, обнаруживается по `reactionUsed`; если модулей несколько, игрок выбирает из списка.

import type { CombatState } from "./engine";
import type { Combatant } from "./types";

/** Вариант в окне реакции (отказ — всегда отдельная кнопка, в список не входит) */
export interface ReactionOption {
  id: string;
  label: string;
}

/** Что показать игроку */
export interface ReactionPromptData {
  /** Ключ решения в `ReactionContext.decisions` */
  key: string;
  reactorId: string;
  reactorName: string;
  title: string;
  /** Что произошло: событие, на которое можно ответить реакцией */
  text: string;
  options: ReactionOption[];
}

/** Откат действия: нужно решение игрока (не ошибка правил — роут её не превращает в 400) */
export class ReactionPrompt extends Error {
  constructor(public readonly prompt: ReactionPromptData) {
    super(`Требуется решение о реакции: ${prompt.reactorName}`);
  }
}

export const DECLINE = "decline";

/** Контекст одного запуска действия */
export interface ReactionContext {
  /** Принятые решения: ключ `<порядковый номер вопроса>:<id бойца>` → id варианта или DECLINE */
  decisions: Record<string, string>;
  /** Счётчик вопросов в этом запуске: одинаков при повторе, пока не изменились решения */
  seq: number;
}

type ContextProvider = () => ReactionContext | undefined;
let provider: ContextProvider | null = null;

/** Серверный роут подключает хранилище контекста запроса (AsyncLocalStorage) */
export function setReactionContextProvider(p: ContextProvider | null): void {
  provider = p;
}

function context(): ReactionContext | undefined {
  return provider?.();
}

/** Решает герой игрока (не ИИ, не мёртв), а не движок */
export function isPlayerReactor(c: Combatant): boolean {
  return c.type === "player" && !c.isAIControlled && c.hpCurrent > 0;
}

const keyOf = (seq: number, id: string) => `${seq}:${id}`;

/**
 * Одно явное решение. Возвращает id выбранного варианта или null — отказ.
 * Без контекста, для ИИ-бойцов и бойцов без реакции — первый вариант (реакция срабатывает сама).
 */
export function askReaction(
  reactor: Combatant,
  ask: { title: string; text: string; options: ReactionOption[] }
): string | null {
  const ctx = context();
  if (!ctx || !isPlayerReactor(reactor) || reactor.reactionUsed) return ask.options[0]?.id ?? null;
  const key = keyOf(ctx.seq++, reactor.id);
  const decision = ctx.decisions[key];
  if (decision === undefined) {
    throw new ReactionPrompt({
      key,
      reactorId: reactor.id,
      reactorName: reactor.name,
      title: ask.title,
      text: ask.text,
      options: ask.options,
    });
  }
  return decision === DECLINE ? null : decision;
}

interface Candidate {
  moduleId: string;
  label: string;
}

/**
 * Область вокруг обхода модулей классов. Для каждого героя игрока с неиспользованной реакцией:
 *  - решения ещё нет: модуль выполняется как обычно, и если он потратил реакцию, это запоминается
 *    как вариант (реакция возвращается), а в конце `close()` бросает окно со списком;
 *  - решение есть: выбранный модуль выполняется как обычно, остальные — при «занятой» реакции,
 *    то есть без реакции героя.
 */
export class ReactionScope {
  private readonly candidates = new Map<string, { reactor: Combatant; list: Candidate[] }>();

  constructor(
    private readonly state: CombatState,
    private readonly ctx: ReactionContext,
    private readonly seq: number,
    private readonly reactors: Combatant[],
    private readonly describe: () => string
  ) {}

  run<T>(moduleId: string, fn: () => T): T {
    const blocked: Combatant[] = [];
    const watching: Combatant[] = [];
    for (const r of this.reactors) {
      if (r.reactionUsed) continue;
      const decision = this.ctx.decisions[keyOf(this.seq, r.id)];
      if (decision === undefined) watching.push(r);
      else if (decision !== moduleId) {
        r.reactionUsed = true;
        blocked.push(r);
      }
    }
    if (blocked.length === 0 && watching.length === 0) return fn();

    const logFrom = this.state.log.length;
    let out: T;
    try {
      out = fn();
    } catch (e) {
      for (const r of blocked) r.reactionUsed = false;
      // Вопрос возник раньше возможной ошибки — сначала спрашиваем его
      for (const r of watching) if (r.reactionUsed) this.note(r, moduleId, logFrom);
      this.close(e);
      throw e;
    }
    for (const r of blocked) r.reactionUsed = false;
    for (const r of watching) if (r.reactionUsed) this.note(r, moduleId, logFrom);
    return out;
  }

  private note(r: Combatant, moduleId: string, logFrom: number): void {
    r.reactionUsed = false;
    const lines = this.state.log.slice(logFrom).map((l) => l.text);
    const entry = this.candidates.get(r.id) ?? { reactor: r, list: [] };
    entry.list.push({ moduleId, label: lines[0] ?? moduleId });
    this.candidates.set(r.id, entry);
  }

  /** Бросает окно реакции, если нашлись варианты; `cause` — ошибка, прервавшая обход (не скрывается) */
  close(cause?: unknown): void {
    const first = this.candidates.values().next().value;
    if (!first) return;
    void cause;
    throw new ReactionPrompt({
      key: keyOf(this.seq, first.reactor.id),
      reactorId: first.reactor.id,
      reactorName: first.reactor.name,
      title: "Использовать реакцию?",
      text: this.describe(),
      options: first.list.map((c) => ({ id: c.moduleId, label: c.label })),
    });
  }
}

/** Открывает область, если есть контекст и есть кому решать; иначе null (обход без накладных расходов) */
export function openScope(state: CombatState, describe: () => string): ReactionScope | null {
  const ctx = context();
  if (!ctx || !Array.isArray(state.combatants)) return null;
  const reactors = state.combatants.filter((c) => isPlayerReactor(c) && !c.reactionUsed);
  if (reactors.length === 0) return null;
  return new ReactionScope(state, ctx, ctx.seq++, reactors, describe);
}

/** Для `catch`, глотающих ошибки действия: окно реакции — не ошибка, его нельзя проглатывать */
export function rethrowIfPrompt(e: unknown): void {
  if (e instanceof ReactionPrompt) throw e;
}
