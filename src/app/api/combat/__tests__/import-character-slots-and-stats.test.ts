import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as importCharacterRoute } from "../import-character/route";
import { db } from "@/lib/db";

describe("POST /api/combat/import-character (Slots and Stats Integrity)", () => {
  let testCombatId: string;

  beforeEach(async () => {
    const combat = await db.combat.create({
      data: {
        name: "Тестовый бой",
        gridWidth: 20,
        gridHeight: 15,
        status: "active",
        turnOrder: "[]",
        log: "[]",
      },
    });
    testCombatId = combat.id;
  });

  afterEach(async () => {
    if (testCombatId) {
      await db.combatant.deleteMany({ where: { combatId: testCombatId } });
      await db.combat.deleteMany({ where: { id: testCombatId } });
    }
  });

  it("correctly parses spellSlots objects from dnd5e-character-sheet format and sums Base + Racial + ASI stats", async () => {
    const characterJson = {
      name: "Эльдрих",
      className: "Волшебник",
      level: 4,
      // Base standard array
      abilityScores: {
        "СИЛ": 8,
        "ЛОВ": 14,
        "ТЕЛ": 13,
        "ИНТ": 15,
        "МДР": 12,
        "ХАР": 10,
      },
      // Racial bonus (+1 INT)
      abilityBonuses: {
        "СИЛ": 0,
        "ЛОВ": 0,
        "ТЕЛ": 0,
        "ИНТ": 1,
        "МДР": 0,
        "ХАР": 0,
      },
      // Level 4 ASI (+2 INT) -> Total INT = 15 + 1 + 2 = 18 (Modifier: +4)
      asiBonuses: {
        "СИЛ": 0,
        "ЛОВ": 0,
        "ТЕЛ": 0,
        "ИНТ": 2,
        "МДР": 0,
        "ХАР": 0,
      },
      // Standard spellSlots format from dnd5e-character-sheet
      spellSlots: {
        1: { totalSlots: 4, expendedSlots: 1 },
        2: { totalSlots: 3, expendedSlots: 0 },
      },
      attacks: [
        {
          name: "Кинжал",
          attackBonus: "+4",
          damageAndType: "1d4+2 колющий",
        },
      ],
    };

    const req = new Request("http://localhost/api/combat/import-character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        combatId: testCombatId,
        characterJson,
        type: "player",
      }),
    });

    const res = await importCharacterRoute(req as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.combatant).toBeDefined();

    // Verify abilityMods: INT must be +4 (from total 18), NOT +2 (from raw base 15)
    const abilityMods = JSON.parse(data.combatant.abilityMods);
    expect(abilityMods.INT).toBe(4);

    // Verify spell slots: must have circle 1 (max 4, used 1) and circle 2 (max 3, used 0)
    const spells = JSON.parse(data.combatant.spells);
    expect(spells.slots).toBeDefined();
    expect(spells.slots[1]).toBeDefined();
    expect(spells.slots[1].max).toBe(4);
    expect(spells.slots[1].used).toBe(1);
    expect(spells.slots[2]).toBeDefined();
    expect(spells.slots[2].max).toBe(3);
    expect(spells.slots[2].used).toBe(0);
  });
});
