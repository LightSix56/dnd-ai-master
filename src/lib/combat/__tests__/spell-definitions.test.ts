import { describe, it, expect } from "vitest";
import { getSRDSpell } from "../srd/adapter";
import type { MapElementProperties } from "../types";

describe("Spell definitions & Zone types (D&D 5e)", () => {
  it("Entangle has point targeting and 20-ft cube/square aoe", () => {
    const spell = getSRDSpell("Entangle");
    expect(spell).toBeDefined();
    expect(spell?.parameters.targeting).toBe("point");
    expect(spell?.parameters.aoe).toEqual({ shape: "cube", size: 20 });
  });

  it("Grease has point targeting and 10-ft cube/square aoe", () => {
    const spell = getSRDSpell("Grease");
    expect(spell).toBeDefined();
    expect(spell?.parameters.targeting).toBe("point");
    expect(spell?.parameters.aoe).toEqual({ shape: "cube", size: 10 });
  });

  it("Spike Growth has point targeting and 20-ft radius aoe", () => {
    const spell = getSRDSpell("Spike Growth");
    expect(spell).toBeDefined();
    expect(spell?.parameters.targeting).toBe("point");
    expect(spell?.parameters.aoe).toEqual({ shape: "sphere", size: 20 });
  });

  it("MapElementProperties supports isSpellZone and zone properties", () => {
    const props: MapElementProperties = {
      isSpellZone: true,
      spellId: "spell_99",
      spellName: "Опутывание",
      casterId: "caster_1",
      concentration: true,
      durationRounds: 10,
      saveType: "STR",
      saveDC: 13,
      zoneType: "entangle",
      difficultTerrain: true,
      conditionOnFail: "restrained",
    };
    expect(props.isSpellZone).toBe(true);
    expect(props.zoneType).toBe("entangle");
  });
});
