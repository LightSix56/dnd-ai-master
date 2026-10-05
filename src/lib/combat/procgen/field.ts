// Числовые поля субклеточного разрешения: маски пола и воды, шум, размытие.
// Чистая математика без canvas — считается одинаково на сервере и в браузере.

import type { Rng } from "./rng";

/** Отсчётов поля на одну клетку сетки по каждой оси */
export const SUB = 8;

export class Field {
  readonly data: Float32Array;

  constructor(readonly w: number, readonly h: number, fill = 0) {
    this.data = new Float32Array(w * h);
    if (fill !== 0) this.data.fill(fill);
  }

  get(x: number, y: number): number {
    return this.data[y * this.w + x];
  }

  set(x: number, y: number, v: number): void {
    this.data[y * this.w + x] = v;
  }
}

/** Значение решётки шума с билинейной интерполяцией и сглаживанием (smoothstep) */
function sampleGrid(grid: Float32Array, gw: number, gh: number, fx: number, fy: number): number {
  const x0 = Math.min(gw - 1, Math.floor(fx));
  const y0 = Math.min(gh - 1, Math.floor(fy));
  const x1 = Math.min(gw - 1, x0 + 1);
  const y1 = Math.min(gh - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const top = grid[y0 * gw + x0] * (1 - sx) + grid[y0 * gw + x1] * sx;
  const bottom = grid[y1 * gw + x0] * (1 - sx) + grid[y1 * gw + x1] * sx;
  return top * (1 - sy) + bottom * sy;
}

/**
 * Многооктавный шум значений в [0, 1]. `cellsAcross` — сколько узлов решётки по ширине
 * у первой октавы; каждая следующая вдвое мельче и вдвое слабее.
 */
export function valueNoise(rng: Rng, w: number, h: number, cellsAcross: number, octaves: number): Field {
  const out = new Field(w, h);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const gw = Math.max(2, cellsAcross * 2 ** o + 1);
    const gh = Math.max(2, Math.round(((gw - 1) * h) / w) + 1);
    const grid = new Float32Array(gw * gh);
    for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
    for (let y = 0; y < h; y++) {
      const fy = (y / Math.max(1, h - 1)) * (gh - 1);
      for (let x = 0; x < w; x++) {
        const fx = (x / Math.max(1, w - 1)) * (gw - 1);
        out.data[y * w + x] += amp * sampleGrid(grid, gw, gh, fx, fy);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.data.length; i++) out.data[i] /= total;
  return out;
}

/** Один проход box-фильтра по оси; за краем поля повторяется крайнее значение */
function boxPass(src: Float32Array, w: number, h: number, r: number, horizontal: boolean): Float32Array {
  const dst = new Float32Array(src.length);
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const norm = 1 / (2 * r + 1);
  for (let line = 0; line < lines; line++) {
    const at = (i: number) => {
      const c = Math.min(len - 1, Math.max(0, i));
      return horizontal ? src[line * w + c] : src[c * w + line];
    };
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += at(i);
    for (let i = 0; i < len; i++) {
      if (horizontal) dst[line * w + i] = acc * norm;
      else dst[i * w + line] = acc * norm;
      acc += at(i + r + 1) - at(i - r);
    }
  }
  return dst;
}

/** Приближение гауссова размытия: три прохода box-фильтра по каждой оси */
export function blurField(f: Field, radius: number): Field {
  const r = Math.max(1, Math.round(radius * 0.8));
  let data: Float32Array = f.data;
  for (let pass = 0; pass < 3; pass++) {
    data = boxPass(data, f.w, f.h, r, true);
    data = boxPass(data, f.w, f.h, r, false);
  }
  const out = new Field(f.w, f.h);
  out.data.set(data);
  return out;
}
