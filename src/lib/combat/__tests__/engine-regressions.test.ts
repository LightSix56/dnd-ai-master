// Регрессионные тесты на баги, найденные при разборе движка (октябрь 2026).
// Каждый тест сначала воспроизводил ошибку на старом коде.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CombatState,
  castSpell,
  dealDamage,
  endTurn,
  performAttack,
  shoveCombatant,
  useAbility,
  EngineError,
} from "../engine";
import { resolveAttack } from "../rules";
import { hydrateCombatant, dehydrateCombatant } from "../serialize";
import { runBotTurn } from "../bot";
import { monsterDefinitionToCombatant } from "../monsters/monster-adapter";
import type { Combat, Combatant, MapElement } from "../types";

function mk(id: string, o: Partial<Combatant> = {}): Combatant {
  return {
    id,
    name: id,
    type: "player",
    color: "#fff",
    x: 0,
    y: 0,
    hpCurrent: 30,
    hpMax: 30,
    hpTemp: 0,
    ac: 12,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 0,
    dexMod: 2,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "",
    level: 5,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: [
      {
        id: "sw",
        name: "Меч",
        attackBonus: 5,
        damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
        kind: "melee",
        range: { normal: 5 },
        actionCost: "action",
      },
    ],
    spells: {
      slots: { 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 } },
      known: [],
      spellSaveDC: 30,
      spellAttackBonus: 6,
      spellcastingAbility: "WIS",
    },
    abilities: [],
    concentration: null,
    saves: {},
    abilityMods: { STR: 3, DEX: 2, CON: 1, INT: 0, WIS: 3, CHA: 0 },
    profBonus: 3,
    isAIControlled: false,
    ...o,
  };
}

function st(cs: Combatant[], mapElements: MapElement[] = []): CombatState {
  const combat: Combat = {
    id: "c",
    name: "t",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    turnOrder: cs.map((c) => c.id),
    gridWidth: 20,
    gridHeight: 20,
    cellSize: 40,
    log: [],
    combatants: cs,
    mapElements,
    createdAt: "",
    updatedAt: "",
  };
  return new CombatState(combat);
}

/** Все кубы выпадают одинаково: 0 → минимум, 0.99 → максимум */
const fix = (v: number) => vi.spyOn(Math, "random").mockReturnValue(v);

const spell = (name: string, parameters: Record<string, unknown>) => ({
  id: name,
  name,
  level: 1,
  parameters: { name, type: "spell", actionCost: "action", spellSlotLevel: 1, ...parameters } as any,
});

afterEach(() => vi.restoreAllMocks());

describe("сериализация бойца", () => {
  it("данные монстра переживают запись в БД и чтение обратно", () => {
    const m = mk("troll", {
      type: "enemy",
      monsterTraits: [{ name: "Регенерация", description: "10 хитов" }],
      damageResistances: ["fire"],
      damageImmunities: ["poison"],
      conditionImmunities: ["poisoned"],
      multiattack: { name: "Мультиатака", description: "", attacks: [{ attackId: "sw", count: 3 }] },
      legendaryState: {
        actionsPerRound: 3,
        remainingActions: 2,
        options: [],
        legendaryResistancesMax: 3,
        legendaryResistancesRemaining: 1,
      },
      rechargeAbilities: [
        { id: "breath", name: "Дыхание", recharge: "5-6", isCharged: false, actionCost: "action", description: "" },
      ],
      tacticalRole: "boss",
    });
    const back = hydrateCombatant({ id: "troll", ...dehydrateCombatant(m) });
    expect(back.monsterTraits).toEqual(m.monsterTraits);
    expect(back.damageResistances).toEqual(["fire"]);
    expect(back.damageImmunities).toEqual(["poison"]);
    expect(back.conditionImmunities).toEqual(["poisoned"]);
    expect(back.multiattack).toEqual(m.multiattack);
    expect(back.legendaryState).toEqual(m.legendaryState);
    expect(back.rechargeAbilities).toEqual(m.rechargeAbilities);
    expect(back.tacticalRole).toBe("boss");
  });

  it("строка без monsterData (старые бои) читается без ошибок", () => {
    const row = { id: "x", ...dehydrateCombatant(mk("x")) } as Record<string, unknown>;
    delete row.monsterData;
    const back = hydrateCombatant(row);
    expect(back.monsterTraits).toBeUndefined();
    expect(back.name).toBe("x");
  });

  it("флаг магического оружия сохраняется", () => {
    const m = mk("h");
    m.attacks[0].magical = true;
    const back = hydrateCombatant({ id: "h", ...dehydrateCombatant(m) });
    expect(back.attacks[0].magical).toBe(true);
  });
});

describe("концентрация", () => {
  const entangle = spell("Опутывание", {
    range: { type: "ranged", value: 60 },
    targeting: "creature",
    saveType: "STR",
    effects: [{ condition: "restrained", durationRounds: 10 }],
    concentration: true,
  });
  const faerie = spell("Огонь фей", {
    range: { type: "ranged", value: 60 },
    targeting: "creature",
    saveType: "DEX",
    effects: [{ condition: "faerie_fire", durationRounds: 10 }],
    concentration: true,
  });

  it("новое заклинание с концентрацией снимает старый эффект и оставляет свой", () => {
    fix(0);
    const s = st([mk("druid"), mk("orc", { type: "enemy", x: 2 })]);
    castSpell(s, "druid", entangle, { targetIds: ["orc"] });
    expect(s.require("orc").conditions.map((c) => c.type)).toEqual(["restrained"]);
    s.require("druid").actionUsed = false;
    castSpell(s, "druid", faerie, { targetIds: ["orc"] });
    expect(s.require("orc").conditions.map((c) => c.type)).toEqual(["faerie_fire"]);
    expect(s.require("druid").concentration?.spellName).toBe("Огонь фей");
  });

  it("потеря концентрации не снимает эффекты, которые ею не держатся", () => {
    fix(0);
    const druid = mk("druid", { conditions: [{ type: "dodging", duration: 1, source: "druid" }] });
    const s = st([druid, mk("orc", { type: "enemy", x: 2 })]);
    castSpell(s, "druid", entangle, { targetIds: ["orc"] });
    dealDamage(s, "druid", 5); // спасбросок концентрации провален (кубы на минимуме)
    expect(s.require("druid").concentration).toBeNull();
    expect(s.require("orc").conditions.map((c) => c.type)).toEqual([]);
    expect(s.require("druid").conditions.map((c) => c.type)).toContain("dodging");
  });
});

describe("атомарность заклинаний", () => {
  it("заклинание вне дальности не тратит ячейку и действие", () => {
    const s = st([mk("wiz"), mk("orc", { type: "enemy", x: 19, y: 19 })]);
    const ray = spell("Луч", {
      range: { type: "ranged", value: 30 },
      targeting: "creature",
      attackType: "ranged",
      damage: [{ dice: "2d8", mod: 0, type: "fire" }],
    });
    expect(() => castSpell(s, "wiz", ray, { targetIds: ["orc"] })).toThrow("Слишком далеко");
    expect(s.require("wiz").spells.slots[1].used).toBe(0);
    expect(s.require("wiz").actionUsed).toBe(false);
    expect(s.dirtyIds).toEqual([]);
    expect(s.log).toHaveLength(0);
  });

  it("откат не подменяет объекты бойцов", () => {
    const s = st([mk("wiz"), mk("orc", { type: "enemy", x: 19, y: 19 })]);
    const ref = s.require("wiz");
    const ray = spell("Луч", { range: { type: "ranged", value: 30 }, targeting: "creature", attackType: "ranged", damage: [{ dice: "1d8", mod: 0, type: "fire" }] });
    try {
      castSpell(s, "wiz", ray, { targetIds: ["orc"] });
    } catch (e) {
      expect(e instanceof EngineError).toBe(true);
    }
    expect(s.require("wiz")).toBe(ref);
  });
});

describe("спасброски от смерти", () => {
  it("персонаж при 0 HP получает ход и бросает спасбросок", () => {
    fix(0.5); // d20 = 11 → успех
    const s = st([
      mk("a"),
      mk("downed", { hpCurrent: 0, conditions: [{ type: "unconscious" }] }),
      mk("orc", { type: "enemy", x: 5 }),
    ]);
    const { nextId } = endTurn(s);
    // ход упавшего проходит автоматически, управление получает следующий стоящий боец
    expect(nextId).toBe("orc");
    const ds = s.require("downed").conditions.find((c) => c.type === "death_save");
    expect(ds?.duration).toBe(1);
    expect(ds?.value).toBe(0);
  });

  it("счётчик не теряется между раундами, три успеха стабилизируют", () => {
    fix(0.5);
    const s = st([
      mk("a"),
      mk("downed", { hpCurrent: 0, conditions: [{ type: "unconscious" }] }),
      mk("orc", { type: "enemy", x: 5 }),
    ]);
    for (let i = 0; i < 6; i++) endTurn(s);
    const types = s.require("downed").conditions.map((c) => c.type);
    expect(types).toContain("stable");
    expect(types).not.toContain("death_save");
  });

  it("натуральная 20 поднимает на ноги, и ход остаётся у персонажа", () => {
    fix(0.99);
    const s = st([mk("a"), mk("downed", { hpCurrent: 0, conditions: [{ type: "unconscious" }] }), mk("orc", { type: "enemy", x: 5 })]);
    const { nextId } = endTurn(s);
    expect(nextId).toBe("downed");
    expect(s.require("downed").hpCurrent).toBe(1);
  });

  it("поверженные враги ход не получают", () => {
    const s = st([mk("a"), mk("orc1", { type: "enemy", hpCurrent: 0, conditions: [{ type: "unconscious" }] }), mk("orc2", { type: "enemy", x: 5 })]);
    expect(endTurn(s).nextId).toBe("orc2");
  });
});

describe("бегство", () => {
  it("сбежавший враг помечается на удаление из БД", () => {
    const g = mk("gob", { type: "enemy", x: 0, y: 5, isAIControlled: true, conditions: [{ type: "fleeing", duration: 10 }] });
    const s = st([g, mk("hero", { x: 10, y: 5 })]);
    runBotTurn(s);
    expect(s.get("gob")).toBeUndefined();
    expect(s.removedIds).toEqual(["gob"]);
    expect(s.turnOrder).toEqual(["hero"]);
    expect(s.dirtyIds).not.toContain("gob");
  });

  it("removeCombatant сохраняет ход за текущим бойцом", () => {
    const s = st([mk("a"), mk("b", { type: "enemy" }), mk("c")]);
    s.currentTurnIndex = 2;
    s.removeCombatant("a");
    expect(s.current()?.id).toBe("c");
  });
});

describe("урон", () => {
  it("сопротивление применяется только к своей части смешанного урона", () => {
    fix(0.99);
    const snake = mk("snake", {
      type: "enemy",
      attacks: [
        {
          id: "bite",
          name: "Укус",
          attackBonus: 20,
          damage: [
            { dice: "1d4", mod: 0, type: "piercing" },
            { dice: "3d6", mod: 0, type: "poison" },
          ],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "action",
        },
      ],
    });
    const s = st([snake, mk("dwarf", { x: 1, hpCurrent: 100, hpMax: 100, damageResistances: ["poison"] })]);
    performAttack(s, "snake", "dwarf", "bite");
    // крит на максимуме: 8 колющего + 36 яда → яд вдвое = 8 + 18
    expect(100 - s.require("dwarf").hpCurrent).toBe(26);
  });

  it("магическое оружие игнорирует сопротивление немагическому урону, обычное — нет", () => {
    fix(0.6);
    const wraith = () => mk("wraith", { type: "enemy", x: 1, hpCurrent: 100, hpMax: 100, damageResistances: ["bludgeoning, piercing, and slashing from nonmagical weapons"] });
    const plain = st([mk("hero"), wraith()]);
    const r1 = performAttack(plain, "hero", "wraith", "sw");
    expect(100 - plain.require("wraith").hpCurrent).toBe(Math.floor(r1.damage / 2));

    const hero = mk("hero");
    hero.attacks[0].magical = true;
    const magic = st([hero, wraith()]);
    const r2 = performAttack(magic, "hero", "wraith", "sw");
    expect(100 - magic.require("wraith").hpCurrent).toBe(r2.damage);
  });

  it("«Дубинка» меняет и урон, а не только бросок атаки", () => {
    fix(0.99);
    const d = mk("druid", {
      conditions: [{ type: "shillelagh" }],
      attacks: [{ id: "st", name: "Посох", attackBonus: 2, damage: [{ dice: "1d6", mod: 0, type: "bludgeoning" }], kind: "melee", range: { normal: 5 }, actionCost: "action" }],
    });
    const r = resolveAttack(d, mk("orc", { type: "enemy" }), d.attacks[0], { distanceFt: 5 });
    expect(r.damage).toBe(8 * 2 + 3); // крит: 2к8 на максимуме + МДР
    expect(r.damageParts[0].magical).toBe(true);
  });

  it("существо на линии выстрела даёт цели +2 к КД", () => {
    fix(0.5); // d20 = 11, +5 = 16
    const archer = mk("archer", {
      attacks: [{ id: "bow", name: "Лук", attackBonus: 5, damage: [{ dice: "1d8", mod: 0, type: "piercing" }], kind: "ranged", range: { normal: 80, long: 320 }, actionCost: "action" }],
    });
    const open = st([archer, mk("orc", { type: "enemy", x: 6, ac: 15 })]);
    expect(performAttack(open, "archer", "orc", "bow").hit).toBe(true);

    const archer2 = { ...archer, attacks: archer.attacks.map((a) => ({ ...a })) };
    const covered = st([archer2, mk("blocker", { type: "enemy", x: 3 }), mk("orc", { type: "enemy", x: 6, ac: 15 })]);
    const r = performAttack(covered, "archer", "orc", "bow");
    expect(r.hit).toBe(false); // 16 против 15 + 2
    expect(r.text).toContain("укрытие +2");
  });
});

describe("скрытая атака", () => {
  it("срабатывает один раз за ход и снова доступна в следующем", () => {
    fix(0.6);
    const rogue = mk("rogue", {
      className: "Плут",
      attacksPerAction: 2,
      attacks: [{ id: "rp", name: "Рапира", attackBonus: 9, damage: [{ dice: "1d8", mod: 4, type: "piercing" }], kind: "melee", range: { normal: 5 }, actionCost: "action", finesse: true }],
    });
    const s = st([rogue, mk("ally", { x: 2 }), mk("orc", { type: "enemy", x: 1, hpCurrent: 500, hpMax: 500 })]);
    expect(performAttack(s, "rogue", "orc", "rp").text).toContain("скрытая атака");
    expect(performAttack(s, "rogue", "orc", "rp").text).not.toContain("скрытая атака");
    endTurn(s);
    endTurn(s);
    endTurn(s); // снова ход плута
    expect(s.current()?.id).toBe("rogue");
    expect(performAttack(s, "rogue", "orc", "rp").text).toContain("скрытая атака");
  });
});

describe("толчок", () => {
  it("нельзя толкать, когда действие уже потрачено", () => {
    const s = st([mk("hero", { actionUsed: true, attacksMadeThisAction: 1 }), mk("orc", { type: "enemy", x: 1 })]);
    expect(() => shoveCombatant(s, "hero", "orc", "prone")).toThrow("Действие уже использовано");
  });

  it("проверка идёт от Силы, а толчок тратит атаку", () => {
    fix(0.5); // оба d20 = 11
    const hero = mk("hero", { abilityMods: { STR: 5, DEX: -1, CON: 0, INT: 0, WIS: 0, CHA: 0 }, dexMod: -1 });
    const orc = mk("orc", { type: "enemy", x: 1, abilityMods: { STR: 2, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }, dexMod: 0 });
    const s = st([hero, orc]);
    const r = shoveCombatant(s, "hero", "orc", "prone");
    expect(r.success).toBe(true); // 16 против 13; с Ловкостью было бы 10 против 13
    expect(s.require("hero").actionUsed).toBe(true);
  });
});

describe("регенерация", () => {
  it("огонь, нанесённый после хода тролля, гасит его следующую регенерацию", () => {
    fix(0.5);
    const troll = mk("troll", { type: "enemy", hpCurrent: 50, hpMax: 84, monsterTraits: [{ name: "Регенерация", description: "восстанавливает 10 хитов" }] });
    const s = st([troll, mk("hero", { x: 1 })]);
    endTurn(s); // ход героя
    dealDamage(s, "troll", 5, { damageType: "fire" });
    endTurn(s); // ход тролля: регенерации нет
    expect(s.require("troll").hpCurrent).toBe(45);
    endTurn(s);
    endTurn(s); // следующий ход тролля: регенерация вернулась
    expect(s.require("troll").hpCurrent).toBe(55);
  });
});

describe("области", () => {
  const blast = spell("Взрыв", {
    range: { type: "ranged", value: 60 },
    aoe: { shape: "sphere", size: 10 },
    targeting: "point",
    saveType: "DEX",
    damage: [{ dice: "2d6", mod: 0, type: "fire", save: "half" }],
  });

  it("урон по области без friendlyFire не задевает ни союзников, ни самого заклинателя", () => {
    fix(0);
    const s = st([mk("wiz", { x: 5, y: 5 }), mk("ally", { x: 6, y: 5 }), mk("orc", { type: "enemy", x: 5, y: 6 })]);
    const r = castSpell(s, "wiz", blast, { center: { x: 5, y: 5 } });
    expect(r.targets.map((t) => t.name)).toEqual(["orc"]);
  });

  it("лечащая область лечит своих, а не врагов", () => {
    fix(0.5);
    const heal = spell("Массовое лечение", {
      range: { type: "ranged", value: 60 },
      aoe: { shape: "sphere", size: 10 },
      targeting: "point",
      damage: [{ dice: "1d4", mod: 3, type: "healing" }],
    });
    const s = st([mk("cleric", { x: 5, y: 5 }), mk("ally", { x: 6, y: 5, hpCurrent: 5 }), mk("orc", { type: "enemy", x: 5, y: 6, hpCurrent: 5 })]);
    const r = castSpell(s, "cleric", heal, { center: { x: 5, y: 5 } });
    expect(r.targets.map((t) => t.name).sort()).toEqual(["ally", "cleric"]);
    expect(s.require("orc").hpCurrent).toBe(5);
  });
});

describe("спасброски монстров от заклинаний", () => {
  const hold = spell("Удержание", {
    range: { type: "ranged", value: 60 },
    targeting: "creature",
    saveType: "WIS",
    effects: [{ condition: "paralyzed", durationRounds: 10 }],
  });

  it("Легендарное сопротивление превращает провал в успех и тратит заряд", () => {
    fix(0);
    const boss = mk("boss", {
      type: "enemy",
      x: 2,
      legendaryState: { actionsPerRound: 3, remainingActions: 3, options: [], legendaryResistancesMax: 3, legendaryResistancesRemaining: 1 },
    });
    const s = st([mk("wiz"), boss]);
    castSpell(s, "wiz", hold, { targetIds: ["boss"] });
    expect(s.require("boss").conditions.map((c) => c.type)).not.toContain("paralyzed");
    expect(s.require("boss").legendaryState?.legendaryResistancesRemaining).toBe(0);
    s.require("wiz").actionUsed = false;
    castSpell(s, "wiz", hold, { targetIds: ["boss"] });
    expect(s.require("boss").conditions.map((c) => c.type)).toContain("paralyzed");
  });

  it("«Шаг ветра» больше не считается телепортом", () => {
    const monk = mk("monk", {
      abilities: [
        {
          id: "step_of_the_wind",
          name: "Шаг ветра",
          usesMax: 0,
          usesUsed: 0,
          refresh: "none",
          parameters: { name: "Шаг ветра", type: "ability", actionCost: "bonus", range: { type: "self" }, targeting: "self", selfEffects: [{ condition: "dashing", durationRounds: 1 }] },
        },
      ],
    });
    const s = st([monk, mk("orc", { type: "enemy", x: 5 })]);
    // раньше падало с «Выберите точку на сетке для телепортации»
    expect(() => useAbility(s, "monk", "step_of_the_wind")).not.toThrow();
    expect(s.require("monk").conditions.map((c) => c.type)).toContain("dashing");
  });
});

describe("защиты монстров из бестиария", () => {
  const base = {
    id: "1",
    slug: "x",
    name: "Тест",
    size: "medium",
    type: "undead",
    challengeRating: 5,
    xp: 1800,
    armorClass: { value: 13 },
    hitPoints: { average: 67, hitDice: "9d8" },
    speed: { walk: 30 },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: {},
    skills: {},
    damageResistances: [],
    damageVulnerabilities: [],
    conditionImmunities: [],
    senses: {},
    languages: [],
    traits: [],
    actions: [],
    reactions: [],
    legendaryActions: null,
    lairActions: [],
    spellcasting: null,
  };

  it("пустые сопротивления дозаполняются из SRD по английскому имени", () => {
    const c = monsterDefinitionToCombatant({ ...base, nameEn: "Wraith", damageImmunities: ["poison", "necrotic"] } as any, {});
    expect(c.damageResistances).toContain("fire");
    expect(c.conditionImmunities).toContain("paralyzed");
    expect(c.damageImmunities).toContain("necrotic");
  });

  it("иммунитет к трём физическим типам трактуется как «от немагических атак»", () => {
    const c = monsterDefinitionToCombatant({ ...base, nameEn: "Homebrew Golem", damageImmunities: ["poison", "bludgeoning", "piercing", "slashing"] } as any, {});
    expect(c.damageImmunities).toContain("poison");
    expect(c.damageImmunities).not.toContain("slashing");
    expect(c.damageImmunities?.some((v) => v.includes("nonmagical"))).toBe(true);
  });
});
