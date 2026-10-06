// Город: улицы и переулки между кварталами домов, площадь с колодцем, телеги, лотки,
// ящики и бочки. Партия и враги — на противоположных концах главной улицы.

import { createRng, type Rng } from "./rng";
import { Field, SUB } from "./field";
import type { Area, Decor, Polyline, ProcgenLayout } from "./layout";

const W = 24;
const H = 16;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Улицы одного направления: [начало, ширина] */
function streets(rng: Rng, length: number, count: number): [number, number][] {
  const out: [number, number][] = [];
  const slot = length / count;
  for (let i = 0; i < count; i++) {
    const width = rng.int(2, 3);
    const start = Math.floor(slot * i + slot / 2 - width / 2 + rng.int(-1, 1));
    out.push([Math.max(2, Math.min(length - 2 - width, start)), width]);
  }
  return out;
}

/** Промежутки между улицами (и краями карты) */
function gaps(length: number, roads: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let pos = 0;
  for (const [start, width] of [...roads].sort((a, b) => a[0] - b[0])) {
    if (start - pos > 0) out.push([pos, start - pos]);
    pos = start + width;
  }
  if (length - pos > 0) out.push([pos, length - pos]);
  return out;
}

export function generateCityLayout(seed: number): ProcgenLayout {
  const rng = createRng((seed ^ 0xc17c0001) >>> 0);
  const rows = streets(rng, H, rng.int(1, 2));
  const cols = streets(rng, W, rng.int(1, 2));

  // Площадь у первого перекрёстка — дома туда не ставятся
  const [ry, rh] = rows[0];
  const [cx, cw] = cols[0];
  const plaza: Rect = { x: cx - 2, y: ry - 2, w: cw + 4, h: rh + 4 };
  const inPlaza = (x: number, y: number) => x >= plaza.x && x < plaza.x + plaza.w && y >= plaza.y && y < plaza.y + plaza.h;

  const houses: Rect[] = [];
  const alleys: Polyline[] = [];
  const flankAreas: Area[] = [];
  for (const [by, bh] of gaps(H, rows)) {
    for (const [bx, bw] of gaps(W, cols)) {
      let x = bx;
      while (x < bx + bw) {
        const w = Math.min(rng.int(3, 6), bx + bw - x);
        const house: Rect = { x, y: by, w, h: bh };
        // Дом не заходит на площадь: обрезаем по высоте, иначе пропускаем
        const cells: [number, number][] = [];
        for (let yy = house.y; yy < house.y + house.h; yy++) for (let xx = house.x; xx < house.x + house.w; xx++) cells.push([xx, yy]);
        if (w >= 2 && !cells.some(([xx, yy]) => inPlaza(xx, yy))) houses.push(house);
        x += w;
        // Переулок между домами
        if (x < bx + bw - 2 && rng.next() < 0.45) {
          alleys.push([{ x: x + 0.5, y: by }, { x: x + 0.5, y: by + bh }]);
          flankAreas.push({ cx: x + 0.5, cy: by + bh / 2, rx: 0.6, ry: Math.max(1, bh / 2) });
          x += 1;
        }
      }
    }
  }

  const solid = Array.from({ length: H }, () => Array<boolean>(W).fill(false));
  for (const h of houses) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) solid[y][x] = true;
  const ground = new Field(W * SUB, H * SUB);
  for (let y = 0; y < ground.h; y++) {
    for (let x = 0; x < ground.w; x++) if (!solid[Math.floor(y / SUB)][Math.floor(x / SUB)]) ground.set(x, y, 1);
  }

  // Главная улица — первая горизонтальная; партия и враги на её концах
  const mainY = ry + rh / 2;
  const areas: Area[] = [
    { cx: 2, cy: mainY, rx: 2, ry: rh / 2 },
    { cx: W - 2, cy: mainY, rx: 2, ry: rh / 2 },
  ];
  const paths: Polyline[] = [
    ...rows.map(([y, h]) => [{ x: 0, y: y + h / 2 }, { x: W, y: y + h / 2 }]),
    ...cols.map(([x, w]) => [{ x: x + w / 2, y: 0 }, { x: x + w / 2, y: H }]),
    ...alleys,
  ];

  const decor: Decor[] = [];
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !solid[y][x];
  const nearArea = (x: number, y: number) => areas.some((a) => Math.hypot(x + 0.5 - a.cx, y + 0.5 - a.cy) < 2.5);
  const onAxis = (x: number, y: number) =>
    rows.some(([sy, sh]) => Math.floor(sy + sh / 2) === y) || cols.some(([sx, sw]) => Math.floor(sx + sw / 2) === x);
  const taken = new Set<string>();
  const place = (kind: Decor["kind"], x: number, y: number, w = 1, h = 1) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (!open(xx, yy) || nearArea(xx, yy) || taken.has(`${xx},${yy}`) || onAxis(xx, yy)) return false;
      }
    }
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) taken.add(`${xx},${yy}`);
    decor.push(w > 1 || h > 1 ? { kind, x, y, r: 0.45, w, h } : { kind, x: x + 0.5, y: y + 0.5, r: 0.35 });
    return true;
  };

  // Колодец на площади, в стороне от осей улиц
  if (!place("well", cx + cw, ry + rh)) place("well", cx - 1, ry - 1);
  const streetCells: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (open(x, y)) streetCells.push([x, y]);
  const scatter = (kind: Decor["kind"], count: number, w = 1, h = 1) => {
    for (let attempt = 0, placed = 0; attempt < count * 40 && placed < count; attempt++) {
      const [x, y] = rng.pick(streetCells);
      if (place(kind, x, y, w, h)) placed++;
    }
  };
  scatter("cart", rng.int(1, 2), 2, 1);
  scatter("stall", rng.int(1, 3), 2, 1);
  scatter("crate", rng.int(2, 5));
  scatter("barrel", rng.int(2, 4));

  return {
    biome: "urban",
    seed,
    width: W,
    height: H,
    ground,
    liquid: new Field(W * SUB, H * SUB),
    decor,
    areas,
    flankAreas,
    paths,
    structures: houses,
  };
}
