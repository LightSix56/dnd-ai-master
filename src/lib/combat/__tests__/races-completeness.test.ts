import { describe, expect, it } from "vitest";
import "../classes/combat-index";
import { kitHandles } from "../class-kit";
import { RACES_2014, raceRuleKeys, raceRules, resolveRaceForCharacter } from "../races/race-defs";
import { raceHero } from "./helpers/race-harness";

describe("Global Races Completeness Audit (All 84 Races)", () => {
  it("has all 84 official races (54 legacy + 30 mpmm) with complete rule definitions", () => {
    expect(RACES_2014.length).toBe(84);
    expect(RACES_2014.filter((r) => r.editionVariant === "legacy").length).toBe(54);
    expect(RACES_2014.filter((r) => r.editionVariant === "mpmm").length).toBe(30);

    for (const race of RACES_2014) {
      const rules = raceRules(race.id);
      expect(rules, `Missing defineRace("${race.id}")`).toBeDefined();

      for (const trait of race.traits) {
        expect(rules!.traits[trait.id], `${race.id} missing trait rule: ${trait.id}`).toBeDefined();
      }

      for (const sub of race.subraces) {
        const subRules = rules!.subraces?.[sub.id];
        expect(subRules, `${race.id} missing subrace rules: ${sub.id}`).toBeDefined();
        for (const trait of sub.traits) {
          expect(subRules!.traits[trait.id], `${race.id}/${sub.id} missing trait rule: ${trait.id}`).toBeDefined();
        }
      }
    }
  });

  it("every non-manual active racial ability across all 84 races has a handler in class-kit", () => {
    for (const race of RACES_2014) {
      for (const { key, rule } of raceRuleKeys(race.id)) {
        if (rule.kind !== "active" || rule.manual) continue;
        expect(kitHandles(key), `Missing kit handler for ${key}`).toBe(true);
      }
    }
  });

  it("builds every race and every subrace cleanly via raceHero at levels 1 and 20", () => {
    for (const race of RACES_2014) {
      expect(
        () => raceHero(race.id, null, `audit1_${race.id}`, 1),
        `${race.id} L1 failed`
      ).not.toThrow();
      expect(
        () => raceHero(race.id, null, `audit20_${race.id}`, 20),
        `${race.id} L20 failed`
      ).not.toThrow();

      for (const sub of race.subraces) {
        expect(
          () => raceHero(race.id, sub.id, `audit1_${race.id}_${sub.id}`, 1),
          `${race.id}/${sub.id} L1 failed`
        ).not.toThrow();
        expect(
          () => raceHero(race.id, sub.id, `audit20_${race.id}_${sub.id}`, 20),
          `${race.id}/${sub.id} L20 failed`
        ).not.toThrow();
      }
    }
  });

  it("minLevel consistency: level-1 innate spells and level-1 racial traits are never blocked by erroneous JSON minLevel > 1", () => {
    for (const race of RACES_2014) {
      const rules = raceRules(race.id)!;
      const checkBuild = (subId?: string) => {
        const subRules = subId ? rules.subraces?.[subId] : undefined;
        const loadout1 = resolveRaceForCharacter({
          race: race.id,
          subrace: subId ?? null,
          level: 1,
          profBonus: 2,
          abilityMods: { STR: 2, DEX: 2, CON: 2, INT: 2, WIS: 2, CHA: 2 },
        });
        expect(loadout1, `resolveRaceForCharacter failed for ${race.id}/${subId ?? "-"}`).not.toBeNull();

        // All unconditional innate spells with minCharacterLevel <= 1 must be present at level 1
        const baseSpells = subRules?.replacesInnateSpells ? [] : (rules.innateSpells ?? []);
        const expectedL1Spells = [...baseSpells, ...(subRules?.innateSpells ?? [])].filter(
          (s) => (s.minCharacterLevel ?? 1) <= 1 && !s.when
        );
        for (const s of expectedL1Spells) {
          expect(
            loadout1!.innateSpells.some((x) => x.spellId === s.spellId),
            `${race.id}/${subId ?? "-"} missing L1 innate spell ${s.spellId}`
          ).toBe(true);
        }

        // All base/subrace non-skip rules explicitly marked minLevel: 1 must be emitted at level 1
        const replaced = new Set(subRules?.replacesTraits ?? []);
        for (const [id, rule] of Object.entries(rules.traits)) {
          if (replaced.has(id) || rule.kind === "skip" || rule.when) continue;
          if (rule.minLevel === 1) {
            expect(
              loadout1!.abilities.some((a) => a.parameters?.srdKey === `race/${race.id}/${rule.id}`),
              `${race.id} trait ${id} blocked at level 1`
            ).toBe(true);
          }
        }
        if (subRules) {
          for (const [id, rule] of Object.entries(subRules.traits)) {
            if (rule.kind === "skip" || rule.when) continue;
            if (rule.minLevel === 1) {
              expect(
                loadout1!.abilities.some((a) => a.parameters?.srdKey === `race/${subId}/${rule.id}`),
                `${race.id}/${subId} trait ${id} blocked at level 1`
              ).toBe(true);
            }
          }
        }
      };

      checkBuild();
      for (const sub of race.subraces) {
        checkBuild(sub.id);
      }
    }
  });
});
