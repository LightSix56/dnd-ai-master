import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { awardCombatVictoryXP } from "../xp-award";
import { db } from "@/lib/db";

describe("Combat Victory XP Progression", () => {
  let campaignId: string;
  let hero1Id: string;
  let hero2Id: string;
  let combatId: string;

  afterEach(async () => {
    if (combatId) {
      await db.combatant.deleteMany({ where: { combatId } });
    }
    if (campaignId) {
      await db.gameEvent.deleteMany({ where: { campaignId } });
      await db.character.deleteMany({ where: { campaignId } });
      await db.combat.deleteMany({ where: { campaignId } });
      await db.campaign.deleteMany({ where: { id: campaignId } });
    }
  });

  beforeEach(async () => {
    const campaign = await db.campaign.create({
      data: { name: "XP Test Campaign " + Date.now() },
    });
    campaignId = campaign.id;

    const hero1 = await db.character.create({
      data: {
        campaignId,
        name: "Варвар Тор",
        type: "player",
        level: 3,
        experiencePoints: 100,
      },
    });
    hero1Id = hero1.id;

    const hero2 = await db.character.create({
      data: {
        campaignId,
        name: "Жрец Лира",
        type: "companion",
        level: 3,
        experiencePoints: 100,
      },
    });
    hero2Id = hero2.id;

    const combat = await db.combat.create({
      data: {
        campaignId,
        name: "Зачистка склепа",
        gridWidth: 30,
        gridHeight: 30,
        cellSize: 40,
        status: "active",
        turnOrder: "[]",
        log: "[]",
      },
    });
    combatId = combat.id;

    // Add 2 heroes as combatants
    await db.combatant.create({
      data: {
        combatId,
        name: "Варвар Тор",
        type: "player",
        x: 2,
        y: 2,
        hpMax: 30,
        hpCurrent: 20,
        ac: 14,
        speed: 30,
        initiative: 12,
        level: 3,
      },
    });

    await db.combatant.create({
      data: {
        combatId,
        name: "Жрец Лира",
        type: "companion",
        x: 3,
        y: 2,
        hpMax: 24,
        hpCurrent: 18,
        ac: 16,
        speed: 30,
        initiative: 10,
        level: 3,
      },
    });

    // Add 2 enemies (CR 1 and CR 2: 200 XP + 450 XP = 650 XP)
    await db.combatant.create({
      data: {
        combatId,
        name: "Вурдалак",
        type: "enemy",
        x: 10,
        y: 10,
        hpMax: 22,
        hpCurrent: 0,
        ac: 12,
        speed: 30,
        initiative: 8,
        level: 1, // CR 1 -> 200 XP
      },
    });

    await db.combatant.create({
      data: {
        combatId,
        name: "Огр-зомби",
        type: "enemy",
        x: 12,
        y: 10,
        hpMax: 50,
        hpCurrent: 0,
        ac: 10,
        speed: 30,
        initiative: 6,
        level: 2, // CR 2 -> 450 XP
      },
    });
  });

  it("calculates DMG awarded XP and increments experiencePoints on all living characters", async () => {
    const result = await awardCombatVictoryXP(combatId);

    expect(result).toBeDefined();
    // 200 + 450 = 650 XP total. For 2 players: 650 / 2 = 325 XP per player
    expect(result.totalXP).toBe(650);
    expect(result.xpPerPlayer).toBe(325);
    expect(result.awardedCharacters.length).toBe(2);

    // Verify in DB
    const char1 = await db.character.findUnique({ where: { id: hero1Id } });
    const char2 = await db.character.findUnique({ where: { id: hero2Id } });

    expect(char1!.experiencePoints).toBe(100 + 325);
    expect(char2!.experiencePoints).toBe(100 + 325);

    // Verify GameEvent
    const events = await db.gameEvent.findMany({
      where: { campaignId, type: "combat" },
    });
    expect(events.length).toBe(1);
    expect(events[0].description).toContain("325 XP");
    expect(events[0].description).toContain("650 XP");
  });
});
