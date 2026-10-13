import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { endTurn, performAttack, useAbility, startTurn } from "../engine";
import { ally, bySrd, enemy, hasLog, hero, makeState } from "./helpers/fighter-harness";
import type { Combatant } from "../types";

// Приёмы Мастера боевых искусств работают в бою сами: заряжаются кнопкой, при попадании тратят кость
// превосходства (к8 → при Math.random = 0.5 выпадает 5), бросают урон и накладывают эффект.

const BM = "Мастер боевых искусств";
const maneuvers = (...names: string[]) => ({ featuresTraits: names.join("\n") });
const dice = (c: Combatant) => bySrd(c, "battlemaster/combat-superiority");

let h: Combatant;
let foe: Combatant;
let state: any;

function setup(names: string[], level = 3, foeExtra: Partial<Combatant> = {}) {
  h = hero("bm", BM, level, { sheet: maneuvers(...names) });
  foe = enemy("orc", 6, 5, foeExtra);
  state = makeState([h, foe]);
}

const arm = (key: string, opts: { targetIds?: string[] } = {}) => useAbility(state, "bm", bySrd(h, key).id, opts);
const strike = (id = "orc") => performAttack(state, "bm", id, "sword");

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("заряженные приёмы: общее", () => {
  it("кость не тратится при зарядке и при промахе, а при попадании тратится одна", () => {
    setup(["Опрокидывающая атака"]);
    arm("battlemaster/trip-attack");
    expect(dice(h).usesUsed).toBe(0);
    foe.ac = 30;
    expect(strike().hit).toBe(false);
    expect(dice(h).usesUsed).toBe(0);
    foe.ac = 10;
    h.actionUsed = false;
    h.attacksMadeThisAction = 0;
    const out = strike();
    expect(out.hit).toBe(true);
    expect(dice(h).usesUsed).toBe(1);
    // второй удар без нового приёма — обычный
    h.actionUsed = false;
    h.attacksMadeThisAction = 0;
    const before = foe.hpCurrent;
    strike();
    expect(dice(h).usesUsed).toBe(1);
    expect(before - foe.hpCurrent).toBe(5 + 3);
  });

  it("приём добавляет кость превосходства к урону", () => {
    setup(["Атака с выпадом"]);
    arm("battlemaster/lunging-attack");
    const before = foe.hpCurrent;
    strike();
    expect(before - foe.hpCurrent).toBe(5 + 3 + 5);
  });

  it("при критическом попадании кость удваивается", () => {
    setup(["Атака с выпадом"]);
    arm("battlemaster/lunging-attack");
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const before = foe.hpCurrent;
    const out = strike();
    expect(out.crit).toBe(true);
    // к8 при 0.99 = 8: оружие 2к8 + 3, приём 2к8
    expect(before - foe.hpCurrent).toBe(8 * 2 + 3 + 8 * 2);
  });

  it("без костей приём не заряжается", () => {
    setup(["Атака с выпадом"]);
    dice(h).usesUsed = dice(h).usesMax;
    expect(() => arm("battlemaster/lunging-attack")).toThrow(/не хватает/);
  });

  it("заряжен только один приём: новый заменяет прежний", () => {
    setup(["Атака с выпадом", "Опрокидывающая атака"]);
    arm("battlemaster/lunging-attack");
    arm("battlemaster/trip-attack");
    strike();
    expect(foe.conditions.some((c) => c.type === "prone")).toBe(true);
    expect(dice(h).usesUsed).toBe(1);
  });

  it("заряженный приём не переходит на следующий ход", () => {
    setup(["Опрокидывающая атака"]);
    arm("battlemaster/trip-attack");
    expect(h.conditions.some((c) => c.type === "fighter_rider")).toBe(true);
    endTurn(state);
    expect(h.conditions.some((c) => c.type === "fighter_rider")).toBe(false);
    expect(dice(h).usesUsed).toBe(0);
  });
});

describe("эффекты приёмов", () => {
  it("Атака с выпадом достаёт на 10 футов", () => {
    setup(["Атака с выпадом"], 3);
    foe.x = 7;
    expect(() => strike()).toThrow(/далеко/i);
    arm("battlemaster/lunging-attack");
    expect(strike().hit).toBe(true);
  });

  it("Опрокидывающая атака: сбивает при провале спасброска Силы, не трогает Огромных", () => {
    setup(["Опрокидывающая атака"]);
    arm("battlemaster/trip-attack");
    strike();
    expect(foe.conditions.some((c) => c.type === "prone")).toBe(true);

    setup(["Опрокидывающая атака"], 3, { size: "huge" });
    arm("battlemaster/trip-attack");
    strike();
    expect(foe.conditions.some((c) => c.type === "prone")).toBe(false);
    expect(hasLog(state, "слишком велик")).toBe(true);
  });

  it("при успешном спасброске цель устаивает", () => {
    setup(["Опрокидывающая атака"], 3, { abilityMods: { STR: 5, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 } });
    arm("battlemaster/trip-attack");
    strike();
    expect(foe.conditions.some((c) => c.type === "prone")).toBe(false);
  });

  it("Атака с угрозой пугает, Провоцирующая — навязывает помеху против других", () => {
    setup(["Атака с угрозой", "Провоцирующая атака"]);
    arm("battlemaster/menacing-attack");
    strike();
    expect(foe.conditions.some((c) => c.type === "frightened")).toBe(true);

    setup(["Провоцирующая атака"]);
    arm("battlemaster/goading-attack");
    strike();
    expect(foe.conditions.some((c) => c.type === "goaded" && c.source === "bm")).toBe(true);
  });

  it("Толкающая атака отбрасывает на 15 футов", () => {
    setup(["Толкающая атака"]);
    arm("battlemaster/pushing-attack");
    strike();
    expect(foe.x).toBe(9);
  });

  it("Обезоруживающая атака вешает помеху на атаки", () => {
    setup(["Обезоруживающая атака"]);
    arm("battlemaster/disarming-attack");
    strike();
    expect(foe.conditions.some((c) => c.type === "disarmed")).toBe(true);
  });

  it("Отвлекающий удар: первая атака союзника по цели — с преимуществом, потом эффект снимается", () => {
    setup(["Отвлекающий удар"]);
    const friend = ally("friend", 6, 6);
    state.combatants.push(friend);
    arm("battlemaster/distracting-strike");
    strike();
    expect(foe.conditions.some((c) => c.type === "distracted")).toBe(true);

    const spy = vi.spyOn(Math, "random");
    spy.mockClear();
    const out = performAttack(state, "friend", "orc", "sword", { skipTurnCheck: true });
    expect(out.text).toContain("Отвлекающий удар");
    expect(foe.conditions.some((c) => c.type === "distracted")).toBe(false);
  });

  it("Широкая атака задевает второго врага рядом, если бросок пробивает его КД", () => {
    setup(["Широкая атака"]);
    const second = enemy("goblin", 6, 6);
    state.combatants.push(second);
    arm("battlemaster/sweeping-attack");
    strike();
    expect(second.hpMax - second.hpCurrent).toBe(5);

    setup(["Широкая атака"]);
    const armored = enemy("knight", 6, 6, { ac: 30 });
    state.combatants.push(armored);
    arm("battlemaster/sweeping-attack");
    strike();
    expect(armored.hpCurrent).toBe(armored.hpMax);
  });

  it("Атака с манёвром даёт союзнику Отход (перемещение без провоцированных атак)", () => {
    setup(["Атака с манёвром"]);
    const friend = ally("friend", 4, 5);
    state.combatants.push(friend);
    arm("battlemaster/maneuvering-attack");
    strike();
    expect(friend.conditions.some((c) => c.type === "disengaging")).toBe(true);
  });

  it("Точная атака превращает промах в попадание и тратит кость", () => {
    setup(["Точная атака"]);
    // бросок 11 + 7 = 18; КД 22: не хватает 4, кость к8 (5) исправляет
    foe.ac = 22;
    arm("battlemaster/precision-attack");
    const out = strike();
    expect(out.hit).toBe(true);
    expect(out.text).toContain("Точная атака");
    expect(dice(h).usesUsed).toBe(1);
  });

  it("Точная атака не тратит кость, если даже максимум не исправит промах", () => {
    setup(["Точная атака"]);
    foe.ac = 40;
    arm("battlemaster/precision-attack");
    expect(strike().hit).toBe(false);
    expect(dice(h).usesUsed).toBe(0);
  });
});

describe("приёмы-действия", () => {
  it("Сплочение: временные хиты = кость + Харизма союзнику", () => {
    setup(["Сплочение"]);
    const friend = ally("friend", 4, 5);
    state.combatants.push(friend);
    useAbility(state, "bm", bySrd(h, "battlemaster/rally").id, { targetIds: ["friend"] });
    expect(friend.hpTemp).toBe(5 + 2);
    expect(h.bonusActionUsed).toBe(true);
    expect(dice(h).usesUsed).toBe(1);
  });

  it("Атака с финтом: бонусное действие, преимущество на атаку и кость к урону", () => {
    setup(["Атака с финтом"]);
    useAbility(state, "bm", bySrd(h, "battlemaster/feinting-attack").id, { targetIds: ["orc"] });
    expect(h.bonusActionUsed).toBe(true);
    expect(dice(h).usesUsed).toBe(1);
    const before = foe.hpCurrent;
    const out = strike();
    expect(out.text).toContain("Атака с финтом");
    expect(before - foe.hpCurrent).toBe(5 + 3 + 5);
    expect(h.conditions.some((c) => c.type === "feint")).toBe(false);
  });

  it("Активное уклонение: кость к КД, пока не начнётся атака", () => {
    setup(["Активное уклонение"]);
    useAbility(state, "bm", bySrd(h, "battlemaster/evasive-footwork").id);
    expect(h.conditions.find((c) => c.type === "evasive_footwork")?.value).toBe(5);
    strike();
    expect(h.conditions.some((c) => c.type === "evasive_footwork")).toBe(false);
  });

  it("Подмена: меняет местами с союзником и даёт кость к КД более уязвимому", () => {
    setup(["Подмена"]);
    const friend = ally("friend", 4, 5, { ac: 12 });
    state.combatants.push(friend);
    useAbility(state, "bm", bySrd(h, "battlemaster/bait-and-switch").id, { targetIds: ["friend"] });
    expect([h.x, friend.x]).toEqual([4, 5]);
    expect(h.movementUsed).toBe(5);
    expect(friend.conditions.find((c) => c.type === "bait_and_switch")?.value).toBe(5);
  });

  it("Удар командующего: союзник атакует реакцией с костью к урону", () => {
    setup(["Удар командующего"]);
    const friend = ally("friend", 6, 6);
    state.combatants.push(friend);
    const before = foe.hpCurrent;
    useAbility(state, "bm", bySrd(h, "battlemaster/commanders-strike").id, { targetIds: ["friend", "orc"] });
    expect(friend.reactionUsed).toBe(true);
    expect(h.bonusActionUsed).toBe(true);
    expect(dice(h).usesUsed).toBe(1);
    expect(before - foe.hpCurrent).toBe(5 + 3 + 5);
  });

  it("Быстрый бросок: бонусная дальняя атака метательным оружием", () => {
    setup(["Быстрый бросок"]);
    h.attacks.push({
      id: "handaxe",
      name: "Ручной топор",
      kind: "melee",
      thrown: true,
      range: { normal: 5 },
      attackBonus: 7,
      damage: [{ dice: "1d6", mod: 3, type: "slashing" }],
      actionCost: "action",
    });
    foe.x = 9;
    const before = foe.hpCurrent;
    useAbility(state, "bm", bySrd(h, "battlemaster/quick-toss").id, { targetIds: ["orc"] });
    expect(h.bonusActionUsed).toBe(true);
    expect(before - foe.hpCurrent).toBe(4 + 3 + 5);
    expect(h.attacks.some((a) => a.id === "__quick_toss")).toBe(false);
  });

  it("Атака с захватом: только после рукопашного попадания; удачный захват схватывает цель", () => {
    setup(["Атака с захватом"]);
    expect(() => useAbility(state, "bm", bySrd(h, "battlemaster/grappling-strike").id, { targetIds: ["orc"] })).toThrow(/после попадания/);
    strike();
    useAbility(state, "bm", bySrd(h, "battlemaster/grappling-strike").id, { targetIds: ["orc"] });
    expect(foe.conditions.some((c) => c.type === "grappled")).toBe(true);
  });
});

describe("реакции", () => {
  it("Парирование уменьшает урон от рукопашной атаки на кость + Ловкость", () => {
    setup(["Парирование"]);
    foe.attacks = [
      { id: "claw", name: "Коготь", kind: "melee", range: { normal: 5 }, attackBonus: 20, damage: [{ dice: "1d8", mod: 6, type: "slashing" }], actionCost: "action" },
    ];
    const before = h.hpCurrent;
    performAttack(state, "orc", "bm", "claw", { skipTurnCheck: true });
    // урон 5 + 6 = 11; парирование: 5 + 1 (Ловкость) = 6
    expect(before - h.hpCurrent).toBe(11 - 6);
    expect(h.reactionUsed).toBe(true);
    expect(dice(h).usesUsed).toBe(1);
  });

  it("Ответный удар: после промаха противника воин бьёт в ответ реакцией с костью к урону", () => {
    setup(["Ответный удар"]);
    foe.attacks = [
      { id: "claw", name: "Коготь", kind: "melee", range: { normal: 5 }, attackBonus: -20, damage: [{ dice: "1d8", mod: 0, type: "slashing" }], actionCost: "action" },
    ];
    const before = foe.hpCurrent;
    performAttack(state, "orc", "bm", "claw", { skipTurnCheck: true });
    expect(h.reactionUsed).toBe(true);
    expect(before - foe.hpCurrent).toBe(5 + 3 + 5);
    expect(dice(h).usesUsed).toBe(1);
  });

  it("реакции не срабатывают, если реакция уже потрачена или костей нет", () => {
    setup(["Парирование"]);
    h.reactionUsed = true;
    foe.attacks = [
      { id: "claw", name: "Коготь", kind: "melee", range: { normal: 5 }, attackBonus: 20, damage: [{ dice: "1d8", mod: 6, type: "slashing" }], actionCost: "action" },
    ];
    const before = h.hpCurrent;
    performAttack(state, "orc", "bm", "claw", { skipTurnCheck: true });
    expect(before - h.hpCurrent).toBe(11);
    expect(dice(h).usesUsed).toBe(0);
  });

  it("Неослабевающий всё ещё возвращает кость на инициативе", () => {
    setup([], 15);
    dice(h).usesUsed = dice(h).usesMax;
    startTurn(state);
    expect(dice(h).usesUsed).toBe(dice(h).usesMax - 1);
  });
});
