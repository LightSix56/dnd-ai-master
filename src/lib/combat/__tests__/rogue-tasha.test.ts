import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dealDamage, endTurn, performAttack, performDeathSave, startTurn, useAbility } from "../engine";
import { modSaveAdvantage } from "../feature-mods";
import { SUBCLASSES, subclassRuleKeys } from "../class-defs";
import { kitHandles } from "../class-kit";
import { psionicFaces } from "../rogue-pool";
import { ally, bySrd, classHero, cond, enemy, hasKey, hasLog, makeState } from "./helpers/class-harness";
import type { Combatant } from "../types";

// Архетипы Tasha's Cauldron (dnd.su, 2014): Клинок души и Фантом.
// Math.random = 0.5: к20 = 11, к4 = 3, к6 = 4, к8 = 5, к10 = 6. Герой: ЛОВ +1, бонус мастерства 3,
// атака клинком +4 (1 + 3); враг: КД 10, 200 хитов, все модификаторы −5.

let r: Combatant;
let foe: Combatant;
let state: any;

function setup(subclass: string, level: number, extra: Combatant[] = []) {
  r = classHero("Плут", "r", subclass, level, { x: 5, y: 5 });
  r.attacks[0].finesse = true;
  foe = enemy("orc", 6, 5);
  state = makeState([r, foe, ...extra]);
}

const use = (key: string, opts: Record<string, any> = {}) => useAbility(state, "r", bySrd(r, key).id, opts);
const pool = () => bySrd(r, "soulknife/psionic-power");
const left = () => pool().usesMax - pool().usesUsed;

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Клинок души: Псионическая сила", () => {
  it("кости: удвоенный бонус мастерства; к6, с 5 ур. к8, с 11 ур. к10, с 17 ур. к12", () => {
    expect([3, 4, 5, 10, 11, 16, 17, 20].map(psionicFaces)).toEqual([6, 6, 8, 8, 10, 10, 12, 12]);
    setup("Клинок души", 3);
    expect(pool().usesMax).toBe(6);
    expect(pool().parameters?.featureValue).toBe(6);
    setup("Клинок души", 5);
    expect(pool().parameters?.featureValue).toBe(8);
    setup("Клинок души", 11);
    expect(pool().parameters?.featureValue).toBe(10);
  });

  it("запас не применяется кнопкой", () => {
    setup("Клинок души", 3);
    expect(() => use("soulknife/psionic-power")).toThrow(/запас/);
  });

  it("бонусным действием возвращает одну кость, раз за отдых", () => {
    setup("Клинок души", 3);
    pool().usesUsed = 3;
    use("soulknife/psi-recover");
    expect(left()).toBe(4);
    expect(r.bonusActionUsed).toBe(true);
    r.bonusActionUsed = false;
    expect(() => use("soulknife/psi-recover")).toThrow(/закончились/);
  });

  it("если все кости на месте, возвращать нечего", () => {
    setup("Клинок души", 3);
    expect(() => use("soulknife/psi-recover")).toThrow(/на месте/);
    expect(r.bonusActionUsed).toBe(false);
  });
});

describe("Клинок души: Психические клинки", () => {
  beforeEach(() => setup("Клинок души", 3));

  it("клинок вплотную: рукопашная атака +4, 1к6 + ЛОВ психической энергией, тратит действие", () => {
    const out = use("soulknife/psychic-blades", { targetIds: ["orc"] });
    expect(r.actionUsed).toBe(true);
    expect(out.targets[0].hit).toBe(true);
    // 4 (к6) + 1 (ЛОВ)
    expect(foe.hpCurrent).toBe(200 - 5);
    expect(hasLog(state, "Психический клинок")).toBe(true);
  });

  it("бросок на расстоянии: дальняя атака в пределах 60 футов", () => {
    foe.x = 15; // 50 футов
    const out = use("soulknife/psychic-blades", { targetIds: ["orc"] });
    expect(out.targets[0].hit).toBe(true);
    expect(foe.hpCurrent).toBe(200 - 5);
  });

  it("дальше 60 футов не бросить", () => {
    foe.x = 20;
    expect(() => use("soulknife/psychic-blades", { targetIds: ["orc"] })).toThrow(/дальше 60/);
    expect(r.actionUsed).toBe(false);
  });

  it("клинок остаётся в списке атак? Нет: он исчезает после удара", () => {
    use("soulknife/psychic-blades", { targetIds: ["orc"] });
    expect(r.attacks.some((a) => a.id.startsWith("psychic_blade"))).toBe(false);
  });

  it("клинок фехтовальный: Скрытая атака работает с ним при союзнике у цели", () => {
    state.combatants.push(ally("friend", 7, 5));
    use("soulknife/psychic-blades", { targetIds: ["orc"] });
    // 5 + 2к6 (3 ур.) = 8
    expect(foe.hpCurrent).toBe(200 - 5 - 8);
  });

  it("вторая атака бонусным действием: только после действия Атака, урон 1к4", () => {
    expect(() => use("soulknife/psychic-blade-bonus", { targetIds: ["orc"] })).toThrow(/после действия Атака/);
    expect(r.bonusActionUsed).toBe(false);
    performAttack(state, "r", "orc", "sword");
    const hpAfterSword = foe.hpCurrent;
    use("soulknife/psychic-blade-bonus", { targetIds: ["orc"] });
    expect(r.bonusActionUsed).toBe(true);
    // 3 (к4) + 1 (ЛОВ)
    expect(hpAfterSword - foe.hpCurrent).toBe(4);
  });

  it("после основного клинка вторым можно ударить бонусным действием", () => {
    use("soulknife/psychic-blades", { targetIds: ["orc"] });
    use("soulknife/psychic-blade-bonus", { targetIds: ["orc"] });
    expect(foe.hpCurrent).toBe(200 - 5 - 4);
  });

  it("враг должен быть живым врагом", () => {
    expect(() => use("soulknife/psychic-blades", { targetIds: ["r"] })).toThrow();
    foe.hpCurrent = 0;
    expect(() => use("soulknife/psychic-blades", { targetIds: ["orc"] })).toThrow(/выведен из боя/);
  });
});

describe("Клинок души: Поражающие душу клинки (9 ур.)", () => {
  beforeEach(() => setup("Клинок души", 9));

  it("доступны только с 9 уровня", () => {
    setup("Клинок души", 8);
    expect(hasKey(r, "soulknife/soul-blades")).toBe(false);
    expect(hasKey(r, "soulknife/psychic-teleportation")).toBe(false);
  });

  it("Самонаводящиеся удары: кость исправляет промах и расходуется", () => {
    foe.ac = 12;
    // к20 = 5 (0.2): 5 + 4 = 9 против КД 12, не хватает 3; к8 = 2: 9 + 2 = 11 ... всё ещё мимо
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    foe.ac = 11; // не хватает 2: кость 2 исправляет
    const out = use("soulknife/psychic-blades", { targetIds: ["orc"] });
    expect(out.targets[0].hit).toBe(true);
    expect(left()).toBe(pool().usesMax - 1);
    expect(hasLog(state, "Самонаводящиеся удары")).toBe(true);
  });

  it("если кость промах не исправила, она остаётся", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    foe.ac = 20; // не хватает 11, кость к8 даёт 2
    const out = use("soulknife/psychic-blades", { targetIds: ["orc"] });
    expect(out.targets[0].hit).toBe(false);
    expect(left()).toBe(pool().usesMax);
  });

  it("без костей Самонаводящихся ударов нет", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    foe.ac = 11;
    pool().usesUsed = pool().usesMax;
    const out = use("soulknife/psychic-blades", { targetIds: ["orc"] });
    expect(out.targets[0].hit).toBe(false);
  });

  it("обычное оружие Самонаводящиеся удары не получает", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    foe.ac = 14; // меч +7: 5 + 7 = 12 — промах на 2, кость к8 = 2 исправила бы
    const out = performAttack(state, "r", "orc", "sword");
    expect(out.hit).toBe(false);
    expect(left()).toBe(pool().usesMax);
  });

  it("Психическая телепортация: бонусное действие, кость тратится, перенос на 10 × бросок футов", () => {
    // к8 = 5 → до 50 футов
    use("soulknife/psychic-teleportation", { center: { x: 11, y: 5 } }); // 30 футов
    expect(r.x).toBe(11);
    expect(r.y).toBe(5);
    expect(r.bonusActionUsed).toBe(true);
    expect(left()).toBe(pool().usesMax - 1);
  });

  it("если клетка дальше броска, плут оказывается в самой дальней доступной клетке на пути", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // к8 = 1 → 10 футов
    use("soulknife/psychic-teleportation", { center: { x: 15, y: 5 } });
    expect(r.x).toBe(7);
    expect(hasLog(state, "клинок упал раньше")).toBe(true);
  });

  it("занятая клетка: плут останавливается перед ней", () => {
    state.combatants.push(enemy("wall", 11, 5));
    use("soulknife/psychic-teleportation", { center: { x: 11, y: 5 } });
    expect(r.x).toBe(10);
  });

  it("нужна клетка; без костей нельзя", () => {
    expect(() => use("soulknife/psychic-teleportation")).toThrow(/клетку/);
    expect(r.bonusActionUsed).toBe(false);
    pool().usesUsed = pool().usesMax;
    expect(() => use("soulknife/psychic-teleportation", { center: { x: 8, y: 5 } })).toThrow(/не хватает/);
    expect(r.bonusActionUsed).toBe(false);
  });
});

describe("Фантом: Могильные вопли", () => {
  beforeEach(() => setup("Фантом", 5, [ally("friend", 7, 5), enemy("orc2", 6, 8)]));

  const sneak = () => performAttack(state, "r", "orc", "sword");
  const wails = () => bySrd(r, "phantom/wails-from-the-grave");

  it("половина костей Скрытой атаки (округление вверх) некротическим уроном второму существу", () => {
    // 5 ур.: 3к6 Скрытой атаки → 2к6 некротического (к6 = 4 → 8)
    use("phantom/wails-from-the-grave", { targetIds: ["orc2"] });
    const out = sneak();
    expect(out.text).toContain("скрытая атака 3d6");
    expect(out.text).toContain("Могильные вопли");
    expect(state.get("orc2").hpCurrent).toBe(200 - 8);
    expect(wails().usesUsed).toBe(1);
    expect(wails().usesMax).toBe(3);
  });

  it("на 3 уровне 2к6 Скрытой атаки → 1к6", () => {
    setup("Фантом", 3, [ally("friend", 7, 5), enemy("orc2", 6, 8)]);
    use("phantom/wails-from-the-grave", { targetIds: ["orc2"] });
    sneak();
    expect(state.get("orc2").hpCurrent).toBe(200 - 4);
  });

  it("без Скрытой атаки вопли не срабатывают и использование не тратится", () => {
    state.get("friend").x = 12;
    use("phantom/wails-from-the-grave", { targetIds: ["orc2"] });
    const out = sneak();
    expect(out.text).not.toContain("Могильные вопли");
    expect(wails().usesUsed).toBe(0);
    expect(state.get("orc2").hpCurrent).toBe(200);
  });

  it("второе существо дальше 30 футов от первого: не срабатывает, использование цело", () => {
    state.get("orc2").x = 13; // 35 футов от орка
    use("phantom/wails-from-the-grave", { targetIds: ["orc2"] });
    const out = sneak();
    expect(out.text).toContain("не сработали");
    expect(wails().usesUsed).toBe(0);
  });

  it("второе существо не может быть первым", () => {
    use("phantom/wails-from-the-grave", { targetIds: ["orc"] });
    const out = sneak();
    expect(out.text).toContain("не сработали");
  });

  it("нужно выбрать существо", () => {
    expect(() => use("phantom/wails-from-the-grave")).toThrow(/цель/);
  });

  it("сработали раз за выстрел: повторная Скрытая атака в ход невозможна, вопли не повторяются", () => {
    use("phantom/wails-from-the-grave", { targetIds: ["orc2"] });
    r.attacksPerAction = 2;
    sneak();
    const second = sneak();
    expect(second.text).not.toContain("Могильные вопли");
    expect(wails().usesUsed).toBe(1);
  });

  it("использования кончились — кнопка не нажимается, пока нет безделушек", () => {
    wails().usesUsed = wails().usesMax;
    expect(() => use("phantom/wails-from-the-grave", { targetIds: ["orc2"] })).toThrow(/закончились/);
  });
});

describe("Фантом: Частица души (9 ур.)", () => {
  const trinkets = () => bySrd(r, "phantom/soul-trinkets");
  const held = () => trinkets().usesMax - trinkets().usesUsed;

  beforeEach(() => setup("Фантом", 9, [ally("friend", 7, 5), enemy("orc2", 6, 8)]));

  it("запас безделушек — бонус мастерства; в начале боя безделушек нет", () => {
    expect(trinkets().usesMax).toBe(3);
    state.turnOrder = ["r", "orc", "friend", "orc2"];
    startTurn(state);
    expect(held()).toBe(0);
  });

  it("гибель существа в 30 футах даёт реакцией безделушку", () => {
    startTurn(state);
    dealDamage(state, "orc2", 500, { attackerId: "r", source: "r" });
    expect(cond(r, "soul_chance")?.source).toBe("orc2");
    state.turnOrder = ["orc", "r", "friend", "orc2"];
    state.currentTurnIndex = 0;
    use("phantom/soul-trinket-claim");
    expect(r.reactionUsed).toBe(true);
    expect(held()).toBe(1);
    expect(cond(r, "soul_chance")).toBeUndefined();
  });

  it("гибель дальше 30 футов или без гибели безделушки не даёт", () => {
    startTurn(state);
    state.get("orc2").x = 15;
    state.get("orc2").y = 5;
    dealDamage(state, "orc2", 500, { attackerId: "r", source: "r" });
    expect(cond(r, "soul_chance")).toBeUndefined();
    expect(() => use("phantom/soul-trinket-claim")).toThrow(/никто не погиб/);
    expect(r.reactionUsed).toBe(false);
  });

  it("не больше бонуса мастерства", () => {
    startTurn(state);
    trinkets().usesUsed = 0;
    r.conditions.push({ type: "soul_chance", source: "orc2" });
    expect(() => use("phantom/soul-trinket-claim")).toThrow(/максимум/);
  });

  it("героя при 0 хитов это не касается: он без сознания, а не погиб", () => {
    startTurn(state);
    const pal = ally("pal", 6, 6);
    state.combatants.push(pal);
    dealDamage(state, "pal", 500, { attackerId: "orc", source: "orc" });
    expect(cond(r, "soul_chance")).toBeUndefined();
  });

  it("с безделушкой: преимущество на спасброски Телосложения и от смерти", () => {
    startTurn(state);
    expect(modSaveAdvantage(r, "CON")).toBe(false);
    trinkets().usesUsed = trinkets().usesMax - 1;
    expect(modSaveAdvantage(r, "CON")).toBe(true);
    expect(modSaveAdvantage(r, "DEX")).toBe(false);
    r.hpCurrent = 0;
    r.conditions.push({ type: "unconscious" });
    performDeathSave(state, "r");
    expect(hasLog(state, "преимущество: Безделушка с душой")).toBe(true);
  });

  it("безделушка вместо использования: вопли без траты использования", () => {
    startTurn(state);
    const wails = bySrd(r, "phantom/wails-from-the-grave");
    wails.usesUsed = wails.usesMax;
    trinkets().usesUsed = trinkets().usesMax - 1;
    use("phantom/wails-from-the-grave", { targetIds: ["orc2"] });
    performAttack(state, "r", "orc", "sword");
    expect(held()).toBe(0);
    expect(wails.usesUsed).toBe(wails.usesMax);
    // 9 ур.: 5к6 Скрытой атаки → 3к6 некротического
    expect(state.get("orc2").hpCurrent).toBe(200 - 12);
  });

  it("вопрос духу: действие и безделушка", () => {
    startTurn(state);
    expect(() => use("phantom/soul-trinket-ask")).toThrow(/не хватает/);
    trinkets().usesUsed = trinkets().usesMax - 1;
    use("phantom/soul-trinket-ask");
    expect(r.actionUsed).toBe(true);
    expect(held()).toBe(0);
  });
});

describe("Архетипы Tasha's: полнота правил", () => {
  const subs = SUBCLASSES.filter((s) => s.classId === "rogue" && ["soulknife", "phantom"].includes(s.id));

  it("каждую кнопку разыгрывает движок: у активных умений есть обработчик или она ручная", () => {
    for (const sub of subs) {
      for (const { key, rule } of subclassRuleKeys("rogue", sub.id)) {
        if (rule.kind !== "active" || rule.manual) continue;
        expect(kitHandles(key), key).toBe(true);
      }
    }
  });

  it("Фантом и Клинок души по названиям на dnd.su", () => {
    expect(hasKey(classHero("Плут", "x", "Фантом", 9), "phantom/soul-trinkets")).toBe(true);
    expect(hasKey(classHero("Плут", "x", "Клинок души", 3), "soulknife/psychic-blades")).toBe(true);
    expect(hasKey(classHero("Плут", "x", "Клинок души", 2), "soulknife/psychic-blades")).toBe(false);
  });

  it("endTurn не падает у героев с этими умениями", () => {
    setup("Фантом", 9);
    expect(() => endTurn(state)).not.toThrow();
    setup("Клинок души", 9);
    expect(() => endTurn(state)).not.toThrow();
  });
});
