// Разметка общего плана карты по клеткам: сплошное → стена, жидкость → вода или лава,
// объекты → свой тип клетки; вдоль проходов клетки прорезаются, чтобы путь не перекрыл
// ни распад диагонали на углы, ни дерево с колонной на оси коридора.

import { DECOR_CELL, LIQUID } from "./biomes";
import { cellMean, WALL_BELOW_FLOOR, WATER_FROM, type CellKind } from "./markup";
import type { ProcgenLayout } from "./layout";

/** Чем «сильнее» тип объекта, тем он важнее при наложении */
const RANK: Partial<Record<CellKind, number>> = { difficult: 1, cover: 2, obstacle: 3 };

export function classifyLayout(layout: ProcgenLayout): CellKind[][] {
  const { width, height, ground, liquid } = layout;
  const liquidKind = LIQUID[layout.biome];
  const cells: CellKind[][] = [];
  for (let cy = 0; cy < height; cy++) {
    const row: CellKind[] = [];
    for (let cx = 0; cx < width; cx++) {
      if (cellMean(ground.data, ground.w, cx, cy) < WALL_BELOW_FLOOR) row.push("wall");
      else if (cellMean(liquid.data, liquid.w, cx, cy) >= WATER_FROM) row.push(liquidKind);
      else row.push("floor");
    }
    cells.push(row);
  }

  for (const d of layout.decor) {
    const kind = DECOR_CELL[d.kind];
    if (!kind) continue;
    const x0 = Math.floor(d.x);
    const y0 = Math.floor(d.y);
    for (let y = y0; y < y0 + (d.h ?? 1); y++) {
      for (let x = x0; x < x0 + (d.w ?? 1); x++) {
        const current = cells[y]?.[x];
        if (current === undefined || current === "wall" || current === "water" || current === "lava") continue;
        if ((RANK[kind] ?? 0) > (RANK[current] ?? 0)) cells[y][x] = kind;
      }
    }
  }

  carvePaths(layout, cells);
  return cells;
}

const BLOCKING = new Set<CellKind>(["wall", "obstacle", "cover"]);

function carvePaths(layout: ProcgenLayout, cells: CellKind[][]): void {
  const open = (x: number, y: number) => {
    const current = cells[y]?.[x];
    if (current !== undefined && BLOCKING.has(current)) cells[y][x] = "floor";
  };
  for (const path of layout.paths) {
    let prev: { x: number; y: number } | null = null;
    for (let s = 0; s < path.length - 1; s++) {
      const a = path[s];
      const b = path[s + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 10));
      for (let i = 0; i <= steps; i++) {
        const cx = Math.floor(a.x + ((b.x - a.x) * i) / steps);
        const cy = Math.floor(a.y + ((b.y - a.y) * i) / steps);
        if (prev && prev.x !== cx && prev.y !== cy) {
          // Диагональный шаг: связка через клетку, где больше земли
          const viaX = cellMean(layout.ground.data, layout.ground.w, cx, prev.y);
          const viaY = cellMean(layout.ground.data, layout.ground.w, prev.x, cy);
          if (viaX >= viaY) open(cx, prev.y);
          else open(prev.x, cy);
        }
        open(cx, cy);
        prev = { x: cx, y: cy };
      }
    }
  }
}
