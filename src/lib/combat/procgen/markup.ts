// Разметка процедурной карты по клеткам: что в каждой клетке — пол, скала, вода,
// укрытие или трудная местность. Считается из тех же полей, по которым рисуется арт,
// поэтому совпадает с картинкой клетка в клетку.

import type { MapElement } from "../types";
import type { CaveLayout } from "./cave";
import { SUB } from "./field";

export type CellKind = "floor" | "wall" | "water" | "cover" | "difficult";

/** Доля пола в клетке, ниже которой клетка — скала */
const WALL_BELOW_FLOOR = 0.5;
/** Доля воды в клетке, начиная с которой клетка — вода */
const WATER_FROM = 0.35;

function cellMean(data: Float32Array, fieldW: number, cx: number, cy: number): number {
  let sum = 0;
  for (let y = cy * SUB; y < (cy + 1) * SUB; y++) {
    for (let x = cx * SUB; x < (cx + 1) * SUB; x++) sum += data[y * fieldW + x];
  }
  return sum / (SUB * SUB);
}

/**
 * Проходы на картинке непрерывны, но диагональный проход по долям клеток может распасться
 * на клетки, касающиеся только углом, а срезать углы движок не даёт. Поэтому клетки вдоль
 * оси каждого прохода становятся полом, а на диагональных шагах добавляется клетка-связка
 * (та из двух, где пола больше).
 */
function carvePassages(layout: CaveLayout, cells: CellKind[][]): void {
  const open = (x: number, y: number) => {
    if (cells[y]?.[x] === "wall") cells[y][x] = "floor";
  };
  for (const p of layout.passages) {
    let prev: { x: number; y: number } | null = null;
    for (let s = 0; s < p.points.length - 1; s++) {
      const a = p.points[s];
      const b = p.points[s + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 10));
      for (let i = 0; i <= steps; i++) {
        const cx = Math.floor(a.x + ((b.x - a.x) * i) / steps);
        const cy = Math.floor(a.y + ((b.y - a.y) * i) / steps);
        if (prev && prev.x !== cx && prev.y !== cy) {
          const viaX = cellMean(layout.floor.data, layout.floor.w, cx, prev.y);
          const viaY = cellMean(layout.floor.data, layout.floor.w, prev.x, cy);
          if (viaX >= viaY) open(cx, prev.y);
          else open(prev.x, cy);
        }
        open(cx, cy);
        prev = { x: cx, y: cy };
      }
    }
  }
}

/** Сетка `[y][x]`: стена и вода важнее декора, укрытие важнее щебня */
export function classifyCells(layout: CaveLayout): CellKind[][] {
  const cells: CellKind[][] = [];
  for (let cy = 0; cy < layout.height; cy++) {
    const row: CellKind[] = [];
    for (let cx = 0; cx < layout.width; cx++) {
      if (cellMean(layout.floor.data, layout.floor.w, cx, cy) < WALL_BELOW_FLOOR) row.push("wall");
      else if (cellMean(layout.water.data, layout.water.w, cx, cy) >= WATER_FROM) row.push("water");
      else row.push("floor");
    }
    cells.push(row);
  }
  carvePassages(layout, cells);
  for (const d of layout.decor) {
    const cx = Math.floor(d.x);
    const cy = Math.floor(d.y);
    const current = cells[cy]?.[cx];
    if (current === undefined || current === "wall" || current === "water") continue;
    if (d.kind === "boulder") cells[cy][cx] = "cover";
    else if (d.kind === "rubble" && current === "floor") cells[cy][cx] = "difficult";
  }
  return cells;
}

const PROPERTIES: Record<Exclude<CellKind, "floor">, MapElement["properties"]> = {
  wall: { label: "Скала" },
  water: { label: "Подземное озеро" },
  cover: { label: "Валун", coverBonus: 2 },
  difficult: { label: "Щебень" },
};

/** Склеивает клетки одного типа в прямоугольники: сначала вдоль строки, затем вниз */
export function mergeToElements(cells: CellKind[][]): MapElement[] {
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  const used = cells.map((row) => row.map(() => false));
  const elements: MapElement[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const kind = cells[y][x];
      if (kind === "floor" || used[y][x]) continue;
      let width = 1;
      while (x + width < w && cells[y][x + width] === kind && !used[y][x + width]) width++;
      let height = 1;
      const rowMatches = (yy: number) => {
        for (let xx = x; xx < x + width; xx++) if (cells[yy][xx] !== kind || used[yy][xx]) return false;
        return true;
      };
      while (y + height < h && rowMatches(y + height)) height++;
      for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) used[yy][xx] = true;
      elements.push({ id: `pg-${kind}-${x}-${y}`, type: kind, x, y, width, height, properties: { ...PROPERTIES[kind] } });
    }
  }
  return elements;
}
