import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTacticalEncounter } from "../generator";
import { db } from "@/lib/db";

describe("createTacticalEncounter with generateEncounter pipeline", () => {
  let campaignId: string;

  afterEach(async () => {
    if (campaignId) {
      await db.combatant.deleteMany({
        where: { combat: { campaignId } },
      });
      await db.mapElement.deleteMany({
        where: { combat: { campaignId } },
      });
      await db.combat.deleteMany({ where: { campaignId } });
      await db.character.deleteMany({ where: { campaignId } });
      await db.campaign.deleteMany({ where: { id: campaignId } });
    }
  });

  beforeEach(async () => {
    // Create a temporary campaign with 2 heroes
    const campaign = await db.campaign.create({
      data: {
        name: "Test Campaign " + Date.now(),
      },
    });
    campaignId = campaign.id;

    await db.character.create({
      data: {
        campaignId,
        name: "Воин Торин",
        type: "player",
        level: 3,
        hpMax: 28,
        hpCurrent: 28,
        ac: 16,
        str: 16,
        dex: 12,
        con: 14,
        int: 10,
        wis: 12,
        cha: 8,
      },
    });

    await db.character.create({
      data: {
        campaignId,
        name: "Маг Эларион",
        type: "player",
        level: 3,
        hpMax: 18,
        hpCurrent: 18,
        ac: 12,
        str: 8,
        dex: 14,
        con: 12,
        int: 16,
        wis: 12,
        cha: 10,
      },
    });
  });

  it("automatically generates monsters and tactical map for narrative combat request", async () => {
    const encounter = await createTacticalEncounter({
      campaignId,
      name: "Засада в лесу",
      biome: "forest",
      difficulty: "medium",
    });

    expect(encounter).toBeDefined();
    expect(encounter.combatId).toBeDefined();
    expect(encounter.enemyNames.length).toBeGreaterThan(0);
    expect(encounter.combatantsCount).toBeGreaterThan(2); // 2 heroes + enemies
    expect(encounter.awardedXP).toBeGreaterThan(0);
    expect(encounter.xpPerPlayer).toBeGreaterThan(0);

    // Verify DB records
    const combat = await db.combat.findUnique({
      where: { id: encounter.combatId },
      include: { combatants: true, mapElements: true },
    });

    expect(combat).toBeDefined();
    expect(combat!.mapElements.length).toBeGreaterThan(0);
    expect(combat!.combatants.some((c) => c.type === "enemy")).toBe(true);

    const enemiesInDb = combat!.combatants.filter((c) => c.type === "enemy");
    for (const enemy of enemiesInDb) {
      expect(enemy.hpCurrent).toBeGreaterThan(0);
      expect(enemy.ac).toBeGreaterThan(0);
      const attacks = JSON.parse(enemy.attacks);
      expect(attacks.length).toBeGreaterThan(0);
    }
  });

  it("supports manual enemy overrides when enemies array is explicitly passed", async () => {
    const encounter = await createTacticalEncounter({
      campaignId,
      name: "Дуэль с чемпионом",
      enemies: [
        {
          name: "Черный рыцарь",
          hpMax: 45,
          ac: 18,
          attacks: [
            {
              name: "Полуторный меч",
              damageDice: "1d10+3",
              attackBonus: 5,
            },
          ],
        },
      ],
    });

    expect(encounter).toBeDefined();
    expect(encounter.enemyNames).toContain("Черный рыцарь");
  });
});
