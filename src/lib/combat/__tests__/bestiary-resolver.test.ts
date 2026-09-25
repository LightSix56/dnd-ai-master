import { describe, it, expect } from "vitest";
import {
  findMonsterInManifest,
  resolveMonsterCombatant,
} from "../monsters/bestiary-resolver";
import { loadDefaultManifest } from "../encounters/encounter-generator";

describe("Bestiary Resolver (D&D 5e Compendium Matching)", () => {
  const manifest = loadDefaultManifest();

  describe("findMonsterInManifest", () => {
    it("resolves exact slug match", () => {
      const match = findMonsterInManifest("442-guard", manifest);
      expect(match).toBeDefined();
      expect(match?.slug).toBe("442-guard");
      expect(match?.name).toBe("Страж");
    });

    it("resolves canonical Russian and English names", () => {
      const guardRu = findMonsterInManifest("Страж", manifest);
      expect(guardRu?.slug).toBe("442-guard");

      const guardEn = findMonsterInManifest("Guard", manifest);
      expect(guardEn?.slug).toBe("442-guard");

      const goblin = findMonsterInManifest("Гоблин", manifest);
      expect(goblin?.slug).toBe("4-goblin");
    });

    it("resolves common Russian declensions and synonyms (стражник -> страж)", () => {
      const guardVariant1 = findMonsterInManifest("Стражник", manifest);
      expect(guardVariant1?.slug).toBe("442-guard");

      const guardVariant2 = findMonsterInManifest("стражники", manifest);
      expect(guardVariant2?.slug).toBe("442-guard");

      const banditVariant = findMonsterInManifest("Бандит", manifest);
      expect(banditVariant?.slug).toBe("437-bandit");
    });

    it("resolves names with trailing instance numbers and punctuation (Стражник 1, Страж #2)", () => {
      const guard1 = findMonsterInManifest("Стражник 1", manifest);
      expect(guard1?.slug).toBe("442-guard");

      const guard2 = findMonsterInManifest("Страж #2", manifest);
      expect(guard2?.slug).toBe("442-guard");

      const goblin3 = findMonsterInManifest("Гоблин-3", manifest);
      expect(goblin3?.slug).toBe("4-goblin");
    });

    it("resolves compound role names like Гоблин-лучник and Орк-воин", () => {
      const goblinArcher = findMonsterInManifest("Гоблин-лучник", manifest);
      expect(goblinArcher?.slug).toBe("4-goblin");

      const orcWarrior = findMonsterInManifest("Орк-воин", manifest);
      expect(orcWarrior?.slug).toBe("20-orc");
    });

    it("returns null for completely unrecognized custom names", () => {
      const unknown = findMonsterInManifest("Неведомая абракадабра 999", manifest);
      expect(unknown).toBeNull();
    });
  });

  describe("resolveMonsterCombatant", () => {
    it("converts a guard input into authentic Guard stat block with Spear (NOT Scimitar)", () => {
      const result = resolveMonsterCombatant(
        {
          name: "Стражник 1",
        },
        { manifest }
      );

      expect(result.matched).toBe(true);
      expect(result.xp).toBe(25);
      expect(result.combatantData.name).toBe("Стражник 1");
      expect(result.combatantData.hpMax).toBe(11);
      expect(result.combatantData.ac).toBe(16);
      expect(result.combatantData.className).toContain("ПО 1/8");

      // Verify authentic attacks
      const attacks = result.combatantData.attacks || [];
      expect(attacks.length).toBeGreaterThan(0);
      const attackNames = attacks.map((a) => a.name);
      expect(attackNames).toContain("Копьё");
      expect(attackNames).not.toContain("Скимитар");

      // Verify Spear stats: 1d6+1 piercing
      const spear = attacks.find((a) => a.name === "Копьё");
      expect(spear?.damage[0].dice).toBe("1d6");
      expect(spear?.damage[0].mod).toBe(1);
      expect(spear?.damage[0].type).toBe("piercing");
    });

    it("replaces dummy/generic 'Скимитар' attack with authentic monster attacks when matched", () => {
      // Simulates the AI passing a dummy placeholder attack
      const result = resolveMonsterCombatant(
        {
          name: "Стражник 2",
          attacks: [
            {
              name: "Скимитар",
              damageDice: "1d6",
              damageType: "slashing",
            },
          ],
        },
        { manifest }
      );

      expect(result.matched).toBe(true);
      const attackNames = (result.combatantData.attacks || []).map((a) => a.name);
      expect(attackNames).toContain("Копьё");
      expect(attackNames).not.toContain("Скимитар");
    });

    it("respects explicit HP and AC overrides on a recognized monster", () => {
      const result = resolveMonsterCombatant(
        {
          name: "Элитный стражник",
          hpMax: 22,
          ac: 18,
        },
        { manifest }
      );

      expect(result.matched).toBe(true);
      expect(result.combatantData.hpMax).toBe(22);
      expect(result.combatantData.ac).toBe(18);
      // Still carries Spear attack and Guard abilities
      const attackNames = (result.combatantData.attacks || []).map((a) => a.name);
      expect(attackNames).toContain("Копьё");
    });

    it("falls back cleanly for custom unrecognized enemies", () => {
      const result = resolveMonsterCombatant(
        {
          name: "Призрачный страж склепа",
          hpMax: 40,
          ac: 14,
          attacks: [
            {
              name: "Призрачное касание",
              damageDice: "2d6+2",
              damageType: "necrotic",
            },
          ],
        },
        { manifest }
      );

      expect(result.matched).toBe(false);
      expect(result.combatantData.hpMax).toBe(40);
      expect(result.combatantData.ac).toBe(14);
      const attackNames = (result.combatantData.attacks || []).map((a) => a.name);
      expect(attackNames).toContain("Призрачное касание");
    });
  });
});
