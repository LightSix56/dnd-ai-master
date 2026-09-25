import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTacticalEncounter } from "../generator";
import { db } from "@/lib/db";

describe("createTacticalEncounter Party Spawning (Class Attacks, Saves & Spells)", () => {
  let testCampaignId: string;
  let createdCombatIds: string[] = [];

  beforeEach(async () => {
    const campaign = await db.campaign.create({
      data: {
        name: "Кампания для тестирования генератора",
        setting: "Forgotten Realms",
        isActive: true,
      },
    });
    testCampaignId = campaign.id;
  });

  afterEach(async () => {
    for (const cId of createdCombatIds) {
      await db.mapElement.deleteMany({ where: { combatId: cId } });
      await db.combatant.deleteMany({ where: { combatId: cId } });
      await db.combat.deleteMany({ where: { id: cId } });
    }
    await db.character.deleteMany({ where: { campaignId: testCampaignId } });
    await db.campaign.deleteMany({ where: { id: testCampaignId } });
  });

  it(
    "spawns non-preset party characters with class-appropriate attacks, saving throw proficiencies, and spells",
    async () => {
    // 1. Wizard character
    const wizardChar = await db.character.create({
      data: {
        campaignId: testCampaignId,
        name: "Эльдрих Архимаг",
        type: "player",
        class: "Волшебник",
        level: 3,
        str: 8,
        dex: 14,
        con: 13,
        int: 16, // Mod +3
        wis: 12, // Mod +1
        cha: 10,
        hpCurrent: 18,
        hpMax: 18,
        ac: 12,
        speed: 30,
        profBonus: 2,
        notes: "Спасброски: ИНТ, МДР\nЯчейки заклинаний: 1 ур.: 4, 2 ур.: 2",
      },
    });

    // 2. Paladin character
    const paladinChar = await db.character.create({
      data: {
        campaignId: testCampaignId,
        name: "Сэр Роланд",
        type: "player",
        class: "Паладин",
        level: 3,
        str: 16, // Mod +3
        dex: 10,
        con: 14,
        int: 8,
        wis: 12,
        cha: 14, // Mod +2
        hpCurrent: 28,
        hpMax: 28,
        ac: 18,
        speed: 30,
        profBonus: 2,
        notes: "Спасброски: МДР, ХАР",
      },
    });

    const encounter = await createTacticalEncounter({
      campaignId: testCampaignId,
      name: "Тестовая битва в подземелье",
      environment: "dungeon",
      gridWidth: 20,
      gridHeight: 20,
      enemies: [
        {
          name: "Гоблин",
          hpMax: 7,
          ac: 15,
          speed: 30,
        },
      ],
    });

    createdCombatIds.push(encounter.combatId);

    const combatants = await db.combatant.findMany({
      where: { combatId: encounter.combatId },
    });

    // Find spawned wizard
    const wizardCombatant = combatants.find((c) => c.characterId === wizardChar.id);
    expect(wizardCombatant).toBeDefined();

    // Check wizard saving throws: INT & WIS must have prof: true and mod reflecting profBonus
    const wizardSaves = JSON.parse(wizardCombatant!.saves || "{}");
    expect(wizardSaves.INT?.prof).toBe(true);
    expect(wizardSaves.INT?.mod).toBe(5); // 3 (intMod) + 2 (prof)
    expect(wizardSaves.WIS?.prof).toBe(true);
    expect(wizardSaves.WIS?.mod).toBe(3); // 1 (wisMod) + 2 (prof)
    expect(wizardSaves.STR?.prof).toBe(false);

    // Check wizard spells: must be valid SpellData with slots, NOT an empty/broken string
    const wizardSpells = JSON.parse(wizardCombatant!.spells || "{}");
    expect(wizardSpells.slots).toBeDefined();
    expect(wizardSpells.slots[1]?.max).toBeGreaterThanOrEqual(4);

    // Find spawned paladin
    const paladinCombatant = combatants.find((c) => c.characterId === paladinChar.id);
    expect(paladinCombatant).toBeDefined();

    // Check paladin saving throws: WIS & CHA must have prof: true
    const paladinSaves = JSON.parse(paladinCombatant!.saves || "{}");
    expect(paladinSaves.WIS?.prof).toBe(true);
    expect(paladinSaves.CHA?.prof).toBe(true);
    expect(paladinSaves.STR?.prof).toBe(false);

    // Check paladin attacks: must NOT be the single generic "Оружие" fallback without abilities
    const paladinAttacks = JSON.parse(paladinCombatant!.attacks || "[]");
    expect(paladinAttacks.length).toBeGreaterThanOrEqual(1);
    expect(paladinAttacks[0].attackBonus).toBe(5); // 3 (strMod) + 2 (prof)
  }, 20000);
});
