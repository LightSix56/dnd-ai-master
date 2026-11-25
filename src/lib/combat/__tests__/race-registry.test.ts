import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dealDamage, useAbility } from "../engine";
import { featureMods } from "../feature-mods";
import { registerKit } from "../class-kit";
import { rollSave } from "../rules";
import {
  RACES_2014,
  defineRace,
  findRaceData,
  raceRuleKeys,
  raceRules,
  resolveRaceForCharacter,
} from "../races/race-defs";
import { ally, bySrd, enemy, hasLog, makeState, raceHero } from "./helpers/race-harness";

describe("RACES_2014 catalog & findRaceData", () => {
  it("loads all 84 official 2014 races (54 legacy + 30 mpmm) and 69 subraces", () => {
    expect(RACES_2014.length).toBe(84);
    expect(RACES_2014.filter((r) => r.editionVariant === "legacy").length).toBe(54);
    expect(RACES_2014.filter((r) => r.editionVariant === "mpmm").length).toBe(30);
    const totalSubraces = RACES_2014.reduce((sum, r) => sum + r.subraces.length, 0);
    expect(totalSubraces).toBe(69);
  });

  it("distinguishes legacy Aasimar + Protector from aasimar-mpmm", () => {
    const legacy = findRaceData("Аасимар", "Защитник");
    expect(legacy).not.toBeNull();
    expect(legacy!.race.id).toBe("aasimar");
    expect(legacy!.subrace?.id).toBe("protector-aasimar");

    const mpmmById = findRaceData("aasimar-mpmm");
    expect(mpmmById).not.toBeNull();
    expect(mpmmById!.race.id).toBe("aasimar-mpmm");
    expect(mpmmById!.subrace).toBeUndefined();

    const mpmmByLabel = findRaceData("Аасимар (MPMM)");
    expect(mpmmByLabel?.race.id).toBe("aasimar-mpmm");
  });

  it("resolves Elf + High Elf and Halfling + Stout Halfling preserving walk: 25", () => {
    const elf = findRaceData("Эльф", "Высший эльф");
    expect(elf?.race.id).toBe("elf");
    expect(elf?.subrace?.id).toBe("high-elf");
    expect(elf?.race.speeds.walk).toBe(30);
    expect(elf?.race.darkvision).toBe(60);

    const halfling = findRaceData("Полурослик", "Коренастый полурослик");
    expect(halfling?.race.id).toBe("halfling");
    expect(halfling?.subrace?.id).toBe("stout-halfling");
    expect(halfling?.race.speeds.walk).toBe(25);
  });

  it("does not attach a random subrace when subraceQuery matches nothing", () => {
    const res = findRaceData("Эльф", "Несуществующая подраса");
    expect(res).not.toBeNull();
    expect(res!.race.id).toBe("elf");
    expect(res!.subrace).toBeUndefined();

    expect(findRaceData("Неизвестная раса")).toBeNull();
    expect(findRaceData(null)).toBeNull();
  });
});

describe("defineRace, resolveRaceForCharacter, level gating & options", () => {
  const prevAasimar = raceRules("aasimar");

  beforeEach(() => {
    defineRace("aasimar", {
      defaultResistances: ["necrotic", "radiant"],
      traits: {
        "istselyayushchie-ruki": {
          id: "healing-hands",
          kind: "active",
          cost: "action",
          target: "ally",
          range: 5,
          uses: { max: 1, refresh: "long" },
        },
        "nebesnoe-soprotivlenie": {
          id: "celestial-resistance",
          kind: "passive",
        },
        yazyki: {
          id: "languages",
          kind: "skip",
        },
      },
      subraces: {
        "protector-aasimar": {
          traits: {
            "siyayushchaya-dusha": {
              id: "radiant-soul",
              kind: "active",
              cost: "action",
              minLevel: 3,
              uses: "profBonus",
            },
          },
          extra: [
            {
              id: "celestial-focus",
              kind: "active",
              cost: "bonus",
              minLevel: 5,
              name: "Небесный фокус",
              description: "Выбор аспекта",
              pick: "sheet-or-all",
              options: [
                {
                  id: "aspect-sun",
                  kind: "passive",
                  name: "Аспект Солнца",
                  description: "Свет",
                  minLevel: 5,
                },
                {
                  id: "aspect-star",
                  kind: "passive",
                  name: "Аспект Звезды",
                  description: "Сияние",
                  minLevel: 6,
                },
              ],
            },
          ],
        },
      },
    });
  });

  afterEach(() => {
    if (prevAasimar) defineRace("aasimar", prevAasimar);
  });

  it("filters abilities by minLevel (3 / 5 / 6) and resolves uses + srdKey format", () => {
    const lvl1 = resolveRaceForCharacter({
      race: "Аасимар",
      subrace: "Защитник",
      level: 1,
      profBonus: 2,
      abilityMods: { CHA: 3 },
    });
    expect(lvl1).not.toBeNull();
    const keys1 = lvl1!.abilities.map((a) => a.parameters?.srdKey);
    expect(keys1).toContain("race/aasimar/healing-hands");
    expect(keys1).toContain("race/aasimar/celestial-resistance");
    expect(keys1).not.toContain("race/aasimar/languages");
    expect(keys1).not.toContain("race/protector-aasimar/radiant-soul");
    expect(keys1).not.toContain("race/protector-aasimar/celestial-focus");

    const lvl3 = resolveRaceForCharacter({
      race: "Аасимар",
      subrace: "Защитник",
      level: 3,
      profBonus: 2,
      abilityMods: { CHA: 3 },
    })!;
    const radiantSoul = lvl3.abilities.find((a) => a.parameters?.srdKey === "race/protector-aasimar/radiant-soul");
    expect(radiantSoul).toBeDefined();
    expect(radiantSoul!.usesMax).toBe(2);
    expect(radiantSoul!.refresh).toBe("long");

    // At level 5 with sheet-or-all and nothing in sheet: aspect-sun (minLevel 5) appears, aspect-star (minLevel 6) does not
    const lvl5 = resolveRaceForCharacter({
      race: "Аасимар",
      subrace: "Защитник",
      level: 5,
      profBonus: 3,
      abilityMods: { CHA: 3 },
    })!;
    const keys5 = lvl5.abilities.map((a) => a.parameters?.srdKey);
    expect(keys5).toContain("race/protector-aasimar/aspect-sun");
    expect(keys5).not.toContain("race/protector-aasimar/aspect-star");

    // At level 6 with sheet choice matching only aspect-star: sheet-or-all narrows to aspect-star
    const lvl6Chosen = resolveRaceForCharacter({
      race: "Аасимар",
      subrace: "Защитник",
      level: 6,
      profBonus: 3,
      abilityMods: { CHA: 3 },
      sheet: { traitsList: [{ id: "star", name: "Аспект Звезды" }] },
    })!;
    const keys6 = lvl6Chosen.abilities.map((a) => a.parameters?.srdKey);
    expect(keys6).toContain("race/protector-aasimar/aspect-star");
    expect(keys6).not.toContain("race/protector-aasimar/aspect-sun");
  });

  it("supports pick: 'sheet' filtering strictly by sheet tokens/text", () => {
    defineRace("elf", {
      traits: {
        "nasledie-fey": {
          id: "fey-ancestry",
          kind: "passive",
          pick: "sheet",
          options: [
            {
              id: "mark-moon",
              kind: "passive",
              name: "Знак Луны",
              description: "Лунный",
              tokens: ["elf-mark-moon"],
            },
            {
              id: "mark-sun",
              kind: "passive",
              name: "Знак Солнца",
              description: "Солнечный",
              tokens: ["elf-mark-sun"],
            },
          ],
        },
      },
    });

    const none = resolveRaceForCharacter({ race: "Эльф", level: 1, profBonus: 2, abilityMods: {} })!;
    expect(none.abilities.map((a) => a.parameters?.srdKey)).toEqual(["race/elf/fey-ancestry"]);

    const moon = resolveRaceForCharacter({
      race: "Эльф",
      level: 1,
      profBonus: 2,
      abilityMods: {},
      sheet: { traitsList: [{ id: "elf-mark-moon", name: "Знак Луны" }] },
    })!;
    expect(moon.abilities.map((a) => a.parameters?.srdKey)).toEqual([
      "race/elf/fey-ancestry",
      "race/elf/mark-moon",
    ]);
  });

  it("exposes raceRuleKeys for completeness audits", () => {
    const keys = raceRuleKeys("aasimar");
    expect(keys.some((k) => k.key === "race/aasimar/healing-hands")).toBe(true);
    expect(keys.some((k) => k.key === "race/protector-aasimar/radiant-soul" && k.subraceId === "protector-aasimar")).toBe(true);
  });
});

describe("raceHero harness & engine integration (classHooks / featureMods)", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("populates racial Combatant fields and integrates with featureMods & classHooks", () => {
    defineRace("halfling", {
      traits: {
        vezenchiy: { id: "lucky", kind: "passive" },
        khrabryy: { id: "brave", kind: "passive" },
      },
      subraces: {
        "stout-halfling": {
          resistances: ["poison"],
          traits: {
            "ustoychivost-korenastykh": { id: "stout-resilience", kind: "passive" },
            "test-roar": { id: "stout-roar", kind: "active", cost: "bonus", uses: "level" },
          },
          extra: [
            {
              id: "stout-boost",
              kind: "active",
              cost: "bonus",
              minLevel: 1,
              name: "Рывок стойкости",
              description: "Боевой клич",
              uses: { max: 1, refresh: "short" },
            },
          ],
        },
      },
    });

    featureMods("race/halfling/brave", {
      name: "Храбрый",
      saveAdvantageConditions: ["frightened"],
    });
    registerKit({
      id: "test-race-stout",
      actions: {
        "race/stout-halfling/stout-boost": ({ state, c, pay }) => {
          pay();
          state.addLog(`${c.name} активирует Рывок стойкости`, "ability", c.name);
          return { text: "Рывок стойкости сработал", targets: [] };
        },
      },
    });

    const halflingLoadout = resolveRaceForCharacter({
      race: "Полурослик",
      subrace: "Коренастый полурослик",
      level: 4,
      profBonus: 2,
      abilityMods: {},
    })!;
    expect(halflingLoadout.speeds.walk).toBe(25);

    const h = raceHero("Полурослик", "Коренастый полурослик", "pip", 4, {
      racialVariants: ["custom-token"],
    });
    expect(h.raceId).toBe("halfling");
    expect(h.subraceId).toBe("stout-halfling");
    expect(h.darkvision).toBe(0);
    expect(h.speed).toBe(25);
    expect(h.size).toBe("small");
    expect(h.damageResistances).toContain("poison");
    expect(h.racialVariants).toContain("custom-token");

    const state = makeState([h, enemy("gob", 6, 5)]);

    // featureMods integration: Brave grants advantage against frightened
    const save = rollSave(h, "WIS", 15, { condition: "frightened" });
    expect(save.advantage).toBe(true);

    // damageResistances integration: poison damage halved
    const hpBefore = h.hpCurrent;
    dealDamage(state, "pip", 10, { damageType: "poison" });
    expect(h.hpCurrent).toBe(hpBefore - 5);

    // classHooks / registerKit integration: active racial ability runs through useAbility
    const boost = bySrd(h, "race/stout-halfling/stout-boost");
    const out = useAbility(state, "pip", boost.id);
    expect(out.text).toContain("Рывок стойкости");
    expect(hasLog(state, "Рывок стойкости")).toBe(true);
    expect(h.bonusActionUsed).toBe(true);
  });
});
