import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET as getActiveCombat } from "../active/route";
import { POST as createCombat } from "../create/route";
import { db } from "@/lib/db";

describe("Combat Campaign Isolation", () => {
  let campaignAId: string;
  let campaignBId: string;
  let combatAId: string;

  beforeAll(async () => {
    const cA = await db.campaign.create({
      data: {
        name: "Campaign Alpha",
        isActive: false,
      },
    });
    campaignAId = cA.id;

    const cB = await db.campaign.create({
      data: {
        name: "Campaign Beta",
        isActive: false,
      },
    });
    campaignBId = cB.id;

    const combatA = await db.combat.create({
      data: {
        campaignId: campaignAId,
        name: "Alpha Battle",
        status: "active",
        gridWidth: 20,
        gridHeight: 15,
        turnOrder: "[]",
        log: "[]",
      },
    });
    combatAId = combatA.id;
  });

  afterAll(async () => {
    await db.combatant.deleteMany({
      where: {
        combat: {
          campaignId: { in: [campaignAId, campaignBId] },
        },
      },
    });
    await db.mapElement.deleteMany({
      where: {
        combat: {
          campaignId: { in: [campaignAId, campaignBId] },
        },
      },
    });
    await db.combat.deleteMany({
      where: { campaignId: { in: [campaignAId, campaignBId] } },
    });
    await db.campaign.deleteMany({
      where: { id: { in: [campaignAId, campaignBId] } },
    });
  });

  it("returns active combat for Campaign A when requesting Campaign A", async () => {
    const req = new Request(`http://localhost:3000/api/combat/active?campaignId=${campaignAId}`);
    const res = await getActiveCombat(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.combat).not.toBeNull();
    expect(json.combat.id).toBe(combatAId);
  });

  it("returns null for Campaign B when Campaign B has no active combat", async () => {
    const req = new Request(`http://localhost:3000/api/combat/active?campaignId=${campaignBId}`);
    const res = await getActiveCombat(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.combat).toBeNull();
  });

  it("creates combat in Campaign B without ending combat in Campaign A", async () => {
    const createReq = new Request("http://localhost:3000/api/combat/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: campaignBId,
        name: "Beta Battle",
        addTestEnemies: false,
      }),
    });
    const createRes = await createCombat(createReq);
    expect(createRes.status).toBe(200);

    // Combat A should still be active
    const checkAReq = new Request(`http://localhost:3000/api/combat/active?campaignId=${campaignAId}`);
    const checkARes = await getActiveCombat(checkAReq as any);
    const jsonA = await checkARes.json();
    expect(jsonA.combat).not.toBeNull();
    expect(jsonA.combat.id).toBe(combatAId);

    // Combat B should now be active
    const checkBReq = new Request(`http://localhost:3000/api/combat/active?campaignId=${campaignBId}`);
    const checkBRes = await getActiveCombat(checkBReq as any);
    const jsonB = await checkBRes.json();
    expect(jsonB.combat).not.toBeNull();
    expect(jsonB.combat.name).toBe("Beta Battle");
  }, 15000);
});
