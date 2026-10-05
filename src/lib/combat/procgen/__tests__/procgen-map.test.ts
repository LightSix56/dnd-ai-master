import { describe, it, expect } from "vitest";
import { generateProcgenMap, parseProcgenUrl, formatProcgenUrl } from "../index";
import { classifyCells, mergeToElements, type CellKind } from "../markup";
import { generateCaveLayout } from "../cave";
import type { TacticalMapPreset } from "../../maps/types";

const W = 24;
const H = 16;

function kindGrid(map: TacticalMapPreset): string[][] {
  const grid = Array.from({ length: H }, () => Array<string>(W).fill("floor"));
  for (const el of map.elements) {
    for (let dy = 0; dy < el.height; dy++) {
      for (let dx = 0; dx < el.width; dx++) grid[el.y + dy][el.x + dx] = el.type;
    }
  }
  return grid;
}

function reachable(grid: string[][], from: { x: number; y: number }): Set<string> {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [from];
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx;
      const y = c.y + dy;
      const key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= W || y >= H || seen.has(key) || grid[y][x] === "wall") continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}

const zone = (map: TacticalMapPreset, name: string) => map.spawnZones.find((z) => z.name === name)?.cells ?? [];

describe("generateProcgenMap", () => {
  it("одно зерно — одна карта, фон — ссылка procgen", () => {
    const a = generateProcgenMap("forest_ambush", 7);
    const b = generateProcgenMap("forest_ambush", 7);
    expect(a.elements).toEqual(b.elements);
    expect(a.spawnZones).toEqual(b.spawnZones);
    const parsed = parseProcgenUrl(a.backgroundUrl);
    expect(parsed?.biome).toBe("cave");
    expect(parsed!.seed).toBeGreaterThanOrEqual(7);
  });

  it("на 200 зёрнах карта проходима, зоны на полу и достаточно велики", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateProcgenMap("cave", seed);
      const grid = kindGrid(map);
      for (const el of map.elements) {
        expect(el.x >= 0 && el.y >= 0 && el.x + el.width <= W && el.y + el.height <= H, `seed ${seed}`).toBe(true);
      }
      const party = zone(map, "party");
      const enemies = [...zone(map, "enemy_frontline"), ...zone(map, "enemy_backline")];
      expect(party.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
      expect(enemies.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
      for (const z of map.spawnZones) {
        for (const c of z.cells) expect(["wall", "water"], `seed ${seed} ${z.name}`).not.toContain(grid[c.y][c.x]);
      }
      const fromParty = reachable(grid, party[0]);
      expect(zone(map, "enemy_frontline").some((c) => fromParty.has(`${c.x},${c.y}`)), `seed ${seed}`).toBe(true);
    }
  });

  it("встречается узкое место в одну клетку между стенами", () => {
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      const layout = generateCaveLayout(seed);
      const cells = classifyCells(layout);
      const rooms = [...layout.chambers, ...layout.niches];
      const insideRoom = (x: number, y: number) =>
        rooms.some((r) => Math.hypot((x - r.cx) / r.rx, (y - r.cy) / r.ry) < 1.3);
      for (const p of layout.passages.filter((p) => p.kind === "narrow")) {
        for (let s = 0; s < p.points.length - 1 && !found; s++) {
          const a = p.points[s];
          const b = p.points[s + 1];
          const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
          for (let t = 0; t <= 1 && !found; t += 0.1) {
            const x = a.x + (b.x - a.x) * t;
            const y = a.y + (b.y - a.y) * t;
            if (insideRoom(x, y)) continue;
            const cx = Math.floor(x);
            const cy = Math.floor(y);
            if (cx < 1 || cy < 1 || cx > W - 2 || cy > H - 2 || cells[cy][cx] === "wall") continue;
            const sides: CellKind[] = horizontal ? [cells[cy - 1][cx], cells[cy + 1][cx]] : [cells[cy][cx - 1], cells[cy][cx + 1]];
            found = sides.every((k) => k === "wall");
          }
        }
      }
    }
    expect(found).toBe(true);
  });
});

describe("mergeToElements", () => {
  it("склеивает клетки одного типа в прямоугольник", () => {
    const els = mergeToElements([
      ["wall", "wall", "floor"],
      ["wall", "wall", "floor"],
    ]);
    expect(els).toHaveLength(1);
    expect(els[0]).toMatchObject({ type: "wall", x: 0, y: 0, width: 2, height: 2 });
  });
});

describe("procgen-ссылки", () => {
  it("разбирает свою ссылку и отвергает чужие", () => {
    expect(formatProcgenUrl(12)).toBe("procgen:cave?seed=12&v=1");
    expect(parseProcgenUrl("procgen:cave?seed=12&v=1")).toEqual({ biome: "cave", seed: 12, version: 1 });
    for (const bad of ["procgen:cave?v=1", "procgen:forest?seed=1&v=1", "procgen:cave?seed=1&v=2", "/maps/cave.jpg", undefined, null, ""]) {
      expect(parseProcgenUrl(bad as string | undefined)).toBeNull();
    }
  });
});
