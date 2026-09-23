// Утилиты для сетки
import type { Cell } from "./types";

// Расстояние Чебышева — D&D 5e вариант: диагональ = 1 квадрат
export function distance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// Расстояние в футах (1 квадрат = 5 ft)
export function distanceFt(a: Cell, b: Cell): number {
  return distance(a, b) * 5;
}

export function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

export function parseCellKey(key: string): Cell {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isInBounds(c: Cell, w: number, h: number): boolean {
  return c.x >= 0 && c.x < w && c.y >= 0 && c.y < h;
}

// Соседние клетки (4-направление, как в D&D без диагоналей для простоты)
export function getNeighbors(c: Cell): Cell[] {
  return [
    { x: c.x + 1, y: c.y },
    { x: c.x - 1, y: c.y },
    { x: c.x, y: c.y + 1 },
    { x: c.x, y: c.y - 1 },
  ];
}

// Соседние клетки с диагоналями (8-направление)
export function getNeighbors8(c: Cell): Cell[] {
  const result: Cell[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      result.push({ x: c.x + dx, y: c.y + dy });
    }
  }
  return result;
}
