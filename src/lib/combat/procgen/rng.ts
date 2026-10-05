// Генератор случайных чисел с зерном (mulberry32). Весь procgen берёт случайность только
// отсюда: одно зерно на сервере и в браузере должно давать одну и ту же карту.

export interface Rng {
  /** Число в [0, 1) */
  next(): number;
  /** Целое в [min, max] включительно */
  int(min: number, max: number): number;
  pick<T>(arr: T[]): T;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}
