import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useAbility, performAttack, dealDamage, castSpell, transformWildShape, startTurn } from "../engine";
import { computeAttackAdvantage, rollSave } from "../rules";
import { extractAbilitiesFromCharacter } from "../character-adapter";
import { resolveAbilityUses } from "../ability-uses";
import type { Attack, Combatant } from "../types";

// Классовые способности по правилам D&D 5e (PHB): заряды, эффекты, ограничения.
// Math.random зафиксирован на 0.5: d20 = 11, к6 = 4, к8 = 5 — броски предсказуемы.

function hero(id: string, className: string, level: number, x: number, y: number): Combatant {
  const c: any = {
    id,
    name: id,
    type: "player",
    className,
    level,
    hpCurrent: 40,
    hpMax: 40,
    hpTemp: 0,
    ac: 15,
    speed: 30,
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    x,
    y,
    facing: "E",
    conditions: [],
    abilityMods: { STR: 3, DEX: 1, CON: 2, INT: 0, WIS: 1, CHA: 3 },
    profBonus: 2,
    saves: {},
    attacks: [
      {
        id: "greatsword",
        name: "Двуручный меч",
        kind: "melee",
        range: { normal: 5 },
        attackBonus: 5,
        damage: [{ dice: "", mod: 5, type: "slashing" }],
        actionCost: "action",
      },
      {
        id: "longbow",
        name: "Длинный лук",
        kind: "ranged",
        range: { normal: 150, long: 600 },
        attackBonus: 5,
        damage: [{ dice: "", mod: 3, type: "piercing" }],
        actionCost: "action",
      },
    ],
    abilities: [],
    spells: { slots: {}, known: [] },
    hotbar: [],
    concentration: null,
  };
  c.abilities = extractAbilitiesFromCharacter({ id, class: className }, level, 2, c.abilityMods);
  return c;
}

function enemy(id: string, x: number, y: number, extra: Partial<Combatant> = {}): Combatant {
  return {
    ...hero(id, "Орк", 1, x, y),
    type: "enemy",
    abilities: [],
    ac: 13,
    hpCurrent: 60,
    hpMax: 60,
    ...extra,
  } as Combatant;
}

function makeState(combatants: Combatant[]) {
  return {
    combatants,
    mapElements: [],
    gridWidth: 20,
    gridHeight: 20,
    round: 1,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    log: [] as any[],
    dirtyIds: new Set<string>(),
    isCombatDirty: false,
    require(id: string) {
      const c = this.combatants.find((x) => x.id === id);
      if (!c) throw new Error("Not found: " + id);
      return c;
    },
    get(id: string) {
      return this.combatants.find((x) => x.id === id);
    },
    current() {
      return this.combatants[this.currentTurnIndex];
    },
    mark(id: string) {
      this.dirtyIds.add(id);
    },
    markCombat() {
      this.isCombatDirty = true;
    },
    addLog(text: string, kind: string, actor: string) {
      this.log.push({ round: this.round, text, kind, actor });
    },
  } as any;
}

const ability = (c: Combatant, name: string) => {
  const a = c.abilities.find((x) => x.name === name);
  if (!a) throw new Error(`${c.name}: нет способности «${name}»`);
  return a;
};

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Заряды классовых способностей из листа", () => {
  const uses = (cls: string, level: number, name: string) => {
    const c = hero("h", cls, level, 0, 0);
    const a = ability(c, name);
    return [a.usesMax, a.refresh];
  };

  it("Воин: Второе дыхание 1 раз за короткий отдых, Всплеск действий 1 (2 с 17 ур.)", () => {
    expect(uses("Воин", 1, "Второе дыхание")).toEqual([1, "short"]);
    expect(uses("Воин", 2, "Всплеск действий")).toEqual([1, "short"]);
    expect(uses("Воин", 17, "Всплеск действий")).toEqual([2, "short"]);
  });

  it("Варвар: Ярость 2/3/4/5/6 за длинный отдых, на 20 ур. без ограничения", () => {
    expect(uses("Варвар", 1, "Ярость")).toEqual([2, "long"]);
    expect(uses("Варвар", 3, "Ярость")).toEqual([3, "long"]);
    expect(uses("Варвар", 6, "Ярость")).toEqual([4, "long"]);
    expect(uses("Варвар", 12, "Ярость")).toEqual([5, "long"]);
    expect(uses("Варвар", 17, "Ярость")).toEqual([6, "long"]);
    expect(uses("Варвар", 20, "Ярость")).toEqual([0, "long"]);
  });

  it("Паладин: запас Наложения рук = 5 × уровень; Монах: ци = уровень; Друид: 2 Диких облика", () => {
    expect(uses("Паладин", 3, "Наложение рук")).toEqual([15, "long"]);
    expect(uses("Монах", 5, "Очки ци")).toEqual([5, "short"]);
    expect(uses("Друид", 2, "Дикий облик")).toEqual([2, "short"]);
  });

  it("Бард: Вдохновение = мод. ХАР, с 5 ур. восстанавливается на коротком отдыхе", () => {
    expect(uses("Бард", 1, "Вдохновение барда")).toEqual([3, "long"]);
    expect(uses("Бард", 5, "Вдохновение барда")).toEqual([3, "short"]);
    expect(resolveAbilityUses({ usesFormula: "bardicInspiration" }, { level: 1, profBonus: 2, abilityMods: { CHA: -1 } }).usesMax).toBe(1);
  });
});

describe("Воин", () => {
  it("Второе дыхание лечит 1к10 + уровень и заканчивается после одного раза", () => {
    const f = hero("f", "Воин", 3, 0, 0);
    f.hpCurrent = 10;
    const state = makeState([f]);
    const sw = ability(f, "Второе дыхание");
    useAbility(state, "f", sw.id, { skipTurnCheck: true });
    expect(f.hpCurrent).toBe(10 + 6 + 3); // к10 = 6
    expect(f.bonusActionUsed).toBe(true);
    f.bonusActionUsed = false;
    expect(() => useAbility(state, "f", sw.id, { skipTurnCheck: true })).toThrow(/закончились/);
  });

  it("Всплеск действий даёт одно Действие и не применяется дважды за ход", () => {
    const f = hero("f", "Воин", 17, 0, 0);
    const state = makeState([f]);
    const surge = ability(f, "Всплеск действий");
    useAbility(state, "f", surge.id, { skipTurnCheck: true });
    expect(f.extraActions).toBe(1);
    expect(() => useAbility(state, "f", surge.id, { skipTurnCheck: true })).toThrow(/уже применён/);
    // В следующем ходу второй заряд (17 ур.) доступен
    startTurn(state);
    useAbility(state, "f", surge.id, { skipTurnCheck: true });
    expect(surge.usesUsed).toBe(2);
  });
});

describe("Варвар", () => {
  it("Ярость: сопротивление дробящему/колющему/рубящему, огонь в полную силу", () => {
    const b = hero("b", "Варвар", 1, 0, 0);
    const state = makeState([b]);
    useAbility(state, "b", ability(b, "Ярость").id, { skipTurnCheck: true });
    dealDamage(state, "b", 10, { damageType: "slashing", isAttack: true });
    expect(b.hpCurrent).toBe(35);
    dealDamage(state, "b", 10, { damageType: "fire", isAttack: true });
    expect(b.hpCurrent).toBe(25);
  });

  it("Ярость: +2 к урону рукопашной атакой Силой, но не луком", () => {
    const b = hero("b", "Варвар", 1, 0, 0);
    const orc = enemy("orc", 1, 0);
    const state = makeState([b, orc]);
    useAbility(state, "b", ability(b, "Ярость").id, { skipTurnCheck: true });
    const melee = performAttack(state, "b", "orc", "greatsword", { skipTurnCheck: true });
    expect(melee.damage).toBe(5 + 2);
    b.actionUsed = false;
    b.attacksMadeThisAction = 0;
    orc.x = 10;
    const ranged = performAttack(state, "b", "orc", "longbow", { skipTurnCheck: true });
    expect(ranged.damage).toBe(3);
  });

  it("Ярость: +3 к урону с 9 уровня, преимущество на спасброски Силы, без заклинаний", () => {
    const b = hero("b", "Варвар", 9, 0, 0);
    const state = makeState([b]);
    useAbility(state, "b", ability(b, "Ярость").id, { skipTurnCheck: true });
    expect(b.conditions.find((c) => c.type === "raging")?.value).toBe(3);
    expect(rollSave(b, "STR", 10).advantage).toBe(true);
    b.spells = { slots: { 1: { max: 2, used: 0 } }, known: ["Лечение ран"] };
    expect(() => castSpell(state, "b", "Лечение ран", { targetIds: ["b"], skipTurnCheck: true })).toThrow(/Ярости/);
  });

  it("Ярость тратит заряды: третья за длинный отдых на 1 уровне недоступна", () => {
    const b = hero("b", "Варвар", 1, 0, 0);
    const state = makeState([b]);
    const rage = ability(b, "Ярость");
    for (let i = 0; i < 2; i++) {
      b.bonusActionUsed = false;
      b.conditions = [];
      useAbility(state, "b", rage.id, { skipTurnCheck: true });
    }
    b.bonusActionUsed = false;
    b.conditions = [];
    expect(() => useAbility(state, "b", rage.id, { skipTurnCheck: true })).toThrow(/закончились/);
  });

  it("Безрассудная атака: преимущество только в рукопашной Силой, враги атакуют с преимуществом до следующего хода", () => {
    const b = hero("b", "Варвар", 2, 0, 0);
    const orc = enemy("orc", 1, 0);
    const state = makeState([b, orc]);
    useAbility(state, "b", ability(b, "Безрассудная атака").id, { skipTurnCheck: true });
    const sword = b.attacks.find((a) => a.id === "greatsword") as Attack;
    const bow = b.attacks.find((a) => a.id === "longbow") as Attack;
    expect(computeAttackAdvantage(b, orc, sword).advantage).toBe(true);
    expect(computeAttackAdvantage(b, orc, bow, {}, { distanceFt: 50 }).advantage).toBe(false);
    expect(computeAttackAdvantage(orc, b, orc.attacks[0]).advantage).toBe(true);
    startTurn(state); // ход варвара снова начинается — эффект снят
    expect(b.conditions.some((c) => c.type === "reckless")).toBe(false);
  });
});

describe("Паладин", () => {
  it("Наложение рук лечит из запаса 5 × уровень и не больше, чем осталось", () => {
    const p = hero("p", "Паладин", 2, 0, 0);
    const ally = hero("ally", "Воин", 2, 1, 0);
    const state = makeState([p, ally]);
    const loh = ability(p, "Наложение рук");
    ally.hpCurrent = ally.hpMax - 7;
    useAbility(state, "p", loh.id, { targetIds: ["ally"], skipTurnCheck: true });
    expect(ally.hpCurrent).toBe(ally.hpMax);
    expect(loh.usesUsed).toBe(7);

    p.actionUsed = false;
    ally.hpCurrent = ally.hpMax - 5;
    useAbility(state, "p", loh.id, { targetIds: ["ally"], skipTurnCheck: true });
    expect(ally.hpCurrent).toBe(ally.hpMax - 2); // в запасе оставалось 3
    p.actionUsed = false;
    expect(() => useAbility(state, "p", loh.id, { targetIds: ["ally"], skipTurnCheck: true })).toThrow();
  });

  it("Наложение рук только касанием", () => {
    const p = hero("p", "Паладин", 2, 0, 0);
    const ally = hero("ally", "Воин", 2, 5, 0);
    ally.hpCurrent = 10;
    const state = makeState([p, ally]);
    expect(() =>
      useAbility(state, "p", ability(p, "Наложение рук").id, { targetIds: ["ally"], skipTurnCheck: true })
    ).toThrow(/касанием/);
  });

  it("Божественная кара: при попадании тратит ячейку и добавляет 2к8 излучением", () => {
    const p = hero("p", "Паладин", 2, 0, 0);
    p.spells = { slots: { 1: { max: 2, used: 0 } }, known: [] };
    const orc = enemy("orc", 1, 0);
    const state = makeState([p, orc]);
    const smite = ability(p, "Божественная кара");
    useAbility(state, "p", smite.id, { skipTurnCheck: true });
    expect(p.actionUsed).toBe(false); // подготовка кары ничего не стоит
    const res = performAttack(state, "p", "orc", "greatsword", { skipTurnCheck: true });
    expect(res.damage).toBe(5 + 5 + 5); // меч 5 + 2к8 (5 + 5)
    expect(p.spells.slots[1].used).toBe(1);
    expect(p.conditions.some((c) => c.type === "smite_ready")).toBe(false);
  });

  it("Божественная кара сильнее против нежити и недоступна без ячеек", () => {
    const p = hero("p", "Паладин", 2, 0, 0);
    p.spells = { slots: { 1: { max: 1, used: 0 } }, known: [] };
    const zombie = enemy("zombie", 1, 0, { className: "нежить • ПО 1/4" });
    const state = makeState([p, zombie]);
    const smite = ability(p, "Божественная кара");
    useAbility(state, "p", smite.id, { skipTurnCheck: true });
    const res = performAttack(state, "p", "zombie", "greatsword", { skipTurnCheck: true });
    expect(res.damage).toBe(5 + 15); // 3к8
    expect(() => useAbility(state, "p", smite.id, { skipTurnCheck: true })).toThrow(/нет свободных ячеек/);
  });
});

describe("Монах", () => {
  it("Приёмы тратят очки ци, без ци недоступны", () => {
    const m = hero("m", "Монах", 2, 0, 0);
    const state = makeState([m]);
    const ki = ability(m, "Очки ци");
    expect(ki.usesMax).toBe(2);
    useAbility(state, "m", ability(m, "Терпеливая оборона").id, { skipTurnCheck: true });
    expect(m.conditions.some((c) => c.type === "patient_defense")).toBe(true);
    m.bonusActionUsed = false;
    useAbility(state, "m", ability(m, "Поступь ветра: Рывок").id, { skipTurnCheck: true });
    expect(m.conditions.some((c) => c.type === "dashing")).toBe(true);
    expect(ki.usesUsed).toBe(2);
    m.bonusActionUsed = false;
    expect(() =>
      useAbility(state, "m", ability(m, "Поступь ветра: Отход").id, { skipTurnCheck: true })
    ).toThrow(/ци/);
    expect(() => useAbility(state, "m", ki.id, { skipTurnCheck: true })).toThrow();
  });

  it("Шквал ударов: два безоружных удара после Атаки за 1 ци", () => {
    const m = hero("m", "Монах", 2, 0, 0);
    const orc = enemy("orc", 1, 0);
    const state = makeState([m, orc]);
    const flurry = ability(m, "Шквал ударов");
    expect(() => useAbility(state, "m", flurry.id, { targetIds: ["orc"], skipTurnCheck: true })).toThrow(/Атаки/);
    m.actionUsed = true;
    const res = useAbility(state, "m", flurry.id, { targetIds: ["orc"], skipTurnCheck: true });
    expect(res.targets).toHaveLength(2);
    expect(orc.hpCurrent).toBe(60 - 2 * (3 + 3)); // к4 = 3, + мод. СИЛ 3
    expect(m.bonusActionUsed).toBe(true);
    expect(ability(m, "Очки ци").usesUsed).toBe(1);
    expect(m.attacks.some((a) => a.id === "__flurry_unarmed")).toBe(false);
  });
});

describe("Бард", () => {
  it("Вдохновение барда спасает промах союзника и расходуется", () => {
    const bard = hero("bard", "Бард", 1, 0, 0);
    const ally = hero("ally", "Воин", 1, 1, 0);
    const orc = enemy("orc", 2, 0, { ac: 18 }); // d20 11 + 5 = 16 — промах, +к6 (4) = 20 — попадание
    const state = makeState([bard, ally, orc]);
    useAbility(state, "bard", ability(bard, "Вдохновение барда").id, { targetIds: ["ally"], skipTurnCheck: true });
    expect(ally.conditions.find((c) => c.type === "bardic_inspiration")?.value).toBe(6);
    const res = performAttack(state, "ally", "orc", "greatsword", { skipTurnCheck: true });
    expect(res.hit).toBe(true);
    expect(ally.conditions.some((c) => c.type === "bardic_inspiration")).toBe(false);
  });

  it("Вдохновение нельзя дать себе", () => {
    const bard = hero("bard", "Бард", 1, 0, 0);
    const state = makeState([bard]);
    expect(() =>
      useAbility(state, "bard", ability(bard, "Вдохновение барда").id, { targetIds: ["bard"], skipTurnCheck: true })
    ).toThrow(/другому/);
  });
});

describe("Друид", () => {
  it("Дикий облик: 2 заряда и звери только по уровню", () => {
    const d = hero("d", "Друид", 2, 0, 0);
    const state = makeState([d]);
    expect(() => transformWildShape(state, "d", "brown_bear", { skipTurnCheck: true })).toThrow(/недоступен/);
    transformWildShape(state, "d", "wolf", { skipTurnCheck: true });
    expect(ability(d, "Дикий облик").usesUsed).toBe(1);
  });
});
