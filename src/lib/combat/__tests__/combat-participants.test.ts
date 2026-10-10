import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPartyCombatants, createTacticalEncounter } from "../generator";
import { awardCombatVictoryXP } from "../xp-award";
import { findNonParticipants } from "../non-participants";
import { buildCombatReport } from "../summary-text";
import { db } from "@/lib/db";

describe("В бою участвуют только выбранные герои", () => {
  let campaignId: string;
  const heroes: Record<string, string> = {};

  beforeEach(async () => {
    const campaign = await db.campaign.create({ data: { name: "Участники боя " + Date.now(), isActive: true } });
    campaignId = campaign.id;
    for (const [name, type] of [["Лира", "player"], ["Добрун", "companion"], ["Марта", "companion"]] as const) {
      const c = await db.character.create({
        data: { campaignId, name, type, class: "Воин", level: 3, hpCurrent: 20, hpMax: 20, ac: 14, speed: 30, experiencePoints: 100 },
      });
      heroes[name] = c.id;
    }
  });

  afterEach(async () => {
    const combats = await db.combat.findMany({ where: { campaignId } });
    for (const c of combats) {
      await db.mapElement.deleteMany({ where: { combatId: c.id } });
      await db.combatant.deleteMany({ where: { combatId: c.id } });
    }
    await db.combat.deleteMany({ where: { campaignId } });
    await db.gameEvent.deleteMany({ where: { campaignId } });
    await db.character.deleteMany({ where: { campaignId } });
    await db.campaign.deleteMany({ where: { id: campaignId } });
  });

  const goblin = [{ name: "Гоблин", hpMax: 7, ac: 15, speed: 30 }];

  it("на карту выходят только названные, остальные в бой не попадают", async () => {
    const encounter = await createTacticalEncounter({
      campaignId,
      name: "Стычка",
      environment: "dungeon",
      gridWidth: 20,
      gridHeight: 20,
      enemies: goblin,
      participantNames: ["Лира", "Марта"],
    });
    const fighters = await db.combatant.findMany({ where: { combatId: encounter.combatId, type: { not: "enemy" } } });
    expect(fighters.map((f) => f.name).sort()).toEqual(["Лира", "Марта"]);
    expect(encounter.participants.sort()).toEqual(["Лира", "Марта"]);
    expect(encounter.notParticipating).toEqual(["Добрун"]);
    expect(await findNonParticipants(encounter.combatId)).toEqual(["Добрун"]);
  });

  it("без списка участников выходят все, как раньше", async () => {
    const encounter = await createTacticalEncounter({
      campaignId, name: "Стычка", environment: "dungeon", gridWidth: 20, gridHeight: 20, enemies: goblin,
    });
    expect(encounter.participants).toHaveLength(3);
    expect(encounter.notParticipating).toEqual([]);
  });

  it("ведущий может ввести забытого героя в идущий бой", async () => {
    const encounter = await createTacticalEncounter({
      campaignId, name: "Стычка", environment: "dungeon", gridWidth: 20, gridHeight: 20, enemies: goblin,
      participantNames: ["Лира"],
    });
    const [dobrun] = await db.character.findMany({ where: { id: heroes["Добрун"] } });
    const created = await createPartyCombatants({
      combatId: encounter.combatId, characters: [dobrun], gridWidth: 20, gridHeight: 20, startIndex: 1,
    });
    expect(created).toHaveLength(1);
    const fighters = await db.combatant.findMany({ where: { combatId: encounter.combatId, type: { not: "enemy" } } });
    expect(fighters.map((f) => f.name).sort()).toEqual(["Добрун", "Лира"]);
    expect(await findNonParticipants(encounter.combatId)).toEqual(["Марта"]);
  });

  it("опыт получают только участники боя", async () => {
    const encounter = await createTacticalEncounter({
      campaignId, name: "Стычка", environment: "dungeon", gridWidth: 20, gridHeight: 20, enemies: goblin,
      participantNames: ["Лира"],
    });
    await db.combatant.updateMany({ where: { combatId: encounter.combatId, type: "enemy" }, data: { hpCurrent: 0 } });
    const result = await awardCombatVictoryXP(encounter.combatId);
    expect(result.awardedCharacters.map((c) => c.name)).toEqual(["Лира"]);
    const dobrun = await db.character.findUnique({ where: { id: heroes["Добрун"] } });
    expect(dobrun?.experiencePoints).toBe(100);
  });
});

describe("сообщение мастеру об итоге боя", () => {
  const base = {
    name: "Засада",
    rounds: 3,
    outcome: "victory" as const,
    survivingCombatants: [
      { name: "Лира", type: "player", hpCurrent: 5, hpMax: 20, conditions: ["poisoned"] },
      { name: "Марта", type: "companion", hpCurrent: 0, hpMax: 18 },
      { name: "Гоблин", type: "enemy", hpCurrent: 0, hpMax: 7 },
    ],
    awardedXP: 100,
    xpPerPlayer: 50,
  };

  it("описывает только участников: хиты, состояния, павших", () => {
    const text = buildCombatReport(base);
    expect(text).toContain("Лира (HP: 5/20, отравлен)");
    expect(text).toContain("Марта (HP: 0/18, без сознания или при смерти)");
    expect(text).not.toContain("Гоблин");
    expect(text).not.toContain("Не участвовали");
  });

  it("отдельной строкой напоминает, кто не участвовал", () => {
    const text = buildCombatReport({ ...base, nonParticipants: ["Добрун"] });
    expect(text).toContain("Не участвовали в бою: Добрун");
    expect(text).toContain("не изменились");
  });
});
