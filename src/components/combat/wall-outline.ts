// Контур стен на тактическом слое: только рёбра клеток стены, за которыми свободная
// клетка, — одна линия по краю пещеры или здания, а не рамка вокруг каждого куска разметки.

import type { MapElement } from "@/lib/combat/types";

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function wallOutlineSegments(elements: MapElement[], width: number, height: number): Segment[] {
  const wall = new Set<string>();
  for (const el of elements) {
    if (el.type !== "wall") continue;
    for (let y = el.y; y < el.y + el.height; y++) for (let x = el.x; x < el.x + el.width; x++) wall.add(`${x},${y}`);
  }
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const open = (x: number, y: number) => inside(x, y) && !wall.has(`${x},${y}`);

  // Горизонтальные рёбра по линиям y, вертикальные — по линиям x; соседние склеиваются
  const horizontal = new Map<number, number[]>();
  const vertical = new Map<number, number[]>();
  const push = (map: Map<number, number[]>, line: number, at: number) => {
    const list = map.get(line) ?? [];
    list.push(at);
    map.set(line, list);
  };
  for (const key of wall) {
    const [x, y] = key.split(",").map(Number);
    if (open(x, y - 1)) push(horizontal, y, x);
    if (open(x, y + 1)) push(horizontal, y + 1, x);
    if (open(x - 1, y)) push(vertical, x, y);
    if (open(x + 1, y)) push(vertical, x + 1, y);
  }

  const segments: Segment[] = [];
  const merge = (map: Map<number, number[]>, make: (line: number, from: number, to: number) => Segment) => {
    for (const [line, cells] of map) {
      const sorted = [...new Set(cells)].sort((a, b) => a - b);
      let start = sorted[0];
      for (let i = 1; i <= sorted.length; i++) {
        if (i === sorted.length || sorted[i] !== sorted[i - 1] + 1) {
          segments.push(make(line, start, sorted[i - 1] + 1));
          start = sorted[i];
        }
      }
    }
  };
  merge(horizontal, (y, from, to) => ({ x1: from, y1: y, x2: to, y2: y }));
  merge(vertical, (x, from, to) => ({ x1: x, y1: from, x2: x, y2: to }));
  return segments;
}
