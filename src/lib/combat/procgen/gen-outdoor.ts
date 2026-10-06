// Природа: открытая местность без внешних стен. Партия и враги — у противоположных
// краёв, засада — у середин двух других краёв. Через карту идёт тропа: она гарантирует
// путь через ручьи и горные гряды.

import { createRng, type Rng } from "./rng";
import { Field, SUB, blurField, valueNoise } from "./field";
import type { Area, Decor, DecorKind, Polyline, ProcgenLayout } from "./layout";

export type OutdoorBiome = "forest" | "swamp" | "desert" | "snow" | "mountain" | "coastal";

const W = 24;
const H = 16;

const range = (rng: Rng, min: number, max: number) => min + rng.next() * (max - min);

function distToPolyline(px: number, py: number, path: Polyline): number {
  let best = Infinity;
  for (let s = 0; s < path.length - 1; s++) {
    const a = path[s];
    const b = path[s + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t)));
  }
  return best;
}

/** Заливает поле там, где точка (в клетках) ближе `half` к ломаной; `noiseAmp` рвёт край */
function rasterStroke(f: Field, path: Polyline, half: number, value: number, noise?: Field, noiseAmp = 0) {
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const wobble = noise ? (noise.get(x, y) - 0.5) * noiseAmp : 0;
      if (distToPolyline((x + 0.5) / SUB, (y + 0.5) / SUB, path) < half + wobble) f.set(x, y, value);
    }
  }
}

function rasterBlob(f: Field, cx: number, cy: number, rx: number, ry: number, noise: Field, value: number) {
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const d = Math.hypot(((x + 0.5) / SUB - cx) / rx, ((y + 0.5) / SUB - cy) / ry);
      if (d + (noise.get(x, y) - 0.5) * 0.5 < 1) f.set(x, y, value);
    }
  }
}

/** Тропа от одной области к другой с 2–3 изгибами */
function trail(rng: Rng, from: Area, to: Area): Polyline {
  const bends = rng.int(2, 3);
  const points: Polyline = [{ x: from.cx, y: from.cy }];
  for (let i = 1; i <= bends; i++) {
    const t = i / (bends + 1);
    points.push({ x: from.cx + (to.cx - from.cx) * t, y: Math.max(2, Math.min(H - 2, from.cy + (to.cy - from.cy) * t + range(rng, -3, 3))) });
  }
  points.push({ x: to.cx, y: to.cy });
  return points;
}

export function generateOutdoorLayout(seed: number, biome: OutdoorBiome): ProcgenLayout {
  const rng = createRng((seed ^ 0x0a7d0000 ^ biome.length * 0x1f1f) >>> 0);
  const ground = new Field(W * SUB, H * SUB, 1);
  const liquid = new Field(W * SUB, H * SUB);
  const edgeNoise = valueNoise(rng, ground.w, ground.h, 10, 3);

  // Побережье: море вдоль верхнего или нижнего края, области — вдоль берега
  const seaTop = rng.next() < 0.5;
  const seaRows = biome === "coastal" ? rng.int(3, 5) : 0;
  const midY = biome === "coastal" ? (seaTop ? (seaRows + H) / 2 : (H - seaRows) / 2) : H / 2;
  const areas: Area[] = [
    { cx: 3.5, cy: midY, rx: 2.5, ry: 2.5 },
    { cx: W - 3.5, cy: midY, rx: 2.5, ry: 2.5 },
  ];
  const flankAreas: Area[] =
    biome === "coastal"
      ? [{ cx: W / 2, cy: seaTop ? H - 2.5 : 2.5, rx: 3, ry: 1.5 }]
      : [
          { cx: W / 2, cy: 2.5, rx: 3, ry: 1.5 },
          { cx: W / 2, cy: H - 2.5, rx: 3, ry: 1.5 },
        ];
  const path = trail(rng, areas[0], areas[1]);

  if (biome === "coastal") {
    for (let y = 0; y < liquid.h; y++) {
      for (let x = 0; x < liquid.w; x++) {
        const row = (y + 0.5) / SUB;
        const shore = seaRows + (edgeNoise.get(x, y) - 0.5) * 1.5;
        if (seaTop ? row < shore : row > H - shore) liquid.set(x, y, 1);
      }
    }
  }
  if (biome === "forest" && rng.next() < 0.4) {
    const x0 = range(rng, W / 2 - 3, W / 2 + 3);
    rasterStroke(liquid, [{ x: x0, y: -1 }, { x: x0 + range(rng, -2, 2), y: H / 2 }, { x: x0 + range(rng, -3, 3), y: H + 1 }], 0.5, 1, edgeNoise, 0.3);
  }
  if (biome === "swamp") {
    for (let i = rng.int(4, 8); i > 0; i--) {
      const cx = range(rng, 6, W - 6);
      const cy = range(rng, 2, H - 2);
      rasterBlob(liquid, cx, cy, range(rng, 0.6, 1.3), range(rng, 0.6, 1.3), edgeNoise, 1);
    }
  }
  if (biome === "mountain") {
    // Скальные гряды поперёк карты; тропа пробивает в каждой проход
    for (let i = rng.int(1, 3); i > 0; i--) {
      const x0 = range(rng, 7, W - 7);
      const ridge: Polyline = [
        { x: x0 + range(rng, -2, 2), y: -1 },
        { x: x0 + range(rng, -2, 2), y: H / 2 },
        { x: x0 + range(rng, -2, 2), y: H + 1 },
      ];
      rasterStroke(ground, ridge, range(rng, 0.8, 1.3), 0, edgeNoise, 0.6);
    }
    rasterStroke(ground, path, 1, 1);
  }

  const softGround = blurField(ground, 1);
  const softLiquid = blurField(liquid, 1);
  for (let i = 0; i < liquid.data.length; i++) liquid.data[i] = softLiquid.data[i] * softGround.data[i];

  const decor: Decor[] = [];
  const free = (x: number, y: number, clearance: number) =>
    x > 0.5 && y > 0.5 && x < W - 0.5 && y < H - 0.5 &&
    areas.every((a) => Math.hypot(x - a.cx, y - a.cy) > 2.2) &&
    distToPolyline(x, y, path) > clearance &&
    softGround.get(Math.floor(x * SUB), Math.floor(y * SUB)) > 0.5 &&
    liquid.get(Math.floor(x * SUB), Math.floor(y * SUB)) < 0.3;
  const scatter = (kind: DecorKind, count: number, rMin: number, rMax: number, around?: { x: number; y: number; spread: number }) => {
    let placed = 0;
    for (let attempt = 0; attempt < count * 30 && placed < count; attempt++) {
      const x = around ? around.x + range(rng, -around.spread, around.spread) : range(rng, 1, W - 1);
      const y = around ? around.y + range(rng, -around.spread, around.spread) : range(rng, 1, H - 1);
      if (!free(x, y, 0.9)) continue;
      decor.push({ kind, x, y, r: range(rng, rMin, rMax) });
      placed++;
    }
  };

  switch (biome) {
    case "forest":
      for (let g = rng.int(3, 5); g > 0; g--) {
        scatter("tree", rng.int(3, 5), 0.35, 0.5, { x: range(rng, 5, W - 5), y: range(rng, 2, H - 2), spread: 2 });
      }
      scatter("bush", rng.int(6, 12), 0.3, 0.45);
      break;
    case "swamp":
      scatter("reed", rng.int(10, 20), 0.25, 0.4);
      scatter("tree", rng.int(3, 6), 0.35, 0.5);
      break;
    case "desert":
      scatter("dune", rng.int(4, 8), 0.5, 0.8);
      scatter("rock", rng.int(3, 6), 0.35, 0.5);
      scatter("cactus", rng.int(3, 6), 0.25, 0.35);
      break;
    case "snow":
      scatter("pine", rng.int(6, 12), 0.35, 0.5);
      scatter("boulder", rng.int(4, 8), 0.25, 0.4);
      scatter("ice", rng.int(4, 8), 0.5, 0.8);
      break;
    case "mountain":
      scatter("boulder", rng.int(6, 10), 0.25, 0.4);
      scatter("rock", rng.int(2, 4), 0.35, 0.5);
      break;
    case "coastal":
      scatter("rock", rng.int(3, 6), 0.35, 0.5);
      scatter("boulder", rng.int(3, 6), 0.25, 0.4);
      break;
  }

  return {
    biome,
    seed,
    width: W,
    height: H,
    ground: softGround,
    liquid,
    decor,
    areas,
    flankAreas,
    paths: [path],
    structures: [],
  };
}
