import { describe, it, expect } from "vitest";
import { generateProcgenMap, parseProcgenUrl, GENERATORS } from "../index";
import type { ProcgenBiome } from "../layout";
import type { TacticalMapPreset } from "../../maps/types";

/** Биомы со своими генераторами — пополняется по мере появления генераторов */
export const BIOMES_UNDER_TEST: ProcgenBiome[] = ["lava", "dungeon", "tavern", "forest", "swamp", "desert", "snow", "mountain", "coastal"];

const W = 24;
const H = 16;
const BLOCKING = new Set(["wall", "obstacle"]);

function kindGrid(map: TacticalMapPreset): string[][] {
  const grid = Array.from({ length: H }, () => Array<string>(W).fill("floor"));
  for (const el of map.elements) {
    for (let dy = 0; dy < el.height; dy++) for (let dx = 0; dx < el.width; dx++) grid[el.y + dy][el.x + dx] = el.type;
  }
  return grid;
}

function distancesFrom(grid: string[][], starts: { x: number; y: number }[]): Map<string, number> {
  const dist = new Map<string, number>(starts.map((c) => [`${c.x},${c.y}`, 0]));
  const queue = [...starts];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx;
      const y = c.y + dy;
      const key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= W || y >= H || dist.has(key) || BLOCKING.has(grid[y][x])) continue;
      dist.set(key, dist.get(`${c.x},${c.y}`)! + 1);
      queue.push({ x, y });
    }
  }
  return dist;
}

const zone = (map: TacticalMapPreset, name: string) => map.spawnZones.find((z) => z.name === name)?.cells ?? [];

describe.each(BIOMES_UNDER_TEST)("биом %s", (biome) => {
  it("одно зерно — одна карта своего биома", () => {
    const a = generateProcgenMap(biome, 9);
    const b = generateProcgenMap(biome, 9);
    expect(a.elements).toEqual(b.elements);
    expect(a.spawnZones).toEqual(b.spawnZones);
    expect(parseProcgenUrl(a.backgroundUrl)?.biome).toBe(biome);
  });

  it("на 200 зёрнах: в границах, зоны на полу, все области достижимы, враги и засада не у партии", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateProcgenMap(biome, seed);
      const grid = kindGrid(map);
      const tag = `${biome} seed ${seed}`;
      for (const el of map.elements) {
        expect(el.x >= 0 && el.y >= 0 && el.x + el.width <= W && el.y + el.height <= H, tag).toBe(true);
      }
      const party = zone(map, "party");
      const enemies = [...zone(map, "enemy_frontline"), ...zone(map, "enemy_backline")];
      expect(party.length, tag).toBeGreaterThanOrEqual(8);
      expect(enemies.length, tag).toBeGreaterThanOrEqual(8);
      for (const z of map.spawnZones) for (const c of z.cells) expect(grid[c.y][c.x], `${tag} ${z.name}`).toBe("floor");

      const dist = distancesFrom(grid, party);
      const enemyKeys = new Set(enemies.map((c) => `${c.x},${c.y}`));
      expect(Math.min(...enemies.map((c) => dist.get(`${c.x},${c.y}`) ?? Infinity)), tag).toBeGreaterThanOrEqual(8);
      for (const c of zone(map, "ambush_flank")) {
        expect(dist.get(`${c.x},${c.y}`)!, tag).toBeGreaterThanOrEqual(4);
        expect(enemyKeys.has(`${c.x},${c.y}`), tag).toBe(false);
      }

      const layout = GENERATORS[biome]!(parseProcgenUrl(map.backgroundUrl)!.seed);
      for (const area of layout.areas) {
        let best = "";
        let bestD = Infinity;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const d = Math.hypot(x + 0.5 - area.cx, y + 0.5 - area.cy);
            if (!BLOCKING.has(grid[y][x]) && d < bestD) [best, bestD] = [`${x},${y}`, d];
          }
        }
        expect(dist.has(best), `${tag}: область (${area.cx.toFixed(1)}, ${area.cy.toFixed(1)}) отрезана`).toBe(true);
      }
    }
  }, 180000);
});
