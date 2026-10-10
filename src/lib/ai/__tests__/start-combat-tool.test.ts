import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    campaign: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    gameEvent: { create: vi.fn().mockResolvedValue({ id: "evt-1" }) },
  },
}));

vi.mock("@/lib/combat/generator", () => ({
  createTacticalEncounter: vi.fn().mockResolvedValue({
    combatId: "combat-1",
    name: "Засада",
    environment: "urban",
    gridWidth: 20,
    gridHeight: 15,
    combatantsCount: 3,
    turnOrder: [],
    enemyNames: ["Бандит", "Бандит"],
    awardedXP: 50,
    xpPerPlayer: 50,
    participants: ["Лира"],
    notParticipating: ["Добрун"],
  }),
}));

vi.mock("@/lib/combat/encounters/ensure-companions", () => ({
  ensureCompanions: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "@/lib/db";
import { ensureCompanions } from "@/lib/combat/encounters/ensure-companions";
import { createTacticalEncounter } from "@/lib/combat/generator";
import { startCombatTool } from "../tools";

/** Вызов инструмента так, как его вызывает AI SDK: вход сначала проходит через схему */
async function callStartCombat(args: Record<string, unknown>) {
  const schema = startCombatTool.inputSchema as unknown as { parse: (v: unknown) => any };
  const input = schema.parse({ biome: "urban", ...args });
  await (startCombatTool.execute as any)(input, { context: { campaignId: "camp-1" }, toolCallId: "t1", messages: [] });
  return vi.mocked(createTacticalEncounter).mock.calls[0][0];
}

describe("start_combat: состав врагов подбирает движок", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.campaign.findUnique).mockResolvedValue({ id: "camp-1", difficulty: "brutal" } as any);
  });

  it("список конкретных врагов от мастера не попадает в генератор", async () => {
    const params = await callStartCombat({
      name: "Нападение на стражу",
      enemyType: "стражники",
      enemies: Array.from({ length: 50 }, (_, i) => ({ name: `Стражник ${i + 1}` })),
    });
    expect(params.enemies).toBeUndefined();
    expect(params.storyFaction).toEqual({ name: "стражники" });
  });

  it("без сложности от мастера берёт сложность кампании", async () => {
    const params = await callStartCombat({ name: "Засада", enemyType: "бандиты" });
    expect(params.difficulty).toBe("deadly");
  });

  it("сложность, названная мастером, важнее сложности кампании", async () => {
    const params = await callStartCombat({ name: "Засада", enemyType: "бандиты", difficulty: "easy" });
    expect(params.difficulty).toBe("easy");
  });

  it("передаёт генератору имя вожака", async () => {
    const params = await callStartCombat({
      name: "Засада в переулке",
      enemyType: "головорезы",
      leaderName: "Человек в сером капюшоне",
    });
    expect(params.leaderName).toBe("Человек в сером капюшоне");
  });

  it("английские названия существ уходят в фракцию для поиска по бестиарию", async () => {
    const params = await callStartCombat({ name: "Засада", enemyType: "ящеролюды и мертвецы", enemyKeywords: ["lizardfolk", "zombie"] });
    expect(params.storyFaction).toEqual({ name: "ящеролюды и мертвецы", tags: ["lizardfolk", "zombie"] });
  });

  it("спутников из рассказа заводит до создания боя", async () => {
    const companions = [{ name: "Марта", class: "Воин" }, { name: "Кестрел", class: "Жрец" }];
    await callStartCombat({ name: "Засада", enemyType: "ящеролюды", companions });
    expect(ensureCompanions).toHaveBeenCalledWith("camp-1", companions);
    expect(vi.mocked(ensureCompanions).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createTacticalEncounter).mock.invocationCallOrder[0]
    );
  });

  it("участников боя передаёт генератору вместе со спутниками из companions", async () => {
    const params = await callStartCombat({
      name: "Засада",
      enemyType: "бандиты",
      participants: ["Лира"],
      companions: [{ name: "Марта" }],
    });
    expect(params.participantNames).toEqual(["Лира", "Марта"]);
  });

  it("без participants в бой идут все (список не передаётся)", async () => {
    const params = await callStartCombat({ name: "Засада", enemyType: "бандиты", companions: [{ name: "Марта" }] });
    expect(params.participantNames).toBeUndefined();
  });

  it("мастеру возвращается, кто в бою не участвует", async () => {
    const schema = startCombatTool.inputSchema as unknown as { parse: (v: unknown) => any };
    const input = schema.parse({ biome: "urban", name: "Засада", enemyType: "бандиты", participants: ["Лира"] });
    const result = await (startCombatTool.execute as any)(input, { context: { campaignId: "camp-1" }, toolCallId: "t1", messages: [] });
    expect(result.participants).toEqual(["Лира"]);
    expect(result.notParticipating).toEqual(["Добрун"]);
    expect(result.message).toContain("Добрун");
  });

  it("бой в таверне идёт на карте таверны, а не города", async () => {
    const params = await callStartCombat({ name: "Драка в «Пьяном драконе»", enemyType: "наёмники", biome: "tavern" });
    expect(params.biome).toBe("tavern");
  });

  it("без места боя вызов не проходит: мастер обязан выбрать биом", () => {
    const schema = startCombatTool.inputSchema as unknown as { safeParse: (v: unknown) => { success: boolean } };
    expect(schema.safeParse({ name: "Засада", enemyType: "бандиты" }).success).toBe(false);
  });
});
