import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET as getMaps, POST as postMap } from "../maps/route";
import { GET as getMonsters } from "../monsters/route";
import { POST as postCreateCombat } from "../create/route";
import { db } from "@/lib/db";

describe("Combat API Routes", () => {
  let combatId: string;
  const createdCombatIds: string[] = [];

  afterEach(async () => {
    if (createdCombatIds.length > 0) {
      await db.combatant.deleteMany({ where: { combatId: { in: createdCombatIds } } });
      await db.mapElement.deleteMany({ where: { combatId: { in: createdCombatIds } } });
      await db.combat.deleteMany({ where: { id: { in: createdCombatIds } } });
      createdCombatIds.length = 0;
    }
  });

  beforeEach(async () => {
    const combat = await db.combat.create({
      data: {
        name: "Test Arena",
        gridWidth: 30,
        gridHeight: 30,
        cellSize: 40,
        status: "active",
        turnOrder: "[]",
        log: "[]",
      },
    });
    combatId = combat.id;
    createdCombatIds.push(combatId);
  });

  describe("GET /api/combat/maps", () => {
    it("returns catalog of 24 tactical maps with complete metadata", async () => {
      const res = await getMaps();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maps).toBeDefined();
      expect(Array.isArray(data.maps)).toBe(true);
      expect(data.maps.length).toBe(24);

      const firstMap = data.maps[0];
      expect(firstMap.id).toBeDefined();
      expect(firstMap.name).toBeDefined();
      expect(firstMap.biome).toBeDefined();
      expect(firstMap.gridWidth).toBeGreaterThan(0);
      expect(firstMap.gridHeight).toBeGreaterThan(0);
    });
  });

  describe("POST /api/combat/maps", () => {
    it("switches combat map preset and updates map elements in DB", async () => {
      const req = new Request("http://localhost/api/combat/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combatId,
          mapPresetId: "preset-lava-cave",
        }),
      });

      const res = await postMap(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.mapName).toBe("Лавовая пещера");
      expect(data.combat).toBeDefined();
      expect(data.combat.gridWidth).toBe(22);
      expect(data.combat.gridHeight).toBe(18);

      // Verify elements inserted in DB
      const elementsInDb = await db.mapElement.findMany({ where: { combatId } });
      expect(elementsInDb.length).toBeGreaterThan(0);
    });

    it("returns 404 for unknown mapPresetId", async () => {
      const req = new Request("http://localhost/api/combat/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combatId,
          mapPresetId: "non_existent_preset",
        }),
      });

      const res = await postMap(req);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/combat/monsters", () => {
    it("filters monsters by query and creature type", async () => {
      const req = new Request("http://localhost/api/combat/monsters?q=волк&type=beast&limit=10");
      const res = await getMonsters(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.monsters).toBeDefined();
      expect(data.total).toBeGreaterThan(0);
      expect(data.monsters.length).toBeLessThanOrEqual(10);
      expect(data.monsters.every((m: any) => m.type.toLowerCase() === "beast")).toBe(true);
    });

    it("filters monsters by CR range", async () => {
      const req = new Request("http://localhost/api/combat/monsters?crMin=1&crMax=3&limit=5");
      const res = await getMonsters(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.monsters.length).toBeGreaterThan(0);
      for (const m of data.monsters) {
        expect(m.challengeRating).toBeGreaterThanOrEqual(1);
        expect(m.challengeRating).toBeLessThanOrEqual(3);
      }
    });
  });

  describe("POST /api/combat/create", () => {
    it("creates combat using procedural encounter generator when biome and difficulty are provided", async () => {
      const req = new Request("http://localhost/api/combat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Битва в подземелье",
          biome: "dungeon",
          difficulty: "easy",
        }),
      });

      const res = await postCreateCombat(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.combat).toBeDefined();
      if (data.combat?.id) createdCombatIds.push(data.combat.id);
      expect(data.encounter).toBeDefined();
      expect(data.encounter.enemyNames.length).toBeGreaterThan(0);
      expect(data.encounter.awardedXP).toBeGreaterThan(0);
    }, 15000);
  });

  describe("POST /api/combat/presets/spawn", () => {
    it("spawns monster from 2,875 bestiary by slug", async () => {
      const { POST: postSpawnPreset } = await import("../presets/spawn/route");
      const req = new Request("http://localhost/api/combat/presets/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combatId,
          slug: "wolf",
          count: 2,
        }),
      });

      const res = await postSpawnPreset(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.spawnedCount).toBe(2);

      const combatantsInDb = await db.combatant.findMany({ where: { combatId } });
      expect(combatantsInDb.length).toBe(2);
      expect(combatantsInDb[0].name).toContain("Волк");
    });
  });

  describe("GET /api/combat/maps/search", () => {
    it("searches open battlemaps by tag or query", async () => {
      const { GET: getSearchMaps } = await import("../maps/search/route");
      const req = new Request("http://localhost/api/combat/maps/search?q=крипта&tags=dungeon");
      const res = await getSearchMaps(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maps).toBeDefined();
      expect(Array.isArray(data.maps)).toBe(true);
      expect(data.maps.length).toBeGreaterThan(0);
      expect(data.popularTags).toBeDefined();
    });
  });
});
