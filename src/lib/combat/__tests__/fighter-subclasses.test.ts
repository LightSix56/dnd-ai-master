import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FIGHTER_FEATURES,
  FIGHTER_SUBCLASSES,
  fighterSubclassAbilityDefinitions,
  fighterSubclassId,
  psionicDice,
  psionicFaces,
  superiorityDice,
  superiorityFaces,
} from "../fighter-subclasses";
import { srdAbilityDefinitions, type HeroFeatureContext } from "../class-features";
import { extractAbilitiesFromCharacter } from "../character-adapter";
import { startTurn, useAbility } from "../engine";
import type { CombatAbility, Combatant } from "../types";

// Подклассы Воина с dnd.su (ред. 2014): данные, подбор по листу, запасы, приёмы/выстрелы/руны и бой.
// Math.random зафиксирован на 0.5. Бонус мастерства героя в боевых тестах — 3.

const ctx = (subclass: string, level: number, sheet: Record<string, any> | null = null): HeroFeatureContext => ({
  className: "Воин",
  subclass,
  level,
  profBonus: 2 + Math.ceil(level / 4) - 1,
  abilityMods: { STR: 3, DEX: 1, CON: 2, INT: 1, WIS: 0, CHA: 0 },
  sheet,
});

const defs = (c: HeroFeatureContext) => fighterSubclassAbilityDefinitions(c);
const byKey = (c: HeroFeatureContext, key: string) => defs(c).find((d) => d.srdKey === key);

const BM = "Мастер боевых искусств";
const traits = (...names: string[]) => ({ featuresTraits: names.join("\n") });

describe("данные подклассов Воина", () => {
  it("10 подклассов, 56 умений, 42 варианта; идентификаторы уникальны", () => {
    expect(FIGHTER_SUBCLASSES).toHaveLength(10);
    expect(FIGHTER_FEATURES).toHaveLength(56);
    expect(FIGHTER_FEATURES.reduce((n, f) => n + f.options.length, 0)).toBe(42);

    const featureIds = FIGHTER_FEATURES.map((f) => `${f.subclassId}/${f.id}`);
    expect(new Set(featureIds).size).toBe(featureIds.length);
    const optionIds = FIGHTER_FEATURES.flatMap((f) => f.options.map((o) => o.id));
    expect(new Set(optionIds).size).toBe(optionIds.length);

    for (const f of FIGHTER_FEATURES) {
      expect(f.name, f.id).toBeTruthy();
      expect(f.description.length, f.id).toBeGreaterThan(20);
      expect(f.level, f.id).toBeGreaterThanOrEqual(3);
      expect(FIGHTER_SUBCLASSES.some((s) => s.id === f.subclassId), f.id).toBe(true);
    }
  });

  it("число приёмов, выстрелов, сил и рун как в книгах", () => {
    const count = (sub: string) => FIGHTER_FEATURES.filter((f) => f.subclassId === sub).reduce((n, f) => n + f.options.length, 0);
    expect(count("battlemaster")).toBe(23);
    expect(count("arcane-archer")).toBe(8);
    expect(count("psi-warrior")).toBe(5);
    expect(count("rune-knight")).toBe(6);
  });

  it("каждое умение и вариант получают правило: ни один подкласс не падает на 20 уровне со всеми вариантами", () => {
    const everything = traits(...FIGHTER_FEATURES.flatMap((f) => f.options.map((o) => o.name)));
    for (const s of FIGHTER_SUBCLASSES) {
      const list = defs(ctx(s.name, 20, everything));
      if (s.id === "champion") {
        expect(list, "Чемпион в SRD").toEqual([]);
        continue;
      }
      expect(list.length, s.id).toBeGreaterThan(0);
      for (const d of list) {
        expect(d.parameters.srdKey).toMatch(new RegExp(`^${s.id}/`));
        expect(d.parameters.description, d.srdKey).toBeTruthy();
      }
    }
  });
});

describe("подбор подкласса по листу", () => {
  it("узнаёт названия dnd.su и английские", () => {
    expect(fighterSubclassId("Мастер боевых искусств")).toBe("battlemaster");
    expect(fighterSubclassId("Battle Master")).toBe("battlemaster");
    expect(fighterSubclassId("Мистический рыцарь")).toBe("eldritch-knight");
    expect(fighterSubclassId("Рыцарь Пурпурного дракона")).toBe("banneret");
    expect(fighterSubclassId("Кавалерист")).toBe("cavalier");
    expect(fighterSubclassId("Мистический лучник")).toBe("arcane-archer");
    expect(fighterSubclassId("Самурай")).toBe("samurai");
    expect(fighterSubclassId("Рыцарь Эха")).toBe("echo-knight");
    expect(fighterSubclassId("Пси-воин")).toBe("psi-warrior");
    expect(fighterSubclassId("Рунный рыцарь")).toBe("rune-knight");
  });

  it("Чемпион, чужой архетип и пустое значение — не из этого модуля", () => {
    expect(fighterSubclassId("Чемпион")).toBeNull();
    expect(fighterSubclassId("Домен Жизни")).toBeNull();
    expect(fighterSubclassId(null)).toBeNull();
  });

  it("только для Воина", () => {
    expect(defs({ ...ctx(BM, 5), className: "Паладин" })).toEqual([]);
    expect(defs({ ...ctx(BM, 5), className: "Альтернативный воин" })).toEqual([]);
    expect(defs({ ...ctx("", 5), subclass: null })).toEqual([]);
  });

  it("попадает в общий список умений SRD, а Чемпион остаётся на SRD без дублей", () => {
    const all = srdAbilityDefinitions(ctx(BM, 3, traits("Парирование"))).map((d) => d.srdKey);
    expect(all).toContain("battlemaster/combat-superiority");
    expect(all).toContain("battlemaster/parry");

    const champ = srdAbilityDefinitions(ctx("Чемпион", 18)).map((d) => d.srdKey);
    expect(champ).toContain("champion/survivor");
    expect(champ.filter((k) => /^(battlemaster|samurai|cavalier|psi-warrior|rune-knight)\//.test(k))).toEqual([]);
  });
});

describe("умения по уровню", () => {
  it("показывает только доступные на уровне", () => {
    const keys = (lvl: number) => defs(ctx("Самурай", lvl)).map((d) => d.srdKey);
    expect(keys(2)).toEqual([]);
    expect(keys(3)).toEqual(["samurai/fighting-spirit"]);
    expect(keys(15)).toEqual(
      expect.arrayContaining(["samurai/fighting-spirit", "samurai/tireless-spirit", "samurai/rapid-strike"])
    );
    expect(keys(15)).not.toContain("samurai/strength-before-death");
    expect(keys(18)).toContain("samurai/strength-before-death");
  });

  it("умения вне боя (владения, заклинательство, знания) в бой не попадают", () => {
    const names = defs(ctx("Мистический рыцарь", 20)).map((d) => d.srdKey);
    expect(names).not.toContain("eldritch-knight/spellcasting");
    expect(names).toEqual(
      expect.arrayContaining(["eldritch-knight/war-magic", "eldritch-knight/arcane-charge", "eldritch-knight/improved-war-magic"])
    );
    expect(defs(ctx(BM, 20)).map((d) => d.srdKey)).not.toContain("battlemaster/student-of-war");
  });

  it("справочные умения — passive и без кнопки", () => {
    const warMagic = byKey(ctx("Мистический рыцарь", 7), "eldritch-knight/war-magic")!;
    expect(warMagic.parameters).toMatchObject({ passive: true, actionCost: "none" });
    const rally = byKey(ctx("Рыцарь Пурпурного дракона", 3), "banneret/rallying-cry")!;
    expect(rally.parameters.passive).toBe(true);
  });
});

describe("Мастер боевых искусств", () => {
  it("кости превосходства: 4/5/6 штук, к8/к10/к12, возвращаются на коротком отдыхе", () => {
    expect([3, 7, 15].map(superiorityDice)).toEqual([4, 5, 6]);
    expect([3, 10, 18].map(superiorityFaces)).toEqual([8, 10, 12]);
    const pool = byKey(ctx(BM, 10), "battlemaster/combat-superiority")!;
    expect(pool).toMatchObject({ usesMax: 5, refresh: "short" });
    expect(pool.parameters).toMatchObject({ isResource: true, actionCost: "none", featureValue: 10 });
    expect(byKey(ctx(BM, 18), "battlemaster/combat-superiority")!.parameters.featureValue).toBe(12);
  });

  it("приёмы — только записанные в листе, и они тратят кость превосходства", () => {
    expect(defs(ctx(BM, 3)).map((d) => d.srdKey)).toEqual(["battlemaster/combat-superiority"]);
    const list = defs(ctx(BM, 3, traits("Парирование", "Точная атака", "Сплочение")));
    const keys = list.map((d) => d.srdKey);
    expect(keys).toEqual(expect.arrayContaining(["battlemaster/parry", "battlemaster/precision-attack", "battlemaster/rally"]));
    expect(keys).not.toContain("battlemaster/riposte");
    for (const d of list.filter((x) => x.srdKey !== "battlemaster/combat-superiority")) {
      expect(d.parameters.resourceCost, d.srdKey).toEqual({ pool: "battlemaster/combat-superiority", amount: 1 });
      expect(d.parameters.manual, d.srdKey).toBe(true);
    }
  });

  it("действие приёма и СЛ спасброска (8 + мастерство + лучшая из Силы/Ловкости)", () => {
    const c = ctx(BM, 3, traits("Парирование", "Ответный удар", "Сплочение", "Опрокидывающая атака", "Атака с угрозой"));
    expect(byKey(c, "battlemaster/parry")!.parameters.actionCost).toBe("reaction");
    expect(byKey(c, "battlemaster/riposte")!.parameters.actionCost).toBe("reaction");
    expect(byKey(c, "battlemaster/rally")!.parameters.actionCost).toBe("bonus");
    expect(byKey(c, "battlemaster/trip-attack")!.parameters).toMatchObject({ saveType: "STR", saveDC: 8 + 2 + 3, actionCost: "free" });
    expect(byKey(c, "battlemaster/menacing-attack")!.parameters.saveType).toBe("WIS");
  });

  it("однословные приёмы узнаются только как пункт списка, а не слово из описания", () => {
    const prose = traits("Я всегда в состоянии готовность к бою и засада на тропе — моё любимое дело");
    expect(defs(ctx(BM, 3, prose)).map((d) => d.srdKey)).toEqual(["battlemaster/combat-superiority"]);
    const list = defs(ctx(BM, 3, traits("Приёмы: Готовность, Засада; Подмена")));
    expect(list.map((d) => d.srdKey)).toEqual(
      expect.arrayContaining(["battlemaster/brace", "battlemaster/ambush", "battlemaster/bait-and-switch"])
    );
  });

  it("варианты берутся и из списка черт листа", () => {
    const sheet = { traitsList: [{ name: "Приём: Точная атака", description: "" }] };
    expect(defs(ctx(BM, 3, sheet)).map((d) => d.srdKey)).toContain("battlemaster/precision-attack");
  });
});

describe("Мистический лучник", () => {
  const AA = "Мистический лучник";
  it("два магических выстрела за короткий отдых, выбранные стрелы тратят заряд", () => {
    const shots = traits("Взрывная стрела", "Теневая стрела");
    const list = defs(ctx(AA, 3, shots));
    expect(list.find((d) => d.srdKey === "arcane-archer/arcane-shot")).toMatchObject({ usesMax: 2, refresh: "short" });
    const shadow = list.find((d) => d.srdKey === "arcane-archer/shadow-arrow")!;
    expect(shadow.parameters).toMatchObject({
      resourceCost: { pool: "arcane-archer/arcane-shot", amount: 1 },
      saveType: "WIS",
      saveDC: 8 + 2 + 1,
    });
    expect(list.find((d) => d.srdKey === "arcane-archer/bursting-arrow")!.parameters.saveType).toBeUndefined();
  });

  it("Странствующая стрела — бонусным действием с 7 уровня", () => {
    expect(byKey(ctx(AA, 6), "arcane-archer/curving-shot")).toBeUndefined();
    expect(byKey(ctx(AA, 7), "arcane-archer/curving-shot")!.parameters.actionCost).toBe("bonus");
  });
});

describe("Пси-воин", () => {
  const PW = "Пси-воин";
  it("кости псионической энергии: 2 × мастерство, к6/к8/к10/к12, длинный отдых", () => {
    expect(psionicDice(3)).toBe(6);
    expect([3, 5, 11, 17].map(psionicFaces)).toEqual([6, 8, 10, 12]);
    const pool = byKey({ ...ctx(PW, 5), profBonus: 3 }, "psi-warrior/psionic-power")!;
    expect(pool).toMatchObject({ usesMax: 6, refresh: "long" });
    expect(pool.parameters).toMatchObject({ isResource: true, featureValue: 8 });
  });

  it("силы: Защитное поле — реакция, Псионический удар — раз в ход, обе тратят кость", () => {
    const c = ctx(PW, 3, traits("Защитное поле", "Псионический удар", "Телекинетическое передвижение"));
    expect(byKey(c, "psi-warrior/protective-field")!.parameters).toMatchObject({
      actionCost: "reaction",
      resourceCost: { pool: "psi-warrior/psionic-power", amount: 1 },
    });
    const strike = byKey(c, "psi-warrior/psionic-strike")!;
    expect(strike).toMatchObject({ usesMax: 1, refresh: "turn" });
    expect(strike.parameters.resourceCost).toEqual({ pool: "psi-warrior/psionic-power", amount: 1 });
    expect(byKey(c, "psi-warrior/telekinetic-movement")).toMatchObject({ usesMax: 1, refresh: "short" });
  });

  it("с 7 уровня — Адепт-телекинетик: пси-прыжок и толчок", () => {
    const c = (lvl: number) => ctx(PW, lvl, traits("Усиленный пси-прыжок", "Телекинетический толчок"));
    expect(byKey(c(6), "psi-warrior/psi-powered-leap")).toBeUndefined();
    expect(byKey(c(7), "psi-warrior/psi-powered-leap")!.parameters.actionCost).toBe("bonus");
    expect(byKey(c(7), "psi-warrior/telekinetic-thrust")!.parameters).toMatchObject({ passive: true, saveType: "STR", saveDC: 8 + 3 + 1 });
  });
});

describe("Рунный рыцарь", () => {
  const RK = "Рунный рыцарь";
  it("руны: одно пробуждение за отдых, с 15 уровня — два и короткий отдых", () => {
    const c = (lvl: number) => ctx(RK, lvl, traits("Огненная руна", "Холмовая руна"));
    expect(byKey(c(3), "rune-knight/fire-rune")).toMatchObject({ usesMax: 1, refresh: "long" });
    expect(byKey(c(15), "rune-knight/fire-rune")).toMatchObject({ usesMax: 2, refresh: "short" });
    expect(byKey(c(3), "rune-knight/storm-rune")).toBeUndefined();
    expect(byKey(c(3), "rune-knight/hill-rune")!.parameters.actionCost).toBe("bonus");
    expect(byKey(c(3), "rune-knight/fire-rune")!.parameters).toMatchObject({ saveType: "STR", saveDC: 8 + 2 + 2 });
  });

  it("Мощь великана: бонусное действие, мастерство раз за долгий отдых, кость растёт", () => {
    const g = (lvl: number) => byKey(ctx(RK, lvl), "rune-knight/giants-might")!;
    expect(g(3)).toMatchObject({ usesMax: 2, refresh: "long" }); // мастерство на 3 уровне
    expect(g(9)).toMatchObject({ usesMax: 4, refresh: "long" });
    expect(g(3).parameters.actionCost).toBe("bonus");
    expect(g(3).parameters.description).toContain("1к6");
    expect(g(10).parameters.description).toContain("1к8");
    expect(g(18).parameters.description).toContain("1к10");
  });

  it("Рунический щит — реакция с 7 уровня", () => {
    expect(byKey(ctx(RK, 6), "rune-knight/runic-shield")).toBeUndefined();
    expect(byKey(ctx(RK, 7), "rune-knight/runic-shield")!.parameters.actionCost).toBe("reaction");
  });
});

describe("остальные подклассы", () => {
  it("Самурай: Боевой дух 3 раза, временные хиты растут", () => {
    const f = (lvl: number) => byKey(ctx("Самурай", lvl), "samurai/fighting-spirit")!;
    expect(f(3)).toMatchObject({ usesMax: 3, refresh: "long" });
    expect([3, 10, 15].map((l) => f(l).parameters.featureValue)).toEqual([5, 10, 15]);
    expect(f(3).parameters.actionCost).toBe("bonus");
  });

  it("Кавалерист: метка — по Силе, Защитный маневр — по Телосложению, натиск раз в ход", () => {
    expect(byKey(ctx("Кавалерист", 3), "cavalier/unwavering-mark")).toMatchObject({ usesMax: 3, refresh: "long" });
    expect(byKey(ctx("Кавалерист", 7), "cavalier/warding-maneuver")).toMatchObject({ usesMax: 2, refresh: "long" });
    expect(byKey(ctx("Кавалерист", 7), "cavalier/warding-maneuver")!.parameters.actionCost).toBe("reaction");
    const charge = byKey(ctx("Кавалерист", 15), "cavalier/ferocious-charger")!;
    expect(charge).toMatchObject({ usesMax: 1, refresh: "turn" });
    expect(charge.parameters).toMatchObject({ saveType: "STR", saveDC: 8 + 5 + 3 });
  });

  it("Рыцарь Эха: Манифест — бонусным, Раскрыть потенциал — Телосложение раз, Эхо-мученик — реакция", () => {
    expect(byKey(ctx("Рыцарь Эха", 3), "echo-knight/manifest-echo")!.parameters.actionCost).toBe("bonus");
    expect(byKey(ctx("Рыцарь Эха", 3), "echo-knight/unleash-incarnation")).toMatchObject({ usesMax: 2, refresh: "long" });
    expect(byKey(ctx("Рыцарь Эха", 10), "echo-knight/shadow-martyr")).toMatchObject({ usesMax: 1, refresh: "short" });
    expect(byKey(ctx("Рыцарь Эха", 10), "echo-knight/shadow-martyr")!.parameters.actionCost).toBe("reaction");
  });
});

// ============ В БОЮ ============

function hero(id: string, subclass: string, level: number, sheet: Record<string, any> = {}): Combatant {
  const c: any = {
    id,
    name: id,
    type: "player",
    className: "Воин",
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
    x: 1,
    y: 1,
    facing: "E",
    conditions: [],
    abilityMods: { STR: 3, DEX: 1, CON: 2, INT: 1, WIS: 0, CHA: 0 },
    profBonus: 3,
    saves: {},
    attacks: [],
    abilities: [],
    spells: { slots: {}, known: [] },
    hotbar: [],
    concentration: null,
  };
  c.abilities = extractAbilitiesFromCharacter({ id, class: "Воин", subclass, ...sheet }, level, 3, c.abilityMods);
  return c;
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
      const c = this.combatants.find((x: Combatant) => x.id === id);
      if (!c) throw new Error("Not found: " + id);
      return c;
    },
    get(id: string) {
      return this.combatants.find((x: Combatant) => x.id === id);
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

const bySrd = (c: Combatant, key: string): CombatAbility => {
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

describe("подклассы Воина в бою", () => {
  it("герой листа получает кости превосходства и приёмы", () => {
    const h = hero("bm", BM, 3, traits("Парирование", "Точная атака"));
    const dice = bySrd(h, "battlemaster/combat-superiority");
    expect(dice).toMatchObject({ usesMax: 4, usesUsed: 0, refresh: "short" });
    expect(bySrd(h, "battlemaster/parry").parameters?.resourceCost?.pool).toBe("battlemaster/combat-superiority");
  });

  it("приём тратит кость превосходства и действие, пишет в журнал", () => {
    const h = hero("bm", BM, 3, traits("Точная атака", "Сплочение"));
    const state = makeState([h]);
    const dice = bySrd(h, "battlemaster/combat-superiority");

    const res = useAbility(state, "bm", bySrd(h, "battlemaster/rally").id);
    expect(res.text).toContain("Сплочение");
    expect(dice.usesUsed).toBe(1);
    expect(h.bonusActionUsed).toBe(true);
    expect(state.log.some((l: any) => l.text.includes("Сплочение"))).toBe(true);
  });

  it("когда кости кончились, приём не применяется", () => {
    const h = hero("bm", BM, 3, traits("Точная атака"));
    const state = makeState([h]);
    const dice = bySrd(h, "battlemaster/combat-superiority");
    dice.usesUsed = dice.usesMax;
    expect(() => useAbility(state, "bm", bySrd(h, "battlemaster/precision-attack").id)).toThrow(/не хватает/);
    expect(dice.usesUsed).toBe(dice.usesMax);
  });

  it("сам запас костей и справочные умения не применяются", () => {
    const h = hero("bm", BM, 15, traits("Точная атака"));
    const state = makeState([h]);
    expect(() => useAbility(state, "bm", bySrd(h, "battlemaster/combat-superiority").id)).toThrow(/запас/);
    expect(() => useAbility(state, "bm", bySrd(h, "battlemaster/relentless").id)).toThrow(/само/);
  });

  it("Неослабевающий: в бою без костей превосходства возвращается одна", () => {
    const h = hero("bm", BM, 15);
    const dice = bySrd(h, "battlemaster/combat-superiority");
    dice.usesUsed = dice.usesMax;
    startTurn(makeState([h]));
    expect(dice.usesUsed).toBe(dice.usesMax - 1);
  });

  it("если кости остались, Неослабевающий ничего не добавляет", () => {
    const h = hero("bm", BM, 15);
    const dice = bySrd(h, "battlemaster/combat-superiority");
    dice.usesUsed = 2;
    startTurn(makeState([h]));
    expect(dice.usesUsed).toBe(2);
  });

  it("Выстрел всегда наготове, Неутомимая душа и Легион единого возвращают по одному использованию", () => {
    const cases: Array<[string, number, string, string]> = [
      ["Мистический лучник", 15, "arcane-archer/ever-ready-shot", "arcane-archer/arcane-shot"],
      ["Самурай", 10, "samurai/tireless-spirit", "samurai/fighting-spirit"],
      ["Рыцарь Эха", 18, "echo-knight/legion-of-one", "echo-knight/unleash-incarnation"],
    ];
    for (const [sub, lvl, featureKey, poolKey] of cases) {
      const h = hero(sub, sub, lvl);
      bySrd(h, featureKey);
      const pool = bySrd(h, poolKey);
      pool.usesUsed = pool.usesMax;
      startTurn(makeState([h]));
      expect(pool.usesUsed, sub).toBe(pool.usesMax - 1);
    }
  });

  it("Магический выстрел: стрела тратит заряд, третий выстрел за отдых невозможен", () => {
    const h = hero("aa", "Мистический лучник", 3, traits("Взрывная стрела"));
    const state = makeState([h]);
    const arrow = bySrd(h, "arcane-archer/bursting-arrow");
    useAbility(state, "aa", arrow.id);
    expect(bySrd(h, "arcane-archer/arcane-shot").usesUsed).toBe(1);
    useAbility(state, "aa", arrow.id);
    expect(() => useAbility(state, "aa", arrow.id)).toThrow(/не хватает/);
  });

  it("Псионический удар: кость энергии тратится, раз в ход", () => {
    const h = hero("pw", "Пси-воин", 5, traits("Псионический удар"));
    const state = makeState([h]);
    const strike = bySrd(h, "psi-warrior/psionic-strike");
    useAbility(state, "pw", strike.id);
    expect(bySrd(h, "psi-warrior/psionic-power").usesUsed).toBe(1);
    expect(() => useAbility(state, "pw", strike.id)).toThrow(/закончились/);
    startTurn(state);
    expect(bySrd(h, "psi-warrior/psionic-strike").usesUsed).toBe(0);
  });

  it("Боевой дух самурая: три использования, бонусное действие", () => {
    const h = hero("sam", "Самурай", 3);
    const state = makeState([h]);
    const spirit = bySrd(h, "samurai/fighting-spirit");
    useAbility(state, "sam", spirit.id);
    expect(h.bonusActionUsed).toBe(true);
    expect(spirit.usesUsed).toBe(1);
  });

  it("Чемпион: умения только из SRD, подкласс dnd.su ничего не добавляет", () => {
    const h = hero("ch", "Чемпион", 18);
    const keys = h.abilities.map((a) => a.parameters?.srdKey).filter(Boolean) as string[];
    expect(keys).toContain("champion/survivor");
    expect(keys.filter((k) => /^(battlemaster|samurai|cavalier|psi-warrior|rune-knight)\//.test(k))).toEqual([]);
  });
});
