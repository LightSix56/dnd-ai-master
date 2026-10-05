// План пещеры по зерну, собранный из заготовленных частей: залы, проходы между ними,
// ниши-тупики, вода и декор. Координаты частей — в клетках сетки; поля пола и воды —
// в субклеточном разрешении (SUB отсчётов на клетку).

import { createRng, type Rng } from "./rng";
import { Field, SUB, blurField, valueNoise } from "./field";

export type ChamberShape = "round" | "long" | "ragged";
export type PassageKind = "narrow" | "wide" | "winding";

export interface Chamber {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  shape: ChamberShape;
}

/**
 * Проход между частями пещеры. Индекс `from`/`to` меньше `chambers.length` — зал,
 * иначе ниша `niches[index - chambers.length]`.
 */
export interface Passage {
  from: number;
  to: number;
  kind: PassageKind;
  points: { x: number; y: number }[];
}

export interface Decor {
  kind: "boulder" | "rubble" | "stalagmite";
  x: number;
  y: number;
  /** Радиус в долях клетки */
  r: number;
}

export interface CaveLayout {
  seed: number;
  width: number;
  height: number;
  chambers: Chamber[];
  passages: Passage[];
  niches: Chamber[];
  /** 1 — пол, 0 — скала, края сглажены */
  floor: Field;
  /** 1 — вода */
  water: Field;
  decor: Decor[];
}

/** Полуширина прохода в клетках */
const HALF_WIDTH: Record<PassageKind, number> = { narrow: 0.5, wide: 1, winding: 0.5 };

const range = (rng: Rng, min: number, max: number) => min + rng.next() * (max - min);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function placeChambers(rng: Rng, width: number, height: number): Chamber[] {
  const count = rng.int(2, 4);
  const halfW = width / 2;
  const halfH = height / 2;
  // Залы разносятся по четвертям карты; при двух залах — по разные стороны
  const quadrants =
    count === 2
      ? rng.next() < 0.5
        ? [[0, 0], [1, 1]]
        : [[0, 1], [1, 0]]
      : shuffle(rng, [[0, 0], [1, 0], [0, 1], [1, 1]]).slice(0, count);

  return quadrants.map(([qx, qy]) => {
    const shape = rng.pick<ChamberShape>(["round", "long", "ragged"]);
    let rx = range(rng, 2.5, 5);
    let ry = range(rng, 2.5, 4.5);
    if (shape === "long") {
      if (rng.next() < 0.5) [rx, ry] = [rx * 1.3, ry * 0.75];
      else [rx, ry] = [rx * 0.75, ry * 1.3];
    }
    rx = Math.min(rx, halfW - 2);
    ry = Math.min(ry, halfH - 2);
    const cx = clamp(qx * halfW + halfW / 2 + range(rng, -1.5, 1.5), 1.5 + rx, width - 1.5 - rx);
    const cy = clamp(qy * halfH + halfH / 2 + range(rng, -1.5, 1.5), 1.5 + ry, height - 1.5 - ry);
    return { cx, cy, rx, ry, shape };
  });
}

/** Точки прохода от a к b: прямой с лёгким изгибом или извилистый */
function passagePoints(rng: Rng, kind: PassageKind, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const inner = kind === "winding" ? rng.int(3, 5) : 1;
  const amp = kind === "winding" ? 1 : 0.5;
  const points = [a];
  for (let i = 1; i <= inner; i++) {
    const t = i / (inner + 1);
    const off = range(rng, -amp, amp);
    points.push({ x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off });
  }
  points.push(b);
  return points;
}

/** Остовное дерево залов (Прим) и, иногда, одно лишнее ребро для кольца */
function connectChambers(rng: Rng, chambers: Chamber[]): Passage[] {
  const dist = (i: number, j: number) => Math.hypot(chambers[i].cx - chambers[j].cx, chambers[i].cy - chambers[j].cy);
  const inTree = new Set([0]);
  const edges: [number, number][] = [];
  while (inTree.size < chambers.length) {
    let best: [number, number] | null = null;
    for (const i of inTree) {
      for (let j = 0; j < chambers.length; j++) {
        if (inTree.has(j)) continue;
        if (!best || dist(i, j) < dist(best[0], best[1])) best = [i, j];
      }
    }
    edges.push(best!);
    inTree.add(best![1]);
  }
  if (chambers.length >= 3 && rng.next() < 0.3) {
    const candidates: [number, number][] = [];
    for (let i = 0; i < chambers.length; i++) {
      for (let j = i + 1; j < chambers.length; j++) {
        if (!edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) candidates.push([i, j]);
      }
    }
    if (candidates.length > 0) edges.push(rng.pick(candidates));
  }
  return edges.map(([from, to]) => {
    const kind = rng.pick<PassageKind>(["narrow", "wide", "winding"]);
    const a = { x: chambers[from].cx, y: chambers[from].cy };
    const b = { x: chambers[to].cx, y: chambers[to].cy };
    return { from, to, kind, points: passagePoints(rng, kind, a, b) };
  });
}

function addNiches(rng: Rng, chambers: Chamber[], passages: Passage[], width: number, height: number) {
  const niches: Chamber[] = [];
  const connectors: Passage[] = [];
  const count = rng.int(0, 2);
  for (let n = 0; n < count; n++) {
    const p = rng.pick(passages);
    const seg = rng.int(0, p.points.length - 2);
    const t = range(rng, 0.3, 0.7);
    const a = p.points[seg];
    const b = p.points[seg + 1];
    const base = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const side = rng.next() < 0.5 ? 1 : -1;
    const away = range(rng, 2.5, 3.5);
    const rx = range(rng, 1.5, 2.5);
    const ry = range(rng, 1.5, 2.5);
    const cx = clamp(base.x + (-(b.y - a.y) / len) * away * side, 1.5 + rx, width - 1.5 - rx);
    const cy = clamp(base.y + ((b.x - a.x) / len) * away * side, 1.5 + ry, height - 1.5 - ry);
    niches.push({ cx, cy, rx, ry, shape: "round" });
    connectors.push({
      from: p.from,
      to: chambers.length + niches.length - 1,
      kind: "narrow",
      points: [base, { x: cx, y: cy }],
    });
  }
  return { niches, connectors };
}

/** Гармоники для неровного края зала: свои фазы у каждого зала */
function edgeWobble(rng: Rng, amp: number) {
  const phases = [2, 3, 4, 5].map((k) => ({ k, phase: range(rng, 0, Math.PI * 2) }));
  return (angle: number) => 1 + amp * phases.reduce((s, { k, phase }) => s + Math.sin(k * angle + phase) / k, 0);
}

function distToSegment(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - a.x) * dx + (py - a.y) * dy) / l2, 0, 1);
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}

function rasterRooms(rng: Rng, target: Field, rooms: Chamber[]) {
  for (const room of rooms) {
    const wobble = edgeWobble(rng, room.shape === "ragged" ? 0.35 : 0.15);
    for (let y = 0; y < target.h; y++) {
      const py = (y + 0.5) / SUB;
      for (let x = 0; x < target.w; x++) {
        const px = (x + 0.5) / SUB;
        const ux = (px - room.cx) / room.rx;
        const uy = (py - room.cy) / room.ry;
        if (Math.hypot(ux, uy) < wobble(Math.atan2(uy, ux))) target.set(x, y, 1);
      }
    }
  }
}

function rasterPassages(target: Field, passages: Passage[], widthScale: number) {
  for (const p of passages) {
    const half = HALF_WIDTH[p.kind] * widthScale;
    for (let s = 0; s < p.points.length - 1; s++) {
      const a = p.points[s];
      const b = p.points[s + 1];
      const x0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - half - 1) * SUB));
      const x1 = Math.min(target.w - 1, Math.ceil((Math.max(a.x, b.x) + half + 1) * SUB));
      const y0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - half - 1) * SUB));
      const y1 = Math.min(target.h - 1, Math.ceil((Math.max(a.y, b.y) + half + 1) * SUB));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (distToSegment((x + 0.5) / SUB, (y + 0.5) / SUB, a, b) < half) target.set(x, y, 1);
        }
      }
    }
  }
}

function buildFloor(rng: Rng, width: number, height: number, rooms: Chamber[], passages: Passage[]): Field {
  const fw = width * SUB;
  const fh = height * SUB;
  const plan = new Field(fw, fh);
  rasterRooms(rng, plan, rooms);
  rasterPassages(plan, passages, 1);

  // Рваные края: размытие плана + шум, порог
  const blurred = blurField(plan, SUB * 0.6);
  const noise = valueNoise(rng, fw, fh, 10, 3);
  const hard = new Field(fw, fh);
  for (let i = 0; i < hard.data.length; i++) {
    hard.data[i] = blurred.data[i] + (noise.data[i] - 0.5) * 0.5 > 0.5 ? 1 : 0;
  }
  // Сердцевина проходов остаётся открытой, иначе шум может перекрыть узкий проход
  const core = new Field(fw, fh);
  rasterPassages(core, passages, 0.9);
  for (let i = 0; i < hard.data.length; i++) hard.data[i] = Math.max(hard.data[i], core.data[i]);
  // Рамка в одну клетку по краю карты — всегда скала
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (x < SUB || y < SUB || x >= fw - SUB || y >= fh - SUB) hard.set(x, y, 0);
    }
  }
  return blurField(hard, 1);
}

function buildWater(rng: Rng, chambers: Chamber[], floor: Field): Field {
  const water = new Field(floor.w, floor.h);
  if (chambers.length < 2 || rng.next() >= 0.6) return water;
  const host = chambers[rng.int(1, chambers.length - 1)];
  const pool: Chamber = {
    cx: host.cx + range(rng, -0.4, 0.4) * host.rx,
    cy: host.cy + range(rng, -0.4, 0.4) * host.ry,
    rx: range(rng, 1.5, 2.5) / 2,
    ry: range(rng, 1.5, 2.5) / 2,
    shape: "round",
  };
  rasterRooms(rng, water, [pool]);
  const soft = blurField(water, 2);
  for (let i = 0; i < water.data.length; i++) {
    water.data[i] = soft.data[i] > 0.5 && floor.data[i] > 0.5 ? 1 : 0;
  }
  return blurField(water, 1);
}

function placeDecor(rng: Rng, layout: Omit<CaveLayout, "decor">): Decor[] {
  const decor: Decor[] = [];
  const at = (f: Field, x: number, y: number) =>
    f.get(clamp(Math.floor(x * SUB), 0, f.w - 1), clamp(Math.floor(y * SUB), 0, f.h - 1));
  const open = (x: number, y: number) => at(layout.floor, x, y) > 0.5 && at(layout.water, x, y) < 0.5;

  const scatter = (kind: Decor["kind"], count: number, rMin: number, rMax: number, edgeBias: number) => {
    let placed = 0;
    for (let attempt = 0; attempt < 200 && placed < count; attempt++) {
      const room = rng.pick(layout.chambers);
      const angle = range(rng, 0, Math.PI * 2);
      const d = range(rng, edgeBias, 0.9);
      const x = room.cx + Math.cos(angle) * room.rx * d;
      const y = room.cy + Math.sin(angle) * room.ry * d;
      if (!open(x, y)) continue;
      decor.push({ kind, x, y, r: range(rng, rMin, rMax) });
      placed++;
    }
  };

  scatter("boulder", rng.int(6, 12), 0.25, 0.4, 0.6);
  for (const p of layout.passages) {
    if (p.kind === "wide") continue;
    const pieces = rng.int(6, 10);
    for (let i = 0; i < pieces; i++) {
      const seg = rng.int(0, p.points.length - 2);
      const t = rng.next();
      const a = p.points[seg];
      const b = p.points[seg + 1];
      const x = a.x + (b.x - a.x) * t + range(rng, -0.2, 0.2);
      const y = a.y + (b.y - a.y) * t + range(rng, -0.2, 0.2);
      if (open(x, y)) decor.push({ kind: "rubble", x, y, r: range(rng, 0.05, 0.1) });
    }
  }
  scatter("stalagmite", rng.int(0, 4), 0.15, 0.25, 0.3);
  return decor;
}

export function generateCaveLayout(seed: number, size: { width: number; height: number } = { width: 24, height: 16 }): CaveLayout {
  const { width, height } = size;
  const rng = createRng(seed);
  const chambers = placeChambers(rng, width, height);
  const links = connectChambers(rng, chambers);
  const { niches, connectors } = addNiches(rng, chambers, links, width, height);
  const passages = [...links, ...connectors];
  const floor = buildFloor(rng, width, height, [...chambers, ...niches], passages);
  const water = buildWater(rng, chambers, floor);
  const base = { seed, width, height, chambers, passages, niches, floor, water };
  return { ...base, decor: placeDecor(rng, base) };
}
