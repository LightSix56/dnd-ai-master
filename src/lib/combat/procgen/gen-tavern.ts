// Таверна: прямоугольное или Г-образное здание посреди двора. Внутри — общий зал со
// стойкой, камином и ровными рядами столов, кухня и кладовая или спальня.
// Главный вход и задняя дверь (иногда ещё боковая), окна в наружных стенах.
//
// План строится «в своей ориентации»: зал слева, подсобные комнаты справа, главный вход
// снизу. В конце карта случайно отражается по горизонтали и вертикали.

import { createRng, type Rng } from "./rng";
import { Field, SUB } from "./field";
import type { Area, Decor, DecorKind, Polyline, ProcgenLayout } from "./layout";

const W = 24;
const H = 16;

type Cell = "out" | "wall" | "in";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Door {
  x: number;
  y: number;
  /** Дверь в горизонтальной стене — "h", в вертикальной — "v" */
  dir: "h" | "v";
}

export function generateTavernLayout(seed: number): ProcgenLayout {
  const rng = createRng((seed ^ 0x7a3e0002) >>> 0);

  // ---- здание ----
  // Двор: слева и сверху хотя бы клетка, справа (задний двор) — две, снизу (вход) — три
  const bw = rng.int(18, 21);
  const bh = rng.int(10, 12);
  const bx = 1 + rng.int(0, W - 3 - bw);
  const by = 1 + rng.int(0, H - 4 - bh); // перед входом — двор хотя бы в три клетки
  const sw = rng.int(3, 4); // ширина подсобных комнат (внутри)
  const ix = bx + bw - 2 - sw; // внутренняя стена между залом и подсобкой
  const counterX = ix - 2;
  const shapeL = rng.next() < 0.5;
  // Г: вырезан угол зала со стороны камина — сетка столов в нём просто не ставится
  const cw = shapeL ? rng.int(4, 6) : 0;
  const ch = shapeL ? rng.int(3, 4) : 0;

  const inside = (x: number, y: number) =>
    x >= bx && x < bx + bw && y >= by && y < by + bh && !(shapeL && x < bx + cw && y < by + ch);
  const grid: Cell[][] = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x): Cell => {
      if (!inside(x, y)) return "out";
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!inside(x + dx, y + dy)) return "wall";
      return "in";
    })
  );
  const setWall = (x: number, y: number) => {
    if (grid[y]?.[x] === "in") grid[y][x] = "wall";
  };
  for (let y = by; y < by + bh; y++) setWall(ix, y);

  // ---- комнаты ----
  const hall: Rect = { x: bx + 1, y: by + 1, w: ix - bx - 1, h: bh - 2 };
  const stripTop = by + 1;
  const stripBottom = by + bh - 2;
  let kitchen: Rect = { x: ix + 1, y: stripTop, w: sw, h: stripBottom - stripTop + 1 };
  // Подсобка делится на кухню (внизу) и кладовую или спальню (вверху)
  const my = stripTop + Math.floor(kitchen.h / 2) - 1;
  for (let x = ix + 1; x <= ix + sw; x++) setWall(x, my);
  const storeroom: Rect = { x: ix + 1, y: stripTop, w: sw, h: my - stripTop };
  kitchen = { x: ix + 1, y: my + 1, w: sw, h: stripBottom - my };
  const bedroom = rng.next() < 0.5;

  // ---- сетка столов: считается до дверей, чтобы входы пришлись на проходы между столами ----
  const region: Rect = { x: hall.x + 1, y: hall.y, w: ix - hall.x - 5, h: hall.h - 1 };
  const unitH = 3;
  const gridFor = (unitW: number) => {
    const cols = Math.floor((region.w + 1) / (unitW + 1));
    const rows = Math.floor((region.h + 1) / (unitH + 1));
    const ox = region.x + Math.floor((region.w - (cols * (unitW + 1) - 1)) / 2);
    const oy = region.y + Math.floor((region.h - (rows * (unitH + 1) - 1)) / 2);
    let fits = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let ok = true;
        for (let y = 0; y < unitH; y++) for (let x = 0; x < unitW; x++) if (grid[oy + r * (unitH + 1) + y]?.[ox + c * (unitW + 1) + x] !== "in") ok = false;
        if (ok) fits++;
      }
    }
    return { cols, rows, ox, oy, fits };
  };
  // Круглые столы со стульями или длинные с лавками; круглых — только если их влезает хотя бы три
  const round = rng.next() < 0.5 && gridFor(3).fits >= 3;
  const unitW = round ? 3 : 2;
  const { cols, rows, ox, oy } = gridFor(unitW);
  const aisles: number[] = [];
  for (let c = 0; c <= cols; c++) {
    const x = ox + c * (unitW + 1) - 1;
    if (x >= hall.x + 1 && x <= ix - 3) aisles.push(x);
  }
  const hallMid = hall.x + hall.w / 2;
  const byCenter = [...aisles].sort((a, b) => Math.abs(a - hallMid) - Math.abs(b - hallMid));

  // ---- двери ----
  const doors: Door[] = [];
  const open = (x: number, y: number, dir: Door["dir"]) => {
    grid[y][x] = "in";
    doors.push({ x, y, dir });
  };
  // Кухня: дверь из зала и задняя дверь наружу — на одной строке, это сквозной проход
  const row = kitchen.y + rng.int(1, Math.max(1, kitchen.h - 2));
  open(ix, row, "v");
  open(bx + bw - 1, row, "v");
  open(ix + 1 + rng.int(0, sw - 1), storeroom.y + storeroom.h, "h");
  const mainX = byCenter[Math.min(byCenter.length - 1, rng.int(0, 1))] ?? hall.x + Math.floor(hall.w / 2);
  const doubleDoor = rng.next() < 0.5;
  open(mainX, by + bh - 1, "h");
  if (doubleDoor) open(mainX + 1, by + bh - 1, "h");
  let sideDoor: Door | null = null;
  const sideChoices = aisles.filter((x) => x !== mainX && x > bx + cw + 1 && x > hall.x);
  if (sideChoices.length > 0 && rng.next() < 0.5) {
    open(rng.pick(sideChoices), by, "h");
    sideDoor = doors[doors.length - 1];
  }

  // ---- окна: через одну-две клетки прямых наружных стен, не у дверей ----
  const isDoor = (x: number, y: number) => doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
  const cell = (x: number, y: number): Cell => grid[y]?.[x] ?? "out";
  const decor: Decor[] = [];
  const phase = rng.int(0, 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== "wall" || isDoor(x, y)) continue;
      const horizontal = cell(x - 1, y) === "wall" && cell(x + 1, y) === "wall" &&
        ((cell(x, y - 1) === "out" && cell(x, y + 1) === "in") || (cell(x, y + 1) === "out" && cell(x, y - 1) === "in"));
      const vertical = cell(x, y - 1) === "wall" && cell(x, y + 1) === "wall" &&
        ((cell(x - 1, y) === "out" && cell(x + 1, y) === "in") || (cell(x + 1, y) === "out" && cell(x - 1, y) === "in"));
      if (horizontal && (x + phase) % 3 === 0) decor.push({ kind: "window", x, y, r: 0.5, dir: "h" });
      if (vertical && (y + phase) % 3 === 0) decor.push({ kind: "window", x, y, r: 0.5, dir: "v" });
    }
  }
  for (const d of doors) decor.push({ kind: "door", x: d.x, y: d.y, r: 0.5, dir: d.dir });

  // ---- обстановка ----
  const taken = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  // Перед каждой дверью — свободный пятачок
  for (const d of doors) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) taken.add(key(d.x + dx, d.y + dy));
  const free = (x: number, y: number, w = 1, h = 1) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (cell(xx, yy) !== "in" || taken.has(key(xx, yy))) return false;
    return true;
  };
  const put = (kind: DecorKind, x: number, y: number, w = 1, h = 1, extra: Partial<Decor> = {}) => {
    if (!free(x, y, w, h)) return false;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) taken.add(key(xx, yy));
    decor.push(w > 1 || h > 1 || kind === "counter" ? { kind, x, y, r: 0.45, w, h, ...extra } : { kind, x: x + 0.5, y: y + 0.5, r: 0.35, ...extra });
    return true;
  };
  // Проход от главного входа к кухне — без мебели
  for (let y = row; y < by + bh - 1; y++) taken.add(key(mainX, y));
  for (let x = ix - 3; x < ix; x++) taken.add(key(x, row));

  // Стойка вдоль стены подсобки: за ней проход для трактирщика, перед ней табуреты
  const above = row - 1 - (hall.y + 1);
  const below = hall.y + hall.h - 2 - (row + 1);
  const [c0, c1] = above >= below ? [hall.y + 1, row - 1] : [row + 1, hall.y + hall.h - 2];
  const counterLen = Math.min(5, c1 - c0 + 1);
  if (counterLen >= 2) {
    const cy = above >= below ? c1 - counterLen + 1 : c0;
    put("counter", counterX, cy, 1, counterLen);
    for (let y = cy; y < cy + counterLen; y++) {
      taken.add(key(ix - 1, y));
      if (free(counterX - 1, y)) {
        put("stool", counterX - 1, y);
      }
    }
    decor.push({ kind: "barrel", x: ix - 0.5, y: (above >= below ? cy : cy + counterLen - 1) + 0.5, r: 0.35 });
  }
  for (let y = hall.y; y < hall.y + hall.h; y++) taken.add(key(ix - 1, y));
  for (let y = hall.y; y < hall.y + hall.h; y++) taken.add(key(counterX - 1, y));

  // Камин у дальней стены зала
  const hearthRows = hall.h - (shapeL ? ch : 0);
  const hearthY = hall.y + hall.h - hearthRows + Math.floor((hearthRows - 2) / 2);
  put("hearth", hall.x, hearthY, 1, 2);

  // Столы ровной сеткой с проходами в одну клетку
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ux = ox + c * (unitW + 1);
      const uy = oy + r * (unitH + 1);
      if (!free(ux, uy, unitW, unitH)) continue;
      if (round) {
        put("table", ux + 1, uy + 1, 1, 1, { r: 0.42 });
        // Стулья придвинуты к столу: центр смещён к нему, клетка та же
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          if (put("chair", ux + 1 + dx, uy + 1 + dy, 1, 1, { dir: dx === 0 ? "h" : "v" })) {
            const chair = decor[decor.length - 1];
            chair.x -= dx * 0.22;
            chair.y -= dy * 0.22;
          }
        }
      } else {
        put("table", ux, uy + 1, 2, 1);
        put("bench", ux, uy, 2, 1);
        put("bench", ux, uy + 2, 2, 1);
      }
    }
  }

  // Кухня: очаг, разделочный стол, бочки; кладовая — ящики и бочки по стенам
  // Очаг — у любой стены кухни, где не мешает дверям
  const hearthSpots: [number, number, number, number][] = [];
  for (let y = kitchen.y; y < kitchen.y + kitchen.h - 1; y++) hearthSpots.push([kitchen.x + kitchen.w - 1, y, 1, 2], [kitchen.x, y, 1, 2]);
  for (let x = kitchen.x; x < kitchen.x + kitchen.w - 1; x++) hearthSpots.push([x, kitchen.y + kitchen.h - 1, 2, 1], [x, kitchen.y, 2, 1]);
  hearthSpots.some(([x, y, w, h]) => put("hearth", x, y, w, h));
  if (!put("table", kitchen.x + 1, kitchen.y + kitchen.h - 1, 2, 1)) put("table", kitchen.x + 1, kitchen.y, 2, 1);
  const alongWalls = (room: Rect, kinds: DecorKind[], count: number) => {
    const spots: [number, number][] = [];
    for (let x = room.x; x < room.x + room.w; x++) spots.push([x, room.y], [x, room.y + room.h - 1]);
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) spots.push([room.x, y], [room.x + room.w - 1, y]);
    for (let placed = 0, attempt = 0; placed < count && attempt < 40; attempt++) {
      const [x, y] = rng.pick(spots);
      if (put(rng.pick(kinds), x, y)) placed++;
    }
  };
  alongWalls(kitchen, ["barrel", "crate"], rng.int(1, 2));
  if (bedroom) {
    if (!put("bed", storeroom.x, storeroom.y, 1, 2)) put("bed", storeroom.x + storeroom.w - 1, storeroom.y, 1, 2);
    alongWalls(storeroom, ["crate"], 1);
  } else {
    alongWalls(storeroom, ["crate", "barrel"], rng.int(3, 5));
  }
  // Во дворе — пара бочек и ящиков у стен
  for (let placed = 0, attempt = 0; placed < 3 && attempt < 60; attempt++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, H - 1);
    if (cell(x, y) !== "out") continue;
    const nearWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cell(x + dx, y + dy) === "wall");
    if (nearWall && !taken.has(key(x, y))) {
      decor.push({ kind: rng.next() < 0.5 ? "barrel" : "crate", x: x + 0.5, y: y + 0.5, r: 0.35 });
      taken.add(key(x, y));
    }
  }

  // ---- зоны, пути: партия входит с улицы, враги — в зале ----
  const yardBelow = H - (by + bh);
  const yardRight = W - (bx + bw);
  const areas: Area[] = [
    { cx: Math.min(mainX + 0.5, hall.x + 2), cy: H - 0.5, rx: 3, ry: yardBelow / 2 },
    // Дальний от входа край зала, у стойки
    { cx: counterX - 2, cy: hall.y + 1, rx: 3, ry: 2 },
  ];
  const asArea = (r: Rect): Area => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, rx: r.w / 2, ry: r.h / 2 });
  // Засада — из кухни, кладовой или с заднего двора через чёрный ход
  const flankAreas: Area[] = [asArea(kitchen), asArea(storeroom), { cx: bx + bw + yardRight / 2, cy: row + 0.5, rx: yardRight / 2, ry: 3 }];
  if (sideDoor) flankAreas.push({ cx: sideDoor.x + 0.5, cy: by / 2, rx: 3, ry: by / 2 });
  const paths: Polyline[] = [
    [
      { x: mainX + 0.5, y: H },
      { x: mainX + 0.5, y: row + 0.5 },
      { x: W, y: row + 0.5 },
    ],
  ];
  if (sideDoor) paths.push([{ x: sideDoor.x + 0.5, y: 0 }, { x: sideDoor.x + 0.5, y: by + 0.5 }]);

  const ground = new Field(W * SUB, H * SUB);
  for (let y = 0; y < ground.h; y++) {
    for (let x = 0; x < ground.w; x++) if (grid[Math.floor(y / SUB)][Math.floor(x / SUB)] !== "wall") ground.set(x, y, 1);
  }
  const structures: Rect[] = shapeL
    ? [{ x: bx + cw, y: by, w: bw - cw, h: bh }, { x: bx, y: by + ch, w: cw, h: bh - ch }]
    : [{ x: bx, y: by, w: bw, h: bh }];

  const layout: ProcgenLayout = {
    biome: "tavern",
    seed,
    width: W,
    height: H,
    ground,
    liquid: new Field(W * SUB, H * SUB),
    decor,
    areas,
    flankAreas,
    paths,
    structures,
    doors: doors.map(({ x, y }) => ({ x, y })),
  };
  return mirror(layout, rng.next() < 0.5, rng.next() < 0.5);
}

/** Отражает план по горизонтали и/или вертикали */
function mirror(layout: ProcgenLayout, flipX: boolean, flipY: boolean): ProcgenLayout {
  if (!flipX && !flipY) return layout;
  const { width: w, height: h } = layout;
  const fx = (x: number, size = 0) => (flipX ? w - x - size : x);
  const fy = (y: number, size = 0) => (flipY ? h - y - size : y);
  const flipField = (f: Field) => {
    const out = new Field(f.w, f.h);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) out.set(x, y, f.get(flipX ? f.w - 1 - x : x, flipY ? f.h - 1 - y : y));
    return out;
  };
  // У объектов-прямоугольников x, y — левый верхний угол; у остальных — центр
  const cornerBased = (d: Decor) => d.w !== undefined || d.kind === "counter" || d.kind === "door" || d.kind === "window";
  return {
    ...layout,
    ground: flipField(layout.ground),
    liquid: flipField(layout.liquid),
    decor: layout.decor.map((d) =>
      cornerBased(d) ? { ...d, x: fx(d.x, d.w ?? 1), y: fy(d.y, d.h ?? 1) } : { ...d, x: fx(d.x), y: fy(d.y) }
    ),
    areas: layout.areas.map((a) => ({ ...a, cx: fx(a.cx), cy: fy(a.cy) })),
    flankAreas: layout.flankAreas.map((a) => ({ ...a, cx: fx(a.cx), cy: fy(a.cy) })),
    paths: layout.paths.map((p) => p.map((pt) => ({ x: fx(pt.x), y: fy(pt.y) }))),
    structures: layout.structures.map((s) => ({ ...s, x: fx(s.x, s.w), y: fy(s.y, s.h) })),
    doors: layout.doors?.map((d) => ({ x: fx(d.x, 1), y: fy(d.y, 1) })),
  };
}
