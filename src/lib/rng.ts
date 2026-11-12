// Источник случайных чисел для кубов и выборов движка боя.
//
// Обычно это Math.random. Серверный роут боя может подставить воспроизводимый генератор
// (см. `setRandomProvider`): так действие, остановленное окном реакции, повторяется с теми же
// бросками. Модуль без импортов Node — его безопасно тянуть и в клиентский код.

type Provider = () => (() => number) | undefined;

let provider: Provider | null = null;

/** Подключает источник генератора текущего запроса (возвращает undefined, если подмены нет) */
export function setRandomProvider(p: Provider | null): void {
  provider = p;
}

/** Случайное число в [0, 1). Math.random вызывается в момент обращения — тесты могут его подменять */
export function rand(): number {
  const gen = provider?.();
  return gen ? gen() : Math.random();
}

/** Воспроизводимый генератор (mulberry32): один и тот же seed даёт одну и ту же последовательность */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
