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
import { performAttack, startTurn, useAbility } from "../engine";
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
      manual: true,
      resourceCost: { pool: "cleric/channel-divinity", amount: 1 },
    });
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
  it("Изгнание нежити тратит Канал божественности; без зарядов — отказ", () => {
    const cleric = hero("Жрец", "Жрец", 2, 1, 1);
    const state = makeState([cleric]);
    const pool = bySrd(cleric, "cleric/channel-divinity");
    const turn = bySrd(cleric, "cleric/channel-divinity-turn-undead");
    expect(pool.usesMax).toBe(1);

    const res = useAbility(state, cleric.id, turn.id, {});
    expect(res.text).toMatch(/мастер/);
    expect(pool.usesUsed).toBe(1);
    expect(cleric.actionUsed).toBe(true);

    cleric.actionUsed = false;
    expect(() => useAbility(state, cleric.id, turn.id, {})).toThrow(/не хватает/);
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
