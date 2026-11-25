import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  combatantCreateMock,
  combatFindUniqueMock,
  campaignFindUniqueMock,
  spellLibraryFindManyMock,
  abilityLibraryFindManyMock,
} = vi.hoisted(() => ({
  combatantCreateMock: vi.fn(),
  combatFindUniqueMock: vi.fn(),
  campaignFindUniqueMock: vi.fn(),
  spellLibraryFindManyMock: vi.fn(),
  abilityLibraryFindManyMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getAuthUserFromRequest: vi.fn(async () => ({ user: { id: "user-race-test" }, error: null })),
  getSupabaseAdminClient: vi.fn(() => ({})),
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    combat: { findUnique: combatFindUniqueMock },
    campaign: { findUnique: campaignFindUniqueMock },
    spellLibrary: { findMany: spellLibraryFindManyMock },
    abilityLibrary: { findMany: abilityLibraryFindManyMock },
    combatant: { create: combatantCreateMock },
  },
}));

import { POST as importCharacterRoute } from "@/app/api/combat/import-character/route";
import {
  extractSpellsFromCharacter,
  innateSpellToCombatAbility,
  mergeRaceIntoCombatantData,
  resolveRaceForCombatant,
} from "../character-adapter";
import { dealDamage } from "../engine";
import { featureMods, modResistance, unregisterFeatureMod } from "../feature-mods";
import { createPartyCombatants } from "../generator";
import {
  defineRace,
  raceRules,
  unregisterRace,
  type RaceRules,
} from "../races/race-defs";
import { dehydrateCombatant, hydrateCombatant, packMonsterData } from "../serialize";
import type { Attack, CombatAbility, Combatant } from "../types";
import { enemy, makeState } from "./helpers/race-harness";

const savedRaces = new Map<string, RaceRules | undefined>();
const registeredFeatureKeys: string[] = [];

function registerTestRace(raceId: string, rules: RaceRules): void {
  if (!savedRaces.has(raceId)) {
    savedRaces.set(raceId, raceRules(raceId));
  }
  defineRace(raceId, rules);
}

function registerTestFeatureMod(srdKey: string, mod: Parameters<typeof featureMods>[1]): void {
  registeredFeatureKeys.push(srdKey);
  featureMods(srdKey, mod);
}

function restoreTestRegistries(): void {
  for (const [id, prev] of savedRaces) {
    if (prev) defineRace(id, prev);
    else unregisterRace(id);
  }
  savedRaces.clear();
  while (registeredFeatureKeys.length > 0) {
    unregisterFeatureMod(registeredFeatureKeys.pop()!);
  }
}

function registerTieflingRules(): void {
  registerTestRace("tiefling", {
    defaultResistances: ["fire"],
    traits: {
      "temnoe-zrenie": { id: "darkvision", kind: "skip" },
      "adskoe-soprotivlenie": { id: "hellish-resistance", kind: "passive" },
      "dyavolskoe-nasledie": { id: "infernal-legacy", kind: "skip" },
      yazyki: { id: "languages", kind: "skip" },
    },
    innateSpells: [
      {
        spellId: "thaumaturgy",
        name: "Чудотворство",
        level: 0,
        minCharacterLevel: 1,
        usesMax: 0,
        castingAbility: "CHA",
      },
      {
        spellId: "hellish-rebuke",
        name: "Адское возмездие",
        level: 2,
        minCharacterLevel: 3,
        usesMax: 1,
        refresh: "long",
        castingAbility: "CHA",
      },
      {
        spellId: "darkness",
        name: "Тьма",
        level: 2,
        minCharacterLevel: 5,
        usesMax: 1,
        refresh: "long",
        castingAbility: "CHA",
      },
    ],
  });
}

function registerDragonbornRules(): void {
  registerTestRace("dragonborn", {
    traits: {
      "nasledie-drakonov": {
        id: "draconic-ancestry",
        kind: "passive",
        pick: "sheet",
        options: [
          {
            id: "ancestry-red",
            kind: "passive",
            name: "Красный дракон",
            description: "Огонь (конус 15 фт., спасбросок Ловкости)",
            tokens: ["red", "ancestry-red"],
            aliases: ["Красный", "Red"],
          },
          {
            id: "ancestry-gold",
            kind: "passive",
            name: "Золотой дракон",
            description: "Огонь (конус 15 фт., спасбросок Ловкости)",
            tokens: ["gold", "ancestry-gold"],
            aliases: ["Золотой", "Gold"],
          },
          {
            id: "ancestry-silver",
            kind: "passive",
            name: "Серебряный дракон",
            description: "Холод (конус 15 фт., спасбросок Телосложения)",
            tokens: ["silver", "ancestry-silver"],
            aliases: ["Серебряный", "Silver"],
          },
          {
            id: "ancestry-white",
            kind: "passive",
            name: "Белый дракон",
            description: "Холод (конус 15 фт., спасбросок Телосложения)",
            tokens: ["white", "ancestry-white"],
            aliases: ["Белый", "White"],
          },
        ],
      },
      "oruzhie-dykhaniya": {
        id: "breath-weapon",
        kind: "active",
        cost: "action",
        minLevel: 1,
        target: "point",
        range: 15,
        save: "DEX",
        dc: (c) => 8 + c.prof + c.mod("CON"),
        uses: { max: 1, refresh: "short" },
        note: (c) =>
          `Урон: ${c.level >= 16 ? "5d6" : c.level >= 11 ? "4d6" : c.level >= 6 ? "3d6" : "2d6"}`,
      },
      "soprotivlenie-uronu": { id: "damage-resistance", kind: "skip" },
      yazyki: { id: "languages", kind: "skip" },
    },
  });
  registerTestFeatureMod("race/dragonborn/ancestry-red", { name: "Сопротивление (красный)", resist: ["fire"] });
  registerTestFeatureMod("race/dragonborn/ancestry-gold", { name: "Сопротивление (золотой)", resist: ["fire"] });
  registerTestFeatureMod("race/dragonborn/ancestry-silver", { name: "Сопротивление (серебряный)", resist: ["cold"] });
  registerTestFeatureMod("race/dragonborn/ancestry-white", { name: "Сопротивление (белый)", resist: ["cold"] });
}

describe("race-adapter: resolveRaceForCombatant & mergeRaceIntoCombatantData", () => {
  beforeEach(() => {
    combatantCreateMock.mockReset();
    combatantCreateMock.mockImplementation(async ({ data }: { data: Record<string, any> }) => ({
      id: `cmb_${Math.random().toString(36).slice(2, 8)}`,
      ...data,
    }));
    combatFindUniqueMock.mockResolvedValue({ id: "combat-1", campaignId: "camp-1", gridWidth: 20, gridHeight: 15 });
    campaignFindUniqueMock.mockResolvedValue({ userId: "user-race-test" });
    spellLibraryFindManyMock.mockResolvedValue([]);
    abilityLibraryFindManyMock.mockResolvedValue([]);
  });

  afterEach(() => {
    restoreTestRegistries();
    vi.restoreAllMocks();
  });

  it("handles Tiefling at levels 1, 3, 5 with fire resistance and innate spells without touching class spell slots", () => {
    registerTieflingRules();
    const abilityMods = { STR: 0, DEX: 2, CON: 1, INT: 1, WIS: 0, CHA: 3 };

    const makeTiefling = (level: number, profBonus: number) => {
      const char = {
        id: `tief-${level}`,
        name: "Никс",
        race: "Тифлинг",
        class: "Волшебник",
        level,
        spellSlots: { 1: { totalSlots: 2, expendedSlots: 0 } },
      };
      const { spells } = extractSpellsFromCharacter(char, abilityMods.INT, abilityMods.WIS, abilityMods.CHA, profBonus);
      const loadout = resolveRaceForCombatant(char, abilityMods, profBonus, `abl_t_${level}`);
      const merged = mergeRaceIntoCombatantData({
        loadout,
        char,
        abilityMods,
        profBonus,
        idPrefix: `abl_t_${level}`,
        attacks: [],
        abilities: [],
      });
      return { spells, merged };
    };

    // Level 1: fire resistance + Thaumaturgy only
    const l1 = makeTiefling(1, 2);
    expect(l1.merged.racialMeta.raceId).toBe("tiefling");
    expect(l1.merged.racialMeta.darkvision).toBe(60);
    expect(l1.merged.racialMeta.damageResistances).toEqual(["fire"]);
    const keys1 = l1.merged.abilities.map((a) => a.parameters?.srdKey);
    expect(keys1).toContain("race/tiefling/innate/thaumaturgy");
    expect(keys1).not.toContain("race/tiefling/innate/hellish-rebuke");
    expect(keys1).not.toContain("race/tiefling/innate/darkness");
    const thaum = l1.merged.abilities.find((a) => a.parameters?.srdKey === "race/tiefling/innate/thaumaturgy")!;
    expect(thaum.usesMax).toBe(0);
    expect(thaum.parameters?.type).toBe("ability");
    expect(thaum.parameters?.spellSlotLevel).toBeNull();
    expect(l1.spells.slots[1]).toEqual({ max: 2, used: 0 });

    // Level 3: adds Hellish Rebuke (slot level 2, offTurn: true, 1/long)
    const l3 = makeTiefling(3, 2);
    const rebuke = l3.merged.abilities.find((a) => a.parameters?.srdKey === "race/tiefling/innate/hellish-rebuke")!;
    expect(rebuke).toBeDefined();
    expect(rebuke.usesMax).toBe(1);
    expect(rebuke.refresh).toBe("long");
    expect(rebuke.parameters?.type).toBe("ability");
    expect(rebuke.parameters?.spellSlotLevel).toBe(2);
    expect(rebuke.parameters?.offTurn).toBe(true);
    expect(rebuke.parameters?.saveDC).toBe(8 + 2 + abilityMods.CHA);
    expect(l3.merged.abilities.map((a) => a.parameters?.srdKey)).not.toContain("race/tiefling/innate/darkness");
    expect(l3.spells.slots[1]).toEqual({ max: 2, used: 0 });

    // Level 5: adds Darkness (1/long, slot level 2)
    const l5 = makeTiefling(5, 3);
    const darkness = l5.merged.abilities.find((a) => a.parameters?.srdKey === "race/tiefling/innate/darkness")!;
    expect(darkness).toBeDefined();
    expect(darkness.usesMax).toBe(1);
    expect(darkness.refresh).toBe("long");
    expect(darkness.parameters?.type).toBe("ability");
    expect(darkness.parameters?.spellSlotLevel).toBe(2);
    expect(l5.spells.slots[1]).toEqual({ max: 2, used: 0 });
  });

  it("handles Dragonborn at level 1 vs 6 (2d6 -> 3d6 breath) and Draconic Ancestry resistance (red/gold -> fire, silver/white -> cold)", () => {
    registerDragonbornRules();
    const abilityMods = { STR: 3, DEX: 0, CON: 2, INT: 0, WIS: 0, CHA: 1 };

    const buildDragonborn = (level: number, profBonus: number, ancestryToken: string) => {
      const char = {
        id: `db_${level}_${ancestryToken}`,
        race: "Драконорождённый",
        level,
        racialVariants: [ancestryToken],
      };
      const loadout = resolveRaceForCombatant(char, abilityMods, profBonus, `abl_db_${level}`);
      return mergeRaceIntoCombatantData({
        loadout,
        char,
        abilityMods,
        profBonus,
        idPrefix: `abl_db_${level}`,
        attacks: [],
        abilities: [],
      });
    };

    const db1Red = buildDragonborn(1, 2, "red");
    const breath1 = db1Red.abilities.find((a) => a.parameters?.srdKey === "race/dragonborn/breath-weapon")!;
    expect(breath1).toBeDefined();
    expect(breath1.parameters?.description).toContain("2d6");
    expect(breath1.parameters?.saveDC).toBe(8 + 2 + 2);

    const db6Silver = buildDragonborn(6, 3, "silver");
    const breath6 = db6Silver.abilities.find((a) => a.parameters?.srdKey === "race/dragonborn/breath-weapon")!;
    expect(breath6.parameters?.description).toContain("3d6");
    expect(breath6.parameters?.saveDC).toBe(8 + 3 + 2);

    // Check elemental resistance per ancestry through featureMods / modResists & dealDamage
    const toCombatant = (id: string, merged: ReturnType<typeof buildDragonborn>): Combatant => ({
      ...enemy(id, 5, 5, { hpMax: 40, hpCurrent: 40 }),
      type: "player",
      abilities: merged.abilities,
      damageResistances: merged.racialMeta.damageResistances,
    });

    for (const [token, expectedElem] of [
      ["red", "fire"],
      ["gold", "fire"],
      ["silver", "cold"],
      ["white", "cold"],
    ] as const) {
      const merged = buildDragonborn(3, 2, token);
      const c = toCombatant(`db_${token}`, merged);
      expect(modResistance(c, expectedElem)).not.toBeNull();
      const otherElem = expectedElem === "fire" ? "cold" : "fire";
      expect(modResistance(c, otherElem)).toBeNull();

      const state = makeState([c]);
      dealDamage(state, c.id, 10, { damageType: expectedElem });
      expect(c.hpCurrent).toBe(35);
    }
  });

  it("dedupes natural weapons and resistances when sheet already defines them", () => {
    registerTestRace("tabaxi", {
      defaultResistances: ["fire"],
      naturalWeapons: [
        {
          id: "cat-claws",
          name: "Когти",
          dice: "1d4",
          damageType: "slashing",
          ability: "STR",
        },
      ],
      traits: {},
    });

    const abilityMods = { STR: 2, DEX: 3 };
    const char = { id: "tab-1", race: "Табакси", level: 1 };
    const loadout = resolveRaceForCombatant(char, abilityMods, 2, "abl_tab")!;

    const existingClaws: Attack = {
      id: "atk_sheet_claws",
      name: "когти",
      attackBonus: 4,
      damage: [{ dice: "1d4", mod: 2, type: "slashing" }],
      kind: "melee",
      range: { normal: 5 },
      actionCost: "action",
    };

    const merged = mergeRaceIntoCombatantData({
      loadout,
      char,
      abilityMods,
      profBonus: 2,
      idPrefix: "abl_tab",
      attacks: [existingClaws],
      abilities: [],
      damageResistances: ["Fire"],
    });

    expect(merged.attacks).toHaveLength(1);
    expect(merged.attacks[0].id).toBe("atk_sheet_claws");
    expect(merged.racialMeta.damageResistances).toEqual(["Fire"]);
  });

  it("falls back to manual ability parameters for unknown innate spells", () => {
    const ab = innateSpellToCombatAbility(
      {
        spellId: "custom-racial-glamour",
        name: "Тайное сияние",
        level: 1,
        minCharacterLevel: 1,
        usesMax: 1,
        refresh: "long",
        castingAbility: "CHA",
      },
      "custom-race",
      { CHA: 2 },
      2,
      "abl_x"
    );
    expect(ab.id).toBe("abl_x_race_spell_custom-racial-glamour");
    expect(ab.parameters?.manual).toBe(true);
    expect(ab.parameters?.type).toBe("ability");
    expect(ab.parameters?.srdKey).toBe("race/custom-race/innate/custom-racial-glamour");
    expect(ab.parameters?.spellSlotLevel).toBe(1);
  });

  it("preserves racial fields and resistances across dehydrateCombatant -> hydrateCombatant roundtrip", () => {
    const original: Combatant = {
      ...enemy("elf-rt", 2, 2),
      type: "player",
      race: "Эльф",
      subrace: "Высший эльф",
      raceId: "elf",
      subraceId: "high-elf",
      darkvision: 60,
      speeds: { fly: 30, swim: 30 },
      racialVariants: ["high-elf-cantrip"],
      damageResistances: ["fire"],
      conditionImmunities: ["charmed"],
    };

    const row = dehydrateCombatant(original);
    const hydrated = hydrateCombatant({ id: original.id, ...row });

    expect(hydrated.race).toBe("Эльф");
    expect(hydrated.subrace).toBe("Высший эльф");
    expect(hydrated.raceId).toBe("elf");
    expect(hydrated.subraceId).toBe("high-elf");
    expect(hydrated.darkvision).toBe(60);
    expect(hydrated.speeds).toEqual({ fly: 30, swim: 30 });
    expect(hydrated.racialVariants).toEqual(["high-elf-cantrip"]);
    expect(hydrated.damageResistances).toEqual(["fire"]);
    expect(hydrated.conditionImmunities).toEqual(["charmed"]);
  });

  it("persists racial fields via createPartyCombatants (generator.ts) and keeps no-race characters unchanged", async () => {
    registerTieflingRules();
    registerTestRace("halfling", {
      traits: { vezenchiy: { id: "lucky", kind: "passive" } },
    });

    await createPartyCombatants({
      combatId: "combat-1",
      gridWidth: 20,
      gridHeight: 15,
      characters: [
        {
          id: "char-tief",
          campaignId: "camp-1",
          name: "Лира",
          type: "player",
          class: "Бард",
          race: "Тифлинг",
          level: 3,
          hpCurrent: 22,
          hpMax: 22,
          ac: 14,
          speed: 30,
          str: 8,
          dex: 16,
          con: 12,
          int: 10,
          wis: 10,
          cha: 16,
          profBonus: 2,
        } as any,
        {
          id: "char-half",
          campaignId: "camp-1",
          name: "Пин",
          type: "player",
          class: "Плут",
          race: "Полурослик",
          level: 2,
          hpCurrent: 15,
          hpMax: 15,
          ac: 14,
          speed: 30,
          str: 8,
          dex: 16,
          con: 12,
          int: 10,
          wis: 10,
          cha: 10,
          profBonus: 2,
        } as any,
        {
          id: "char-plain",
          campaignId: "camp-1",
          name: "Безымянный",
          type: "player",
          class: "Воин",
          race: "",
          level: 1,
          hpCurrent: 12,
          hpMax: 12,
          ac: 15,
          speed: 30,
          str: 16,
          dex: 10,
          con: 14,
          int: 10,
          wis: 10,
          cha: 10,
          profBonus: 2,
        } as any,
      ],
    });

    expect(combatantCreateMock).toHaveBeenCalledTimes(3);

    const tiefCall = combatantCreateMock.mock.calls[0][0].data;
    const tiefMonster = JSON.parse(tiefCall.monsterData);
    expect(tiefMonster.raceId).toBe("tiefling");
    expect(tiefMonster.darkvision).toBe(60);
    expect(tiefMonster.damageResistances).toEqual(["fire"]);
    const tiefAbilities: CombatAbility[] = JSON.parse(tiefCall.abilities);
    // Lyra preset should NOT overwrite Tiefling innate spells/abilities
    expect(tiefAbilities.some((a) => a.parameters?.srdKey === "race/tiefling/innate/hellish-rebuke")).toBe(true);
    const tiefHotbar = JSON.parse(tiefCall.hotbar);
    expect(tiefHotbar.some((h: { name: string }) => h.name === "Адское возмездие")).toBe(true);

    const halfCall = combatantCreateMock.mock.calls[1][0].data;
    expect(halfCall.size).toBe("small");
    expect(halfCall.speed).toBe(25);
    expect(JSON.parse(halfCall.monsterData).raceId).toBe("halfling");

    const plainCall = combatantCreateMock.mock.calls[2][0].data;
    expect(plainCall.size).toBe("medium");
    expect(plainCall.speed).toBe(30);
    expect(plainCall.monsterData ?? "{}").toBe(packMonsterData({}));
  });

  it("persists racial fields and subrace via POST /api/combat/import-character and leaves no-race imports unchanged", async () => {
    registerTieflingRules();

    const makeReq = (characterJson: Record<string, any>) =>
      new Request("http://localhost/api/combat/import-character", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
        body: JSON.stringify({ combatId: "combat-1", characterJson, type: "player" }),
      });

    const resRace = await importCharacterRoute(
      makeReq({
        name: "Каэль",
        className: "Колдун",
        race: "Тифлинг",
        subrace: "",
        level: 5,
        hpMax: 35,
        ac: 14,
        abilityScores: { СИЛ: 8, ЛОВ: 14, ТЕЛ: 14, ИНТ: 10, МДР: 10, ХАР: 18 },
      }) as any
    );
    expect(resRace.status).toBe(200);
    const bodyRace = await resRace.json();
    expect(bodyRace.parsed.raceId).toBe("tiefling");
    expect(bodyRace.parsed.subrace).toBe("");

    const createdData = combatantCreateMock.mock.calls[0][0].data;
    const meta = JSON.parse(createdData.monsterData);
    expect(meta.raceId).toBe("tiefling");
    expect(meta.darkvision).toBe(60);
    expect(meta.damageResistances).toEqual(["fire"]);
    const abilities: CombatAbility[] = JSON.parse(createdData.abilities);
    expect(abilities.some((a) => a.parameters?.srdKey === "race/tiefling/innate/darkness")).toBe(true);
    const hotbar = JSON.parse(createdData.hotbar);
    expect(hotbar.some((h: { name: string }) => h.name === "Тьма")).toBe(true);

    // No-race character behaves identically without racial metadata
    const resPlain = await importCharacterRoute(
      makeReq({
        name: "Страж",
        className: "Воин",
        level: 1,
        hpMax: 12,
        ac: 16,
      }) as any
    );
    expect(resPlain.status).toBe(200);
    const bodyPlain = await resPlain.json();
    expect(bodyPlain.parsed.raceId).toBeUndefined();
    const plainData = combatantCreateMock.mock.calls[1][0].data;
    expect(plainData.size).toBe("medium");
    expect(plainData.speed).toBe(30);
    expect(plainData.monsterData).toBe("{}");
  });
});
