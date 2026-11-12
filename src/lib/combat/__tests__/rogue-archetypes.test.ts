import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { attemptHide, castSpell, dealDamage, moveCombatant, performAttack, useAbility } from "../engine";
import { effectiveSpeed } from "../rules";
import { rollInitiativeFor } from "../initiative";
import { extractSpellsFromCharacter } from "../character-adapter";
import { SUBCLASSES, classRules, subclassRuleKeys } from "../class-defs";
import { kitHandles } from "../class-kit";
import { ally, bySrd, classHero, cond, enemy, hasKey, hasLog, makeState } from "./helpers/class-harness";
import type { Combatant } from "../types";

// Архетипы плута из PHB и Xanathar's Guide (dnd.su, 2014): Вор, Убийца, Мистический ловкач, Дуэлянт,
// Комбинатор, Сыщик, Скаут. Math.random = 0.5: к20 = 11, к4 = 3, к6 = 4, к8 = 5.
// Герой: ЛОВ +1, ХАР +2, МУД 0, ИНТ +1, бонус мастерства 3; атака +7; враг: КД 10, все модификаторы −5.

let r: Combatant;
let foe: Combatant;
let state: any;

function setup(subclass: string, level: number, extra: Combatant[] = [], sheet: Record<string, any> = {}) {
  r = classHero("Плут", "r", subclass, level, { x: 5, y: 5, sheet });
  r.attacks[0].finesse = true;
  foe = enemy("orc", 6, 5);
  state = makeState([r, foe, ...extra]);
}

const use = (key: string, opts: Record<string, any> = {}) => useAbility(state, "r", bySrd(r, key).id, opts);
const freshAction = () => {
  r.actionUsed = false;
  r.attacksMadeThisAction = 0;
  r.bonusActionUsed = false;
  r.reactionUsed = false;
  r.conditions = r.conditions.filter((c) => c.type !== "sneak_used" && c.type !== "last_attack");
};

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Вор", () => {
  it("Быстрые руки: бонусное действие Хитрого действия на предмет или ловкость рук", () => {
    setup("Вор", 3);
    use("thief/fast-hands");
    expect(r.bonusActionUsed).toBe(true);
    expect(r.actionUsed).toBe(false);
    expect(hasLog(state, "Быстрые руки")).toBe(true);
  });

  it("Превосходная скрытность (9 ур.): преимущество на Скрытность, если плут прошёл не больше половины скорости", () => {
    setup("Вор", 9);
    foe.facing = "W"; // враг смотрит на плута, но тот в укрытии
    r.conditions.push({ type: "cover_half" });
    r.movementUsed = 10;
    const slow = attemptHide(state, "r");
    expect(slow.text).toContain("преимущество: Превосходная скрытность");
    r.isHidden = false;
    freshAction();
    r.movementUsed = 20;
    const fast = attemptHide(state, "r");
    expect(fast.text).not.toContain("Превосходная скрытность");
  });

  it("до 9 уровня преимущества на Скрытность нет", () => {
    setup("Вор", 8);
    foe.facing = "W";
    r.conditions.push({ type: "cover_half" });
    expect(attemptHide(state, "r").text).not.toContain("Превосходная скрытность");
  });
});

describe("Мистический ловкач", () => {
  const slots = (level: number, subclass = "Мистический ловкач") =>
    extractSpellsFromCharacter({ id: "t", class: "Плут", subclass, level, spells: [] }, 3, 0, 0, 2).spells;

  it("колдует на Интеллекте: СЛ 8 + мастерство + ИНТ, ячейки как у «трети» заклинателя", () => {
    const s3 = slots(3);
    expect(s3.spellcastingAbility).toBe("INT");
    expect(s3.spellSaveDC).toBe(8 + 2 + 3);
    expect(s3.spellAttackBonus).toBe(2 + 3);
    expect(s3.slots).toEqual({ 1: { max: 2, used: 0 } });
    expect(slots(4).slots).toEqual({ 1: { max: 3, used: 0 } });
    expect(slots(7).slots).toEqual({ 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } });
    expect(slots(10).slots).toEqual({ 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 } });
  });

  it("Мистический рыцарь тоже колдует на Интеллекте, а обычный плут и вор — нет", () => {
    const ek = extractSpellsFromCharacter({ id: "k", class: "Воин", subclass: "Мистический рыцарь", level: 3, spells: [] }, 3, 0, 0, 2).spells;
    expect(ek.spellcastingAbility).toBe("INT");
    expect(ek.slots).toEqual({ 1: { max: 2, used: 0 } });
    expect(slots(3, "Вор").spellcastingAbility).toBe("");
    expect(slots(3, "Вор").slots).toEqual({});
  });

  it("слоты из листа сохраняются", () => {
    const s = extractSpellsFromCharacter(
      { id: "t", class: "Плут", subclass: "Мистический ловкач", level: 3, sheet: { spellSlots: { 1: { totalSlots: 2, expendedSlots: 1 } } } },
      3,
      0,
      0,
      2
    ).spells;
    expect(s.slots).toEqual({ 1: { max: 2, used: 1 } });
  });

  const saveSpell = {
    id: "slow-test",
    name: "Очарование личности",
    level: 1,
    parameters: {
      name: "Очарование личности",
      type: "spell" as const,
      actionCost: "action" as const,
      range: { type: "ranged" as const, value: 30 },
      targeting: "creature" as const,
      saveType: "WIS" as const,
      level: 1,
      damage: [],
      effects: [{ condition: "charmed", durationRounds: 10 }],
    },
  };

  const cast = () => {
    r.spells = { slots: { 1: { max: 2, used: 0 } }, known: [], spellSaveDC: 13, spellAttackBonus: 5, spellcastingAbility: "INT" } as any;
    r.actionUsed = false;
    castSpell(state, "r", saveSpell as any, { targetIds: ["orc"] });
  };

  it("Магическая засада (9 ур.): скрытый заклинатель — спасбросок цели с помехой", () => {
    setup("Мистический ловкач", 9);
    r.isHidden = true;
    cast();
    expect(hasLog(state, "помеха на спасбросок (Магическая засада)")).toBe(true);
    expect(r.isHidden).toBe(false);
  });

  it("не скрытый заклинатель и герой до 9 уровня помехи не дают", () => {
    setup("Мистический ловкач", 9);
    cast();
    expect(hasLog(state, "Магическая засада")).toBe(false);
    setup("Мистический ловкач", 8);
    r.isHidden = true;
    cast();
    expect(hasLog(state, "Магическая засада")).toBe(false);
  });

  it("помеха действительно бросает спасбросок дважды: при скрытом заклинателе и единице на втором кубе цель проваливает", () => {
    setup("Мистический ловкач", 9);
    foe.abilityMods.WIS = 10; // +10: обычно спасается легко
    r.isHidden = true;
    // кубы: 0.95 (к20 = 20) и 0.0 (к20 = 1): с помехой берётся меньший
    vi.spyOn(Math, "random").mockReset().mockReturnValueOnce(0.95).mockReturnValueOnce(0).mockReturnValue(0.5);
    cast();
    expect(foe.conditions.some((c) => c.type === "charmed")).toBe(true);
  });

  it("Улучшенная волшебная рука: бонусное действие Хитрого действия", () => {
    setup("Мистический ловкач", 3);
    use("arcane-trickster/mage-hand-legerdemain");
    expect(r.bonusActionUsed).toBe(true);
    expect(hasLog(state, "Улучшенная волшебная рука")).toBe(true);
  });
});

describe("Дуэлянт (Головорез): Ловкое маневрирование", () => {
  it("после рукопашной атаки цель не бьёт провоцированной атакой до конца хода", () => {
    setup("Головорез", 3);
    performAttack(state, "r", "orc", "sword");
    expect(cond(r, "fancy_footwork")?.source).toBe("orc");
    const out = moveCombatant(state, "r", { x: 3, y: 5 });
    expect(out.opportunityAttacks).toHaveLength(0);
  });

  it("другие враги провоцированную атаку всё равно совершают", () => {
    setup("Головорез", 3, [enemy("orc2", 5, 6)]);
    performAttack(state, "r", "orc", "sword");
    const out = moveCombatant(state, "r", { x: 3, y: 5 });
    expect(out.opportunityAttacks.map((a) => a.attackerId)).toEqual(["orc2"]);
  });

  it("дальняя атака умения не запускает", () => {
    setup("Головорез", 3);
    performAttack(state, "r", "orc", "bow");
    expect(cond(r, "fancy_footwork")).toBeUndefined();
    expect(moveCombatant(state, "r", { x: 3, y: 5 }).opportunityAttacks).toHaveLength(1);
  });

  it("не работает не в свой ход (реакция на чужом ходу)", () => {
    setup("Головорез", 3);
    state.currentTurnIndex = 1; // ход орка
    performAttack(state, "r", "orc", "sword", { skipTurnCheck: true });
    expect(cond(r, "fancy_footwork")).toBeUndefined();
  });

  it("герой без умения (Вор) провоцирует как обычно", () => {
    setup("Вор", 3);
    performAttack(state, "r", "orc", "sword");
    expect(moveCombatant(state, "r", { x: 3, y: 5 }).opportunityAttacks).toHaveLength(1);
  });
});

describe("Дуэлянт (Головорез): Лихая удаль", () => {
  it("добавляет модификатор Харизмы к инициативе", () => {
    setup("Головорез", 3);
    r.dexMod = 1;
    expect(rollInitiativeFor(r)).toBe(11 + 1 + 2);
    setup("Вор", 3);
    r.dexMod = 1;
    expect(rollInitiativeFor(r)).toBe(11 + 1);
  });

  it("Скрытая атака в одиночку: цель в 5 футах, других существ рядом нет — без преимущества", () => {
    setup("Головорез", 3);
    const out = performAttack(state, "r", "orc", "sword");
    expect(out.text).toContain("скрытая атака 2d6");
    expect(out.text).toContain("(Лихая удаль)");
    expect(out.damage).toBe(8 + 8);
  });

  it("если рядом с плутом стоит ещё кто-то, добавки нет", () => {
    setup("Головорез", 3, [ally("friend", 4, 5)]);
    const out = performAttack(state, "r", "orc", "sword");
    expect(out.text).not.toContain("скрытая атака");
  });

  it("с помехой не срабатывает", () => {
    setup("Головорез", 3);
    const out = performAttack(state, "r", "orc", "sword", { manualDisadvantage: true });
    expect(out.text).not.toContain("скрытая атака");
  });

  it("издалека не срабатывает: цель не в 5 футах", () => {
    setup("Головорез", 3);
    foe.x = 9;
    const out = performAttack(state, "r", "orc", "bow");
    expect(out.text).not.toContain("скрытая атака");
  });

  it("не срабатывает у героев других архетипов", () => {
    setup("Вор", 3);
    expect(performAttack(state, "r", "orc", "sword").text).not.toContain("скрытая атака");
  });
});

describe("Дуэлянт (Головорез): Щегольство", () => {
  beforeEach(() => setup("Головорез", 9, [ally("friend", 5, 6)]));

  it("успех против врага: помеха на его атаки по другим и нет провоцированных атак по другим", () => {
    use("swashbuckler/panache", { targetIds: ["orc"] });
    expect(r.actionUsed).toBe(true);
    expect(cond(foe, "panache")?.source).toBe("r");
    // враг атакует союзника — с помехой
    foe.attacks = [{ id: "claw", name: "Коготь", kind: "melee", range: { normal: 5 }, attackBonus: 5, damage: [{ dice: "1d6", mod: 0, type: "slashing" }], actionCost: "action" }];
    state.currentTurnIndex = 1;
    foe.x = 6;
    state.get("friend").x = 6;
    state.get("friend").y = 6;
    const hitFriend = performAttack(state, "orc", "friend", "claw");
    expect(hitFriend.text).toContain("Щегольство (цель не источник)");
    // по самому плуту — без помехи
    foe.actionUsed = false;
    foe.attacksMadeThisAction = 0;
    const hitRogue = performAttack(state, "orc", "r", "claw");
    expect(hitRogue.text).not.toContain("Щегольство");
  });

  it("провоцированные атаки по другим у врага отнимаются, по плуту остаются", () => {
    use("swashbuckler/panache", { targetIds: ["orc"] });
    state.currentTurnIndex = 0;
    const friend = state.get("friend");
    friend.x = 7;
    friend.y = 5;
    const away = moveCombatant(state, "friend", { x: 9, y: 5 }, { skipTurnCheck: true });
    expect(away.opportunityAttacks).toHaveLength(0);
    freshAction();
    const awayRogue = moveCombatant(state, "r", { x: 3, y: 5 });
    expect(awayRogue.opportunityAttacks.map((a) => a.attackerId)).toEqual(["orc"]);
  });

  it("мирное существо очаровано", () => {
    const friend = ally("pal", 6, 6);
    state.combatants.push(friend);
    use("swashbuckler/panache", { targetIds: ["pal"] });
    expect(cond(friend, "charmed")?.source).toBe("r");
    expect(cond(friend, "panache")).toBeUndefined();
  });

  it("проигранное состязание ничего не даёт, но действие потрачено", () => {
    foe.abilityMods.WIS = 10;
    use("swashbuckler/panache", { targetIds: ["orc"] });
    expect(cond(foe, "panache")).toBeUndefined();
    expect(r.actionUsed).toBe(true);
  });

  it("прекращается, когда союзник плута нападает на цель", () => {
    use("swashbuckler/panache", { targetIds: ["orc"] });
    state.currentTurnIndex = 0;
    const friend = state.get("friend");
    friend.x = 7;
    friend.y = 5;
    state.turnOrder = ["friend", "r", "orc"];
    state.currentTurnIndex = 0;
    performAttack(state, "friend", "orc", "sword");
    expect(cond(foe, "panache")).toBeUndefined();
  });

  it("прекращается, когда цель уходит от плута на 60 футов", () => {
    use("swashbuckler/panache", { targetIds: ["orc"] });
    foe.speed = 100;
    state.turnOrder = ["orc", "r", "friend"];
    state.currentTurnIndex = 0;
    moveCombatant(state, "orc", { x: 17, y: 5 });
    expect(cond(foe, "panache")).toBeUndefined();
  });

  it("цель дальше 60 футов не выбрать", () => {
    foe.x = 20;
    expect(() => use("swashbuckler/panache", { targetIds: ["orc"] })).toThrow(/дальше 60/);
  });
});

describe("Убийца", () => {
  it("правила подкласса есть у каждого умения", () => {
    const rules = classRules("rogue")!;
    for (const sub of SUBCLASSES.filter((s) => s.classId === "rogue" && s.id !== "thief")) {
      for (const f of sub.features) expect(rules.subclasses[sub.id]?.features[f.name], `${sub.name}: ${f.name}`).toBeDefined();
    }
  });
});

describe("Комбинатор (Мастер интриг): Мастер тактики", () => {
  beforeEach(() => setup("Мастер интриг", 3, [ally("friend", 8, 5)]));

  it("Помощь бонусным действием: союзник бьёт с преимуществом", () => {
    use("mastermind/master-of-tactics", { targetIds: ["friend"] });
    expect(r.bonusActionUsed).toBe(true);
    expect(r.actionUsed).toBe(false);
    const friend = state.get("friend");
    expect(cond(friend, "helped")).toBeDefined();
    state.turnOrder = ["friend", "r", "orc"];
    state.currentTurnIndex = 0;
    friend.x = 7;
    const out = performAttack(state, "friend", "orc", "sword");
    expect(out.text).toContain("Помощь союзника");
  });

  it("цель атаки союзника может быть в 30 футах от плута", () => {
    foe.x = 10; // 25 футов от плута
    use("mastermind/master-of-tactics", { targetIds: ["friend", "orc"] });
    expect(cond(state.get("friend"), "helped")).toBeDefined();
  });

  it("дальше 30 футов, не враг или не союзник — нельзя", () => {
    foe.x = 14; // 45 футов
    expect(() => use("mastermind/master-of-tactics", { targetIds: ["friend", "orc"] })).toThrow(/30 футов/);
    expect(() => use("mastermind/master-of-tactics", { targetIds: ["orc"] })).toThrow(/союзнику/);
    expect(() => use("mastermind/master-of-tactics", { targetIds: ["r"] })).toThrow();
    expect(r.bonusActionUsed).toBe(false);
  });

  it("повторно в тот же ход нельзя: бонусное действие занято", () => {
    use("mastermind/master-of-tactics", { targetIds: ["friend"] });
    expect(() => use("mastermind/master-of-tactics", { targetIds: ["friend"] })).toThrow(/Бонусное действие/);
  });
});

describe("Сыщик", () => {
  beforeEach(() => setup("Сыщик", 3));

  it("Внимательный взгляд: бонусным действием находит спрятавшегося врага", () => {
    foe.isHidden = true;
    use("inquisitive/eye-for-detail");
    expect(r.bonusActionUsed).toBe(true);
    expect(foe.isHidden).toBe(false);
    expect(hasLog(state, "замечает orc")).toBe(true);
  });

  it("не находит того, чья Скрытность выше", () => {
    foe.isHidden = true;
    foe.abilityMods.DEX = 10; // пассивная Скрытность 10 + 10 + 3 = 23 против 11 + 0 + 3 = 14
    use("inquisitive/eye-for-detail");
    expect(foe.isHidden).toBe(true);
  });

  it("если никто не прячется, умение сообщает об этом", () => {
    use("inquisitive/eye-for-detail");
    expect(hasLog(state, "скрытых врагов нет")).toBe(true);
  });

  it("Проницательный бой: победа в состязании — Скрытая атака без преимущества по этой цели", () => {
    use("inquisitive/insightful-fighting", { targetIds: ["orc"] });
    expect(r.bonusActionUsed).toBe(true);
    expect(cond(r, "insightful_fighting")?.source).toBe("orc");
    const out = performAttack(state, "r", "orc", "sword");
    expect(out.text).toContain("скрытая атака 2d6");
    expect(out.text).toContain("(Проницательный бой)");
  });

  it("по другой цели без преимущества Скрытая атака не срабатывает", () => {
    state.combatants.push(enemy("orc2", 5, 6));
    use("inquisitive/insightful-fighting", { targetIds: ["orc"] });
    const out = performAttack(state, "r", "orc2", "sword");
    expect(out.text).not.toContain("скрытая атака");
  });

  it("помеха всё равно запрещает Скрытую атаку", () => {
    use("inquisitive/insightful-fighting", { targetIds: ["orc"] });
    const out = performAttack(state, "r", "orc", "sword", { manualDisadvantage: true });
    expect(out.text).not.toContain("скрытая атака");
  });

  it("успех против другой цели переносит отметку", () => {
    state.combatants.push(enemy("orc2", 5, 6));
    use("inquisitive/insightful-fighting", { targetIds: ["orc"] });
    r.bonusActionUsed = false;
    use("inquisitive/insightful-fighting", { targetIds: ["orc2"] });
    expect(r.conditions.filter((c) => c.type === "insightful_fighting")).toHaveLength(1);
    expect(cond(r, "insightful_fighting")?.source).toBe("orc2");
  });

  it("проигранное состязание отметки не даёт", () => {
    foe.abilityMods.CHA = 10;
    use("inquisitive/insightful-fighting", { targetIds: ["orc"] });
    expect(cond(r, "insightful_fighting")).toBeUndefined();
    expect(r.bonusActionUsed).toBe(true);
  });

  it("недееспособная цель — состязание не нужно", () => {
    foe.conditions.push({ type: "stunned" });
    expect(() => use("inquisitive/insightful-fighting", { targetIds: ["orc"] })).toThrow(/недееспособен/);
    expect(r.bonusActionUsed).toBe(false);
  });

  it("не работает без умения (Вор)", () => {
    setup("Вор", 3);
    expect(hasKey(r, "inquisitive/insightful-fighting")).toBe(false);
  });
});

describe("Скаут", () => {
  const withTurnOf = (current: string) => {
    state.turnOrder = [current, ...state.turnOrder.filter((id: string) => id !== current)];
    state.currentTurnIndex = 0;
  };

  beforeEach(() => setup("Скаут", 3));

  it("Зачинщик: реакцией в чужой ход уходит на полскорости без провоцированных атак", () => {
    withTurnOf("orc");
    use("scout/skirmisher", { center: { x: 5, y: 8 } }); // 15 футов
    expect(r.reactionUsed).toBe(true);
    expect(r.x).toBe(5);
    expect(r.y).toBe(8);
    expect(foe.reactionUsed).toBe(false);
    expect(hasLog(state, "Зачинщик")).toBe(true);
  });

  it("дальше половины скорости уйти нельзя", () => {
    withTurnOf("orc");
    expect(() => use("scout/skirmisher", { center: { x: 5, y: 9 } })).toThrow();
    expect(r.reactionUsed).toBe(false);
    expect(r.y).toBe(5);
  });

  it("враг должен быть в 5 футах и это должен быть его ход", () => {
    withTurnOf("orc");
    foe.x = 8;
    expect(() => use("scout/skirmisher", { center: { x: 5, y: 8 } })).toThrow(/5 футов/);
    foe.x = 6;
    withTurnOf("r");
    expect(() => use("scout/skirmisher", { center: { x: 5, y: 8 } })).toThrow(/5 футов/);
  });

  it("без реакции не работает", () => {
    withTurnOf("orc");
    r.reactionUsed = true;
    expect(() => use("scout/skirmisher", { center: { x: 5, y: 8 } })).toThrow(/Реакция/);
  });

  it("клетку выбирать обязательно, занятую нельзя", () => {
    withTurnOf("orc");
    expect(() => use("scout/skirmisher")).toThrow(/клетку/);
    state.combatants.push(enemy("block", 5, 6));
    expect(() => use("scout/skirmisher", { center: { x: 5, y: 6 } })).toThrow();
  });

  it("Превосходная мобильность (9 ур.): скорость +10 футов", () => {
    expect(effectiveSpeed(r)).toBe(30);
    setup("Скаут", 9);
    expect(effectiveSpeed(r)).toBe(40);
    setup("Скаут", 8);
    expect(effectiveSpeed(r)).toBe(30);
  });
});

describe("Архетипы PHB и Xanathar's: полнота правил", () => {
  const subs = SUBCLASSES.filter((s) => s.classId === "rogue" && ["assassin", "arcane-trickster", "swashbuckler", "mastermind", "inquisitive", "scout"].includes(s.id));

  it("каждую кнопку разыгрывает движок: у активных умений есть обработчик или она ручная", () => {
    for (const sub of subs) {
      for (const { key, rule } of subclassRuleKeys("rogue", sub.id)) {
        if (rule.kind !== "active" || rule.manual) continue;
        expect(kitHandles(key), key).toBe(true);
      }
    }
  });

  it("с 3 уровня у героя каждого архетипа есть умения подкласса, до 3 — нет", () => {
    for (const sub of subs) {
      const low = classHero("Плут", "x", sub.name, 2).abilities.filter((a) => a.parameters?.srdKey?.startsWith(`${sub.id}/`));
      expect(low, sub.name).toHaveLength(0);
    }
    expect(hasKey(classHero("Плут", "x", "Головорез", 3), "swashbuckler/fancy-footwork")).toBe(true);
    expect(hasKey(classHero("Плут", "x", "Скаут", 9), "scout/superior-mobility")).toBe(true);
    expect(hasKey(classHero("Плут", "x", "Скаут", 8), "scout/superior-mobility")).toBe(false);
    expect(hasKey(classHero("Плут", "x", "Убийца", 3), "assassin/assassinate")).toBe(true);
  });

  it("подкласс узнаётся и по названию на dnd.su", () => {
    expect(hasKey(classHero("Плут", "x", "Дуэлянт", 3), "swashbuckler/fancy-footwork")).toBe(true);
    expect(hasKey(classHero("Плут", "x", "Комбинатор", 3), "mastermind/master-of-tactics")).toBe(true);
  });
});

describe("Урон в бою не ломает героя с умениями", () => {
  it("простое попадание по Фантому/Сыщику без реакций", () => {
    setup("Сыщик", 5);
    dealDamage(state, "r", 4, { damageType: "fire" });
    expect(r.hpCurrent).toBe(36);
  });
});
