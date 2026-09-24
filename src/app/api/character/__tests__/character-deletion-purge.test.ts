import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DELETE } from "../route";
import { db } from "@/lib/db";

describe("DELETE /api/character trace purging", () => {
  let testCampaignId: string;
  let testCharId: string;
  let testCombatId: string;
  const testCharName = "Эльфийский Следопыт Арагорн";

  beforeAll(async () => {
    // 1. Создаем тестовую кампанию с сюжетной аркой и personalHooks
    const campaign = await db.campaign.create({
      data: {
        name: "Test Purge Campaign",
        startingLevel: 3,
        storyArc: JSON.stringify({
          acts: [
            {
              name: "Акт 1",
              personalHooks: [
                { characterName: testCharName, hook: "Ищет древний клинок своего предка" },
                { characterName: "Другой Персонаж", hook: "Должен выплатить долг" },
              ],
            },
          ],
        }),
      },
    });
    testCampaignId = campaign.id;

    // 2. Создаем персонажа
    const char = await db.character.create({
      data: {
        campaignId: testCampaignId,
        name: testCharName,
        type: "player",
        level: 3,
        race: "Эльф",
        class: "Следопыт",
      },
    });
    testCharId = char.id;

    // 3. Создаем факты в долгосрочной памяти (Memory)
    await db.memory.create({
      data: {
        campaignId: testCampaignId,
        category: "character",
        subject: testCharName,
        content: `${testCharName} — непревзойдённый стрелок и защитник леса.`,
      },
    });
    await db.memory.create({
      data: {
        campaignId: testCampaignId,
        category: "character",
        subject: `${testCharName} — предыстория`,
        content: "Родился в Ривенделле...",
      },
    });
    await db.memory.create({
      data: {
        campaignId: testCampaignId,
        category: "relationship",
        subject: `${testCharName} — союзники`,
        content: "Дружит с гномами.",
      },
    });
    // И память о ДРУГОМ персонаже (не должна удаляться!)
    await db.memory.create({
      data: {
        campaignId: testCampaignId,
        category: "character",
        subject: "Другой Персонаж",
        content: "Другой персонаж живёт своей жизнью.",
      },
    });

    // 4. Создаем бой и бойца в таблице combatant
    const combat = await db.combat.create({
      data: {
        campaignId: testCampaignId,
        status: "active",
      },
    });
    testCombatId = combat.id;

    await db.combatant.create({
      data: {
        combatId: testCombatId,
        characterId: testCharId,
        name: testCharName,
        type: "player",
        x: 2,
        y: 3,
        hpMax: 28,
        hpCurrent: 28,
        ac: 15,
      },
    });

    // 5. Создаем событие игры
    await db.gameEvent.create({
      data: {
        campaignId: testCampaignId,
        type: "story",
        description: `Импортирован персонаж ${testCharName}`,
        participants: JSON.stringify([testCharId]),
      },
    });
  });

  afterAll(async () => {
    if (testCampaignId) {
      if (testCombatId) {
        await db.combatant.deleteMany({ where: { combatId: testCombatId } });
        await db.combat.deleteMany({ where: { id: testCombatId } });
      }
      await db.memory.deleteMany({ where: { campaignId: testCampaignId } });
      await db.gameEvent.deleteMany({ where: { campaignId: testCampaignId } });
      await db.character.deleteMany({ where: { campaignId: testCampaignId } });
      await db.campaign.deleteMany({ where: { id: testCampaignId } });
    }
  });

  it("purges all traces of deleted character from memories, combatants, events and story hooks", async () => {
    const req = new Request(`http://localhost/api/character?id=${encodeURIComponent(testCharId)}`, {
      method: "DELETE",
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.name).toBe(testCharName);

    // 1. Проверяем, что персонаж удален из db.character
    const charInDb = await db.character.findUnique({ where: { id: testCharId } });
    expect(charInDb).toBeNull();

    // 2. Проверяем, что ВСЕ воспоминания удаленного персонажа стерты
    const charMemories = await db.memory.findMany({
      where: {
        campaignId: testCampaignId,
        OR: [
          { subject: { contains: testCharName } },
          { content: { contains: testCharName } },
        ],
      },
    });
    expect(charMemories.length).toBe(0);

    // Память о другом персонаже осталась нетронутой
    const otherMemories = await db.memory.findMany({
      where: {
        campaignId: testCampaignId,
        subject: "Другой Персонаж",
      },
    });
    expect(otherMemories.length).toBe(1);

    // 3. Проверяем, что боец удален из combatant
    const combatants = await db.combatant.findMany({
      where: {
        OR: [{ characterId: testCharId }, { name: testCharName }],
      },
    });
    expect(combatants.length).toBe(0);

    // 4. Проверяем, что события удаленного персонажа очищены
    const events = await db.gameEvent.findMany({
      where: {
        campaignId: testCampaignId,
        OR: [
          { participants: { contains: testCharId } },
          { description: { contains: testCharName } },
        ],
      },
    });
    expect(events.length).toBe(0);

    // 5. Проверяем, что сюжетный крючок персонажа удален из storyArc кампании
    const updatedCampaign = await db.campaign.findUnique({ where: { id: testCampaignId } });
    const arc = JSON.parse(updatedCampaign!.storyArc as string);
    const hooks = arc.acts[0].personalHooks;
    expect(hooks.some((h: any) => h.characterName === testCharName)).toBe(false);
    expect(hooks.some((h: any) => h.characterName === "Другой Персонаж")).toBe(true);
  });
});
