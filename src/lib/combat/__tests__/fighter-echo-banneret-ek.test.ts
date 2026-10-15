import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { castSpell, endTurn, moveCombatant, performAttack, startTurn, useAbility } from "../engine";
import { rollSave } from "../rules";
import { ally, bySrd, enemy, hasLog, hero, makeState } from "./helpers/fighter-harness";
import type { Combatant } from "../types";

// Рыцарь Эха, рыцарь Пурпурного дракона и Мистический рыцарь. Math.random = 0.5: к20 = 11, к6 = 4, к8 = 5; атака героя +7.

let h: Combatant;
let foe: Combatant;
let state: any;

function setup(subclass: string, level: number, foeExtra: Partial<Combatant> = {}) {
  h = hero("h", subclass, level, { x: 5, y: 5 });
  foe = enemy("orc", 12, 5, foeExtra);
  state = makeState([h, foe]);
}

const echoes = (c: Combatant) => c.conditions.filter((x) => x.type === "echo").map((x) => x.source);

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Рыцарь Эха", () => {
  it("Манифест эха: бонусное действие, эхо в клетке до 15 футов, новое эхо заменяет прежнее", () => {
    setup("Рыцарь Эха", 3);
    const id = bySrd(h, "echo-knight/manifest-echo").id;
    useAbility(state, "h", id, { center: { x: 8, y: 5 } });
    expect(echoes(h)).toEqual(["8,5"]);
    expect(h.bonusActionUsed).toBe(true);
    h.bonusActionUsed = false;
    useAbility(state, "h", id, { center: { x: 5, y: 8 } });
    expect(echoes(h)).toEqual(["5,8"]);
  });

  it("эхо нельзя поставить дальше 15 футов и в занятую клетку", () => {
    setup("Рыцарь Эха", 3);
    const id = bySrd(h, "echo-knight/manifest-echo").id;
    expect(() => useAbility(state, "h", id, { center: { x: 12, y: 5 } })).toThrow(/15 футов/);
    expect(() => useAbility(state, "h", id, { center: { x: 5, y: 5 } })).toThrow(/занята/);
    expect(echoes(h)).toEqual([]);
  });

  it("без указания клетки эхо появляется само между рыцарем и врагом", () => {
    setup("Рыцарь Эха", 3);
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id);
    expect(echoes(h)).toHaveLength(1);
  });

  it("эхо двигается на 30 футов раз в ход без действия", () => {
    setup("Рыцарь Эха", 3);
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 5 } });
    const move = bySrd(h, "echo-knight/echo-move").id;
    useAbility(state, "h", move, { center: { x: 12, y: 8 } });
    expect(echoes(h)).toEqual(["12,8"]);
    expect(h.actionUsed).toBe(false);
    expect(h.bonusActionUsed).toBe(true); // от Манифеста
    expect(() => useAbility(state, "h", move, { center: { x: 13, y: 8 } })).toThrow(/уже двигалось/);
    expect(() => useAbility(state, "h", move, { center: { x: 50, y: 50 } })).toThrow();
  });

  it("обмен местами: бонусное действие, −15 футов перемещения", () => {
    setup("Рыцарь Эха", 3);
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 5 } });
    h.bonusActionUsed = false;
    useAbility(state, "h", bySrd(h, "echo-knight/echo-swap").id);
    expect([h.x, h.y]).toEqual([8, 5]);
    expect(echoes(h)).toEqual(["5,5"]);
    expect(h.movementUsed).toBe(15);
  });

  it("атака из позиции эха достаёт врага, до которого сам рыцарь не достаёт, и стоит атаку из Действия", () => {
    setup("Рыцарь Эха", 3);
    foe.x = 9;
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 5 } });
    const res = useAbility(state, "h", bySrd(h, "echo-knight/echo-strike").id, { targetIds: ["orc"] });
    expect(res.targets[0].hit).toBe(true);
    expect(foe.hpCurrent).toBe(200 - 8);
    expect([h.x, h.y]).toEqual([5, 5]);
    expect(h.actionUsed).toBe(true);
  });

  it("Раскрыть потенциал: дополнительная рукопашная атака с позиции эха, тратит использование", () => {
    setup("Рыцарь Эха", 3);
    foe.x = 9;
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 5 } });
    const unleash = bySrd(h, "echo-knight/unleash-incarnation");
    expect(() => useAbility(state, "h", unleash.id, { targetIds: ["orc"] })).toThrow(/Атака/);
    performAttack(state, "h", "orc", "bow");
    const res = useAbility(state, "h", unleash.id, { targetIds: ["orc"] });
    expect(res.targets[0].hit).toBe(true);
    expect(unleash.usesUsed).toBe(1);
    expect(foe.hpCurrent).toBe(200 - 1 - 5 - 8);
  });

  it("эхо дальше 30 футов от рыцаря в конце его хода рассеивается", () => {
    setup("Рыцарь Эха", 3);
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 5 } });
    h.x = 0;
    endTurn(state);
    expect(echoes(h)).toEqual([]);
  });

  it("провоцированная атака с позиции эха, когда враг уходит от эха", () => {
    setup("Рыцарь Эха", 3);
    foe.x = 9;
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 5 } });
    const hp = foe.hpCurrent;
    moveCombatant(state, "orc", { x: 12, y: 5 }, { skipTurnCheck: true });
    expect(foe.hpCurrent).toBeLessThan(hp);
    expect(h.reactionUsed).toBe(true);
  });

  it("Эхо-мученик: эхо принимает удар за раненого союзника и разрушается", () => {
    setup("Рыцарь Эха", 10);
    foe.x = 7;
    const friend = ally("friend", 6, 5, { hpCurrent: 15, hpMax: 40 });
    state = makeState([h, foe, friend]);
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 5 } });
    h.bonusActionUsed = false;
    const out = performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(out.hit).toBe(false);
    expect(friend.hpCurrent).toBe(15);
    expect(echoes(h)).toEqual([]);
    expect(h.reactionUsed).toBe(true);
    expect(bySrd(h, "echo-knight/shadow-martyr").usesUsed).toBe(1);
    expect(hasLog(state, "Эхо-мученик")).toBe(true);
  });

  it("Эхо-мученик: если нападающий промахнулся по эху, эхо остаётся", () => {
    setup("Рыцарь Эха", 10);
    foe.x = 7;
    foe.attacks[0].attackBonus = -5;
    const friend = ally("friend", 6, 5, { hpCurrent: 15, hpMax: 40 });
    state = makeState([h, foe, friend]);
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 6 } });
    performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(echoes(h)).toHaveLength(1);
    expect(friend.hpCurrent).toBe(15);
  });

  it("Эхо-мученик не нужен здоровому союзнику", () => {
    setup("Рыцарь Эха", 10);
    foe.x = 7;
    const friend = ally("friend", 6, 5);
    state = makeState([h, foe, friend]);
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 5 } });
    performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(echoes(h)).toHaveLength(1);
    expect(friend.hpCurrent).toBe(32);
  });

  it("Поглотить потенциал: разрушенное эхо даёт 2к6 + Телосложение временных хитов", () => {
    setup("Рыцарь Эха", 15);
    foe.x = 7;
    const friend = ally("friend", 6, 5, { hpCurrent: 15, hpMax: 40 });
    state = makeState([h, foe, friend]);
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 5 } });
    performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(h.hpTemp).toBe(4 + 4 + 2);
    expect(bySrd(h, "echo-knight/reclaim-potential").usesUsed).toBe(1);
  });

  it("Легион единого: два эха одновременно", () => {
    setup("Рыцарь Эха", 18);
    const id = bySrd(h, "echo-knight/manifest-echo").id;
    useAbility(state, "h", id, { center: { x: 8, y: 5 } });
    h.bonusActionUsed = false;
    useAbility(state, "h", id, { center: { x: 5, y: 8 } });
    expect(echoes(h)).toHaveLength(2);
  });

  it("Аватар эха: слепота рыцаря включается и выключается", () => {
    setup("Рыцарь Эха", 7);
    useAbility(state, "h", bySrd(h, "echo-knight/manifest-echo").id, { center: { x: 8, y: 5 } });
    const avatar = bySrd(h, "echo-knight/echo-avatar").id;
    useAbility(state, "h", avatar);
    expect(h.conditions.some((x) => x.type === "blinded")).toBe(true);
    useAbility(state, "h", avatar);
    expect(h.conditions.some((x) => x.type === "blinded")).toBe(false);
  });
});

describe("Рыцарь Пурпурного дракона", () => {
  it("Сплочающий крик: Второе дыхание лечит до трёх раненых союзников на уровень воина", () => {
    setup("Рыцарь Пурпурного дракона", 3);
    const a = ally("a", 6, 5, { hpCurrent: 10, hpMax: 40 });
    const b = ally("b", 6, 6, { hpCurrent: 20, hpMax: 40 });
    const c = ally("c", 6, 7, { hpCurrent: 30, hpMax: 40 });
    const d = ally("d", 6, 8, { hpCurrent: 35, hpMax: 40 });
    const far = ally("far", 25, 5, { hpCurrent: 1, hpMax: 40 });
    state = makeState([h, foe, a, b, c, d, far]);
    h.hpCurrent = 20;
    useAbility(state, "h", bySrd(h, "fighter/second-wind").id);
    expect(a.hpCurrent).toBe(13);
    expect(b.hpCurrent).toBe(23);
    expect(c.hpCurrent).toBe(33);
    expect(d.hpCurrent).toBe(35);
    expect(far.hpCurrent).toBe(1);
  });

  it("Вдохновляющий всплеск: Всплеск действий даёт союзнику атаку реакцией", () => {
    setup("Рыцарь Пурпурного дракона", 10);
    foe.x = 7;
    const friend = ally("friend", 8, 5);
    state = makeState([h, foe, friend]);
    useAbility(state, "h", bySrd(h, "fighter/action-surge").id);
    expect(friend.reactionUsed).toBe(true);
    expect(foe.hpCurrent).toBeLessThan(200);
    expect(hasLog(state, "Вдохновляющий всплеск")).toBe(true);
  });

  it("Вдохновляющий всплеск на 18 уровне — два союзника", () => {
    setup("Рыцарь Пурпурного дракона", 18);
    foe.x = 7;
    const f1 = ally("f1", 8, 5);
    const f2 = ally("f2", 8, 6);
    const f3 = ally("f3", 8, 4);
    state = makeState([h, foe, f1, f2, f3]);
    useAbility(state, "h", bySrd(h, "fighter/action-surge").id);
    expect([f1, f2, f3].filter((f) => f.reactionUsed)).toHaveLength(2);
  });

  it("до 10 уровня Всплеск действий союзникам ничего не даёт", () => {
    setup("Рыцарь Пурпурного дракона", 9);
    foe.x = 7;
    const friend = ally("friend", 8, 5);
    state = makeState([h, foe, friend]);
    useAbility(state, "h", bySrd(h, "fighter/action-surge").id);
    expect(friend.reactionUsed).toBe(false);
  });
});

describe("Мистический рыцарь", () => {
  const cantrip = { id: "fire_bolt", name: "Огненный снаряд", level: 0, parameters: { name: "Огненный снаряд", type: "spell" as const, actionCost: "action" as const, range: { type: "ranged" as const, value: 120 }, targeting: "creature" as const, damage: [{ dice: "1d10", mod: 0, type: "fire" }], attackRoll: true } };
  const leveled = { ...cantrip, id: "magic_missile", name: "Волшебная стрела", level: 1, parameters: { ...cantrip.parameters, name: "Волшебная стрела", level: 1 } };

  it("Боевая магия: после заговора — атака оружием бонусным действием", () => {
    setup("Мистический рыцарь", 7);
    foe.x = 6;
    h.spells = { slots: { 1: { max: 2, used: 0 } }, known: [], spellSaveDC: 13, spellAttackBonus: 7 } as any;
    castSpell(state, "h", cantrip, { targetIds: ["orc"] });
    expect(h.conditions.some((x) => x.type === "war_magic_ready")).toBe(true);
    const res = useAbility(state, "h", bySrd(h, "eldritch-knight/war-magic-strike").id, { targetIds: ["orc"] });
    expect(res.targets[0].hit).toBe(true);
    expect(h.bonusActionUsed).toBe(true);
    expect(h.conditions.some((x) => x.type === "war_magic_ready")).toBe(false);
  });

  it("Боевая магия: после заклинания с кругом атака не даётся до 18 уровня, а на 18 — даётся", () => {
    setup("Мистический рыцарь", 7);
    foe.x = 6;
    h.spells = { slots: { 1: { max: 2, used: 0 } }, known: [], spellSaveDC: 13, spellAttackBonus: 7 } as any;
    castSpell(state, "h", leveled, { targetIds: ["orc"], slotLevel: 1 });
    expect(h.conditions.some((x) => x.type === "war_magic_ready")).toBe(false);
    expect(() => useAbility(state, "h", bySrd(h, "eldritch-knight/war-magic-strike").id, { targetIds: ["orc"] })).toThrow(/Боевая магия/);

    setup("Мистический рыцарь", 18);
    foe.x = 6;
    h.spells = { slots: { 1: { max: 2, used: 0 } }, known: [], spellSaveDC: 13, spellAttackBonus: 7 } as any;
    castSpell(state, "h", leveled, { targetIds: ["orc"], slotLevel: 1 });
    expect(h.conditions.some((x) => x.type === "war_magic_ready")).toBe(true);
  });

  it("Мистический удар: попадание оружием даёт цели помеху на следующий спасбросок против заклинания", () => {
    setup("Мистический рыцарь", 10);
    foe.x = 6;
    performAttack(state, "h", "orc", "sword");
    expect(foe.conditions.some((x) => x.type === "eldritch_struck")).toBe(true);
    const normal = rollSave(foe, "DEX", 10, { isSpell: false });
    const vsSpell = rollSave(foe, "DEX", 10, { isSpell: true });
    expect(normal.advantage).toBe(false);
    expect(vsSpell.roll.mode).toBe("disadvantage");
    // помеха тратится на первом спасброске
    expect(foe.conditions.some((x) => x.type === "eldritch_struck")).toBe(false);
  });

  it("Мистический натиск: сразу после Всплеска действий — телепортация до 30 футов", () => {
    setup("Мистический рыцарь", 15);
    const id = bySrd(h, "eldritch-knight/arcane-charge").id;
    expect(() => useAbility(state, "h", id, { center: { x: 9, y: 5 } })).toThrow(/Всплеска/);
    useAbility(state, "h", bySrd(h, "fighter/action-surge").id);
    expect(() => useAbility(state, "h", id, { center: { x: 25, y: 5 } })).toThrow(/30 футов/);
    useAbility(state, "h", id, { center: { x: 10, y: 8 } });
    expect([h.x, h.y]).toEqual([10, 8]);
  });
});
