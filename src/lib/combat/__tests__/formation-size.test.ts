import { describe, it, expect } from "vitest";
import { planFormation, FORMATIONS, type FormationInput } from "../formation";

const W = 24;
const H = 16;

const foot = (x: number, y: number, size: number) => {
  const cells: string[] = [];
  for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) cells.push(`${x + dx},${y + dy}`);
  return cells;
};

function base(formation: FormationInput["formation"], enemies: FormationInput["enemies"], blocked: string[] = []): FormationInput {
  return {
    formation,
    width: W,
    height: H,
    blocked: new Set(blocked),
    cover: new Set(),
    heroes: [
      { id: "h1", x: 2, y: 7, size: 1 },
      { id: "h2", x: 2, y: 8, size: 1 },
      { id: "h3", x: 2, y: 9, size: 1 },
    ],
    enemies,
  };
}

describe("расстановка учитывает размер существ", () => {
  const enemies = [
    { id: "boss", x: 20, y: 4, size: 3 },
    { id: "horse1", x: 20, y: 8, size: 2 },
    { id: "horse2", x: 20, y: 10, size: 2 },
    { id: "rat1", x: 21, y: 12, size: 1 },
    { id: "rat2", x: 21, y: 13, size: 1 },
  ];
  // Колонна из стен посреди карты и вода сбоку: крупным нужно обходить
  const blocked = [...Array.from({ length: 5 }, (_, i) => `12,${6 + i}`), "10,3", "10,4", "9,3", "9,4"];

  for (const formation of FORMATIONS.filter((f) => f !== "standard")) {
    it(`${formation}: тела не пересекаются, не на стенах и не за краем карты`, () => {
      const inp = base(formation, enemies, blocked);
      const plan = planFormation(inp);
      const taken = new Map<string, string>();
      const all = [...inp.heroes, ...inp.enemies];
      for (const f of all) {
        const spot = plan.positions.get(f.id) ?? { x: f.x, y: f.y };
        for (const k of foot(spot.x, spot.y, f.size ?? 1)) {
          const [x, y] = k.split(",").map(Number);
          expect(x >= 0 && y >= 0 && x < W && y < H, `${f.id} в границах`).toBe(true);
          expect(inp.blocked.has(k), `${f.id} не на стене (${k})`).toBe(false);
          expect(taken.get(k), `${f.id} не пересекается с ${taken.get(k)} (${k})`).toBeUndefined();
          taken.set(k, f.id);
        }
      }
    });
  }

  it("close: враги вплотную, даже когда у героев на краю карты мало места", () => {
    const inp = base("close", Array.from({ length: 10 }, (_, i) => ({ id: `e${i}`, x: 20, y: 2 + i, size: 1 })));
    inp.heroes = [
      { id: "h1", x: 1, y: 3, size: 1 },
      { id: "h2", x: 1, y: 4, size: 1 },
      { id: "h3", x: 1, y: 5, size: 1 },
    ];
    const plan = planFormation(inp);
    for (const e of inp.enemies) {
      const s = plan.positions.get(e.id)!;
      expect(s, `${e.id} расставлен`).toBeDefined();
      const gap = Math.min(...inp.heroes.map((h) => Math.max(Math.abs(s.x - h.x), Math.abs(s.y - h.y))));
      expect(gap).toBeLessThanOrEqual(4);
    }
  });

  it("ambush: засадники в той же части карты, что и герои, а не за глухой стеной", () => {
    // Сплошная стена по x=11: герои в центре справа от неё
    const wall = Array.from({ length: H }, (_, y) => `11,${y}`);
    const inp = base("ambush", [
      { id: "a", x: 20, y: 3, size: 1 },
      { id: "b", x: 20, y: 6, size: 1 },
      { id: "c", x: 20, y: 9, size: 1 },
      { id: "d", x: 20, y: 12, size: 1 },
    ], wall);
    inp.heroes = [{ id: "h1", x: 13, y: 8, size: 1 }, { id: "h2", x: 13, y: 9, size: 1 }];
    const plan = planFormation(inp);
    for (const e of inp.enemies) expect(plan.positions.get(e.id)!.x).toBeGreaterThan(11);
  });
});
