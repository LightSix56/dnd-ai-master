import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { RoomService } from "@/lib/room/room-service";
import { extractCharacterStats, mapSheetToCharacter, isSheetCharacter } from "@/lib/dnd/import-character";
import { POST as importPost } from "@/app/api/character/import/route";
import { POST as characterPost } from "@/app/api/character/route";

describe("Character De-duplication and Stat Preservation", () => {
  let testCampaignId: string;

  beforeEach(async () => {
    const campaign = await db.campaign.create({
      data: {
        name: "Stat & Dedup Test Campaign",
        startingLevel: 1,
        levelFrom: 1,
        levelTo: 5,
        isActive: true,
      },
    });
    testCampaignId = campaign.id;
  });

  afterEach(async () => {
    if (testCampaignId) {
      await db.character.deleteMany({ where: { campaignId: testCampaignId } });
      await db.gameEvent.deleteMany({ where: { campaignId: testCampaignId } });
      await db.memory.deleteMany({ where: { campaignId: testCampaignId } });
      await db.campaign.deleteMany({ where: { id: testCampaignId } });
    }
  });

  describe("extractCharacterStats & mapSheetToCharacter", () => {
    it("extracts stats from Russian abilityScores", () => {
      const src = {
        name: "Громмаш",
        level: 1,
        className: "Варвар",
        race: "Полуорк",
        abilityScores: { СИЛ: 16, ЛОВ: 14, ТЕЛ: 16, ИНТ: 8, МДР: 10, ХАР: 12 },
        hpMax: 15,
        ac: 15,
      };

      const stats = extractCharacterStats(src);
      expect(stats.str).toBe(16);
      expect(stats.dex).toBe(14);
      expect(stats.con).toBe(16);
      expect(stats.int).toBe(8);
      expect(stats.wis).toBe(10);
      expect(stats.cha).toBe(12);
      expect(stats.hpMax).toBe(15);
      expect(stats.ac).toBe(15);
    });

    it("extracts stats from English abilityScores (str, dex, con...)", () => {
      const src = {
        name: "Эльфийский Лучник",
        level: 1,
        className: "Следопыт",
        race: "Эльф",
        abilityScores: { str: 10, dex: 17, con: 14, int: 12, wis: 15, cha: 8 },
        hpMax: 12,
        ac: 14,
      };

      const stats = extractCharacterStats(src);
      expect(stats.str).toBe(10);
      expect(stats.dex).toBe(17);
      expect(stats.con).toBe(14);
      expect(stats.int).toBe(12);
      expect(stats.wis).toBe(15);
      expect(stats.cha).toBe(8);
    });

    it("extracts stats from direct properties on snapshot object", () => {
      const src = {
        name: "Торгрим",
        level: 1,
        class: "Воин",
        race: "Дварф",
        str: 16,
        dex: 12,
        con: 16,
        int: 10,
        wis: 12,
        cha: 8,
        hpMax: 13,
        ac: 16,
      };

      const stats = extractCharacterStats(src);
      expect(stats.str).toBe(16);
      expect(stats.dex).toBe(12);
      expect(stats.con).toBe(16);
      expect(stats.int).toBe(10);
      expect(stats.wis).toBe(12);
      expect(stats.cha).toBe(8);
      expect(stats.hpMax).toBe(13);
      expect(stats.ac).toBe(16);
    });

    it("extracts stats from nested data object (Supabase format)", () => {
      const src = {
        id: "sup-char-1",
        name: "Мерлин",
        data: {
          className: "Волшебник",
          race: "Человек",
          level: 1,
          abilityScores: { СИЛ: 8, ЛОВ: 13, ТЕЛ: 14, ИНТ: 16, МДР: 12, ХАР: 10 },
          calculatedAC: 12,
          hpMax: 8,
        },
      };

      const stats = extractCharacterStats(src);
      expect(stats.int).toBe(16);
      expect(stats.con).toBe(14);
      expect(stats.str).toBe(8);
      expect(stats.ac).toBe(12);
      expect(stats.hpMax).toBe(8);
    });

    it("assigns class-based archetype stats when no abilities are provided (never flat 10s)", () => {
      const src = {
        name: "Безымянный Воин",
        level: 1,
        className: "Воин",
      };

      const stats = extractCharacterStats(src);
      // Fighter primary is STR/CON
      expect(stats.str).toBeGreaterThanOrEqual(14);
      expect(stats.con).toBeGreaterThanOrEqual(13);
      // Not all stats should be 10
      const allTen = [stats.str, stats.dex, stats.con, stats.int, stats.wis, stats.cha].every((v) => v === 10);
      expect(allTen).toBe(false);
    });

    it("isSheetCharacter recognizes sheets with English or nested attributes", () => {
      const englishSheet = {
        name: "Rogue",
        level: 1,
        abilityScores: { str: 10, dex: 16, con: 14, int: 12, wis: 10, cha: 12 },
      };
      expect(isSheetCharacter(englishSheet)).toBe(true);

      const nestedSheet = {
        name: "Wizard",
        data: {
          abilityScores: { СИЛ: 10, ИНТ: 16 },
        },
      };
      expect(isSheetCharacter(nestedSheet)).toBe(true);
    });
  });

  describe("joinRoom Campaign Character Sync & De-duplication", () => {
    it("creates character with full stats and does not leave them all at 10", async () => {
      const mockClient = {
        from: (table: string) => {
          if (table === "rooms") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "room-join-1",
                      starting_level: 1,
                      status: "in_campaign",
                      campaign_settings: { campaignId: testCampaignId },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "room_participants") {
            return {
              upsert: () => ({
                select: () => ({
                  single: async () => ({
                    data: { id: "p1", user_id: "u1", room_id: "room-join-1" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return { upsert: async () => ({ data: null, error: null }) };
        },
      } as any;

      const service = new RoomService(mockClient);
      await service.joinRoom({
        roomId: "room-join-1",
        userId: "u1",
        characterId: "c1",
        characterSnapshot: {
          id: "c1",
          name: "Кроуг Могучий",
          level: 1,
          className: "Варвар",
          race: "Полуорк",
          abilityScores: { СИЛ: 16, ЛОВ: 14, ТЕЛ: 16, ИНТ: 8, МДР: 10, ХАР: 12 },
          hpMax: 15,
          ac: 15,
        },
      });

      const inDb = await db.character.findFirst({
        where: { campaignId: testCampaignId, name: "Кроуг Могучий" },
      });
      expect(inDb).not.toBeNull();
      expect(inDb!.str).toBe(16);
      expect(inDb!.dex).toBe(14);
      expect(inDb!.con).toBe(16);
      expect(inDb!.hpMax).toBe(15);
      expect(inDb!.ac).toBe(15);
    });

    it("does not create a duplicate character if character with same name (or case/spacing) already exists", async () => {
      // Pre-create character in campaign
      const existing = await db.character.create({
        data: {
          campaignId: testCampaignId,
          name: "Кроуг Могучий",
          class: "Варвар",
          level: 1,
          str: 10, // old default
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10,
          hpMax: 10,
          hpCurrent: 10,
          ac: 10,
        },
      });

      const mockClient = {
        from: (table: string) => {
          if (table === "rooms") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "room-join-2",
                      starting_level: 1,
                      status: "in_campaign",
                      campaign_settings: { campaignId: testCampaignId },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "room_participants") {
            return {
              upsert: () => ({
                select: () => ({
                  single: async () => ({
                    data: { id: "p2", user_id: "u2", room_id: "room-join-2" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return { upsert: async () => ({ data: null, error: null }) };
        },
      } as any;

      const service = new RoomService(mockClient);
      // Join with slight casing variation: "кроуг могучий "
      await service.joinRoom({
        roomId: "room-join-2",
        userId: "u2",
        characterId: existing.id,
        characterSnapshot: {
          name: "  кроуг могучий  ",
          level: 1,
          className: "Варвар",
          str: 16,
          dex: 14,
          con: 16,
          int: 8,
          wis: 10,
          cha: 12,
          hpMax: 15,
          ac: 15,
        },
      });

      // Verify no duplicates were created
      const allChars = await db.character.findMany({
        where: { campaignId: testCampaignId },
      });
      expect(allChars.length).toBe(1);
      // Existing character was updated with real stats
      expect(allChars[0].str).toBe(16);
      expect(allChars[0].hpMax).toBe(15);
    });
  });

  describe("POST /api/character/import de-duplication and stat handling", () => {
    it("updates existing character without duplicating, even with case variation", async () => {
      // 1. First import
      const req1 = new Request("http://localhost:3000/api/character/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: testCampaignId,
          type: "player",
          character: {
            name: "Лира Серебряная",
            level: 1,
            race: "Полуэльф",
            class: "Плут",
            abilityScores: { str: 10, dex: 16, con: 14, int: 12, wis: 10, cha: 15 },
            hpMax: 10,
            ac: 14,
          },
        }),
      });

      const res1 = await importPost(req1);
      expect(res1.status).toBe(200);

      // 2. Second import of the same character with different case
      const req2 = new Request("http://localhost:3000/api/character/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: testCampaignId,
          type: "player",
          character: {
            name: "лира серебряная",
            level: 1,
            race: "Полуэльф",
            class: "Плут",
            abilityScores: { str: 10, dex: 17, con: 14, int: 12, wis: 10, cha: 16 },
            hpMax: 11,
            ac: 15,
          },
        }),
      });

      const res2 = await importPost(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.updated).toBe(true);

      const charsInDb = await db.character.findMany({
        where: { campaignId: testCampaignId },
      });
      expect(charsInDb.length).toBe(1);
      expect(charsInDb[0].dex).toBe(17);
      expect(charsInDb[0].hpMax).toBe(11);
    });
  });

  describe("POST /api/character quick creation de-duplication and stats", () => {
    it("de-duplicates if character with same name exists, and does not default stats to 10 if missing", async () => {
      const req1 = new Request("http://localhost:3000/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: testCampaignId,
          name: "Быстрый Герой",
          class: "Воин",
          race: "Человек",
          level: 1,
          type: "player",
        }),
      });

      const res1 = await characterPost(req1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      const char1 = data1.character;

      // Class-based fallback stats should NOT be all 10s
      const allTen = [char1.str, char1.dex, char1.con, char1.int, char1.wis, char1.cha].every((v: number) => v === 10);
      expect(allTen).toBe(false);

      // Call POST again with same name -> should update, not create duplicate
      const req2 = new Request("http://localhost:3000/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: testCampaignId,
          name: "  быстрый герой  ",
          class: "Воин",
          race: "Человек",
          level: 1,
          type: "player",
          hpMax: 14,
        }),
      });

      const res2 = await characterPost(req2);
      expect(res2.status).toBe(200);

      const allChars = await db.character.findMany({
        where: { campaignId: testCampaignId },
      });
      expect(allChars.length).toBe(1);
      expect(allChars[0].hpMax).toBe(14);
    });
  });
});
