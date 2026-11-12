// Серверная часть окна реакции: контекст и генератор случайных чисел на время одного запроса.
// Отдельный модуль, потому что тянет node:async_hooks — клиентский код его импортировать не должен.

import { AsyncLocalStorage } from "node:async_hooks";
import { seededRandom, setRandomProvider } from "@/lib/rng";
import { setReactionContextProvider, type ReactionContext } from "./reactions";

interface Store {
  ctx: ReactionContext;
  random: () => number;
}

const storage = new AsyncLocalStorage<Store>();

setReactionContextProvider(() => storage.getStore()?.ctx);
setRandomProvider(() => storage.getStore()?.random);

/** Выполняет `fn` с воспроизводимым генератором (seed) и заданными решениями о реакциях */
export function runWithReactions<T>(ctx: ReactionContext, seed: number, fn: () => T): T {
  return storage.run({ ctx, random: seededRandom(seed) }, fn);
}
