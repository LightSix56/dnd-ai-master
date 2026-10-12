import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  evaluateFormula,
  featureUses,
  heroClassFeatures,
  srdAbilityDefinitions,
  srdClassKey,
  srdSubclassKey,
  SRD_FEATURES,
  SRD_CLASS_FEATURES_NOTICE,
  type HeroFeatureContext,
} from "../class-features";
import { extractAbilitiesFromCharacter } from "../character-adapter";
import { castSpell, dealDamage, performAttack, startTurn, useAbility } from "../engine";
import { rollInitiativeFor } from "../initiative";
import { runBotTurn } from "../bot";
import { abilitiesForClass, attacksPerAction } from "../library-data";
import { resolveAbilityUses } from "../ability-uses";
import ruNames from "../data/srd-class-features-ru.json";
import type { Combatant } from "../types";

// Умения SRD 5.1 из Foundry VTT: формулы, рост по уровню, выбор вариантов, общие запасы
// и срабатывания в бою. Math.random зафиксирован на 0.5: d20 = 11, к8 = 5.

const ctx = (over: Partial<HeroFeatureContext>): HeroFeatureContext => ({
  className: "Воин",
  subclass: null,
  level: 1,
  profBonus: 2,
  abilityMods: { STR: 3, DEX: 1, CON: 2, INT: 0, WIS: 3, CHA: 3 },
  sheet: null,
  ...over,
});

const keys = (c: HeroFeatureContext) => heroClassFeatures(c).map((f) => f.feature.key);

describe("данные SRD", () => {
  it("у каждого умения есть русское название и описание, источник указан", () => {
    const ru = ruNames as Record<string, any>;
    for (const f of SRD_FEATURES) {
      expect(ru[f.key]?.name, f.key).toBeTruthy();
      expect(ru[f.key]?.description, f.key).toBeTruthy();
    }
    expect(SRD_CLASS_FEATURES_NOTICE).toMatch(/Creative Commons Attribution 4\.0/);
  });

  it("узнаёт класс и архетип по названиям из листа", () => {
    expect(srdClassKey("Воин")).toBe("fighter");
    expect(srdClassKey("Колдун")).toBe("warlock");
    expect(srdClassKey("Альтернативный варвар")).toBeNull();
    expect(srdSubclassKey("cleric", "Домен Жизни")).toBe("life-domain");
    expect(srdSubclassKey("sorcerer", "Драконья кровь")).toBe("draconic-bloodline");
    expect(srdSubclassKey("ranger", "Охотник")).toBe("hunter");
    expect(srdSubclassKey("ranger", "Убийца монстров")).toBeNull();
    // Архетип другого класса не подходит
    expect(srdSubclassKey("fighter", "Домен Жизни")).toBeNull();
  });
});

describe("формулы и рост по уровню", () => {
  const f = (formula: string, level: number, mod = 0) =>
    evaluateFormula(formula, { level, profBonus: 3, abilityMods: { CHA: -1, WIS: 4 }, mod });

  it("кости и числа", () => {
    expect(f("1d10 + @classes.fighter.levels", 5)).toEqual({ dice: "1d10", mod: 5 });
    expect(f("5 * @classes.paladin.levels", 7)).toEqual({ dice: null, mod: 35 });
    expect(f("max(1, @abilities.cha.mod)", 3)).toEqual({ dice: null, mod: 1 });
    expect(f("floor(@classes.druid.levels / 2)", 5)).toEqual({ dice: null, mod: 2 });
  });

  it("таблицы роста: Скрытая атака, кость монаха, Божественный удар", () => {
    expect(f("@scale.rogue.sneak-attack", 5).dice).toBe("3d6");
    expect(f("@scale.rogue.sneak-attack", 19).dice).toBe("10d6");
    expect(f("1@scale.monk.die + @mod", 11, 4)).toEqual({ dice: "1d8", mod: 4 });
    expect(f("@scale.life-domain.divine-strike", 14).dice).toBe("2d8");
  });

  it("заряды: Канал божественности жреца 1/2/3, Ярость на 20 уровне без ограничения", () => {
    const cd = SRD_FEATURES.find((x) => x.key === "cleric/channel-divinity")!;
    const rage = SRD_FEATURES.find((x) => x.key === "barbarian/rage")!;
    const at = (level: number) => ({ level, profBonus: 2, abilityMods: {} });
    expect(featureUses(cd, at(2))).toEqual({ usesMax: 1, refresh: "short" });
    expect(featureUses(cd, at(6))?.usesMax).toBe(2);
    expect(featureUses(cd, at(18))?.usesMax).toBe(3);
    expect(featureUses(rage, at(17))).toEqual({ usesMax: 6, refresh: "long" });
    expect(featureUses(rage, at(20))?.usesMax).toBe(0);
  });
});

describe("умения героя", () => {
  it("умения архетипа — только с выбранным архетипом и по уровню", () => {
    expect(keys(ctx({ className: "Жрец", subclass: "Домен Жизни", level: 8 }))).toContain("life-domain/divine-strike");
    expect(keys(ctx({ className: "Жрец", subclass: "Домен Жизни", level: 7 }))).not.toContain("life-domain/divine-strike");
    expect(keys(ctx({ className: "Жрец", subclass: "Домен Бури", level: 8 })).some((k) => k.startsWith("life-domain/"))).toBe(false);
  });

  it("варианты на выбор — только выбранные в листе", () => {
    const fighter = keys(
      ctx({ className: "Воин", level: 1, sheet: { traitsList: [{ id: "fighting-style-archery", name: "Стрельба" }] } })
    );
    expect(fighter).toContain("fighter/archery");
    expect(fighter).not.toContain("fighter/dueling");

    const warlock = keys(
      ctx({
        className: "Колдун",
        level: 5,
        sheet: { levelHistory: [{ warlockInvocations: ["agonizing-blast", "devils-sight"], pactBoon: "blade" }] },
      })
    );
    expect(warlock).toEqual(expect.arrayContaining(["warlock/agonizing-blast", "warlock/devils-sight", "warlock/pact-of-the-blade"]));
    expect(warlock).not.toContain("warlock/repelling-blast");

    const hunter = keys(ctx({ className: "Следопыт", subclass: "Охотник", level: 3, sheet: { featuresTraits: "Добыча охотника: Убийца колоссов" } }));
    expect(hunter).toContain("hunter/colossus-slayer");
    expect(hunter).not.toContain("hunter/horde-breaker");
  });

  it("одинаковый боевой стиль воина и чемпиона — один раз", () => {
    const k = keys(ctx({ className: "Воин", subclass: "Чемпион", level: 10, sheet: { traitsList: [{ id: "fighting-style-defense" }] } }));
    expect(k.filter((x) => x.endsWith("/defense"))).toHaveLength(1);
  });

  it("общий запас, применяемые и пассивные умения", () => {
    const defs = srdAbilityDefinitions(ctx({ className: "Жрец", subclass: "Домен Жизни", level: 6, abilityMods: { WIS: 4 } }));
    const by = (key: string) => defs.find((d) => d.srdKey === key)!;
    expect(by("cleric/channel-divinity")).toMatchObject({ usesMax: 2, refresh: "short", parameters: { isResource: true } });
    expect(by("cleric/channel-divinity-turn-undead").parameters).toMatchObject({
      actionCost: "action",
      resourceCost: { pool: "cleric/channel-divinity", amount: 1 },
    });
    // Изгнание нежити разыгрывает движок, а не мастер
    expect(by("cleric/channel-divinity-turn-undead").parameters.manual).toBeFalsy();
    expect(by("life-domain/disciple-of-life").parameters.passive).toBe(true);
    // Умения вне боя в бой не попадают
    expect(defs.some((d) => d.srdKey === "cleric/spellcasting")).toBe(false);
  });

  it("умения с ручной реализацией не дублируются", () => {
    const abilities = extractAbilitiesFromCharacter({ id: "f", class: "Воин" }, 5, 3, { CON: 2 });
    expect(abilities.filter((a) => a.name === "Второе дыхание")).toHaveLength(1);
    expect(abilities.some((a) => a.parameters?.srdKey === "fighter/second-wind" && a.id.includes("_srd_"))).toBe(false);
    expect(abilities.some((a) => a.parameters?.srdKey === "fighter/extra-attack")).toBe(true);
  });

  it("Исцеление тела монаха лечит 3 × уровень, Ошеломляющий удар — спасбросок Телосложения и ци", () => {
    const defs = srdAbilityDefinitions(ctx({ className: "Монах", subclass: "Путь открытой ладони", level: 6, profBonus: 3, abilityMods: { WIS: 3 } }));
    const wholeness = defs.find((d) => d.srdKey === "way-of-the-open-hand/wholeness-of-body")!;
    expect(wholeness).toMatchObject({ usesMax: 1, refresh: "long", parameters: { selfHeal: { dice: "0", mod: 18 } } });
    const stun = defs.find((d) => d.srdKey === "monk/stunning-strike")!;
    expect(stun.parameters).toMatchObject({
      saveType: "CON",
      saveDC: 14,
      resourceCost: { pool: "monk/monks-focus", amount: 1 },
      effects: [{ condition: "stunned", durationRounds: 1 }],
    });
  });
});

// ============ В БОЮ ============

function hero(id: string, className: string, level: number, x: number, y: number, sheet: Record<string, any> = {}): Combatant {
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
    abilityMods: { STR: 3, DEX: 1, CON: 2, INT: 0, WIS: 3, CHA: 3 },
    profBonus: 3,
    saves: {},
    attacks: [
      {
        id: "mace",
        name: "Булава",
        kind: "melee",
        range: { normal: 5 },
        attackBonus: 6,
        damage: [{ dice: "1d6", mod: 3, type: "bludgeoning" }],
        actionCost: "action",
      },
    ],
    abilities: [],
    spells: { slots: {}, known: [] },
    hotbar: [],
    concentration: null,
  };
  c.abilities = extractAbilitiesFromCharacter({ id, class: className, ...sheet }, level, 3, c.abilityMods);
  return c;
}

function enemy(id: string, x: number, y: number, extra: Partial<Combatant> = {}): Combatant {
  return { ...hero(id, "Орк", 1, x, y), type: "enemy", abilities: [], ac: 10, hpCurrent: 60, hpMax: 60, ...extra } as Combatant;
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

const bySrd = (c: Combatant, key: string) => {
  const a = c.abilities.find((x) => x.parameters?.srdKey === key);
  if (!a) throw new Error(`${c.name}: нет умения ${key}`);
  return a;
};

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("умения SRD в бою", () => {
  it("Изгнание нежити: слабую нежить уничтожает, сильную изгоняет, тратит Канал божественности", () => {
    const cleric = hero("Жрец", "Жрец", 5, 1, 1);
    const weakSave = { WIS: { prof: false, mod: -2 } } as any;
    // к20 = 11 − 2 = 9 против СЛ 8 + 3 + 3 = 14 — провал
    const zombie = enemy("Зомби", 2, 1, { className: "Нежить", challengeRating: 0.25, saves: weakSave });
    const ghoul = enemy("Гуль", 3, 1, { className: "Нежить", challengeRating: 1, saves: weakSave });
    const orc = enemy("Орк", 1, 2, { saves: weakSave });
    const state = makeState([cleric, zombie, ghoul, orc]);
    const pool = bySrd(cleric, "cleric/channel-divinity");
    const turn = bySrd(cleric, "cleric/channel-divinity-turn-undead");
    expect(pool.usesMax).toBe(1);

    useAbility(state, cleric.id, turn.id, {});
    // Уничтожение нежити на 5 уровне — ПО 1/2 и ниже
    expect(zombie.hpCurrent).toBe(0);
    expect(zombie.conditions.some((c) => c.type === "dead")).toBe(true);
    expect(ghoul.conditions.some((c) => c.type === "turned")).toBe(true);
    expect(orc.conditions.some((c) => c.type === "turned")).toBe(false);
    expect(pool.usesUsed).toBe(1);
    expect(cleric.actionUsed).toBe(true);

    // Урон снимает изгнание
    dealDamage(state, ghoul.id, 3, { damageType: "fire" });
    expect(ghoul.conditions.some((c) => c.type === "turned")).toBe(false);

    cleric.actionUsed = false;
    expect(() => useAbility(state, cleric.id, turn.id, {})).toThrow(/не хватает/);
  });

  it("изгнанная нежить в свой ход не атакует, а уходит от жреца", () => {
    const cleric = hero("Жрец", "Жрец", 2, 5, 5);
    const ghoul = enemy("Гуль", 6, 5, { className: "Нежить", challengeRating: 1 });
    ghoul.conditions.push({ type: "turned", duration: 10, source: cleric.id });
    const state = makeState([ghoul, cleric]);
    runBotTurn(state);
    expect(cleric.hpCurrent).toBe(40);
    expect(Math.abs(ghoul.x - cleric.x) + Math.abs(ghoul.y - cleric.y)).toBeGreaterThan(1);
  });

  it("пассивное умение не применяется", () => {
    const cleric = hero("Жрец", "Жрец", 8, 1, 1, { subclass: "Домен Жизни" });
    const state = makeState([cleric]);
    expect(() => useAbility(state, cleric.id, bySrd(cleric, "life-domain/divine-strike").id, {})).toThrow(/действует само/);
  });

  it("Божественный удар — +1к8 излучением раз в ход", () => {
    const cleric = hero("Жрец", "Жрец", 8, 1, 1, { subclass: "Домен Жизни" });
    const orc = enemy("Орк", 2, 1);
    const state = makeState([cleric, orc]);
    cleric.attacksPerAction = 2;

    performAttack(state, cleric.id, orc.id, "mace");
    // к6 = 4 + 3, к8 = 5
    expect(orc.hpCurrent).toBe(60 - 7 - 5);
    expect(state.log.some((l: any) => /Божественный удар/.test(l.text))).toBe(true);

    performAttack(state, cleric.id, orc.id, "mace");
    expect(orc.hpCurrent).toBe(60 - 7 - 5 - 7);
  });

  it("Улучшенные критические попадания Чемпиона: крит на 19", () => {
    const champ = hero("Чемпион", "Воин", 3, 1, 1, { subclass: "Чемпион" });
    const orc = enemy("Орк", 2, 1);
    const state = makeState([champ, orc]);
    vi.spyOn(Math, "random").mockReturnValue(0.9); // d20 = 19
    const res = performAttack(state, champ.id, orc.id, "mace");
    expect(res.crit).toBe(true);
  });

  it("Аура защиты паладина: + мод. Харизмы к спасброскам союзников рядом", () => {
    const fear = (dc: number): Combatant["abilities"][number] => ({
      id: "fear_test",
      name: "Устрашение (тест)",
      usesMax: 0,
      usesUsed: 0,
      refresh: "none",
      parameters: {
        name: "Устрашение (тест)",
        type: "ability",
        actionCost: "action",
        range: { type: "ranged", value: 60 },
        targeting: "creature",
        saveType: "WIS",
        saveDC: dc,
        effects: [{ condition: "frightened", durationRounds: 1 }],
      },
    });
    // Союзник: к20 = 11 + Мудрость 3 = 14 против СЛ 17 — без ауры провал, с аурой (+3) успех
    for (const withPaladin of [false, true]) {
      const ally = hero("Союзник", "Воин", 1, 2, 1);
      const orc = enemy("Орк", 6, 1);
      orc.abilities = [fear(17)];
      const party = withPaladin ? [hero("Паладин", "Паладин", 6, 1, 1)] : [];
      const state = makeState([orc, ally, ...party]);
      if (withPaladin) expect(bySrd(party[0], "paladin/aura-of-protection").parameters?.featureValue).toBe(3);
      useAbility(state, orc.id, "fear_test", { targetIds: [ally.id] });
      expect(ally.conditions.some((c) => c.type === "frightened")).toBe(!withPaladin);
    }
  });

  it("Уцелевший Чемпиона лечит в начале хода при половине хитов", () => {
    const champ = hero("Чемпион", "Воин", 18, 1, 1, { subclass: "Чемпион" });
    champ.hpCurrent = 10;
    const state = makeState([champ]);
    startTurn(state);
    expect(champ.hpCurrent).toBe(10 + 5 + 2);
  });

  it("Увёртливость плута: успех спасброска Ловкости — без урона", () => {
    const rogue = hero("Плут", "Плут", 7, 3, 3);
    rogue.saves = { DEX: { prof: true, mod: 10 } } as any;
    const wizard = hero("Маг", "Волшебник", 5, 1, 1);
    wizard.type = "enemy";
    const state = makeState([wizard, rogue]);
    wizard.spells = { ...wizard.spells, spellSaveDC: 15 } as any;
    wizard.abilities.push({
      id: "fireball_test",
      name: "Огненный шар (тест)",
      usesMax: 0,
      usesUsed: 0,
      refresh: "none",
      parameters: {
        name: "Огненный шар (тест)",
        type: "ability",
        actionCost: "action",
        range: { type: "ranged", value: 150 },
        targeting: "creature",
        saveType: "DEX",
        saveDC: 15,
        damage: [{ dice: "8d6", mod: 0, type: "fire", save: "half" }],
      },
    });
    useAbility(state, wizard.id, "fireball_test", { targetIds: [rogue.id] });
    expect(rogue.hpCurrent).toBe(40);
    expect(state.log.some((l: any) => /Увёртливость/.test(l.text))).toBe(true);
  });
});

const effectAbility = (condition: string, saveType: "WIS" | "CON", dc: number): Combatant["abilities"][number] => ({
  id: `effect_${condition}`,
  name: `Наложение «${condition}» (тест)`,
  usesMax: 0,
  usesUsed: 0,
  refresh: "none",
  parameters: {
    name: `Наложение «${condition}» (тест)`,
    type: "ability",
    actionCost: "action",
    range: { type: "ranged", value: 60 },
    targeting: "creature",
    saveType,
    saveDC: dc,
    effects: [{ condition, durationRounds: 1 }],
  },
});
const has = (c: Combatant, type: string) => c.conditions.some((x) => x.type === type);
const rage = (c: Combatant) => c.conditions.push({ type: "raging", duration: 10, value: 2 });

describe("умения SRD в бою: волна проверки", () => {
  it("Сохранение жизни делит 5 × уровень между ранеными союзниками, не выше половины хитов", () => {
    const cleric = hero("Жрец", "Жрец", 5, 1, 1, { subclass: "Домен Жизни" });
    const a = hero("Воин", "Воин", 1, 2, 1);
    const b = hero("Плут", "Плут", 1, 3, 1);
    a.hpCurrent = 5;
    b.hpCurrent = 10;
    const state = makeState([cleric, a, b]);
    const preserve = bySrd(cleric, "life-domain/channel-divinity-preserve-life");
    useAbility(state, cleric.id, preserve.id, {});
    // Запас 25: первому до 20 (+15), второму оставшиеся 10
    expect(a.hpCurrent).toBe(20);
    expect(b.hpCurrent).toBe(20);
    expect(bySrd(cleric, "cleric/channel-divinity").usesUsed).toBe(1);

    // Никто не ранен ниже половины — отказ без траты заряда
    const fresh = hero("Жрец2", "Жрец", 6, 1, 1, { subclass: "Домен Жизни" });
    const s2 = makeState([fresh, hero("Воин2", "Воин", 1, 2, 1)]);
    expect(() => useAbility(s2, fresh.id, bySrd(fresh, "life-domain/channel-divinity-preserve-life").id, {})).toThrow(/меньше половины/);
    expect(bySrd(fresh, "cleric/channel-divinity").usesUsed).toBe(0);
  });

  it("Наложение рук не лечит нежить", () => {
    const paladin = hero("Паладин", "Паладин", 3, 1, 1);
    const zombie = enemy("Зомби", 2, 1, { className: "Нежить", hpCurrent: 10 });
    const state = makeState([paladin, zombie]);
    const loh = paladin.abilities.find((a) => a.parameters?.srdKey === "paladin/lay-on-hands")!;
    expect(() => useAbility(state, paladin.id, loh.id, { targetIds: [zombie.id] })).toThrow(/нежить/);
  });

  it("Бешенство берсерка: только в Ярости, атака бонусным действием", () => {
    const barb = hero("Берсерк", "Варвар", 3, 1, 1, { subclass: "Путь берсерка" });
    const orc = enemy("Орк", 2, 1);
    const state = makeState([barb, orc]);
    const frenzy = bySrd(barb, "path-of-the-berserker/frenzy");
    expect(() => useAbility(state, barb.id, frenzy.id, { targetIds: [orc.id] })).toThrow(/Ярости/);
    rage(barb);
    useAbility(state, barb.id, frenzy.id, { targetIds: [orc.id] });
    // к6 = 4 + 3 + Ярость 2
    expect(orc.hpCurrent).toBe(60 - 9);
    expect(barb.bonusActionUsed).toBe(true);
    expect(barb.actionUsed).toBe(false);
  });

  it("Сокрушитель орды: после атаки, по другой цели рядом с первой, раз в ход", () => {
    const ranger = hero("Охотник", "Следопыт", 3, 1, 1, { subclass: "Охотник", featuresTraits: "Сокрушитель орды" });
    const first = enemy("Орк1", 2, 1);
    const second = enemy("Орк2", 2, 2);
    const state = makeState([ranger, first, second]);
    const hb = bySrd(ranger, "hunter/horde-breaker");
    expect(() => useAbility(state, ranger.id, hb.id, { targetIds: [second.id] })).toThrow(/после атаки/);
    performAttack(state, ranger.id, first.id, "mace");
    expect(() => useAbility(state, ranger.id, hb.id, { targetIds: [first.id] })).toThrow(/другая цель/);
    useAbility(state, ranger.id, hb.id, { targetIds: [second.id] });
    expect(second.hpCurrent).toBe(60 - 7);
    expect(() => useAbility(state, ranger.id, hb.id, { targetIds: [second.id] })).toThrow(/уже использован/);
  });

  it("Вихревая атака бьёт всех врагов рядом, Залп — всех в области", () => {
    const sheet = { subclass: "Охотник", featuresTraits: "Вихревая атака, Залп" };
    const ranger = hero("Охотник", "Следопыт", 11, 5, 5, sheet);
    ranger.attacks.push({
      id: "bow",
      name: "Длинный лук",
      kind: "ranged",
      range: { normal: 150, long: 600 },
      attackBonus: 6,
      damage: [{ dice: "1d8", mod: 3, type: "piercing" }],
      actionCost: "action",
    });
    const near1 = enemy("Орк1", 6, 5);
    const near2 = enemy("Орк2", 5, 6);
    const far1 = enemy("Орк3", 12, 12);
    const far2 = enemy("Орк4", 13, 12);
    const state = makeState([ranger, near1, near2, far1, far2]);

    useAbility(state, ranger.id, bySrd(ranger, "hunter/whirlwind-attack").id, {});
    expect([near1.hpCurrent, near2.hpCurrent, far1.hpCurrent]).toEqual([53, 53, 60]);
    expect(ranger.actionUsed).toBe(true);

    ranger.actionUsed = false;
    useAbility(state, ranger.id, bySrd(ranger, "hunter/volley").id, { center: { x: 12, y: 12 } });
    // к8 = 5 + 3
    expect([far1.hpCurrent, far2.hpCurrent, near1.hpCurrent]).toEqual([52, 52, 53]);
  });

  it("Ошеломляющий удар — только после попадания рукопашной атакой", () => {
    const monk = hero("Монах", "Монах", 5, 1, 1);
    const orc = enemy("Орк", 2, 1, { saves: { CON: { prof: false, mod: -5 } } as any });
    const state = makeState([monk, orc]);
    const stun = bySrd(monk, "monk/stunning-strike");
    expect(() => useAbility(state, monk.id, stun.id, { targetIds: [orc.id] })).toThrow(/после попадания/);
    performAttack(state, monk.id, orc.id, "mace");
    useAbility(state, monk.id, stun.id, { targetIds: [orc.id] });
    expect(has(orc, "stunned")).toBe(true);
  });

  it("Непреклонная ярость: в Ярости держится на 1 хите, СЛ растёт на 5", () => {
    const barb = hero("Варвар", "Варвар", 11, 1, 1);
    rage(barb);
    barb.hpCurrent = 5;
    const state = makeState([barb]);
    // Телосложение: к20 = 11 + 2 = 13 против СЛ 10 — успех
    dealDamage(state, barb.id, 20, { damageType: "fire" });
    expect(barb.hpCurrent).toBe(1);
    // СЛ 15 — провал
    dealDamage(state, barb.id, 20, { damageType: "fire" });
    expect(barb.hpCurrent).toBe(0);
  });

  it("иммунитеты: Бездумная ярость, Аура отваги, Чистота тела", () => {
    const orc = enemy("Орк", 6, 1);
    orc.abilities = [effectAbility("frightened", "WIS", 30), effectAbility("poisoned", "CON", 30)];

    const berserker = hero("Берсерк", "Варвар", 6, 1, 1, { subclass: "Путь берсерка" });
    rage(berserker);
    useAbility(makeState([orc, berserker]), orc.id, "effect_frightened", { targetIds: [berserker.id] });
    expect(has(berserker, "frightened")).toBe(false);

    orc.actionUsed = false;
    const ally = hero("Союзник", "Воин", 1, 2, 1);
    const paladin = hero("Паладин", "Паладин", 10, 1, 1);
    useAbility(makeState([orc, ally, paladin]), orc.id, "effect_frightened", { targetIds: [ally.id] });
    expect(has(ally, "frightened")).toBe(false);

    orc.actionUsed = false;
    const monk = hero("Монах", "Монах", 10, 1, 1);
    useAbility(makeState([orc, monk]), orc.id, "effect_poisoned", { targetIds: [monk.id] });
    expect(has(monk, "poisoned")).toBe(false);

    // Без умений — состояние накладывается
    orc.actionUsed = false;
    const fighter = hero("Воин", "Воин", 1, 2, 1);
    useAbility(makeState([orc, fighter]), orc.id, "effect_frightened", { targetIds: [fighter.id] });
    expect(has(fighter, "frightened")).toBe(true);
  });

  it("Неуловимость плута снимает преимущество атакующего", () => {
    const rogue = hero("Плут", "Плут", 18, 1, 1);
    rogue.conditions.push({ type: "prone" });
    const orc = enemy("Орк", 2, 1);
    const state = makeState([orc, rogue]);
    performAttack(state, orc.id, rogue.id, "mace");
    expect(state.log.some((l: any) => /Неуловимость/.test(l.text))).toBe(true);
  });

  it("боевой стиль Стрельба: +2 к дальнобойным атакам", () => {
    const bow = {
      id: "bow",
      name: "Длинный лук",
      kind: "ranged" as const,
      range: { normal: 150, long: 600 },
      attackBonus: 5,
      damage: [{ dice: "1d8", mod: 3, type: "piercing" }],
      actionCost: "action" as const,
    };
    // к20 = 11 + 5 = 16 против КД 17: промах, со Стрельбой 18 — попадание
    for (const archery of [false, true]) {
      const fighter = hero("Лучник", "Воин", 1, 1, 1, archery ? { traitsList: [{ id: "fighting-style-archery" }] } : {});
      fighter.attacks = [bow];
      const orc = enemy("Орк", 8, 1, { ac: 17 });
      const res = performAttack(makeState([fighter, orc]), fighter.id, orc.id, "bow");
      expect(res.hit).toBe(archery);
    }
  });

  it("Благословение Тёмного: временные хиты за убитого врага", () => {
    const warlock = hero("Колдун", "Колдун", 3, 1, 1, { subclass: "Исчадие" });
    const orc = enemy("Орк", 2, 1, { hpCurrent: 1 });
    const state = makeState([warlock, orc]);
    dealDamage(state, orc.id, 5, { damageType: "fire", attackerId: warlock.id });
    // Харизма 3 + уровень 3
    expect(warlock.hpTemp).toBe(6);
  });

  it("начало боя: Превосходное вдохновение и Совершенство возвращают по заряду, если всё потрачено", () => {
    const bard = hero("Бард", "Бард", 20, 1, 1);
    const inspiration = bySrd(bard, "bard/bardic-inspiration");
    inspiration.usesUsed = inspiration.usesMax;
    startTurn(makeState([bard]));
    expect(inspiration.usesUsed).toBe(inspiration.usesMax - 1);

    const monk = hero("Монах", "Монах", 20, 1, 1);
    const ki = bySrd(monk, "monk/monks-focus");
    ki.usesUsed = ki.usesMax;
    startTurn(makeState([monk]));
    expect(ki.usesUsed).toBe(ki.usesMax - 4);
  });

  it("Дикий инстинкт: инициатива с преимуществом", () => {
    const feral = [{ parameters: { srdKey: "barbarian/feral-instinct" } }] as any;
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    expect(rollInitiativeFor({ dexMod: 0, abilities: feral })).toBe(20);
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    expect(rollInitiativeFor({ dexMod: 0 })).toBe(1);
  });

  it("Жаждущий клинок — вторая атака колдуну; Ликвидация — только Убийце; Дикий облик без ограничения на 20", () => {
    const warlock = extractAbilitiesFromCharacter(
      { id: "w", class: "Колдун", traitsList: [{ id: "pact-boon-blade" }], levelHistory: [{ warlockInvocations: ["thirsting-blade"] }] },
      5,
      3,
      { CHA: 3 }
    );
    expect(attacksPerAction("Колдун", 5, warlock)).toBe(2);
    expect(attacksPerAction("Колдун", 5, [])).toBe(1);

    const names = (sub: string) => abilitiesForClass("Плут", 3, sub).map((a) => a.name);
    expect(names("Убийца")).toContain("Ликвидация (Убийца)");
    expect(names("Вор")).not.toContain("Ликвидация (Убийца)");

    const ws = { usesFormula: "wildShape" as const };
    expect(resolveAbilityUses(ws, { level: 19, profBonus: 6 }).usesMax).toBe(2);
    expect(resolveAbilityUses(ws, { level: 20, profBonus: 6 }).usesMax).toBe(0);
  });
});

describe("умения, меняющие заклинания", () => {
  const spell = (over: Partial<Combatant["abilities"][number]["parameters"]> & { level: number }) => ({
    id: "test_spell",
    name: over.name ?? "Тестовое заклинание",
    level: over.level,
    parameters: {
      name: over.name ?? "Тестовое заклинание",
      type: "spell" as const,
      actionCost: "action" as const,
      range: { type: "ranged" as const, value: 120 },
      targeting: "creature" as const,
      ...over,
    },
  });
  const caster = (cls: string, level: number, subclass: string, mods: Record<string, number> = {}) => {
    const c = hero(cls, cls, level, 1, 1);
    c.abilityMods = { ...c.abilityMods, ...mods };
    c.abilities = extractAbilitiesFromCharacter({ id: c.id, class: cls, subclass }, level, 3, c.abilityMods);
    c.spells = { slots: { 1: { max: 4, used: 0 }, 3: { max: 2, used: 0 } }, known: [], spellSaveDC: 30, spellAttackBonus: 7 } as any;
    return c;
  };

  it("Усиленная эвокация: + мод. Интеллекта к урону воплощения", () => {
    const wiz = caster("Волшебник", 10, "Школа Воплощения", { INT: 4 });
    const orc = enemy("Орк", 4, 1);
    castSpell(makeState([wiz, orc]), wiz.id, spell({ level: 0, school: "evocation", damage: [{ dice: "2d6", mod: 0, type: "fire" }] }), { targetIds: [orc.id] });
    // 2к6 = 8 + 4
    expect(orc.hpCurrent).toBe(60 - 12);
  });

  it("Могущественный заговор: при успешном спасброске — половина урона", () => {
    const wiz = caster("Волшебник", 6, "Школа Воплощения");
    wiz.spells.spellSaveDC = 5;
    const orc = enemy("Орк", 4, 1);
    castSpell(makeState([wiz, orc]), wiz.id, spell({ level: 0, school: "evocation", saveType: "DEX", damage: [{ dice: "2d6", mod: 0, type: "fire" }] }), { targetIds: [orc.id] });
    expect(orc.hpCurrent).toBe(60 - 4);
  });

  it("Формовка заклинаний: союзник в области не получает урона", () => {
    const wiz = caster("Волшебник", 5, "Школа Воплощения");
    const ally = hero("Союзник", "Воин", 1, 8, 8);
    const orc = enemy("Орк", 9, 8);
    const fireball = spell({
      level: 3,
      school: "evocation",
      saveType: "DEX",
      aoe: { shape: "sphere", size: 20 },
      targeting: "point" as any,
      range: { type: "ranged", value: 150 },
      damage: [{ dice: "8d6", mod: 0, type: "fire", save: "half" }],
    });
    castSpell(makeState([wiz, ally, orc]), wiz.id, fireball, { center: { x: 8, y: 8 } });
    expect(ally.hpCurrent).toBe(40);
    expect(orc.hpCurrent).toBe(60 - 32);
  });

  it("жрец Жизни: Поборник жизни, Благословенный целитель, Высшее исцеление", () => {
    const cure = spell({ level: 1, targeting: "ally" as any, range: { type: "touch" as any }, damage: [{ dice: "1d8", mod: 3, type: "healing" }] });
    const cleric = caster("Жрец", 6, "Домен Жизни");
    cleric.hpCurrent = 30;
    const ally = hero("Союзник", "Воин", 1, 2, 1);
    ally.hpCurrent = 10;
    castSpell(makeState([cleric, ally]), cleric.id, cure, { targetIds: [ally.id] });
    // к8 = 5 + 3, Поборник жизни +3
    expect(ally.hpCurrent).toBe(21);
    // Благословенный целитель: 2 + круг
    expect(cleric.hpCurrent).toBe(33);

    const high = caster("Жрец", 17, "Домен Жизни");
    const ally2 = hero("Союзник2", "Воин", 1, 2, 1);
    ally2.hpCurrent = 10;
    castSpell(makeState([high, ally2]), high.id, cure, { targetIds: [ally2.id] });
    // Высшее исцеление: 8 + 3, +3
    expect(ally2.hpCurrent).toBe(24);
  });

  it("Мучительный взрыв: + мод. Харизмы к Мистическому заряду", () => {
    const warlock = hero("Колдун", "Колдун", 2, 1, 1, { levelHistory: [{ warlockInvocations: ["agonizing-blast"] }] });
    warlock.spells = { slots: {}, known: [], spellSaveDC: 13, spellAttackBonus: 6 } as any;
    const orc = enemy("Орк", 4, 1);
    const blast = spell({ name: "Мистический заряд", level: 0, school: "evocation", attackType: "ranged" as any, damage: [{ dice: "1d10", mod: 0, type: "force" }] });
    castSpell(makeState([warlock, orc]), warlock.id, blast, { targetIds: [orc.id] });
    // к10 = 6 + 3
    expect(orc.hpCurrent).toBe(60 - 9);
  });
});
