import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateText } from "ai";
import { buildFrozenRoomSystemPrompt, resolveActiveRoomTurnHelper } from "../resolve-turn-helper";
import type { RoomWithParticipants, RoomTurn } from "../types";
import { buildFrozenSystemPrompt } from "@/lib/ai/caching/frozen-prefix";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn().mockResolvedValue({
      text: "Мастер описывает засаду гоблинов.",
      steps: [
        {
          toolCalls: [{ toolName: "start_combat", args: { name: "Засада гоблинов" } }],
          toolResults: [{ toolName: "start_combat", result: { success: true, combatId: "combat-1" } }],
        },
      ],
    }),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    campaign: {
      findFirst: vi.fn().mockResolvedValue({ id: "camp-test", isActive: true }),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "camp-test" }),
    },
    character: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    gameEvent: {
      create: vi.fn().mockResolvedValue({ id: "evt-test" }),
    },
    chatMessage: {
      create: vi.fn().mockResolvedValue({ id: "msg-test" }),
    },
    combat: {
      create: vi.fn().mockResolvedValue({ id: "combat-1", name: "Засада гоблинов", round: 1 }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/combat/generator", () => ({
  createTacticalEncounter: vi.fn().mockResolvedValue({
    combatId: "combat-1",
    name: "Засада гоблинов",
    environment: "forest",
    gridWidth: 20,
    gridHeight: 15,
    combatantsCount: 4,
    enemyNames: ["Гоблин-мечник", "Гоблин-лучник"],
    awardedXP: 100,
    xpPerPlayer: 50,
  }),
}));

describe("Room System Prompt - Anti-Chinese & Tactical Combat Rules", () => {
  const mockRoom: RoomWithParticipants = {
    id: "room-1",
    code: "TEST12",
    name: "Логово дракона",
    hostUserId: "user-1",
    partyBond: "strangers",
    campaignId: "camp-1",
    status: "active",
    startingLevel: 1,
    maxLevel: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    campaignSettings: {
      title: "Охота на гоблинов",
      setting: "Забытые Королевства",
      tone: "heroic",
      difficulty: "normal",
    },
    participants: [
      {
        id: "p1",
        roomId: "room-1",
        userId: "u1",
        characterId: "c1",
        isHost: true,
        isReady: true,
        joinedAt: new Date().toISOString(),
        characterSnapshot: {
          id: "c1",
          name: "Ник",
          className: "Плут",
          level: 1,
        },
      },
      {
        id: "p2",
        roomId: "room-1",
        userId: "u2",
        characterId: "c2",
        isHost: false,
        isReady: true,
        joinedAt: new Date().toISOString(),
        characterSnapshot: {
          id: "c2",
          name: "Ли齿 (Клык)",
          className: "Варвар",
          level: 1,
        },
      },
    ],
  };

  const mockTurn: RoomTurn = {
    id: "turn-1",
    roomId: "room-1",
    roundNumber: 1,
    status: "resolving",
    playerInputs: {
      u1: {
        userId: "u1",
        characterName: "Ник",
        actionText: "Начать бой инструментом, а не просто в чате",
        submittedAt: Date.now(),
      },
    },
    dmResponse: null,
    createdAt: new Date().toISOString(),
  };

  it("strictly forbids Chinese language and OOC Chinese in system prompt", () => {
    const prompt = buildFrozenRoomSystemPrompt(mockRoom);
    expect(prompt).toContain("КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать китайский язык");
    expect(prompt).toContain("ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ");
  });

  it("strictly forbids text-based combat simulation and demands start_combat tool", () => {
    const prompt = buildFrozenRoomSystemPrompt(mockRoom);
    expect(prompt).toContain("start_combat");
    expect(prompt).toContain("КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вести бой текстом");
    expect(prompt).toContain("рисовать таблицы HP/AC");
  });

  it("preserves Russian words without corruption in buildFrozenSystemPrompt", () => {
    const context = {
      name: "Кампания",
      setting: "Фэнтези",
      tone: "heroic",
      worldDescription: "Похитители скрылись в тумане, но сохраненный свиток содержит хитрость.",
    };
    const prompt = buildFrozenSystemPrompt(context);
    expect(prompt).toContain("Похитители");
    expect(prompt).toContain("сохраненный");
    expect(prompt).toContain("хитрость");
    expect(prompt).not.toContain("похочков");
    expect(prompt).not.toContain("сотравмированный");
  });

  it("provides tools including start_combat to generateText in room turn resolution", async () => {
    const mockRoomService = {
      resolveRoomTurn: vi.fn().mockResolvedValue({
        completedTurn: { ...mockTurn, status: "completed" },
        nextTurn: { ...mockTurn, id: "turn-2", roundNumber: 2, status: "waiting", playerInputs: {} },
      }),
    };

    const res = await resolveActiveRoomTurnHelper(mockRoom, mockTurn, {
      apiKey: "sk-test",
      roomService: mockRoomService as any,
    });

    expect(res.dmResponse).toBe("Мастер описывает засаду гоблинов.");
    expect(generateText).toHaveBeenCalled();
    const callArgs = vi.mocked(generateText).mock.calls[0][0] as any;
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools).toHaveProperty("start_combat");
    expect(callArgs.maxSteps).toBe(3);
  });
});
