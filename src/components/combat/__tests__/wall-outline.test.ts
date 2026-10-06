import { describe, it, expect } from "vitest";
import { wallOutlineSegments } from "../wall-outline";
import type { MapElement } from "@/lib/combat/types";

const wall = (x: number, y: number, width = 1, height = 1): MapElement => ({
  id: `w-${x}-${y}`,
  type: "wall",
  x,
  y,
  width,
  height,
  properties: {},
});

describe("wallOutlineSegments", () => {
  it("стена-столбец у края карты — одна линия по границе с полом", () => {
    expect(wallOutlineSegments([wall(0, 0, 1, 3)], 3, 3)).toEqual([{ x1: 1, y1: 0, x2: 1, y2: 3 }]);
  });

  it("стена, разбитая на куски, обводится так же, как цельная", () => {
    expect(wallOutlineSegments([wall(0, 0), wall(0, 1), wall(0, 2)], 3, 3)).toEqual([{ x1: 1, y1: 0, x2: 1, y2: 3 }]);
  });

  it("вся карта — стена: внутри скалы линий нет", () => {
    expect(wallOutlineSegments([wall(0, 0, 3, 3)], 3, 3)).toEqual([]);
  });

  it("одиночная стена посередине — четыре стороны", () => {
    const segs = wallOutlineSegments([wall(1, 1)], 3, 3);
    expect(segs).toHaveLength(4);
    expect(segs).toEqual(
      expect.arrayContaining([
        { x1: 1, y1: 1, x2: 2, y2: 1 },
        { x1: 1, y1: 2, x2: 2, y2: 2 },
        { x1: 1, y1: 1, x2: 1, y2: 2 },
        { x1: 2, y1: 1, x2: 2, y2: 2 },
      ])
    );
  });

  it("не-стены не обводятся", () => {
    expect(wallOutlineSegments([{ ...wall(1, 1), type: "cover" }], 3, 3)).toEqual([]);
  });
});
