import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as postCompleteCombat } from "../[id]/complete/route";
import { db } from "@/lib/db";

describe("POST /api/combat/[id]/complete (Combat Loot & Rewards API)", () => {
  let testCombatId: string;

  afterEach(async () => {
    if (testCombatId) {
      await db.combatant.deleteMany({ where: { combatId: testCombatId } });
      await db.combat.deleteMany({ where: { id: testCombatId } });
    }
  });

  beforeEach(async () => {
    const combat = await db.combat.create({
      data: {
        name: "Арена славы",
        gridWidth: 20,
        gridHeight: 15,
        status: "active",
        turnOrder: "[]",
        log: "[]",
      },
    });
    testCombatId = combat.id;
  });

  it("returns 404 for non-existent combat ID", async () => {
    const req = new Request("http://localhost/api/combat/invalid-id/complete", {
      method: "POST",
    });

    const res = await postCompleteCombat(req, {
      params: Promise.resolve({ id: "non-existent-id" }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("successfully completes combat when all enemies are defeated and generates loot", async () => {
    // Add player combatant
    await db.combatant.create({
      data: {
        combatId: testCombatId,
        name: "Воин Торин",
        type: "player",
        hpCurrent: 24,
        hpMax: 24,
        x: 2,
        y: 2,
        level: 3,
      },
    });

    // Add defeated enemies (hpCurrent <= 0)
    await db.combatant.create({
      data: {
        combatId: testCombatId,
        name: "Орк-налётчик",
        type: "enemy",
        hpCurrent: 0,
        hpMax: 15,
        x: 5,
        y: 5,
        level: 1, // CR 1 -> 200 XP
        className: "humanoid",
      },
    });

    await db.combatant.create({
      data: {
        combatId: testCombatId,
        name: "Гоблин-лучник",
        type: "enemy",
        hpCurrent: -3,
        hpMax: 7,
        x: 6,
        y: 5,
        level: 1,
        className: "humanoid",
      },
    });

    const req = new Request(
      `http://localhost/api/combat/${testCombatId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biome: "dungeon" }),
      }
    );

    const res = await postCompleteCombat(req, {
      params: Promise.resolve({ id: testCombatId }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.combatId).toBe(testCombatId);
    expect(data.victory).toBe(true);
    expect(data.loot).toBeDefined();
    expect(data.loot.coins.totalGoldValue).toBeGreaterThan(0);
    expect(data.loot.totalXp).toBeGreaterThan(0);
    expect(data.loot.partyShare).toBeDefined();

    // Verify combat status is marked as 'ended' in database
    const updatedCombat = await db.combat.findUnique({
      where: { id: testCombatId },
    });
    expect(updatedCombat?.status).toBe("ended");
  });

  it("handles enemies that fled combat via condition 'fled'", async () => {
    await db.combatant.create({
      data: {
        combatId: testCombatId,
        name: "Кобольд-беглец",
        type: "enemy",
        hpCurrent: 5,
        hpMax: 5,
        x: 1,
        y: 1,
        level: 1,
        conditions: JSON.stringify([{ id: "fled", name: "fled" }]),
      },
    });

    const req = new Request(
      `http://localhost/api/combat/${testCombatId}/complete`,
      {
        method: "POST",
      }
    );

    const res = await postCompleteCombat(req, {
      params: Promise.resolve({ id: testCombatId }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.victory).toBe(true);
  });

  it("returns 400 when enemies are still alive and combat is not forced to complete", async () => {
    await db.combatant.create({
      data: {
        combatId: testCombatId,
        name: "Свирепый огр",
        type: "enemy",
        hpCurrent: 30,
        hpMax: 50,
        x: 8,
        y: 8,
        level: 2,
        conditions: "[]",
      },
    });

    const req = new Request(
      `http://localhost/api/combat/${testCombatId}/complete`,
      {
        method: "POST",
      }
    );

    const res = await postCompleteCombat(req, {
      params: Promise.resolve({ id: testCombatId }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("враги");
  });

  it("allows ending with defeat/force even if enemies are still alive", async () => {
    await db.combatant.create({
      data: {
        combatId: testCombatId,
        name: "Свирепый огр",
        type: "enemy",
        hpCurrent: 30,
        hpMax: 50,
        x: 8,
        y: 8,
        level: 2,
        conditions: "[]",
      },
    });

    const req = new Request(
      `http://localhost/api/combat/${testCombatId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      }
    );

    const res = await postCompleteCombat(req, {
      params: Promise.resolve({ id: testCombatId }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.victory).toBe(false);

    const updated = await db.combat.findUnique({
      where: { id: testCombatId },
    });
    expect(updated?.status).toBe("ended");
  });
});
