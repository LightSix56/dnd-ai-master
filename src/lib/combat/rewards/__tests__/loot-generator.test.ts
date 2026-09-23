import { describe, it, expect } from "vitest";
import { generateCombatLoot } from "../loot-generator";

describe("generateCombatLoot (Combat Rewards & Loot Generator)", () => {
  describe("Coins Generation (DMG p. 136 Individual Treasure)", () => {
    it("generates copper, silver, and gold for CR 0-4 monsters without platinum", () => {
      // Deterministic pseudo-random returning 0.5 (middle roll)
      const fakeRng = () => 0.5;
      const enemies = [
        { name: "Гоблин-стрелок", challengeRating: 0.25, type: "humanoid" },
        { name: "Гоблин-вожак", challengeRating: 1, type: "humanoid" },
      ];

      const loot = generateCombatLoot(enemies, "dungeon", 4, { rng: fakeRng });

      expect(loot.coins).toBeDefined();
      expect(loot.coins.copper).toBeGreaterThan(0);
      expect(loot.coins.silver).toBeGreaterThan(0);
      expect(loot.coins.gold).toBeGreaterThan(0);
      expect(loot.coins.platinum).toBe(0); // CR 0-4 does not roll platinum at mid roll
      expect(loot.coins.totalGoldValue).toBeGreaterThan(0);

      // Verify total gold value math: pp*10 + gp + ep*0.5 + sp*0.1 + cp*0.01
      const expectedValue =
        loot.coins.platinum * 10 +
        loot.coins.gold +
        loot.coins.electrum * 0.5 +
        loot.coins.silver * 0.1 +
        loot.coins.copper * 0.01;
      expect(loot.coins.totalGoldValue).toBeCloseTo(expectedValue, 2);
    });

    it("generates higher scale coins including platinum for CR 5-10 monsters", () => {
      // Using rng returning 0.98 to test high rolls with platinum
      const highRng = () => 0.98;
      const enemies = [
        { name: "Молодой дракон", challengeRating: 7, type: "dragon" },
      ];

      const loot = generateCombatLoot(enemies, "cave", 4, { rng: highRng });

      expect(loot.coins.platinum).toBeGreaterThan(0);
      expect(loot.coins.gold).toBeGreaterThan(50);
      expect(loot.coins.totalGoldValue).toBeGreaterThan(100);
    });
  });

  describe("Thematic Monster & Biome Drops", () => {
    it("drops undead-themed items (e.g. amulets, dark relics) when undead enemies are present", () => {
      const fixedRng = () => 0.2;
      const enemies = [
        { name: "Зомби-страж", challengeRating: 0.25, type: "undead" },
        { name: "Скелет-лучник", challengeRating: 0.25, type: "undead" },
      ];

      const loot = generateCombatLoot(enemies, "dungeon", 4, { rng: fixedRng });

      const hasUndeadDrop = loot.items.some(
        (item) =>
          item.name.toLowerCase().includes("амулет") ||
          item.name.toLowerCase().includes("прах") ||
          item.name.toLowerCase().includes("кост") ||
          item.name.toLowerCase().includes("череп") ||
          item.description.toLowerCase().includes("нежит")
      );
      expect(hasUndeadDrop).toBe(true);
    });

    it("drops biome-specific items (e.g. swamp herbs/moss) in a swamp biome", () => {
      const fixedRng = () => 0.3;
      const enemies = [
        { name: "Болотная гадюка", challengeRating: 0.125, type: "beast" },
      ];

      const loot = generateCombatLoot(enemies, "swamp", 3, { rng: fixedRng });

      const hasSwampDrop = loot.items.some(
        (item) =>
          item.name.toLowerCase().includes("болот") ||
          item.name.toLowerCase().includes("мох") ||
          item.name.toLowerCase().includes("трав") ||
          item.description.toLowerCase().includes("болот")
      );
      expect(hasSwampDrop).toBe(true);
    });

    it("drops beast-themed materials (pelts, fangs, claws) when beasts are defeated", () => {
      const fixedRng = () => 0.1;
      const enemies = [
        { name: "Лютый волк", challengeRating: 1, type: "beast" },
      ];

      const loot = generateCombatLoot(enemies, "forest", 4, { rng: fixedRng });

      const hasBeastDrop = loot.items.some(
        (item) =>
          item.type === "material" &&
          (item.name.toLowerCase().includes("клык") ||
            item.name.toLowerCase().includes("шкур") ||
            item.name.toLowerCase().includes("когот"))
      );
      expect(hasBeastDrop).toBe(true);
    });
  });

  describe("Boss Loot Bonus (Potions & Scrolls)", () => {
    it("guarantees or grants bonus potion/scroll for boss role or CR >= 1", () => {
      // rng returning 0.1 to trigger boss bonus drop
      const fixedRng = () => 0.1;
      const enemies = [
        { name: "Гоблин-шаман", challengeRating: 2, role: "boss", type: "humanoid" },
      ];

      const loot = generateCombatLoot(enemies, "dungeon", 4, { rng: fixedRng });

      const hasPotionOrScroll = loot.items.some(
        (item) =>
          item.type === "potion" ||
          item.type === "scroll" ||
          item.name.includes("Зелье лечения")
      );
      expect(hasPotionOrScroll).toBe(true);

      const healingPotion = loot.items.find((item) =>
        item.name.includes("Зелье лечения")
      );
      if (healingPotion) {
        expect(healingPotion.valueGp).toBe(50);
        expect(healingPotion.type).toBe("potion");
      }
    });
  });

  describe("Party Loot Split & Summary Text", () => {
    it("calculates partyShare dividing gold and XP evenly among party members", () => {
      const fixedRng = () => 0.5;
      const enemies = [
        { name: "Орк", challengeRating: 1, cr: 1 }, // 200 XP
        { name: "Орк-берсерк", challengeRating: 2, cr: 2 }, // 450 XP
      ]; // Total XP: 650 XP

      const loot = generateCombatLoot(enemies, "cave", 4, { rng: fixedRng });

      expect(loot.totalXp).toBe(650);
      expect(loot.xpPerPlayer).toBe(Math.floor(650 / 4)); // 162
      expect(loot.partyShare.xpPerPlayer).toBe(162);
      expect(loot.partyShare.goldPerPlayer).toBe(
        Number((loot.coins.totalGoldValue / 4).toFixed(2))
      );

      // Summary text checks
      expect(loot.summaryText).toContain("XP");
      expect(loot.summaryText).toContain("монет");
    });

    it("handles partySize = 1 and empty enemy list gracefully", () => {
      const lootEmpty = generateCombatLoot([], "dungeon", 1);
      expect(lootEmpty.totalXp).toBe(0);
      expect(lootEmpty.xpPerPlayer).toBe(0);
      expect(lootEmpty.coins.totalGoldValue).toBe(0);
      expect(lootEmpty.items).toHaveLength(0);
      expect(lootEmpty.partyShare.goldPerPlayer).toBe(0);
    });
  });
});
