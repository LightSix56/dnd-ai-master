import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { endTurn, moveCombatant, performAttack, startTurn, useAbility } from "../engine";
import { effectiveSpeed } from "../rules";
import { ally, bySrd, enemy, hasLog, hero, makeState } from "./helpers/fighter-harness";
import type { Combatant } from "../types";

// Мистический лучник: выстрелы работают в бою сами. Math.random = 0.5: к20 = 11, к6 = 4, к8 = 5.
// Бонус мастерства героя 3, Интеллект +1, СЛ выстрела = 8 + 3 + 1 = 12; к20 врага без модификатора даёт 11 — спасбросок провален.

const AA = "Мистический лучник";
const arrows = (...names: string[]) => ({ featuresTraits: names.join("\n") });
const shots = (c: Combatant) => bySrd(c, "arcane-archer/arcane-shot");

let h: Combatant;
let foe: Combatant;
let state: any;

function setup(names: string[], level = 7, foeExtra: Partial<Combatant> = {}) {
  h = hero("aa", AA, level, { sheet: arrows(...names), x: 2, y: 5 });
  foe = enemy("orc", 10, 5, foeExtra);
  state = makeState([h, foe]);
}

const arm = (key: string) => useAbility(state, "aa", bySrd(h, key).id);
const shoot = (id = "orc") => performAttack(state, "aa", id, "bow");
const newAction = () => {
  h.actionUsed = false;
  h.attacksMadeThisAction = 0;
};

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Магический выстрел: общее", () => {
  it("зарядка ничего не тратит, при попадании уходит один заряд, а урон — оружие + 2к6", () => {
    setup(["Взрывная стрела"]);
    arm("arcane-archer/bursting-arrow");
    expect(shots(h).usesUsed).toBe(0);
    const before = foe.hpCurrent;
    const out = shoot();
    expect(out.hit).toBe(true);
    expect(shots(h).usesUsed).toBe(1);
    // 1к8 (5) + 1 + 2к6 (4 + 4)
    expect(before - foe.hpCurrent).toBe(5 + 1 + 8);
    expect(hasLog(state, "Взрывная стрела")).toBe(true);
  });

  it("промах заряд не тратит", () => {
    setup(["Взрывная стрела"]);
    arm("arcane-archer/bursting-arrow");
    foe.ac = 40;
    expect(shoot().hit).toBe(false);
    expect(shots(h).usesUsed).toBe(0);
  });

  it("раз в ход: вторая стрела в том же ходу не применяется, в новом ходу — да", () => {
    setup(["Взрывная стрела", "Теневая стрела"]);
    h.attacksPerAction = 3;
    arm("arcane-archer/bursting-arrow");
    shoot();
    expect(() => arm("arcane-archer/shadow-arrow")).toThrow(/уже применён/);
    state.round += 1;
    startTurn(state);
    arm("arcane-archer/shadow-arrow");
    shoot();
    expect(shots(h).usesUsed).toBe(2);
  });

  it("третьей стрелы без заряда нет", () => {
    setup(["Взрывная стрела"]);
    shots(h).usesUsed = shots(h).usesMax;
    expect(() => arm("arcane-archer/bursting-arrow")).toThrow(/не хватает/);
  });

  it("только из лука: рукопашная атака стрелу не тратит", () => {
    setup(["Взрывная стрела"]);
    foe.x = 3;
    arm("arcane-archer/bursting-arrow");
    performAttack(state, "aa", "orc", "sword");
    expect(shots(h).usesUsed).toBe(0);
    newAction();
    shoot();
    expect(shots(h).usesUsed).toBe(1);
  });

  it("на 18 уровне кубы стрелы — 4к6", () => {
    setup(["Теневая стрела"], 18);
    arm("arcane-archer/shadow-arrow");
    const before = foe.hpCurrent;
    shoot();
    expect(before - foe.hpCurrent).toBe(5 + 1 + 16);
  });

  it("критическое попадание удваивает кубы стрелы", () => {
    setup(["Теневая стрела"]);
    arm("arcane-archer/shadow-arrow");
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const out = shoot();
    expect(out.crit).toBe(true);
    // к8 при 0.99 = 8: (8+8) + 1 + 4к6 (6×4 = 24)
    expect(out.damage).toBe(16 + 1 + 24);
  });
});

describe("варианты Магического выстрела", () => {
  it("Взрывная стрела: 2к6 силой всем в 10 футах от цели, дальние не задеты", () => {
    setup(["Взрывная стрела"]);
    const near = enemy("near", 12, 5);
    const far = enemy("far", 16, 5);
    const friend = ally("friend", 11, 6);
    state = makeState([h, foe, near, far, friend]);
    arm("arcane-archer/bursting-arrow");
    shoot();
    expect(near.hpCurrent).toBe(200 - 8);
    expect(friend.hpCurrent).toBe(40 - 8);
    expect(far.hpCurrent).toBe(200);
  });

  it("Изгоняющая стрела: проваленный спасбросок Харизмы изгоняет цель", () => {
    setup(["Изгоняющая стрела"]);
    arm("arcane-archer/banishing-arrow");
    shoot();
    expect(foe.conditions.some((x) => x.type === "banished")).toBe(true);
  });

  it("Изгоняющая стрела: успешный спасбросок — цель на месте", () => {
    setup(["Изгоняющая стрела"], 7, { abilityMods: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 5 } });
    arm("arcane-archer/banishing-arrow");
    shoot();
    expect(foe.conditions.some((x) => x.type === "banished")).toBe(false);
  });

  it("Изгоняющая стрела на 18 уровне добавляет 2к6 силы", () => {
    setup(["Изгоняющая стрела"], 18);
    arm("arcane-archer/banishing-arrow");
    const before = foe.hpCurrent;
    shoot();
    expect(before - foe.hpCurrent).toBe(5 + 1 + 8);
  });

  it("Обманная стрела: психический урон и очарование цели союзником", () => {
    setup(["Обманная стрела"]);
    const friend = ally("friend", 11, 5);
    state = makeState([h, foe, friend]);
    arm("arcane-archer/beguiling-arrow");
    const before = foe.hpCurrent;
    shoot();
    expect(before - foe.hpCurrent).toBe(5 + 1 + 8);
    const charm = foe.conditions.find((x) => x.type === "charmed");
    expect(charm?.source).toBe("friend");
  });

  it("Обманная стрела: без союзника рядом очаровывать некем", () => {
    setup(["Обманная стрела"]);
    arm("arcane-archer/beguiling-arrow");
    shoot();
    expect(foe.conditions.some((x) => x.type === "charmed")).toBe(false);
  });

  it("Ослабляющая стрела: урон оружием ослабленного цели вдвое меньше", () => {
    setup(["Ослабляющая стрела"]);
    arm("arcane-archer/enfeebling-arrow");
    shoot();
    expect(foe.conditions.some((x) => x.type === "enfeebled")).toBe(true);
    foe.x = 3;
    const hp = h.hpCurrent;
    performAttack(state, "orc", "aa", "sword", { skipTurnCheck: true });
    // к8 (5) + 3 = 8, вдвое — 4
    expect(hp - h.hpCurrent).toBe(4);
  });

  it("Сжимающая стрела: яд, скорость −10 и 2к6 рубящего за первое движение в ход", () => {
    setup(["Сжимающая стрела"]);
    arm("arcane-archer/grasping-arrow");
    const before = foe.hpCurrent;
    shoot();
    expect(before - foe.hpCurrent).toBe(5 + 1 + 8);
    expect(effectiveSpeed(foe)).toBe(20);
    const hp = foe.hpCurrent;
    moveCombatant(state, "orc", { x: 12, y: 5 }, { skipTurnCheck: true });
    expect(hp - foe.hpCurrent).toBe(8);
    const hp2 = foe.hpCurrent;
    moveCombatant(state, "orc", { x: 13, y: 5 }, { skipTurnCheck: true });
    expect(foe.hpCurrent).toBe(hp2);
  });

  it("Теневая стрела: психический урон и цель не видит дальше 5 футов", () => {
    setup(["Теневая стрела"]);
    arm("arcane-archer/shadow-arrow");
    shoot();
    expect(foe.conditions.some((x) => x.type === "shadow_veil")).toBe(true);
  });

  it("Зачарованная стрела: с 7 уровня стрела пробивает защиту от немагического оружия", () => {
    for (const [level, expectHp] of [
      [3, 200],
      [7, 200 - 6],
    ] as const) {
      setup([], level, { damageImmunities: ["piercing from nonmagical weapons"] });
      const out = shoot();
      expect(out.hit).toBe(true);
      expect(foe.hpCurrent, `уровень ${level}`).toBe(expectHp);
    }
  });
});

describe("стрелы без броска атаки", () => {
  it("Ищущая стрела: провал спасброска — полный урон оружия и 1к6 силы, тратит атаку и заряд", () => {
    setup(["Ищущая стрела"]);
    h.actionUsed = false;
    const res = useAbility(state, "aa", bySrd(h, "arcane-archer/seeking-arrow").id, { targetIds: ["orc"] });
    expect(res.targets[0].saved).toBe(false);
    // 1к8 (5) + 1 + 1к6 (4)
    expect(200 - foe.hpCurrent).toBe(5 + 1 + 4);
    expect(shots(h).usesUsed).toBe(1);
    expect(h.actionUsed).toBe(true);
  });

  it("Ищущая стрела: успешный спасбросок — половина", () => {
    setup(["Ищущая стрела"], 7, { abilityMods: { STR: 0, DEX: 5, CON: 0, INT: 0, WIS: 0, CHA: 0 } });
    useAbility(state, "aa", bySrd(h, "arcane-archer/seeking-arrow").id, { targetIds: ["orc"] });
    // полный урон 10, половина 5: 3 + 2
    expect(200 - foe.hpCurrent).toBe(Math.floor(6 / 2) + Math.floor(4 / 2));
  });

  it("Ищущая стрела работает на цель за укрытием и вне прямой видимости, но не дальше дальности лука", () => {
    setup(["Ищущая стрела"]);
    foe.x = 29;
    expect(() => useAbility(state, "aa", bySrd(h, "arcane-archer/seeking-arrow").id, { targetIds: ["orc"] })).not.toThrow();
    const far = enemy("far", 29, 29);
    far.x = 2000;
    state.combatants.push(far);
    expect(() => useAbility(state, "aa", bySrd(h, "arcane-archer/seeking-arrow").id, { targetIds: ["far"] })).toThrow();
  });

  it("Пронзающая стрела задевает всех на линии в 30 футов, остальных нет", () => {
    setup(["Пронзающая стрела"]);
    foe.x = 8;
    const second = enemy("second", 6, 5);
    const aside = enemy("aside", 8, 8);
    const beyond = enemy("beyond", 20, 5);
    state = makeState([h, foe, second, aside, beyond]);
    useAbility(state, "aa", bySrd(h, "arcane-archer/piercing-arrow").id, { targetIds: ["orc"] });
    expect(200 - foe.hpCurrent).toBe(5 + 1 + 4);
    expect(200 - second.hpCurrent).toBe(5 + 1 + 4);
    expect(aside.hpCurrent).toBe(200);
    expect(beyond.hpCurrent).toBe(200);
    expect(shots(h).usesUsed).toBe(1);
  });

  it("Странствующая стрела: после промаха бонусным действием атака по другой цели в 60 футах", () => {
    setup(["Взрывная стрела"]);
    const other = enemy("other", 14, 8);
    state = makeState([h, foe, other]);
    foe.ac = 40;
    expect(shoot().hit).toBe(false);
    const res = useAbility(state, "aa", bySrd(h, "arcane-archer/curving-shot").id, { targetIds: ["other"] });
    expect(h.bonusActionUsed).toBe(true);
    expect(res.targets[0].hit).toBe(true);
    expect(other.hpCurrent).toBeLessThan(200);
  });

  it("Странствующая стрела нужна только после промаха и не на ту же цель", () => {
    setup(["Взрывная стрела"]);
    const other = enemy("other", 14, 8);
    state = makeState([h, foe, other]);
    expect(() => useAbility(state, "aa", bySrd(h, "arcane-archer/curving-shot").id, { targetIds: ["other"] })).toThrow(/после промаха/);
    foe.ac = 40;
    shoot();
    expect(() => useAbility(state, "aa", bySrd(h, "arcane-archer/curving-shot").id, { targetIds: ["orc"] })).toThrow(/другого врага/);
  });
});

describe("Выстрел всегда наготове", () => {
  it("без зарядов в начале боя возвращается один", () => {
    setup([], 15);
    shots(h).usesUsed = shots(h).usesMax;
    startTurn(state);
    expect(shots(h).usesUsed).toBe(shots(h).usesMax - 1);
    endTurn(state);
  });
});
