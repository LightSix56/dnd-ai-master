import { describe, it, expect } from "vitest";
import { runBotTurn } from "../bot";
import { CombatState } from "../engine";
import { hasCoverBetween, hasLineOfSight, isLavaTerrain } from "../movement";
import { meleeThreatsReaching } from "../bot-tactics";
import type { Attack, Combatant, MapElement } from "../types";

const dagger: Attack = { id: "dagger", name: "Кинжал", attackBonus: 5, damage: [{ dice: "1d4", mod: 3, type: "piercing" }], kind: "melee", range: { normal: 5 }, actionCost: "action" };
const club: Attack = { id: "club", name: "Дубина", attackBonus: 4, damage: [{ dice: "1d6", mod: 2, type: "bludgeoning" }], kind: "melee", range: { normal: 5 }, actionCost: "action" };
const bow: Attack = { id: "bow", name: "Короткий лук", attackBonus: 5, damage: [{ dice: "1d6", mod: 3, type: "piercing" }], kind: "ranged", range: { normal: 80, long: 320 }, actionCost: "action" };

function fighter(o: Partial<Combatant> & { id: string; x: number; y: number }): Combatant {
  return {
    name: o.id,
    type: "enemy",
    color: "#f00",
    hpCurrent: 30,
    hpMax: 30,
    hpTemp: 0,
    ac: 12,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 3,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "Monster",
    level: 3,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: [club],
    spells: { slots: {}, known: [] },
    abilities: [],
    concentration: null,
    saves: {},
    abilityMods: { STR: 1, DEX: 3, CON: 1, INT: 0, WIS: 1, CHA: 0 },
    profBonus: 2,
    isAIControlled: true,
    monsterTraits: [],
    rechargeAbilities: [],
    ...o,
  } as Combatant;
}

const el = (id: string, type: MapElement["type"], x: number, y: number, w = 1, h = 1, properties: Record<string, unknown> = {}): MapElement =>
  ({ id, type, x, y, width: w, height: h, properties }) as MapElement;

function state(combatants: Combatant[], mapElements: MapElement[] = [], w = 20, h = 10): CombatState {
  return new CombatState({
    id: "t",
    name: "t",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    combatants,
    mapElements,
    log: [],
    gridWidth: w,
    gridHeight: h,
  } as any);
}

/** Стена по столбцу x с дверью в строке doorY */
function wallWithDoor(x: number, doorY: number, height: number, isOpen: boolean): MapElement[] {
  const out: MapElement[] = [];
  for (let y = 0; y < height; y++) if (y !== doorY) out.push(el(`w${y}`, "wall", x, y));
  out.push(el("door", "door", x, doorY, 1, 1, { isOpen }));
  return out;
}

describe("бот: двери", () => {
  it("ближник за закрытой дверью подходит, открывает её и проходит дальше", () => {
    const s = state(
      [fighter({ id: "brute", x: 13, y: 5 }), fighter({ id: "hero", type: "player", x: 6, y: 5, isAIControlled: false })],
      wallWithDoor(10, 5, 10, false)
    );
    const before = 13 - 6;
    const res = runBotTurn(s);
    const door = s.mapElements.find((e) => e.id === "door")!;
    expect((door.properties as any).isOpen).toBe(true);
    expect(res.steps.some((st) => st.text.includes("открывает дверь"))).toBe(true);
    expect(s.dirtyElementIds).toContain("door");
    expect(Math.abs(s.get("brute")!.x - 6)).toBeLessThan(before - 2);
  });

  it("закрытая дверь отрезает вражеских ближников — это видно в подсчёте угроз", () => {
    const archer = fighter({ id: "archer", x: 8, y: 5, attacks: [bow] });
    const brute = fighter({ id: "brute", type: "player", x: 13, y: 5 });
    const open = wallWithDoor(10, 5, 10, true);
    const s = state([archer, brute], open);
    expect(meleeThreatsReaching(s, archer, open)).toBe(1);
    expect(meleeThreatsReaching(s, archer, wallWithDoor(10, 5, 10, false))).toBe(0);
  });
});

describe("бот: плут", () => {
  const rogue = (o: Partial<Combatant> & { x: number; y: number }) =>
    fighter({ id: "rogue", className: "Плут", attacks: [dagger, bow], abilityMods: { STR: 0, DEX: 4, CON: 1, INT: 0, WIS: 1, CHA: 0 }, dexMod: 4, ...o });

  it("на открытом поле ход не ломается, даже когда спрятаться негде", () => {
    const s = state([rogue({ x: 10, y: 5 }), fighter({ id: "hero", type: "player", x: 2, y: 5 })]);
    expect(() => runBotTurn(s)).not.toThrow();
  });

  it("вплотную к врагу бьёт, отходит Хитрым действием и не остаётся рядом", () => {
    const s = state([
      rogue({ x: 6, y: 5, attacks: [dagger] }),
      fighter({ id: "hero", type: "player", x: 5, y: 5, facing: "E" }),
    ]);
    const res = runBotTurn(s);
    const text = res.steps.map((st) => st.text).join("\n");
    expect(text).toContain("Отход");
    const r = s.get("rogue")!;
    expect(Math.max(Math.abs(r.x - 5), Math.abs(r.y - 5))).toBeGreaterThan(1);
  });

  it("стреляет и уходит за стену, где его не видно", () => {
    // Стена с проёмом: плут может выглянуть, выстрелить и спрятаться за ней
    const walls = [0, 1, 2, 3, 4, 6, 7, 8, 9].map((y) => el(`w${y}`, "wall", 12, y));
    const s = state(
      [rogue({ x: 13, y: 5, facing: "W" }), fighter({ id: "hero", type: "player", x: 3, y: 5, facing: "E" })],
      walls
    );
    const res = runBotTurn(s);
    const text = res.steps.map((st) => st.text).join("\n");
    expect(text).toMatch(/Короткий лук|лук/i);
    const r = s.get("rogue")!;
    expect(hasLineOfSight(s.get("hero")!, r, s.mapElements)).toBe(false);
  });
});

describe("бот: стрелок и укрытия", () => {
  it("выбирает для выстрела клетку за укрытием", () => {
    const crates = [el("c1", "cover", 9, 3), el("c2", "cover", 9, 6)];
    const s = state(
      [fighter({ id: "archer", x: 11, y: 8, attacks: [bow] }), fighter({ id: "hero", type: "player", x: 2, y: 4, attacks: [bow] })],
      crates
    );
    runBotTurn(s);
    const a = s.get("archer")!;
    expect(hasCoverBetween(s.get("hero")!, a, s.mapElements, [])).not.toBe("none");
  });
});

describe("бот: лава", () => {
  it("ближник обходит лаву, а не идёт сквозь неё", () => {
    // Полоса лавы поперёк пути с обходом по краю
    const lava = el("lava", "lava", 8, 0, 2, 8);
    const s = state([fighter({ id: "brute", x: 13, y: 4 }), fighter({ id: "hero", type: "player", x: 4, y: 4 })], [lava]);
    for (let turn = 0; turn < 3; turn++) {
      const b = s.get("brute")!;
      b.movementUsed = 0;
      b.actionUsed = false;
      b.bonusActionUsed = false;
      runBotTurn(s);
      expect(isLavaTerrain(s.get("brute")!, s.mapElements)).toBe(false);
    }
    expect(s.log.some((l) => l.text.includes("лав"))).toBe(false);
  });
});

describe("бот: авангард прикрывает своих стрелков", () => {
  it("из двух равных целей выбирает ту, что подобралась к союзному стрелку", () => {
    const guard = fighter({ id: "guard", x: 10, y: 5 });
    const archer = fighter({ id: "archer", x: 14, y: 2, attacks: [bow] });
    const nearArcher = fighter({ id: "near", type: "player", x: 13, y: 2 });
    const far = fighter({ id: "far", type: "player", x: 7, y: 8 });
    const s = state([guard, archer, nearArcher, far]);
    const res = runBotTurn(s);
    expect(res.steps.map((st) => st.text).join("\n")).toContain("near");
  });
});
