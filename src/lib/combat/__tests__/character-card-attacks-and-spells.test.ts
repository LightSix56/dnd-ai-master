import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTacticalEncounter } from "../generator";
import { db } from "@/lib/db";
import { safeParse } from "../serialize";
import type { Attack, CombatAbility, HotbarItem, SpellData } from "../types";

describe("createTacticalEncounter: Character Card Attacks, Spells & Abilities", () => {
  let testCampaignId: string;
  let createdCombatIds: string[] = [];

  beforeEach(async () => {
    const campaign = await db.campaign.create({
      data: {
        name: "Кампания для тестирования атак из листа",
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

  it("extracts exact attacks from Rogue's character card and does not inject Rapier", async () => {
    // Плут с короткими мечами: 1 рука, 2 рука (бонусное), двумя сразу (действие+бонус)
    const rogueSnapshot = {
      name: "Шелест",
      className: "Плут",
      level: 3,
      attacks: [
        { name: "Короткий меч (1 рука)", attackBonus: "+5", damageAndType: "1к6+3 кол" },
        { name: "Короткий меч (вторая рука)", attackBonus: "+5", damageAndType: "1к6 кол" },
        { name: "Короткие мечи (двумя сразу)", attackBonus: "+5", damageAndType: "1к6+3 и 1к6 кол" },
      ],
    };

    const rogueChar = await db.character.create({
      data: {
        campaignId: testCampaignId,
        name: "Шелест",
        type: "player",
        class: "Плут",
        level: 3,
        str: 10,
        dex: 16,
        con: 14,
        int: 12,
        wis: 12,
        cha: 14,
        hpCurrent: 24,
        hpMax: 24,
        ac: 15,
        speed: 30,
        profBonus: 2,
        notes: JSON.stringify(rogueSnapshot),
      },
    });

    const encounter = await createTacticalEncounter({
      campaignId: testCampaignId,
      name: "Засада в руинах",
      environment: "dungeon",
      gridWidth: 20,
      gridHeight: 20,
      difficulty: "easy",
    });
    createdCombatIds.push(encounter.combatId);

    const rogueCombatant = await db.combatant.findFirst({
      where: { combatId: encounter.combatId, characterId: rogueChar.id },
    });
    expect(rogueCombatant).toBeDefined();

    const attacks = safeParse<Attack[]>(rogueCombatant!.attacks, []);
    const hotbar = safeParse<HotbarItem[]>(rogueCombatant!.hotbar, []);
    const abilities = safeParse<CombatAbility[]>(rogueCombatant!.abilities, []);

    // 1. Атаки ДОЛЖНЫ быть строго из карточки персонажа
    expect(attacks).toHaveLength(3);
    const attackNames = attacks.map((a) => a.name);
    expect(attackNames).toContain("Короткий меч (1 рука)");
    expect(attackNames).toContain("Короткий меч (вторая рука)");
    expect(attackNames).toContain("Короткие мечи (двумя сразу)");

    // Никакой Рапиры быть не должно!
    expect(attackNames.some((n) => n.toLowerCase().includes("рапир"))).toBe(false);

    // 2. Проверка стоимостей действий (actionCost)
    const mainHand = attacks.find((a) => a.name.includes("1 рука"))!;
    expect(mainHand.actionCost).toBe("action");
    expect(mainHand.attackBonus).toBe(5);
    expect(mainHand.damage[0].dice).toBe("1d6");
    expect(mainHand.damage[0].mod).toBe(3);

    const offHand = attacks.find((a) => a.name.includes("вторая рука"))!;
    expect(offHand.actionCost).toBe("bonus");
    expect(offHand.attackBonus).toBe(5);
    expect(offHand.damage[0].mod).toBe(0);

    const dual = attacks.find((a) => a.name.includes("двумя сразу"))!;
    expect(dual.actionCost).toBe("action+bonus");
    expect(dual.damage).toHaveLength(2);
    expect(dual.damage[0].mod).toBe(3);
    expect(dual.damage[1].mod).toBe(0);

    // 3. Проверка способностей плута
    const abilityNames = abilities.map((ab) => ab.name);
    expect(abilityNames.some((n) => n.includes("Скрытая атака"))).toBe(true);
    expect(abilityNames.some((n) => n.includes("Рывок"))).toBe(true);
    expect(abilityNames.some((n) => n.includes("Отход"))).toBe(true);

    // 4. Hotbar содержит атаки и способности
    expect(hotbar.some((h) => h.name === "Короткий меч (1 рука)")).toBe(true);
    expect(hotbar.some((h) => h.name.includes("Скрытая атака"))).toBe(true);
  });

  it("extracts attacks from plain text notes formatted as 'Атаки: ...'", async () => {
    const char = await db.character.create({
      data: {
        campaignId: testCampaignId,
        name: "Барри",
        type: "player",
        class: "Плут",
        level: 2,
        str: 10,
        dex: 16,
        con: 14,
        int: 10,
        wis: 12,
        cha: 14,
        hpCurrent: 16,
        hpMax: 16,
        ac: 14,
        speed: 30,
        profBonus: 2,
        notes: "Спасброски: ЛОВ, ИНТ\nАтаки: Короткий меч (1 рука) +5 1к6+3 кол; Кинжал (бросок) +5 1к4+3 кол",
      },
    });

    const encounter = await createTacticalEncounter({
      campaignId: testCampaignId,
      name: "Стычка в таверне",
      environment: "tavern",
      gridWidth: 15,
      gridHeight: 15,
      difficulty: "easy",
    });
    createdCombatIds.push(encounter.combatId);

    const combatant = await db.combatant.findFirst({
      where: { combatId: encounter.combatId, characterId: char.id },
    });
    const attacks = safeParse<Attack[]>(combatant!.attacks, []);
    expect(attacks).toHaveLength(2);
    expect(attacks[0].name).toBe("Короткий меч (1 рука)");
    expect(attacks[1].name).toBe("Кинжал (бросок)");
    expect(attacks.some((a) => a.name.includes("Рапира"))).toBe(false);
  });

  it("populates spells, spell slots and spell hotbar items for spellcasters", async () => {
    const wizardSnapshot = {
      name: "Магистр Люциан",
      className: "Волшебник",
      level: 3,
      cantrips: ["Огненный снаряд"],
      spellsByLevel: {
        "1": [{ name: "Волшебная стрела", prepared: true }, { name: "Щит", prepared: true }],
        "2": [{ name: "Пылающий шар", prepared: true }],
      },
      spellSlots: {
        "1": { totalSlots: 4, expendedSlots: 0 },
        "2": { totalSlots: 2, expendedSlots: 0 },
      },
      spellcastingAbility: "ИНТ",
    };

    const wizardChar = await db.character.create({
      data: {
        campaignId: testCampaignId,
        name: "Магистр Люциан",
        type: "player",
        class: "Волшебник",
        level: 3,
        str: 8,
        dex: 14,
        con: 14,
        int: 16,
        wis: 12,
        cha: 10,
        hpCurrent: 20,
        hpMax: 20,
        ac: 12,
        speed: 30,
        profBonus: 2,
        notes: JSON.stringify(wizardSnapshot),
      },
    });

    const encounter = await createTacticalEncounter({
      campaignId: testCampaignId,
      name: "Битва в башне",
      environment: "dungeon",
      gridWidth: 20,
      gridHeight: 20,
      difficulty: "easy",
    });
    createdCombatIds.push(encounter.combatId);

    const combatant = await db.combatant.findFirst({
      where: { combatId: encounter.combatId, characterId: wizardChar.id },
    });
    expect(combatant).toBeDefined();

    const spells = safeParse<SpellData>(combatant!.spells, { slots: {}, known: [], prepared: [] });
    const hotbar = safeParse<HotbarItem[]>(combatant!.hotbar, []);

    // Слоты 1 и 2 уровней
    expect(spells.slots[1]).toBeDefined();
    expect(spells.slots[1].max).toBe(4);
    expect(spells.slots[2]).toBeDefined();
    expect(spells.slots[2].max).toBe(2);

    // Заклинания в хотбаре
    const spellHotbar = hotbar.filter((h) => h.type === "spell");
    expect(spellHotbar.length).toBeGreaterThanOrEqual(2);
    expect(spellHotbar.some((h) => h.name.includes("Огненный снаряд") || h.name.includes("Волшебная стрела"))).toBe(true);
  });
});
