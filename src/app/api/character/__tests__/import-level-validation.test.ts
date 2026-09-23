import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST } from "../import/route";
import { db } from "@/lib/db";

describe("POST /api/character/import level validation", () => {
  let testCampaignId: string;

  beforeAll(async () => {
    const campaign = await db.campaign.create({
      data: {
        name: "Test Level 1 Campaign",
        startingLevel: 1,
        levelFrom: 1,
        levelTo: 5,
        isActive: false,
      },
    });
    testCampaignId = campaign.id;
  });

  afterAll(async () => {
    if (testCampaignId) {
      await db.character.deleteMany({ where: { campaignId: testCampaignId } });
      await db.memory.deleteMany({ where: { campaignId: testCampaignId } });
      await db.gameEvent.deleteMany({ where: { campaignId: testCampaignId } });
      await db.campaign.deleteMany({ where: { id: testCampaignId } });
    }
  });

  const validSheetLevel3 = {
    name: "Кроуг Тестовый",
    level: 3,
    race: "Полуорк",
    class: "Варвар",
    abilityScores: { СИЛ: 16, ЛОВ: 14, ТЕЛ: 16, ИНТ: 8, МДР: 10, ХАР: 10 },
    hpMax: 35,
    ac: 15,
  };

  const validSheetLevel1 = {
    name: "Новичок 1 ур",
    level: 1,
    race: "Человек",
    class: "Воин",
    abilityScores: { СИЛ: 15, ЛОВ: 14, ТЕЛ: 14, ИНТ: 10, МДР: 10, ХАР: 10 },
    hpMax: 12,
    ac: 16,
  };

  it("rejects player character with level 3 when campaign requires level 1 (422)", async () => {
    const req = new Request("http://localhost:3000/api/character/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: testCampaignId,
        type: "player",
        character: validSheetLevel3,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/3 уровень.*1 уровень/i);
  });

  it("allows player character with level 1 in a level 1 campaign (200)", async () => {
    const req = new Request("http://localhost:3000/api/character/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: testCampaignId,
        type: "player",
        character: validSheetLevel1,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.character.level).toBe(1);
  });

  it("allows NPC / enemy / companion with higher level (200)", async () => {
    const req = new Request("http://localhost:3000/api/character/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: testCampaignId,
        type: "npc",
        character: validSheetLevel3,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.character.level).toBe(3);
  });

  it("dynamically adapts target level when party levels up in the campaign", async () => {
    // 1. Manually update or add a level 2 character to the campaign
    await db.character.updateMany({
      where: { campaignId: testCampaignId, type: "player" },
      data: { level: 2 },
    });

    // 2. Importing a level 1 character should now be rejected because party is now level 2
    const reqLevel1 = new Request("http://localhost:3000/api/character/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: testCampaignId,
        type: "player",
        character: validSheetLevel1,
      }),
    });
    const resLevel1 = await POST(reqLevel1);
    expect(resLevel1.status).toBe(422);
    const json1 = await resLevel1.json();
    expect(json1.error).toMatch(/2 уровень/i);

    // 3. Importing a level 2 character should now succeed
    const validSheetLevel2 = {
      ...validSheetLevel1,
      name: "Ветеран 2 ур",
      level: 2,
    };
    const reqLevel2 = new Request("http://localhost:3000/api/character/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: testCampaignId,
        type: "player",
        character: validSheetLevel2,
      }),
    });
    const resLevel2 = await POST(reqLevel2);
    expect(resLevel2.status).toBe(200);
    const json2 = await resLevel2.json();
    expect(json2.success).toBe(true);
    expect(json2.character.level).toBe(2);
  });
});
