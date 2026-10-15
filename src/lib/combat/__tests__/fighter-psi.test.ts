import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dealDamage, performAttack, startTurn, useAbility } from "../engine";
import { effectiveAC, effectiveSpeed } from "../rules";
import { ally, bySrd, enemy, hasLog, hero, makeState } from "./helpers/fighter-harness";
import type { Combatant } from "../types";

// Воин-псионик: кости псионической энергии (6 штук при мастерстве 3; к8 на 5–10 уровнях, к10 с 11, к12 с 17).
// Math.random = 0.5: к8 = 5, к10 = 6, к12 = 7, к20 = 11; модификатор Интеллекта героя +1.

const PW = "Пси-воин";
const traits = (...names: string[]) => ({ featuresTraits: names.join("\n") });
const pool = (c: Combatant) => bySrd(c, "psi-warrior/psionic-power");

let h: Combatant;
let foe: Combatant;
let state: any;

function setup(names: string[], level = 5, foeExtra: Partial<Combatant> = {}, mods: Record<string, number> = {}) {
  h = hero("pw", PW, level, { sheet: traits(...names), x: 5, y: 5, mods });
  foe = enemy("orc", 6, 5, foeExtra);
  state = makeState([h, foe]);
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Псионический удар", () => {
  it("кнопка заряжает, попадание тратит кость и добавляет кость + мод. Интеллекта силовым полем", () => {
    setup(["Псионический удар"]);
    useAbility(state, "pw", bySrd(h, "psi-warrior/psionic-strike").id);
    expect(pool(h).usesUsed).toBe(0);
    const out = performAttack(state, "pw", "orc", "sword");
    expect(out.hit).toBe(true);
    // 1к8 (5) + 3 + к8 энергии (5) + 1
    expect(200 - foe.hpCurrent).toBe(5 + 3 + 5 + 1);
    expect(pool(h).usesUsed).toBe(1);
  });

  it("раз в ход: повторно зарядить в том же ходу нельзя", () => {
    setup(["Псионический удар"]);
    h.attacksPerAction = 2;
    const key = "psi-warrior/psionic-strike";
    useAbility(state, "pw", bySrd(h, key).id);
    performAttack(state, "pw", "orc", "sword");
    expect(() => useAbility(state, "pw", bySrd(h, key).id)).toThrow(/закончились/);
    state.round += 1;
    startTurn(state);
    expect(() => useAbility(state, "pw", bySrd(h, key).id)).not.toThrow();
  });

  it("дальше 30 футов не срабатывает и кость не тратит", () => {
    setup(["Псионический удар"]);
    foe.x = 5 + 8;
    useAbility(state, "pw", bySrd(h, "psi-warrior/psionic-strike").id);
    performAttack(state, "pw", "orc", "bow");
    expect(pool(h).usesUsed).toBe(0);
    expect(200 - foe.hpCurrent).toBe(5 + 1);
  });

  it("Телекинетический толчок: при провале спасброска Силы рукопашная цель сбита с ног", () => {
    setup(["Псионический удар", "Телекинетический толчок"], 7);
    useAbility(state, "pw", bySrd(h, "psi-warrior/psionic-strike").id);
    performAttack(state, "pw", "orc", "sword");
    expect(foe.conditions.some((x) => x.type === "prone")).toBe(true);
  });

  it("Телекинетический толчок: успешный спасбросок — цель на ногах", () => {
    setup(["Псионический удар", "Телекинетический толчок"], 7, { abilityMods: { STR: 5, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 } });
    useAbility(state, "pw", bySrd(h, "psi-warrior/psionic-strike").id);
    performAttack(state, "pw", "orc", "sword");
    expect(foe.conditions.some((x) => x.type === "prone")).toBe(false);
  });
});

describe("Защитное поле", () => {
  it("реакция воина уменьшает урон по союзнику в 30 футах на кость + мод. Интеллекта и тратит кость", () => {
    setup(["Защитное поле"]);
    const friend = ally("friend", 6, 6);
    state = makeState([h, foe, friend]);
    const hp = friend.hpCurrent;
    const out = performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(out.hit).toBe(true);
    // урон 5 + 3 = 8, поле гасит 5 + 1 = 6
    expect(hp - friend.hpCurrent).toBe(2);
    expect(pool(h).usesUsed).toBe(1);
    expect(h.reactionUsed).toBe(true);
  });

  it("защищает и самого воина", () => {
    setup(["Защитное поле"]);
    const hp = h.hpCurrent;
    performAttack(state, "orc", "pw", "sword", { skipTurnCheck: true });
    expect(hp - h.hpCurrent).toBe(2);
  });

  it("мелкий урон (меньше 6) не стоит кости, и реакция одна на раунд", () => {
    setup(["Защитное поле"]);
    dealDamage(state, "pw", 4, { isAttack: false, damageType: "fire" });
    expect(pool(h).usesUsed).toBe(0);
    dealDamage(state, "pw", 10, { isAttack: false, damageType: "fire" });
    expect(pool(h).usesUsed).toBe(1);
    dealDamage(state, "pw", 10, { isAttack: false, damageType: "fire" });
    expect(pool(h).usesUsed).toBe(1);
  });

  it("союзник дальше 30 футов не прикрыт", () => {
    setup(["Защитное поле"]);
    const far = ally("far", 5 + 7, 5);
    state = makeState([h, foe, far]);
    dealDamage(state, "far", 10, { isAttack: false, damageType: "fire" });
    expect(pool(h).usesUsed).toBe(0);
  });
});

describe("Адепт-телекинетик и Оплот силы", () => {
  it("Телекинетическое передвижение переносит союзника, второй раз — за кость энергии", () => {
    setup(["Телекинетическое передвижение"]);
    const friend = ally("friend", 7, 5);
    state = makeState([h, foe, friend]);
    const id = bySrd(h, "psi-warrior/telekinetic-movement").id;
    useAbility(state, "pw", id, { targetIds: ["friend"], center: { x: 10, y: 8 } });
    expect([friend.x, friend.y]).toEqual([10, 8]);
    expect(pool(h).usesUsed).toBe(0);
    h.actionUsed = false;
    useAbility(state, "pw", id, { targetIds: ["friend"], center: { x: 12, y: 8 } });
    expect([friend.x, friend.y]).toEqual([12, 8]);
    expect(pool(h).usesUsed).toBe(1);
  });

  it("не переносит на себя, за 30 футов и в занятую клетку", () => {
    setup(["Телекинетическое передвижение"]);
    const friend = ally("friend", 7, 5);
    state = makeState([h, foe, friend]);
    const id = bySrd(h, "psi-warrior/telekinetic-movement").id;
    expect(() => useAbility(state, "pw", id, { targetIds: ["pw"], center: { x: 8, y: 8 } })).toThrow(/не на вас/);
    expect(() => useAbility(state, "pw", id, { targetIds: ["friend"], center: { x: 25, y: 5 } })).toThrow(/30 футов/);
    expect(() => useAbility(state, "pw", id, { targetIds: ["friend"], center: { x: 6, y: 5 } })).toThrow(/занята/);
  });

  it("Усиленный пси-прыжок удваивает скорость до конца хода", () => {
    setup(["Усиленный пси-прыжок"], 7);
    expect(effectiveSpeed(h)).toBe(30);
    useAbility(state, "pw", bySrd(h, "psi-warrior/psi-powered-leap").id);
    expect(effectiveSpeed(h)).toBe(60);
    expect(h.bonusActionUsed).toBe(true);
  });

  it("Оплот силы: КД +2 союзникам (по Интеллекту) на минуту", () => {
    setup([], 15, {}, { INT: 3 });
    const f1 = ally("f1", 6, 6);
    const f2 = ally("f2", 4, 5);
    const f3 = ally("f3", 5, 8);
    state = makeState([h, foe, f1, f2, f3]);
    const ac = effectiveAC(h);
    useAbility(state, "pw", bySrd(h, "psi-warrior/bulwark-of-force").id);
    // INT 3 → воин и ещё двое ближайших
    expect(effectiveAC(h)).toBe(ac + 2);
    const covered = [f1, f2, f3].filter((f) => f.conditions.some((x) => x.type === "bulwark_of_force"));
    expect(covered).toHaveLength(2);
    expect(effectiveAC(covered[0])).toBe(15 + 2);
  });
});

describe("Защищённый разум", () => {
  it("сопротивление психической энергии", () => {
    setup([], 10);
    dealDamage(state, "pw", 10, { isAttack: false, damageType: "psychic" });
    expect(h.hpCurrent).toBe(40 - 5);
  });

  it("в начале хода снимает очарование и испуг за кость энергии", () => {
    setup([], 10);
    h.conditions.push({ type: "charmed" }, { type: "frightened" });
    startTurn(state);
    expect(h.conditions.some((x) => x.type === "charmed" || x.type === "frightened")).toBe(false);
    expect(pool(h).usesUsed).toBe(1);
    expect(hasLog(state, "Защищённый разум")).toBe(true);
  });

  it("без очарования кость не тратится", () => {
    setup([], 10);
    startTurn(state);
    expect(pool(h).usesUsed).toBe(0);
  });
});

describe("Мастер телекинеза", () => {
  it("цель с проваленным спасброском Силы обездвижена, атака оружием бонусным действием доступна", () => {
    setup([], 18);
    const res = useAbility(state, "pw", bySrd(h, "psi-warrior/telekinetic-master").id, { targetIds: ["orc"] });
    expect(res.targets[0].saved).toBe(false);
    expect(foe.conditions.some((x) => x.type === "restrained")).toBe(true);
    expect(h.actionUsed).toBe(true);
    const out = useAbility(state, "pw", bySrd(h, "psi-warrior/telekinetic-master-strike").id, { targetIds: ["orc"] });
    expect(out.targets[0].hit).toBe(true);
    expect(h.bonusActionUsed).toBe(true);
  });

  it("атака бонусным действием невозможна без телекинеза", () => {
    setup([], 18);
    expect(() => useAbility(state, "pw", bySrd(h, "psi-warrior/telekinetic-master-strike").id, { targetIds: ["orc"] })).toThrow(/Телекинез/);
  });
});
