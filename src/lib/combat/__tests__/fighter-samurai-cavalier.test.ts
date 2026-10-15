import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dealDamage, endTurn, moveCombatant, performAttack, startTurn, useAbility } from "../engine";
import { computeAttackAdvantage, canAct } from "../rules";
import { ally, bySrd, enemy, hasLog, hero, makeState } from "./helpers/fighter-harness";
import type { Combatant } from "../types";

// Самурай и Кавалерист. Math.random = 0.5: к20 = 11, к6 = 4, к8 = 5, к12 = 7; атака героя +7 (11 + 7 = 18).

let h: Combatant;
let foe: Combatant;
let state: any;

function setup(subclass: string, level: number, names: string[] = [], foeExtra: Partial<Combatant> = {}) {
  h = hero("h", subclass, level, { sheet: { featuresTraits: names.join("\n") }, x: 5, y: 5 });
  foe = enemy("orc", 6, 5, foeExtra);
  state = makeState([h, foe]);
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Самурай", () => {
  it("Боевой дух: бонусное действие, 5 временных хитов, преимущество на атаки оружием", () => {
    setup("Самурай", 3);
    const spirit = bySrd(h, "samurai/fighting-spirit");
    useAbility(state, "h", spirit.id);
    expect(h.hpTemp).toBe(5);
    expect(h.bonusActionUsed).toBe(true);
    expect(spirit.usesUsed).toBe(1);
    const adv = computeAttackAdvantage(h, foe, h.attacks[0], {}, { distanceFt: 5, allCombatants: state.combatants });
    expect(adv.advantage).toBe(true);
  });

  it("временные хиты растут с уровнем: 10 на 10-м, 15 на 15-м", () => {
    for (const [level, temp] of [
      [10, 10],
      [15, 15],
    ] as const) {
      setup("Самурай", level);
      useAbility(state, "h", bySrd(h, "samurai/fighting-spirit").id);
      expect(h.hpTemp, `уровень ${level}`).toBe(temp);
    }
  });

  it("Стремительный удар: преимущество отдано за дополнительную атаку в том же действии", () => {
    setup("Самурай", 15);
    h.attacksPerAction = 2;
    useAbility(state, "h", bySrd(h, "samurai/fighting-spirit").id);
    performAttack(state, "h", "orc", "sword");
    useAbility(state, "h", bySrd(h, "samurai/rapid-strike").id, { targetIds: ["orc"] });
    expect(h.attacksPerAction).toBe(3);
    const out = performAttack(state, "h", "orc", "sword");
    expect(out.text).toContain("Стремительный удар");
    expect(h.conditions.some((x) => x.type === "rapid_strike")).toBe(false);
    // третья атака действия — снова с преимуществом
    const third = performAttack(state, "h", "orc", "sword");
    expect(third.hit).toBe(true);
    expect(h.attacksMadeThisAction).toBe(3);
  });

  it("Стремительный удар нужен только при преимуществе и раз в ход", () => {
    setup("Самурай", 15);
    h.attacksPerAction = 2;
    performAttack(state, "h", "orc", "sword");
    expect(() => useAbility(state, "h", bySrd(h, "samurai/rapid-strike").id, { targetIds: ["orc"] })).toThrow(/нет преимущества|Нет преимущества/i);
    useAbility(state, "h", bySrd(h, "samurai/fighting-spirit").id);
    useAbility(state, "h", bySrd(h, "samurai/rapid-strike").id, { targetIds: ["orc"] });
    expect(() => useAbility(state, "h", bySrd(h, "samurai/rapid-strike").id, { targetIds: ["orc"] })).toThrow();
  });

  it("Стойкость перед смертью: 0 хитов без потери сознания, дополнительный ход, затем обморок", () => {
    setup("Самурай", 18);
    state = makeState([foe, h]);
    h.hpCurrent = 5;
    foe.x = 6;
    // ход орка
    performAttack(state, "orc", "h", "sword", { skipTurnCheck: true });
    expect(h.hpCurrent).toBe(0);
    expect(h.conditions.some((x) => x.type === "unconscious")).toBe(false);
    expect(h.conditions.some((x) => x.type === "strength_before_death")).toBe(true);
    expect(h.reactionUsed).toBe(true);
    expect(state.turnOrder).toEqual(["orc", "h", "h"]);
    // пока дополнительный ход не наступил, добивающий урон не засчитывается
    dealDamage(state, "h", 30, { isAttack: true, attackerId: "orc" });
    expect(h.conditions.some((x) => x.type === "dead" || x.type === "death_save")).toBe(false);

    // ход орка заканчивается, наступает дополнительный ход самурая
    endTurn(state);
    expect(state.current().id).toBe("h");
    expect(canAct(h)).toBe(true);
    const out = performAttack(state, "h", "orc", "sword");
    expect(out.hit).toBe(true);
    // урон во время дополнительного хода — провал спасброска от смерти
    dealDamage(state, "h", 3, { isAttack: false });
    expect(h.conditions.find((x) => x.type === "death_save")?.value).toBe(1);
    endTurn(state);
    expect(h.conditions.some((x) => x.type === "unconscious")).toBe(true);
    expect(state.turnOrder.filter((id: string) => id === "h")).toHaveLength(1);
  });

  it("Стойкость перед смертью не срабатывает при мгновенной смерти и без реакции", () => {
    setup("Самурай", 18);
    h.hpCurrent = 5;
    dealDamage(state, "h", 5 + h.hpMax, { isAttack: false });
    expect(h.conditions.some((x) => x.type === "strength_before_death")).toBe(false);
    setup("Самурай", 18);
    h.hpCurrent = 5;
    h.reactionUsed = true;
    dealDamage(state, "h", 10, { isAttack: false });
    expect(h.conditions.some((x) => x.type === "strength_before_death")).toBe(false);
    expect(h.conditions.some((x) => x.type === "unconscious")).toBe(true);
  });
});

describe("Кавалерист", () => {
  it("Непоколебимая метка: рукопашное попадание помечает цель, метка у чужой цели снимается", () => {
    setup("Кавалерист", 3);
    performAttack(state, "h", "orc", "sword");
    const mark = foe.conditions.find((x) => x.type === "unwavering_mark");
    expect(mark?.source).toBe("h");
    expect(hasLog(state, "Непоколебимой меткой")).toBe(true);
  });

  it("помеченный рядом с рыцарем атакует других с помехой, самого рыцаря — без", () => {
    setup("Кавалерист", 3);
    const friend = ally("friend", 6, 6);
    state = makeState([h, foe, friend]);
    performAttack(state, "h", "orc", "sword");
    const against = (target: Combatant) => computeAttackAdvantage(foe, target, foe.attacks[0], {}, { distanceFt: 5, allCombatants: state.combatants });
    expect(against(friend).disadvantage).toBe(true);
    expect(against(h).disadvantage).toBe(false);
  });

  it("помеченный навредил не рыцарю: особая атака бонусным действием с преимуществом и +½ уровня урона", () => {
    setup("Кавалерист", 10);
    const friend = ally("friend", 7, 5);
    state = makeState([h, foe, friend]);
    performAttack(state, "h", "orc", "sword");
    performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(h.conditions.some((x) => x.type === "mark_punish" && x.targetId === "orc")).toBe(true);
    // новый ход рыцаря
    state.round += 1;
    startTurn(state);
    const before = foe.hpCurrent;
    const res = useAbility(state, "h", bySrd(h, "cavalier/unwavering-mark").id, { targetIds: ["orc"] });
    expect(res.targets[0].hit).toBe(true);
    // 1к8 (5) + 3 + половина уровня (5)
    expect(before - foe.hpCurrent).toBe(5 + 3 + 5);
    expect(h.bonusActionUsed).toBe(true);
    expect(bySrd(h, "cavalier/unwavering-mark").usesUsed).toBe(1);
    expect(h.conditions.some((x) => x.type === "mark_punish")).toBe(false);
  });

  it("особая атака невозможна, если помеченный никому не навредил", () => {
    setup("Кавалерист", 3);
    performAttack(state, "h", "orc", "sword");
    expect(() => useAbility(state, "h", bySrd(h, "cavalier/unwavering-mark").id, { targetIds: ["orc"] })).toThrow(/Особая атака/);
  });

  it("метка держится до конца следующего хода рыцаря", () => {
    setup("Кавалерист", 3);
    performAttack(state, "h", "orc", "sword");
    endTurn(state);
    expect(foe.conditions.some((x) => x.type === "unwavering_mark")).toBe(true);
    state.currentTurnIndex = 0;
    endTurn(state);
    expect(foe.conditions.some((x) => x.type === "unwavering_mark")).toBe(false);
  });

  it("Защитный манёвр: +1к8 к КД союзника рядом превращает попадание в промах", () => {
    setup("Кавалерист", 7);
    const friend = ally("friend", 4, 5, { ac: 16 });
    state = makeState([h, foe, friend]);
    foe.x = 3;
    const out = performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    // бросок 18 против КД 16 + 5
    expect(out.hit).toBe(false);
    expect(friend.hpCurrent).toBe(40);
    expect(h.reactionUsed).toBe(true);
    expect(bySrd(h, "cavalier/warding-maneuver").usesUsed).toBe(1);
  });

  it("Защитный манёвр: если удар всё равно попал, цель получает половину урона", () => {
    setup("Кавалерист", 7);
    const friend = ally("friend", 4, 5, { ac: 10 });
    state = makeState([h, foe, friend]);
    foe.x = 3;
    performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(friend.hpCurrent).toBe(40 - 4);
  });

  it("Защитный манёвр: союзник дальше 5 футов от рыцаря не прикрыт", () => {
    setup("Кавалерист", 7);
    const friend = ally("friend", 5, 8, { ac: 10 });
    state = makeState([h, foe, friend]);
    foe.x = 5;
    foe.y = 9;
    performAttack(state, "orc", "friend", "sword", { skipTurnCheck: true });
    expect(friend.hpCurrent).toBe(40 - 8);
    expect(bySrd(h, "cavalier/warding-maneuver").usesUsed).toBe(0);
  });

  it("Держать строй: враг, двигающийся рядом, получает провоцированную атаку, при попадании скорость 0", () => {
    setup("Кавалерист", 10);
    const out = moveCombatant(state, "orc", { x: 6, y: 6 }, { skipTurnCheck: true });
    expect(out.path.length).toBe(1);
    expect(h.reactionUsed).toBe(true);
    expect(foe.hpCurrent).toBeLessThan(200);
    expect(foe.movementUsed).toBeGreaterThanOrEqual(30);
    expect(hasLog(state, "Держать строй")).toBe(true);
  });

  it("Держать строй: без умения (9 уровень) провоцированной атаки нет", () => {
    setup("Кавалерист", 9);
    moveCombatant(state, "orc", { x: 6, y: 6 }, { skipTurnCheck: true });
    expect(h.reactionUsed).toBe(false);
    expect(foe.hpCurrent).toBe(200);
  });

  it("Свирепый натиск: разбег 10+ футов по прямой и попадание — цель сбита с ног, раз в ход", () => {
    setup("Кавалерист", 15);
    h.x = 1;
    h.attacksPerAction = 2;
    foe.x = 6;
    moveCombatant(state, "h", { x: 5, y: 5 }, { skipTurnCheck: true });
    performAttack(state, "h", "orc", "sword");
    expect(foe.conditions.some((x) => x.type === "prone")).toBe(true);
    expect(bySrd(h, "cavalier/ferocious-charger").usesUsed).toBe(1);
    foe.conditions = foe.conditions.filter((x) => x.type !== "prone");
    performAttack(state, "h", "orc", "sword");
    expect(foe.conditions.some((x) => x.type === "prone")).toBe(false);
  });

  it("Свирепый натиск: короткий разбег не сбивает", () => {
    setup("Кавалерист", 15);
    h.x = 4;
    moveCombatant(state, "h", { x: 5, y: 5 }, { skipTurnCheck: true });
    performAttack(state, "h", "orc", "sword");
    expect(foe.conditions.some((x) => x.type === "prone")).toBe(false);
    expect(bySrd(h, "cavalier/ferocious-charger").usesUsed).toBe(0);
  });

  it("Бдительный защитник: вторая реакция для провоцированной атаки на каждый чужой ход", () => {
    setup("Кавалерист", 18);
    h.reactionUsed = true;
    moveCombatant(state, "orc", { x: 6, y: 6 }, { skipTurnCheck: true });
    expect(foe.hpCurrent).toBeLessThan(200);
    expect(hasLog(state, "Бдительный защитник")).toBe(true);
    const hp = foe.hpCurrent;
    foe.movementUsed = 0;
    moveCombatant(state, "orc", { x: 6, y: 5 }, { skipTurnCheck: true });
    expect(foe.hpCurrent).toBe(hp);
  });
});
