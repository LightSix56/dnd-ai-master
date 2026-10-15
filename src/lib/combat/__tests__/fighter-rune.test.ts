import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dealDamage, endTurn, performAttack, startTurn, useAbility } from "../engine";
import { rollSave } from "../rules";
import { ally, bySrd, enemy, hasLog, hero, makeState } from "./helpers/fighter-harness";
import type { Combatant } from "../types";

// Рунный рыцарь: Мощь великана, руны и Рунический щит работают сами.
// Math.random = 0.5: к20 = 11, к6 = 4, к8 = 5, к10 = 6; бонус мастерства 3, Телосложение +2 (СЛ рун 13).

const RK = "Рунный рыцарь";
const runes = (...names: string[]) => ({ featuresTraits: names.join("\n") });

let h: Combatant;
let foe: Combatant;
let state: any;

function setup(names: string[], level = 3, foeExtra: Partial<Combatant> = {}) {
  h = hero("rk", RK, level, { sheet: runes(...names), x: 5, y: 5 });
  foe = enemy("orc", 6, 5, foeExtra);
  state = makeState([h, foe]);
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Мощь великана", () => {
  it("бонусное действие: размер Большой, преимущество на Силу, три использования за долгий отдых", () => {
    setup([]);
    const gm = bySrd(h, "rune-knight/giants-might");
    expect(gm.usesMax).toBe(3);
    useAbility(state, "rk", gm.id);
    expect(h.bonusActionUsed).toBe(true);
    expect(h.size).toBe("large");
    expect(gm.usesUsed).toBe(1);
    expect(h.conditions.some((x) => x.type === "giants_might")).toBe(true);
  });

  it("раз в ход оружие наносит 1к6 дополнительного урона, во второй атаке — нет", () => {
    setup([]);
    h.attacksPerAction = 2;
    useAbility(state, "rk", bySrd(h, "rune-knight/giants-might").id);
    const first = performAttack(state, "rk", "orc", "sword");
    expect(first.damage).toBe(5 + 3 + 4);
    const second = performAttack(state, "rk", "orc", "sword");
    expect(second.damage).toBe(5 + 3);
  });

  it("кость растёт: к8 на 10 уровне, к10 на 18", () => {
    for (const [level, extra] of [
      [10, 5],
      [18, 6],
    ] as const) {
      setup([], level);
      useAbility(state, "rk", bySrd(h, "rune-knight/giants-might").id);
      const out = performAttack(state, "rk", "orc", "sword");
      expect(out.damage, `уровень ${level}`).toBe(5 + 3 + extra);
    }
  });

  it("на 18 уровне размер Огромный; по окончании возвращается прежний", () => {
    setup([], 18);
    useAbility(state, "rk", bySrd(h, "rune-knight/giants-might").id);
    expect(h.size).toBe("huge");
    h.conditions.find((x) => x.type === "giants_might")!.duration = 1;
    endTurn(state);
    expect(h.size).toBe("medium");
  });

  it("крит удваивает дополнительную кость", () => {
    setup([]);
    useAbility(state, "rk", bySrd(h, "rune-knight/giants-might").id);
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const out = performAttack(state, "rk", "orc", "sword");
    expect(out.crit).toBe(true);
    // 2к8 (8+8) + 3 + 2к6 (6+6)
    expect(out.damage).toBe(16 + 3 + 12);
  });
});

describe("руны", () => {
  it("Ледяная руна: +2 к спасброскам Силы и Телосложения, одно использование", () => {
    setup(["Ледяная руна"]);
    const rune = bySrd(h, "rune-knight/frost-rune");
    const before = rollSave(h, "CON", 10);
    useAbility(state, "rk", rune.id);
    const after = rollSave(h, "CON", 10);
    expect(after.roll.total - before.roll.total).toBe(2);
    expect(rune.usesUsed).toBe(1);
    expect(h.bonusActionUsed).toBe(true);
    expect(() => useAbility(state, "rk", rune.id)).toThrow();
  });

  it("Холмовая руна: сопротивление дробящему, рубящему и колющему урону", () => {
    setup(["Холмовая руна"]);
    useAbility(state, "rk", bySrd(h, "rune-knight/hill-rune").id);
    dealDamage(state, "rk", 10, { isAttack: false, damageType: "slashing" });
    expect(h.hpCurrent).toBe(35);
    dealDamage(state, "rk", 10, { isAttack: false, damageType: "fire" });
    expect(h.hpCurrent).toBe(25);
  });

  it("Огненная руна: заряд тратится при попадании, 2к6 огня и опутывание кандалами при провале спасброска Силы", () => {
    setup(["Огненная руна"]);
    const rune = bySrd(h, "rune-knight/fire-rune");
    useAbility(state, "rk", rune.id);
    expect(rune.usesUsed).toBe(0);
    const out = performAttack(state, "rk", "orc", "sword");
    expect(out.damage).toBe(5 + 3 + 8);
    expect(rune.usesUsed).toBe(1);
    const shackles = foe.conditions.find((x) => x.type === "fire_shackles");
    expect(shackles).toMatchObject({ saveType: "STR", saveDC: 13 });
  });

  it("Огненная руна: при успешном спасброске кандалов нет", () => {
    setup(["Огненная руна"], 3, { abilityMods: { STR: 6, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 } });
    useAbility(state, "rk", bySrd(h, "rune-knight/fire-rune").id);
    performAttack(state, "rk", "orc", "sword");
    expect(foe.conditions.some((x) => x.type === "fire_shackles")).toBe(false);
  });

  it("Каменная руна: враг, закончивший ход в 30 футах, околдован реакцией рыцаря", () => {
    setup(["Каменная руна"]);
    state.currentTurnIndex = 1; // ход врага
    endTurn(state);
    expect(foe.conditions.some((x) => x.type === "stone_trance")).toBe(true);
    expect(bySrd(h, "rune-knight/stone-rune").usesUsed).toBe(1);
    expect(hasLog(state, "Каменная руна")).toBe(true);
  });

  it("Каменная руна: успешный спасбросок Мудрости — ничего", () => {
    setup(["Каменная руна"], 3, { abilityMods: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 6, CHA: 0 } });
    state.currentTurnIndex = 1;
    endTurn(state);
    expect(foe.conditions.some((x) => x.type === "stone_trance")).toBe(false);
  });

  it("Каменная руна: дальше 30 футов не срабатывает", () => {
    setup(["Каменная руна"]);
    foe.x = 5 + 8;
    state.currentTurnIndex = 1;
    endTurn(state);
    expect(foe.conditions.some((x) => x.type === "stone_trance")).toBe(false);
    expect(bySrd(h, "rune-knight/stone-rune").usesUsed).toBe(0);
  });

  it("Облачная руна: удар по союзнику уходит на другого врага рыцаря в 30 футах", () => {
    setup(["Облачная руна"]);
    const friend = ally("friend", 7, 5, { hpCurrent: 20, hpMax: 40 });
    const other = enemy("other", 8, 6);
    state = makeState([h, foe, other, friend]);
    performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(friend.hpCurrent).toBe(20);
    expect(other.hpCurrent).toBe(200 - 8);
    expect(bySrd(h, "rune-knight/cloud-rune").usesUsed).toBe(1);
    expect(h.reactionUsed).toBe(true);
  });

  it("Облачная руна: цель с КД выше броска — удар уходит впустую", () => {
    setup(["Облачная руна"]);
    const friend = ally("friend", 7, 5, { hpCurrent: 20, hpMax: 40 });
    const other = enemy("other", 8, 6, { ac: 30 });
    state = makeState([h, foe, other, friend]);
    performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(friend.hpCurrent).toBe(20);
    expect(other.hpCurrent).toBe(200);
  });

  it("Облачная руна: пустяковый урон реакции не стоит", () => {
    setup(["Облачная руна"]);
    const other = enemy("other", 7, 5);
    state = makeState([h, foe, other]);
    h.hpCurrent = h.hpMax;
    const out = performAttack(state, "orc", "rk", "sword", { skipTurnCheck: true });
    expect(out.hit).toBe(true);
    expect(h.hpCurrent).toBe(40 - 8);
    expect(h.reactionUsed).toBe(false);
  });
});

describe("Рунический щит", () => {
  it("попадание по союзнику в 60 футах: нападающий перебрасывает к20 и промахивается", () => {
    setup([], 7);
    const friend = ally("friend", 7, 5, { hpCurrent: 20, hpMax: 40 });
    state = makeState([h, foe, friend]);
    vi.spyOn(Math, "random").mockReset();
    vi.spyOn(Math, "random").mockReturnValueOnce(0.5).mockReturnValue(0);
    const out = performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(out.hit).toBe(false);
    expect(friend.hpCurrent).toBe(20);
    expect(h.reactionUsed).toBe(true);
    expect(bySrd(h, "rune-knight/runic-shield").usesUsed).toBe(1);
  });

  it("если после переброса удар всё равно попал, урон остаётся", () => {
    setup([], 7);
    const friend = ally("friend", 7, 5, { hpCurrent: 20, hpMax: 40 });
    state = makeState([h, foe, friend]);
    const out = performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(out.hit).toBe(true);
    expect(friend.hpCurrent).toBe(12);
    expect(bySrd(h, "rune-knight/runic-shield").usesUsed).toBe(1);
  });

  it("на самого рыцаря и дальше 60 футов не работает", () => {
    setup([], 7);
    performAttack(state, "orc", "rk", "sword", { skipTurnCheck: true });
    expect(bySrd(h, "rune-knight/runic-shield").usesUsed).toBe(0);
    foe.actionUsed = false;
    foe.attacksMadeThisAction = 0;
    const far = ally("far", 5 + 15, 5, { hpCurrent: 20, hpMax: 40 });
    foe.x = 5 + 14;
    state = makeState([h, foe, far]);
    performAttack(state, "orc", "far", "sword", { skipTurnCheck: true });
    expect(bySrd(h, "rune-knight/runic-shield").usesUsed).toBe(0);
  });
});
