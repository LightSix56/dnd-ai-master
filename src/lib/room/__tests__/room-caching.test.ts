import { describe, it, expect, vi } from "vitest";
import {
  buildFrozenRoomSystemPrompt,
  resolveActiveRoomTurnHelper,
} from "../resolve-turn-helper";
import { bundleTurnInputs, type PlayerTurnInput } from "../turn-batcher";
import type { RoomWithParticipants, RoomTurn } from "../types";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn().mockResolvedValue({ text: "Мастер описывает исход раунда." }),
  };
});

vi.mock("@/lib/ai/client", () => ({
  createClient: vi.fn(() => ({
    chat: vi.fn((modelName: string) => ({ modelId: modelName })),
  })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    chatMessage: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("Room Prompt Caching & Frozen Prefix Architecture", () => {
  const baseRoom: RoomWithParticipants = {
    id: "room-caching-1",
    code: "CACHE",
    name: "Обитель Дракона",
    hostUserId: "host-user",
    status: "active",
    startingLevel: 3,
    maxLevel: 10,
    partyBond: "established",
    campaignSettings: {
      title: "Обитель Дракона",
      setting: "Забытые Королевства",
      tone: "dark-fantasy",
      difficulty: "hard",
    },
    storyArc: {
      act: {
        name: "Пробуждение зла",
        goal: "Найти логово дракона",
        summary: "Герои идут по следу пепла",
        climaxObjective: "Сразить драконьего вестника",
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participants: [
      {
        id: "part-1",
        roomId: "room-caching-1",
        userId: "user-thorgrim",
        characterId: "char-1",
        characterSnapshot: {
          name: "Торгрим",
          race: "Дворф",
          className: "Жрец",
          level: 3,
          hpCurrent: 28,
          hpMax: 28,
          condition: "здоров",
        },
        isHost: true,
        isReady: true,
        joinedAt: new Date().toISOString(),
      },
      {
        id: "part-2",
        roomId: "room-caching-1",
        userId: "user-lyra",
        characterId: "char-2",
        characterSnapshot: {
          name: "Лира",
          race: "Эльф",
          className: "Плут",
          level: 3,
          hpCurrent: 19,
          hpMax: 19,
          condition: "здоров",
        },
        isHost: false,
        isReady: true,
        joinedAt: new Date().toISOString(),
      },
    ],
  };

  it("buildFrozenRoomSystemPrompt produces 100% byte-for-byte identical prompt between Round 1 and Round 2 despite HP changes", () => {
    // Раунд 1: персонажи полностью здоровы
    const promptRound1 = buildFrozenRoomSystemPrompt(baseRoom);

    // Раунд 2: Торгрим ранен, Лира отравлена и потеряла половину HP
    const mutatedRoom: RoomWithParticipants = {
      ...baseRoom,
      participants: [
        {
          ...baseRoom.participants[0],
          characterSnapshot: {
            ...baseRoom.participants[0].characterSnapshot,
            hpCurrent: 12,
            condition: "ранен, кровотечение",
          },
        },
        {
          ...baseRoom.participants[1],
          characterSnapshot: {
            ...baseRoom.participants[1].characterSnapshot,
            hpCurrent: 5,
            condition: "отравлен",
          },
        },
      ],
    };

    const promptRound2 = buildFrozenRoomSystemPrompt(mutatedRoom);

    // 100% побайтовое совпадение префикса
    expect(promptRound1).toBe(promptRound2);

    // Никакие динамические HP или раны не должны проникать в системный промпт
    expect(promptRound1).not.toContain("12/28");
    expect(promptRound1).not.toContain("5/19");
    expect(promptRound1).not.toContain("кровотечение");
    expect(promptRound1).not.toContain("отравлен");

    // Также не должно быть привязки к конкретному номеру раунда в неизменяемых правилах
    expect(promptRound1).not.toMatch(/раунд\w*\s+\d+/i);
  });

  it("buildFrozenRoomSystemPrompt sorts participants deterministically to prevent KV cache fragmentation", () => {
    const roomReversed: RoomWithParticipants = {
      ...baseRoom,
      participants: [...baseRoom.participants].reverse(),
    };

    const promptDefault = buildFrozenRoomSystemPrompt(baseRoom);
    const promptReversed = buildFrozenRoomSystemPrompt(roomReversed);

    expect(promptDefault).toBe(promptReversed);
  });

  it("bundleTurnInputs encapsulates dynamic party HP and conditions in prompt tail", () => {
    const playerInputs: Record<string, PlayerTurnInput> = {
      "user-thorgrim": {
        userId: "user-thorgrim",
        characterName: "Торгрим",
        className: "Жрец",
        level: 3,
        actionText: "Поднимаю щит и прикрываю Лиру.",
        submittedAt: 1000,
      },
    };

    const bundled = bundleTurnInputs(playerInputs, {
      roundNumber: 2,
      partyStatus: [
        { name: "Торгрим", hpCurrent: 12, hpMax: 28, condition: "ранен", ac: 18 },
        { name: "Лира", hpCurrent: 5, hpMax: 19, hpTemp: 3, condition: "отравлена", ac: 14 },
      ],
    });

    expect(bundled).toContain("Совместный ход отряда — Раунд 2");
    expect(bundled).toContain("Торгрим");
    expect(bundled).toContain("Поднимаю щит");
    // Динамический срез сцены должен присутствовать в теле заявки
    expect(bundled).toContain("12/28");
    expect(bundled).toContain("ранен");
    expect(bundled).toContain("отравлена");
  });

  it("resolveActiveRoomTurnHelper passes identical frozen system prompt across multiple rounds to generateText", async () => {
    const { generateText } = await import("ai");
    const mockGenerateText = vi.mocked(generateText);
    mockGenerateText.mockClear();

    const turn1: RoomTurn = {
      id: "turn-1",
      roomId: baseRoom.id,
      roundNumber: 1,
      status: "waiting",
      playerInputs: {
        "user-thorgrim": {
          userId: "user-thorgrim",
          characterName: "Торгрим",
          actionText: "Осматриваю зал.",
          submittedAt: 100,
        },
      },
      createdAt: new Date().toISOString(),
    };

    const turn2: RoomTurn = {
      id: "turn-2",
      roomId: baseRoom.id,
      roundNumber: 2,
      status: "waiting",
      playerInputs: {
        "user-thorgrim": {
          userId: "user-thorgrim",
          characterName: "Торгрим",
          actionText: "Атакую приближающуюся тварь.",
          submittedAt: 200,
        },
      },
      createdAt: new Date().toISOString(),
    };

    const mockRoomService = {
      resolveRoomTurn: vi.fn().mockImplementation((_roomId, narrative) => ({
        completedTurn: { id: "turn-comp", dmResponse: narrative, status: "completed" },
        nextTurn: { id: "turn-next", status: "waiting" },
      })),
    } as any;

    // Резолвим раунд 1
    await resolveActiveRoomTurnHelper(baseRoom, turn1, {
      apiKey: "test-ai-key",
      roomService: mockRoomService,
    });

    // Изменяем HP персонажей ко 2 раунду
    const damagedRoom: RoomWithParticipants = {
      ...baseRoom,
      participants: [
        {
          ...baseRoom.participants[0],
          characterSnapshot: {
            ...baseRoom.participants[0].characterSnapshot,
            hpCurrent: 14,
            condition: "тяжело ранен",
          },
        },
        baseRoom.participants[1],
      ],
    };

    // Резолвим раунд 2
    await resolveActiveRoomTurnHelper(damagedRoom, turn2, {
      apiKey: "test-ai-key",
      roomService: mockRoomService,
    });

    expect(mockGenerateText).toHaveBeenCalledTimes(2);

    const call1 = mockGenerateText.mock.calls[0][0] as any;
    const call2 = mockGenerateText.mock.calls[1][0] as any;

    // ПРЕФИКС КЭШИРОВАНИЯ: Системный промпт ОБЯЗАН быть 100% идентичным!
    expect(call1.system).toBe(call2.system);
    expect(call1.system).not.toContain("раунде 1");
    expect(call1.system).not.toContain("раунде 2");
    expect(call1.system).not.toContain("тяжело ранен");

    // Промпты раундов содержат соответствующую динамику
    expect(call1.prompt).toContain("Раунд 1");
    expect(call2.prompt).toContain("Раунд 2");
    expect(call2.prompt).toContain("тяжело ранен");
    expect(call2.prompt).toContain("14/28");
  });
});
