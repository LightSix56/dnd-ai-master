import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dealDamage, endTurn, moveCombatant, performAttack, rollEffectSave, useAbility } from "../engine";
import { computeAttackAdvantage, effectiveAC, effectiveSpeed } from "../rules";
import { modOpportunityDisadvantage } from "../feature-mods";
import { SUBCLASSES, subclassRuleKeys, classRules } from "../class-defs";
import { kitHandles } from "../class-kit";
import { ally, bySrd, classHero, cond, enemy, hasKey, hasLog, makeState } from "./helpers/class-harness";
import type { Combatant } from "../types";

// Варвар: Ярость и девять путей. Math.random = 0.5: к20 = 11, к4 = 3, к6 = 4, к8 = 5, к12 = 7.
// Атака героя +7 (11 + 7 = 18), меч 1к8+3 = 8; у врага КД 10, 200 хитов, все модификаторы −5.

let b: Combatant;
let foe: Combatant;
let state: any;

function setup(subclass: string, level: number, sheet: Record<string, any> = {}, extra: Combatant[] = []) {
  b = classHero("Варвар", "b", subclass, level, { sheet, x: 5, y: 5 });
  foe = enemy("orc", 6, 5);
  state = makeState([b, foe, ...extra]);
}

const rage = () => useAbility(state, "b", bySrd(b, "barbarian/rage").id);
const use = (key: string, opts: Record<string, any> = {}) => useAbility(state, "b", bySrd(b, key).id, opts);
const raging = () => !!cond(b, "raging");

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Варвар: Ярость", () => {
  it("бонус урона и сопротивление физическому урону приходят из поправок состояния", () => {
    setup("", 1);
    rage();
    expect(b.bonusActionUsed).toBe(true);
    expect(bySrd(b, "barbarian/rage").usesUsed).toBe(1);
    const out = performAttack(state, "b", "orc", "sword");
    expect(out.text).toContain("ярость +2");
    expect(out.damage).toBe(10);
    dealDamage(state, "b", 10, { damageType: "slashing" });
    expect(b.hpCurrent).toBe(35);
    dealDamage(state, "b", 10, { damageType: "fire" });
    expect(b.hpCurrent).toBe(25);
  });

  it("угасает в конце хода, если варвар не атаковал врага и не получал урона", () => {
    setup("", 1);
    rage();
    endTurn(state);
    expect(raging()).toBe(false);
    expect(hasLog(state, "Ярость угасла")).toBe(true);
  });

  it("держится после атаки по врагу и после полученного урона", () => {
    setup("", 1);
    rage();
    performAttack(state, "b", "orc", "sword");
    endTurn(state);
    expect(raging()).toBe(true);
    // ход врага: урон по варвару кормит ярость до конца его следующего хода
    dealDamage(state, "b", 4, { damageType: "fire" });
    endTurn(state);
    endTurn(state);
    expect(raging()).toBe(true);
    // следующий ход без атак и урона — угасает
    endTurn(state);
    endTurn(state);
    expect(raging()).toBe(false);
  });

  it("Непрекращающаяся ярость (15 ур.) не угасает без атак", () => {
    setup("", 15);
    rage();
    endTurn(state);
    expect(raging()).toBe(true);
  });

  it("заканчивается, когда варвар теряет сознание", () => {
    setup("", 1);
    rage();
    dealDamage(state, "b", 500, { damageType: "fire" });
    endTurn(state);
    expect(raging()).toBe(false);
  });
});

describe("Путь берсерка", () => {
  it("Ответный удар (14 ур.): реакцией бьёт того, кто нанёс урон в 5 футах", () => {
    setup("Путь берсерка", 14);
    const before = foe.hpCurrent;
    dealDamage(state, "b", 5, { damageType: "slashing", isAttack: true, attackerId: "orc" });
    expect(hasLog(state, "Ответный удар")).toBe(true);
    expect(b.reactionUsed).toBe(true);
    expect(foe.hpCurrent).toBeLessThan(before);
    // реакция одна: второй раз не срабатывает
    const hp = foe.hpCurrent;
    dealDamage(state, "b", 5, { damageType: "slashing", isAttack: true, attackerId: "orc" });
    expect(foe.hpCurrent).toBe(hp);
  });
});

describe("Путь тотемного воина", () => {
  const totem = (...names: string[]) => ({ traitsList: names.map((name) => ({ id: "totem-x", name })) });

  it("в бой попадает только выбранный в листе тотем", () => {
    setup("Путь тотемного воина", 3, totem("Дух тотема: Медведь"));
    expect(hasKey(b, "totem-warrior/spirit-bear")).toBe(true);
    expect(hasKey(b, "totem-warrior/spirit-wolf")).toBe(false);
    expect(hasKey(b, "totem-warrior/spirit-eagle")).toBe(false);
  });

  it("Медведь: в ярости сопротивление всему, кроме психического урона", () => {
    setup("Путь тотемного воина", 3, totem("Дух тотема: Медведь"));
    dealDamage(state, "b", 10, { damageType: "fire" });
    expect(b.hpCurrent).toBe(30);
    rage();
    dealDamage(state, "b", 10, { damageType: "fire" });
    expect(b.hpCurrent).toBe(25);
    dealDamage(state, "b", 10, { damageType: "psychic" });
    expect(b.hpCurrent).toBe(15);
  });

  it("Орёл: Рывок бонусным действием в ярости и помеха на провоцированные атаки", () => {
    setup("Путь тотемного воина", 3, totem("Дух тотема: Орёл"));
    expect(() => use("totem-warrior/spirit-eagle")).toThrow(/в Ярости/);
    expect(modOpportunityDisadvantage(b)).toBeNull();
    rage();
    expect(modOpportunityDisadvantage(b)).not.toBeNull();
    b.bonusActionUsed = false;
    use("totem-warrior/spirit-eagle");
    expect(effectiveSpeed(b)).toBe(60);
    // уход от врага: провоцированная атака идёт с помехой
    const res = moveCombatant(state, "b", { x: 2, y: 5 });
    expect(res.opportunityAttacks.length).toBe(1);
    expect(res.opportunityAttacks[0].text).toContain("помеха");
  });

  it("Волк: союзники бьют с преимуществом в ближнем бою по врагам рядом с варваром", () => {
    const friend = ally("friend", 7, 5);
    setup("Путь тотемного воина", 3, totem("Дух тотема: Волк"), [friend]);
    const adv = () => computeAttackAdvantage(friend, foe, friend.attacks[0], {}, { distanceFt: 5, allCombatants: state.combatants });
    expect(adv().advantage).toBe(false);
    rage();
    expect(adv().advantage).toBe(true);
    // дальнобойная атака преимущества не получает
    expect(computeAttackAdvantage(friend, foe, friend.attacks[1], {}, { distanceFt: 5, allCombatants: state.combatants }).reasons.join()).not.toContain("Волк");
  });

  it("Лось: +15 футов скорости в ярости", () => {
    setup("Путь тотемного воина", 3, totem("Дух тотема: Лось"));
    expect(effectiveSpeed(b)).toBe(30);
    rage();
    expect(effectiveSpeed(b)).toBe(45);
  });

  it("Гармония медведя (14 ур.): враг рядом с варваром атакует других с помехой", () => {
    const friend = ally("friend", 7, 5);
    setup("Путь тотемного воина", 14, totem("Дух тотема: Волк", "Гармония тотема: Медведь"), [friend]);
    rage();
    const vsFriend = computeAttackAdvantage(foe, friend, foe.attacks[0], {}, { distanceFt: 5, allCombatants: state.combatants });
    const vsBarbarian = computeAttackAdvantage(foe, b, foe.attacks[0], {}, { distanceFt: 5, allCombatants: state.combatants });
    expect(vsFriend.disadvantage).toBe(true);
    expect(vsBarbarian.disadvantage).toBe(false);
  });

  it("Гармония волка: после попадания бонусным действием сбивает с ног", () => {
    setup("Путь тотемного воина", 14, totem("Гармония тотема: Волк"));
    rage();
    b.bonusActionUsed = false;
    expect(() => use("totem-warrior/attune-wolf", { targetIds: ["orc"] })).toThrow(/после попадания/);
    performAttack(state, "b", "orc", "sword");
    use("totem-warrior/attune-wolf", { targetIds: ["orc"] });
    expect(cond(foe, "prone")).toBeTruthy();
  });

  it("Гармония лося: провал спасброска Силы — ничком и 1к12 + мод. Силы урона", () => {
    setup("Путь тотемного воина", 14, totem("Гармония тотема: Лось"));
    rage();
    b.bonusActionUsed = false;
    const hp = foe.hpCurrent;
    use("totem-warrior/attune-elk", { targetIds: ["orc"] });
    expect(cond(foe, "prone")).toBeTruthy();
    expect(hp - foe.hpCurrent).toBe(10);
  });

  it("Гармония тигра: дополнительная атака только после 20 футов движения", () => {
    setup("Путь тотемного воина", 14, totem("Гармония тотема: Тигр"));
    rage();
    b.bonusActionUsed = false;
    expect(() => use("totem-warrior/attune-tiger", { targetIds: ["orc"] })).toThrow(/20 футов/);
    b.movementUsed = 20;
    const hp = foe.hpCurrent;
    use("totem-warrior/attune-tiger", { targetIds: ["orc"] });
    expect(foe.hpCurrent).toBeLessThan(hp);
  });
});

describe("Путь буйствующего", () => {
  it("Шипастая броня: атака шипами бонусным действием, только в ярости", () => {
    setup("Путь буйствующего", 3);
    expect(() => use("battlerager/spiked-armor", { targetIds: ["orc"] })).toThrow(/в Ярости/);
    rage();
    b.bonusActionUsed = false;
    const hp = foe.hpCurrent;
    use("battlerager/spiked-armor", { targetIds: ["orc"] });
    // 1к4 (3) + Сила 3 + ярость 2
    expect(hp - foe.hpCurrent).toBe(8);
    expect(b.attacks.some((a) => a.id === "__armor_spikes")).toBe(false);
  });

  it("Яростный таран: Безрассудная атака в ярости даёт временные хиты", () => {
    setup("Путь буйствующего", 6);
    rage();
    use("barbarian/reckless-attack");
    expect(b.hpTemp).toBe(2);
  });

  it("Шипастый рывок (10 ур.) и Острые шипы (14 ур.)", () => {
    setup("Путь буйствующего", 14);
    rage();
    b.bonusActionUsed = false;
    use("battlerager/battlerager-charge");
    expect(effectiveSpeed(b)).toBe(60);
    const hp = foe.hpCurrent;
    dealDamage(state, "b", 6, { damageType: "slashing", isAttack: true, attackerId: "orc" });
    expect(hp - foe.hpCurrent).toBe(3);
  });
});

describe("Путь хранителя предков", () => {
  it("Защитники предков: помеченный атакует других с помехой, его урон по ним вдвое меньше", () => {
    const friend = ally("friend", 7, 5);
    setup("Путь хранителя предков", 3, {}, [friend]);
    rage();
    performAttack(state, "b", "orc", "sword");
    expect(cond(foe, "ancestral_mark")?.source).toBe("b");
    const vsFriend = computeAttackAdvantage(foe, friend, foe.attacks[0], {}, { distanceFt: 5, allCombatants: state.combatants });
    const vsBarbarian = computeAttackAdvantage(foe, b, foe.attacks[0], {}, { distanceFt: 5, allCombatants: state.combatants });
    expect(vsFriend.disadvantage).toBe(true);
    expect(vsBarbarian.disadvantage).toBe(false);
    dealDamage(state, "friend", 4, { damageType: "slashing", isAttack: true, attackerId: "orc" });
    expect(friend.hpCurrent).toBe(38);
  });

  it("Духовный щит: реакцией уменьшает урон по союзнику на 2к6 (3к6 с 10 ур.)", () => {
    const friend = ally("friend", 7, 5);
    setup("Путь хранителя предков", 6, {}, [friend]);
    dealDamage(state, "friend", 12, { damageType: "fire" });
    expect(friend.hpCurrent).toBe(28); // без ярости щита нет
    rage();
    dealDamage(state, "friend", 12, { damageType: "fire" });
    expect(friend.hpCurrent).toBe(24); // 12 − 2к6 (8)
    expect(b.reactionUsed).toBe(true);
    // реакция потрачена
    dealDamage(state, "friend", 12, { damageType: "fire" });
    expect(friend.hpCurrent).toBe(12);
  });

  it("Мстительные предки (14 ур.): нападавший получает снятый щитом урон", () => {
    const friend = ally("friend", 7, 5);
    setup("Путь хранителя предков", 14, {}, [friend]);
    rage();
    const hp = foe.hpCurrent;
    dealDamage(state, "friend", 30, { damageType: "fire", attackerId: "orc" });
    // 4к6 = 16 снято и возвращено нападавшему
    expect(friend.hpCurrent).toBe(40 - 14);
    expect(hp - foe.hpCurrent).toBe(16);
  });
});

describe("Путь вестника бури", () => {
  const env = (name: string) => ({ featuresTraits: `Аура бури: ${name}` });

  it("без записи стихии в листе доступны все три ауры, с записью — одна", () => {
    setup("Путь вестника бури", 3);
    expect(["desert", "sea", "tundra"].every((e) => hasKey(b, `storm-herald/aura-${e}`))).toBe(true);
    setup("Путь вестника бури", 3, env("Море"));
    expect(hasKey(b, "storm-herald/aura-sea")).toBe(true);
    expect(hasKey(b, "storm-herald/aura-desert")).toBe(false);
  });

  it("Пустыня: при входе в ярость все остальные в 10 футах получают урон огнём", () => {
    const friend = ally("friend", 5, 6);
    const far = enemy("far", 20, 20);
    setup("Путь вестника бури", 3, env("Пустыня"), [friend, far]);
    rage();
    expect(foe.hpCurrent).toBe(198);
    expect(friend.hpCurrent).toBe(38);
    expect(far.hpCurrent).toBe(200);
    // повтор бонусным действием
    b.bonusActionUsed = false;
    use("storm-herald/aura-desert");
    expect(foe.hpCurrent).toBe(196);
  });

  it("Море: спасбросок Ловкости, 1к6 молнией (2к6 с 10 ур.)", () => {
    setup("Путь вестника бури", 10, env("Море"));
    rage();
    expect(foe.hpCurrent).toBe(192);
  });

  it("Тундра: временные хиты варвару и союзникам в ауре", () => {
    const friend = ally("friend", 5, 6);
    setup("Путь вестника бури", 5, env("Тундра"), [friend]);
    rage();
    expect(b.hpTemp).toBe(3);
    expect(friend.hpTemp).toBe(3);
  });

  it("Штормовая душа и Оберегающий шторм: сопротивление стихии себе всегда, союзникам в ауре — в ярости", () => {
    const friend = ally("friend", 5, 6);
    setup("Путь вестника бури", 10, env("Тундра"), [friend]);
    dealDamage(state, "b", 10, { damageType: "cold" });
    expect(b.hpCurrent).toBe(35);
    dealDamage(state, "friend", 10, { damageType: "cold" });
    expect(friend.hpCurrent).toBe(30);
    rage();
    friend.hpTemp = 0;
    dealDamage(state, "friend", 10, { damageType: "cold" });
    expect(friend.hpCurrent).toBe(25);
  });

  it("Ярость бури (14 ур.), Пустыня: попавший по варвару в ауре получает урон огнём", () => {
    setup("Путь вестника бури", 14, env("Пустыня"));
    rage();
    const hp = foe.hpCurrent;
    dealDamage(state, "b", 6, { damageType: "slashing", isAttack: true, attackerId: "orc" });
    expect(hp - foe.hpCurrent).toBe(7);
    expect(b.reactionUsed).toBe(true);
  });
});

describe("Путь ревностного яростника", () => {
  it("Божественная ярость: раз в ход 1к6 + половина уровня излучением", () => {
    setup("Путь ревностного яростника", 6);
    b.attacksPerAction = 2;
    rage();
    const first = performAttack(state, "b", "orc", "sword");
    expect(first.text).toContain("Божественная ярость +7");
    const second = performAttack(state, "b", "orc", "sword");
    expect(second.text).not.toContain("Божественная ярость");
  });

  it("Фанатичное присутствие: проваленный в ярости спасбросок перебрасывается раз за ярость", () => {
    setup("Путь ревностного яростника", 6);
    rage();
    const first = rollEffectSave(state, b, "WIS", 30, false, "тест");
    expect(first.text).toContain("переброс");
    const second = rollEffectSave(state, b, "WIS", 30, false, "тест");
    expect(second.text).not.toContain("переброс");
  });

  it("Ревностное воодушевление: союзники получают преимущество на атаки и спасброски, раз за отдых", () => {
    const friend = ally("friend", 7, 5);
    setup("Путь ревностного яростника", 10, {}, [friend]);
    use("zealot/zealous-presence");
    expect(cond(friend, "zealous_presence")).toBeTruthy();
    const adv = computeAttackAdvantage(friend, foe, friend.attacks[0], {}, { distanceFt: 5, allCombatants: state.combatants });
    expect(adv.advantage).toBe(true);
    b.bonusActionUsed = false;
    expect(() => use("zealot/zealous-presence")).toThrow(/закончились/);
  });
});

describe("Путь зверя", () => {
  it("Форма зверя: природное оружие появляется в ярости и исчезает с ней", () => {
    setup("Путь зверя", 3);
    expect(() => use("beast/form-bite")).toThrow(/в Ярости/);
    rage();
    use("beast/form-bite");
    expect(b.attacks[0].id).toBe("beast_bite");
    expect(() => use("beast/form-claws")).toThrow(/уже выбрана/);
    endTurn(state);
    expect(b.attacks.some((a) => a.id === "beast_bite")).toBe(false);
    expect(cond(b, "beast_form")).toBeUndefined();
  });

  it("Укус: при хитах меньше половины раз в ход лечит на бонус мастерства", () => {
    setup("Путь зверя", 3);
    rage();
    use("beast/form-bite");
    b.hpCurrent = 10;
    const out = performAttack(state, "b", "orc", "beast_bite");
    expect(out.text).toContain("укус восстанавливает 3");
    expect(b.hpCurrent).toBe(13);
  });

  it("Когти: атака когтями даёт ещё одну атаку когтями раз в ход", () => {
    setup("Путь зверя", 3);
    rage();
    use("beast/form-claws");
    const hp = foe.hpCurrent;
    performAttack(state, "b", "orc", "beast_claws");
    // две атаки: (1к6 = 4) + 3 + ярость 2 = 9 каждая
    expect(hp - foe.hpCurrent).toBe(18);
    expect(hasLog(state, "Когти — дополнительная атака")).toBe(true);
  });

  it("Хвост: реакцией +1к8 к КД превращает попадание в промах", () => {
    setup("Путь зверя", 3);
    rage();
    use("beast/form-tail");
    expect(b.attacks[0].range.normal).toBe(10);
    // враг: 11 + 7 = 18 против КД 15; хвост даёт +5 → 20, промах
    state.currentTurnIndex = 1;
    const out = performAttack(state, "orc", "b", "sword");
    expect(out.hit).toBe(false);
    expect(out.text).toContain("хвост отбивает удар");
    expect(b.reactionUsed).toBe(true);
  });

  it("Заразная ярость (10 ур.): заряжается и срабатывает при попадании природным оружием", () => {
    setup("Путь зверя", 10);
    rage();
    use("beast/form-bite");
    use("beast/infectious-fury");
    const fury = bySrd(b, "beast/infectious-fury");
    expect(fury.usesUsed).toBe(0);
    const out = performAttack(state, "b", "orc", "beast_bite");
    expect(out.text).toContain("Заразная ярость +14");
    expect(fury.usesUsed).toBe(1);
    expect(b.attacks.find((a) => a.id === "beast_bite")?.magical).toBe(true);
  });
});

describe("Путь дикой магии", () => {
  it("Всплеск при входе в ярость: бросок к8, эффект 5 — попавший по варвару получает 1к6", () => {
    setup("Путь дикой магии", 3);
    rage();
    expect(cond(b, "wild_surge")?.value).toBe(5);
    const hp = foe.hpCurrent;
    dealDamage(state, "b", 6, { damageType: "slashing", isAttack: true, attackerId: "orc" });
    expect(hp - foe.hpCurrent).toBe(4);
  });

  it("эффект 6: +1 к КД варвару и союзникам в 10 футах", () => {
    const friend = ally("friend", 5, 6);
    const far = ally("far", 20, 20);
    setup("Путь дикой магии", 3, {}, [friend, far]);
    vi.spyOn(Math, "random").mockReturnValue(0.7); // к8 = 6
    rage();
    expect(cond(b, "wild_surge")?.value).toBe(6);
    expect(effectiveAC(b, state.combatants)).toBe(16);
    expect(effectiveAC(friend, state.combatants)).toBe(16);
    expect(effectiveAC(far, state.combatants)).toBe(15);
  });

  it("эффект 2: телепортация бонусным действием, пока длится ярость", () => {
    setup("Путь дикой магии", 3);
    vi.spyOn(Math, "random").mockReturnValue(0.2); // к8 = 2
    rage();
    b.bonusActionUsed = false;
    use("wild-magic/surge-teleport", { center: { x: 9, y: 9 } });
    expect([b.x, b.y]).toEqual([9, 9]);
    expect(() => use("wild-magic/surge-bolt", { targetIds: ["orc"] })).toThrow(/при всплеске 8/);
  });

  it("эффект 8: луч света — урон излучением и ослепление", () => {
    setup("Путь дикой магии", 3);
    vi.spyOn(Math, "random").mockReturnValue(0.99); // к8 = 8, спасбросок врага: 20 − 5 = 15 ≥ 13
    rage();
    expect(cond(b, "wild_surge")?.value).toBe(8);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    b.bonusActionUsed = false;
    const hp = foe.hpCurrent;
    use("wild-magic/surge-bolt", { targetIds: ["orc"] });
    expect(hp - foe.hpCurrent).toBe(4);
    expect(cond(foe, "blinded")).toBeTruthy();
  });

  it("Подпитка магией: +1к3 к атакам или возврат ячейки, общий запас по бонусу мастерства", () => {
    const friend = ally("friend", 5, 6);
    setup("Путь дикой магии", 6, {}, [friend]);
    const pool = bySrd(b, "wild-magic/bolstering-magic");
    expect(pool.usesMax).toBe(3);
    use("wild-magic/bolster-attack", { targetIds: ["friend"] });
    expect(cond(friend, "bolstered")).toBeTruthy();
    expect(pool.usesUsed).toBe(1);
    friend.spells = { slots: { 1: { max: 2, used: 2 }, 2: { max: 1, used: 1 } }, known: [] };
    b.actionUsed = false;
    use("wild-magic/bolster-slot", { targetIds: ["friend"] });
    // к3 = 2: возвращается ячейка 2 круга
    expect(friend.spells.slots[2].used).toBe(0);
    expect(pool.usesUsed).toBe(2);
  });
});

describe("Путь великана", () => {
  it("Ярость великана: досягаемость +5 футов и бонус ярости к метательному оружию", () => {
    setup("Путь великана", 3);
    foe.x = 7; // 10 футов
    expect(() => performAttack(state, "b", "orc", "sword")).toThrow();
    rage();
    const out = performAttack(state, "b", "orc", "sword");
    expect(out.hit).toBe(true);
    b.attacks.push({ id: "axe", name: "Ручной топор", kind: "ranged", thrown: true, range: { normal: 20, long: 60 }, attackBonus: 7, damage: [{ dice: "1d6", mod: 3, type: "slashing" }], actionCost: "action" });
    b.actionUsed = false;
    b.attacksMadeThisAction = 0;
    foe.x = 9;
    const thrown = performAttack(state, "b", "orc", "axe");
    expect(thrown.text).toContain("ярость (бросок) +2");
  });

  it("Стихийное оружие (6 ур.): +1к6 стихией, огонь по умолчанию, смена бонусным действием", () => {
    setup("Путь великана", 6);
    rage();
    expect(cond(b, "elemental_cleaver")?.source).toBe("fire");
    const out = performAttack(state, "b", "orc", "sword");
    expect(out.text).toContain("Стихийное оружие +4");
    b.bonusActionUsed = false;
    use("giant/cleaver-cold");
    expect(cond(b, "elemental_cleaver")?.source).toBe("cold");
  });

  it("Могучий бросок (10 ур.): провал спасброска Силы — враг отлетает на 30 футов", () => {
    setup("Путь великана", 10);
    rage();
    b.bonusActionUsed = false;
    use("giant/mighty-impel", { targetIds: ["orc"] });
    expect(foe.x).toBe(12);
  });
});

describe("Варвар: полнота правил", () => {
  const paths = SUBCLASSES.filter((s) => s.classId === "barbarian" && s.id !== "berserker");

  it("у каждого умения каждого пути есть правило", () => {
    const rules = classRules("barbarian")!;
    for (const path of paths) {
      for (const f of path.features) {
        expect(rules.subclasses[path.id]?.features[f.name], `${path.name}: ${f.name}`).toBeDefined();
      }
    }
  });

  it("каждую кнопку разыгрывает движок: у активных умений есть обработчик", () => {
    for (const path of paths) {
      for (const { key, rule } of subclassRuleKeys("barbarian", path.id)) {
        if (rule.kind !== "active" || rule.manual) continue;
        expect(kitHandles(key), key).toBe(true);
      }
    }
  });

  it("герой 20 уровня каждого пути собирается без ошибок", () => {
    for (const path of paths) {
      expect(() => classHero("Варвар", "x", path.name, 20), path.name).not.toThrow();
    }
  });
});
