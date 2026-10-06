// Подземелье: прямоугольные комнаты, соединённые коридорами; колонны, ящики, бочки, обломки.

import { createRng, type Rng } from "./rng";
import { Field, SUB } from "./field";
import type { Area, Decor, Polyline, ProcgenLayout } from "./layout";

const W = 24;
const H = 16;

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

const center = (r: Room) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) });

function placeRooms(rng: Rng): Room[] {
  const target = rng.int(4, 7);
  const rooms: Room[] = [];
  for (let attempt = 0; attempt < 300 && rooms.length < target; attempt++) {
    const w = rng.int(3, 7);
    const h = rng.int(3, 6);
    const x = rng.int(1, W - 1 - w);
    const y = rng.int(1, H - 1 - h);
    // Между комнатами — хотя бы одна клетка стены
    const clash = rooms.some((o) => x < o.x + o.w + 1 && x + w + 1 > o.x && y < o.y + o.h + 1 && y + h + 1 > o.y);
    if (!clash) rooms.push({ x, y, w, h });
  }
  return rooms;
}

/** Рёбра остовного дерева по расстоянию между центрами (Прим) и, иногда, одно лишнее */
function connect(rng: Rng, rooms: Room[]): [number, number][] {
  const dist = (i: number, j: number) => Math.hypot(center(rooms[i]).x - center(rooms[j]).x, center(rooms[i]).y - center(rooms[j]).y);
  const inTree = new Set([0]);
  const edges: [number, number][] = [];
  while (inTree.size < rooms.length) {
    let best: [number, number] | null = null;
    for (const i of inTree) {
      for (let j = 0; j < rooms.length; j++) {
        if (!inTree.has(j) && (!best || dist(i, j) < dist(best[0], best[1]))) best = [i, j];
      }
    }
    edges.push(best!);
    inTree.add(best![1]);
  }
  if (rooms.length >= 3 && rng.next() < 0.3) {
    const i = rng.int(0, rooms.length - 1);
    const j = (i + rng.int(1, rooms.length - 1)) % rooms.length;
    if (!edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) edges.push([i, j]);
  }
  return edges;
}

/** Г-образный коридор между центрами комнат, в координатах центров клеток */
function corridor(rng: Rng, a: Room, b: Room): Polyline {
  const p = center(a);
  const q = center(b);
  const corner = rng.next() < 0.5 ? { x: q.x, y: p.y } : { x: p.x, y: q.y };
  return [p, corner, q].map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }));
}

function carveCells(open: boolean[][], path: Polyline, wide: boolean) {
  for (let s = 0; s < path.length - 1; s++) {
    const a = path[s];
    const b = path[s + 1];
    const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let i = 0; i <= steps; i++) {
      const x = Math.floor(a.x + ((b.x - a.x) * i) / steps);
      const y = Math.floor(a.y + ((b.y - a.y) * i) / steps);
      open[y][x] = true;
      if (wide) {
        if (a.y === b.y && y + 1 < H - 1) open[y + 1][x] = true;
        if (a.x === b.x && x + 1 < W - 1) open[y][x + 1] = true;
      }
    }
  }
}

/** Клетка у стены комнаты (внутри) — для ящиков, бочек, стойки */
function besideWall(rng: Rng, r: Room): { x: number; y: number } {
  switch (rng.int(0, 3)) {
    case 0:
      return { x: r.x + rng.int(0, r.w - 1), y: r.y };
    case 1:
      return { x: r.x + rng.int(0, r.w - 1), y: r.y + r.h - 1 };
    case 2:
      return { x: r.x, y: r.y + rng.int(0, r.h - 1) };
    default:
      return { x: r.x + r.w - 1, y: r.y + rng.int(0, r.h - 1) };
  }
}

function dungeonDecor(rng: Rng, rooms: Room[]): Decor[] {
  const decor: Decor[] = [];
  for (const r of rooms) {
    if (r.w >= 5 && r.h >= 5) {
      for (const [x, y] of [[r.x + 1, r.y + 1], [r.x + r.w - 2, r.y + 1], [r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]]) {
        decor.push({ kind: "column", x: x + 0.5, y: y + 0.5, r: 0.35 });
      }
    }
  }
  for (let i = rng.int(3, 6); i > 0; i--) {
    const c = besideWall(rng, rng.pick(rooms));
    decor.push({ kind: rng.next() < 0.5 ? "crate" : "barrel", x: c.x + 0.5, y: c.y + 0.5, r: 0.35 });
  }
  for (let i = rng.int(4, 8); i > 0; i--) {
    const r = rng.pick(rooms);
    decor.push({ kind: "rubble", x: r.x + rng.next() * r.w, y: r.y + rng.next() * r.h, r: 0.08 });
  }
  return decor;
}

export function generateDungeonLayout(seed: number): ProcgenLayout {
  const rng = createRng((seed ^ 0x0d0e0001) >>> 0);
  const rooms = placeRooms(rng);
  const edges = connect(rng, rooms);

  const open = Array.from({ length: H }, () => Array<boolean>(W).fill(false));
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) open[y][x] = true;
  const paths: Polyline[] = [];
  for (const [i, j] of edges) {
    const path = corridor(rng, rooms[i], rooms[j]);
    carveCells(open, path, rng.next() < 0.3);
    paths.push(path);
  }

  const ground = new Field(W * SUB, H * SUB);
  for (let y = 0; y < ground.h; y++) {
    for (let x = 0; x < ground.w; x++) if (open[Math.floor(y / SUB)][Math.floor(x / SUB)]) ground.set(x, y, 1);
  }

  const degree = rooms.map((_, i) => edges.filter(([a, b]) => a === i || b === i).length);
  const asArea = (r: Room): Area => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, rx: r.w / 2, ry: r.h / 2 });
  return {
    biome: "dungeon",
    seed,
    width: W,
    height: H,
    ground,
    liquid: new Field(W * SUB, H * SUB),
    decor: dungeonDecor(rng, rooms),
    areas: rooms.map(asArea),
    flankAreas: rooms.filter((_, i) => degree[i] === 1).map(asArea),
    paths,
    structures: rooms,
  };
}
