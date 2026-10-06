import { describe, it, expect } from "vitest";
import { resolveProcgenBiome, PROCGEN_BIOMES } from "../biomes";
import { formatProcgenUrl, parseProcgenUrl } from "../index";
import { classifyLayout, clearPathObstacles } from "../classify";
import { buildAreaZones } from "../areas";
import { Field, SUB } from "../field";
import type { ProcgenLayout, Decor } from "../layout";

function plan(width: number, height: number, extra: Partial<ProcgenLayout> = {}): ProcgenLayout {
  return {
    biome: "forest",
    seed: 1,
    width,
    height,
    ground: new Field(width * SUB, height * SUB, 1),
    liquid: new Field(width * SUB, height * SUB, 0),
    decor: [],
    areas: [],
    flankAreas: [],
    paths: [],
    structures: [],
    ...extra,
  };
}

function fillCell(f: Field, cx: number, cy: number, v: number) {
  for (let y = cy * SUB; y < (cy + 1) * SUB; y++) for (let x = cx * SUB; x < (cx + 1) * SUB; x++) f.set(x, y, v);
}

describe("resolveProcgenBiome", () => {
  it.each([
    ["forest_ambush", "forest"],
    [" Forest ", "forest"],
    ["city_street", "urban"],
    ["lava_cave", "lava"],
    ["dungeon_prison", "dungeon"],
    ["ship", "coastal"],
    ["tavern", "tavern"],
    ["swamp_bog", "swamp"],
    ["desert_dunes", "desert"],
    ["snowy_mountain", "snow"],
    ["mountain", "mountain"],
    ["?", "cave"],
    [undefined, "cave"],
  ])("%s → %s", (name, expected) => {
    expect(resolveProcgenBiome(name as string | undefined)).toBe(expected);
  });
});

describe("resolveProcgenBiome: свободные описания мастера", () => {
  it.each([
    ["ice cave", "cave"],
    ["sea cave", "cave"],
    ["mountain cave", "cave"],
    ["forest cave", "cave"],
    ["lava cave", "lava"],
    ["road", "forest"],
    ["plains", "forest"],
    ["grassland", "forest"],
    ["river crossing", "forest"],
    ["countryside", "forest"],
    ["лес", "forest"],
    ["город", "urban"],
    ["пещера", "cave"],
    ["болото", "swamp"],
    ["пустыня", "desert"],
    ["таверна", "tavern"],
    ["подземелье", "dungeon"],
    ["горы", "mountain"],
    ["побережье", "coastal"],
    ["снежная равнина", "snow"],
    ["лава", "lava"],
    ["mine_tracks", "cave"],
    ["snowy_mountain", "snow"],
  ])("%s → %s", (name, expected) => {
    expect(resolveProcgenBiome(name)).toBe(expected);
  });

  it.each([
    ["police office", "snow"],
    ["justice hall", "snow"],
    ["research lab", "coastal"],
    ["dice den", "snow"],
    ["inner sanctum", "tavern"],
    ["secret passage", "mountain"],
    ["astral portal", "coastal"],
    ["garden fence", "swamp"],
    ["лавка торговца", "lava"],
    ["морозный перевал", "coastal"],
  ])("«%s» не попадает в %s по куску слова", (name, wrong) => {
    expect(resolveProcgenBiome(name)).not.toBe(wrong);
  });
});

describe("procgen-ссылки всех биомов", () => {
  it("ссылка разбирается обратно для каждого биома", () => {
    for (const biome of PROCGEN_BIOMES) {
      expect(parseProcgenUrl(formatProcgenUrl(5, biome))).toEqual({ biome, seed: 5, version: 1 });
    }
    expect(formatProcgenUrl(5)).toBe("procgen:cave?seed=5&v=1");
    expect(parseProcgenUrl("procgen:volcano?seed=1&v=1")).toBeNull();
  });
});

describe("classifyLayout", () => {
  it("декор и жидкость дают свои типы клеток, препятствие с оси пути убирается из плана", () => {
    const decor: Decor[] = [
      { kind: "table", x: 1, y: 1, r: 0.4, w: 2, h: 1 },
      { kind: "tree", x: 4.5, y: 1.5, r: 0.4 },
      { kind: "rock", x: 3.5, y: 2.5, r: 0.4 },
    ];
    const lava = plan(6, 4, { biome: "lava", decor, paths: [[{ x: 0.5, y: 2.5 }, { x: 5.5, y: 2.5 }]] });
    fillCell(lava.liquid, 0, 3, 1);
    const cleared = clearPathObstacles(lava);
    expect(cleared.decor.map((d) => d.kind)).toEqual(["table", "tree"]);
    const cells = classifyLayout(cleared);
    expect(cells[1][1]).toBe("cover");
    expect(cells[1][2]).toBe("cover");
    expect(cells[1][4]).toBe("obstacle");
    expect(cells[3][0]).toBe("lava");
    expect(cells[2][3]).toBe("floor");
  });

  it("сплошная земля — стена", () => {
    const p = plan(3, 3);
    fillCell(p.ground, 1, 1, 0);
    expect(classifyLayout(p)[1][1]).toBe("wall");
  });
});

describe("buildAreaZones", () => {
  const areas = [
    { cx: 3, cy: 4, rx: 2, ry: 2 },
    { cx: 17, cy: 4, rx: 2, ry: 2 },
  ];

  it("на открытой карте — партия и враги на разных краях, достаточно далеко", () => {
    const p = plan(20, 8, { areas });
    const zones = buildAreaZones(p, classifyLayout(p));
    expect(zones).not.toBeNull();
    const party = zones!.find((z) => z.name === "party")!.cells;
    const enemy = zones!.find((z) => z.name === "enemy_frontline")!.cells;
    expect(party.length).toBeGreaterThanOrEqual(8);
    expect(Math.max(...party.map((c) => c.x))).toBeLessThan(Math.min(...enemy.map((c) => c.x)));
  });

  it("сплошная перегородка из препятствий — карта отклоняется", () => {
    const decor: Decor[] = Array.from({ length: 8 }, (_, y) => ({ kind: "rock" as const, x: 10.5, y: y + 0.5, r: 0.45 }));
    const p = plan(20, 8, { areas, decor });
    expect(buildAreaZones(p, classifyLayout(p))).toBeNull();
  });
});
