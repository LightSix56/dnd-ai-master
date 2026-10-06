import { describe, it, expect } from "vitest";
import { generateProcgenMap, layoutForUrl } from "../index";
import { classifyLayout } from "../classify";

describe("таверна", () => {
  it("на 100 зёрнах: стойка, столы, комнаты, двери-элементы боя в проёмах, окна в стенах", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const map = generateProcgenMap("tavern", seed);
      const layout = layoutForUrl(map.backgroundUrl!)!;
      const cells = classifyLayout(layout);
      const kinds = layout.decor.map((d) => d.kind);
      expect(kinds, `seed ${seed}`).toContain("counter");
      expect(kinds.filter((k) => k === "table").length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      expect(kinds.filter((k) => k === "hearth").length, `seed ${seed}`).toBe(2);

      const doors = map.elements.filter((e) => e.type === "door");
      expect(doors.length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
      for (const d of doors) expect(cells[d.y][d.x], `seed ${seed} дверь`).not.toBe("wall");
      for (const w of layout.decor.filter((d) => d.kind === "window")) expect(cells[w.y][w.x], `seed ${seed} окно`).toBe("wall");

      // Партия входит со двора, враги — в здании
      const inside = (c: { x: number; y: number }) => layout.structures.some((s) => c.x >= s.x && c.x < s.x + s.w && c.y >= s.y && c.y < s.y + s.h);
      expect(map.spawnZones.find((z) => z.name === "party")!.cells.some(inside), `seed ${seed}`).toBe(false);
      expect(map.spawnZones.find((z) => z.name === "enemy_frontline")!.cells.every(inside), `seed ${seed}`).toBe(true);
    }
  }, 60000);
});
