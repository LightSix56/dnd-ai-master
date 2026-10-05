import { describe, it, expect, vi } from "vitest";
import { RoomService } from "@/lib/room/room-service";
import { calculateTurnReadiness, type PlayerTurnInput } from "@/lib/room/turn-batcher";
import {
  resolveActiveRoomTurnHelper,
  buildFrozenRoomSystemPrompt,
} from "@/lib/room/resolve-turn-helper";
import type { RoomWithParticipants, RoomTurn } from "@/lib/room/types";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn().mockResolvedValue({ text: "Ведущий красочно описывает последствия раунда." }),
  };
});

describe("Cooperative Turn Logic", () => {
  it("rejects duplicate submission from the same user in active round", async () => {
    const existingTurn = {
      id: "turn-1",
      room_id: "room-1",
      round_number: 1,
      status: "waiting",
      player_inputs: {
        "user-1": {
          userId: "user-1",
          characterName: "Торин",
          actionText: "Атакую молотом",
          submittedAt: 1000,
        },
      },
      dm_response: null,
      created_at: new Date().toISOString(),
    };

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: existingTurn, error: null }),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: existingTurn, error: null }),
            })),
          })),
        })),
      })),
    };

    const service = new RoomService(mockSupabase as any);
    const input: PlayerTurnInput = {
      userId: "user-1",
      characterName: "Торин",
      actionText: "Изменил решение, стреляю из лука",
      submittedAt: 2000,
    };

    await expect(
      service.submitPlayerAction("room-1", "user-1", input)
    ).rejects.toThrow("Сказанного не вернёшь: вы уже отправили действие в этом раунде");
  });

  it("calculates turn readiness: isAllReady becomes true when all participants with character submit actions", () => {
    const participants = [
      { userId: "user-1", character: { name: "Торин" } },
      { userId: "user-2", character: { name: "Эльфийка" } },
      { userId: "user-3", character: null },
    ];

    const playerInputs: Record<string, PlayerTurnInput> = {
      "user-1": {
        userId: "user-1",
        characterName: "Торин",
        actionText: "Атакую молотом",
        submittedAt: 1000,
      },
      "user-2": {
        userId: "user-2",
        characterName: "Эльфийка",
        actionText: "Кастую огненный шар",
        submittedAt: 1005,
      },
    };

    const readiness = calculateTurnReadiness(participants, playerInputs);
    expect(readiness.totalCount).toBe(2);
    expect(readiness.readyCount).toBe(2);
    expect(readiness.isAllReady).toBe(true);
    expect(readiness.readyUserIds).toEqual(["user-1", "user-2"]);
    expect(readiness.pendingUserIds).toEqual([]);
  });

  it("resolves active room turn using provided dmResponse", async () => {
    const room: RoomWithParticipants = {
      id: "room-1",
      code: "ABCD",
      name: "Комната",
      hostUserId: "host-1",
      status: "active",
      startingLevel: 1,
      maxLevel: 5,
      partyBond: "established",
      campaignSettings: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      participants: [],
    };

    const activeTurn: RoomTurn = {
      id: "turn-1",
      roomId: "room-1",
      roundNumber: 1,
      status: "waiting",
      playerInputs: {
        "user-1": {
          userId: "user-1",
          characterName: "Торин",
          actionText: "Атакую молотом",
          submittedAt: 1000,
        },
      },
      createdAt: new Date().toISOString(),
    };

    const completedTurn: RoomTurn = {
      ...activeTurn,
      status: "completed",
      dmResponse: "Удар сокрушает преграду.",
    };
    const nextTurn: RoomTurn = {
      id: "turn-2",
      roomId: "room-1",
      roundNumber: 2,
      status: "waiting",
      playerInputs: {},
      createdAt: new Date().toISOString(),
    };

    const mockRoomService = {
      resolveRoomTurn: vi.fn().mockResolvedValue({
        completedTurn,
        nextTurn,
      }),
    } as unknown as RoomService;

    const result = await resolveActiveRoomTurnHelper(room, activeTurn, {
      dmResponse: "Удар сокрушает преграду.",
      roomService: mockRoomService,
    });

    expect(result.dmResponse).toBe("Удар сокрушает преграду.");
    expect(result.completedTurn.status).toBe("completed");
    expect(result.nextTurn.roundNumber).toBe(2);
    expect(mockRoomService.resolveRoomTurn).toHaveBeenCalledWith(
      "room-1",
      "Удар сокрушает преграду.",
      expect.anything()
    );
  });

  it("keeps the round open (does not resolve it with a stub) when no API key is provided", async () => {
    const room: RoomWithParticipants = {
      id: "room-1",
      code: "ABCD",
      name: "Комната",
      hostUserId: "host-1",
      status: "active",
      startingLevel: 1,
      maxLevel: 5,
      partyBond: "established",
      campaignSettings: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      participants: [],
    };

    const activeTurn: RoomTurn = {
      id: "turn-1",
      roomId: "room-1",
      roundNumber: 3,
      status: "waiting",
      playerInputs: {},
      createdAt: new Date().toISOString(),
    };

    const mockRoomService = {
      resolveRoomTurn: vi.fn().mockImplementation((_roomId, narrative) => ({
        completedTurn: { ...activeTurn, status: "completed", dmResponse: narrative },
        nextTurn: { id: "turn-2", roomId: "room-1", roundNumber: 4, status: "waiting", playerInputs: {}, createdAt: new Date().toISOString() },
      })),
    } as unknown as RoomService;

    const originalKey = process.env.AI_API_KEY;
    delete process.env.AI_API_KEY;

    try {
      // Без ключа раунд не закрывается заглушкой: заявки остаются, ведущий задаёт ключ и повторяет
      await expect(
        resolveActiveRoomTurnHelper(room, activeTurn, {
          roomService: mockRoomService,
        })
      ).rejects.toThrow("Не задан API-ключ ИИ");
      expect(mockRoomService.resolveRoomTurn).not.toHaveBeenCalled();
    } finally {
      process.env.AI_API_KEY = originalKey;
    }
  });

  it("resolves active room turns with frozen system prompt and dynamic state injected into prompt tail across rounds", async () => {
    const { generateText } = await import("ai");
    const mockGenerateText = vi.mocked(generateText);
    mockGenerateText.mockClear();

    const room: RoomWithParticipants = {
      id: "room-frozen-1",
      code: "FROZ",
      name: "Поход в Подземелье",
      hostUserId: "host-1",
      status: "active",
      startingLevel: 2,
      maxLevel: 6,
      partyBond: "established",
      campaignSettings: {
        title: "Поход в Подземелье",
        setting: "Забытые Королевства",
        tone: "героический",
        difficulty: "normal",
      },
      storyArc: {
        act: {
          name: "Катакомбы",
          goal: "Найти артефакт",
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      participants: [
        {
          id: "part-1",
          roomId: "room-frozen-1",
          userId: "user-1",
          characterId: "char-1",
          character: {
            name: "Гимли",
            race: "Дворф",
            className: "Воин",
            level: 2,
            hpCurrent: 20,
            hpMax: 20,
          },
          isHost: true,
          isReady: true,
          joinedAt: new Date().toISOString(),
        },
      ],
    };

    const turn1: RoomTurn = {
      id: "turn-1",
      roomId: "room-frozen-1",
      roundNumber: 1,
      status: "waiting",
      playerInputs: {
        "user-1": {
          userId: "user-1",
          characterName: "Гимли",
          actionText: "Бросаюсь на скелета",
          submittedAt: 100,
        },
      },
      createdAt: new Date().toISOString(),
    };

    const mockRoomService = {
      resolveRoomTurn: vi.fn().mockImplementation((_roomId, narrative) => ({
        completedTurn: { ...turn1, status: "completed", dmResponse: narrative },
        nextTurn: { id: "turn-2", roomId: "room-frozen-1", roundNumber: 2, status: "waiting", playerInputs: {}, createdAt: new Date().toISOString() },
      })),
    } as unknown as RoomService;

    // Раунд 1
    await resolveActiveRoomTurnHelper(room, turn1, {
      apiKey: "test-ai-key",
      roomService: mockRoomService,
    });

    // Раунд 2 (Гимли ранен: HP 8/20, состояние "ранен")
    const damagedRoom: RoomWithParticipants = {
      ...room,
      participants: [
        {
          ...room.participants[0],
          character: {
            ...room.participants[0].character,
            hpCurrent: 8,
            condition: "ранен",
          },
        },
      ],
    };

    const turn2: RoomTurn = {
      id: "turn-2",
      roomId: "room-frozen-1",
      roundNumber: 2,
      status: "waiting",
      playerInputs: {
        "user-1": {
          userId: "user-1",
          characterName: "Гимли",
          actionText: "Защищаюсь щитом",
          submittedAt: 200,
        },
      },
      createdAt: new Date().toISOString(),
    };

    await resolveActiveRoomTurnHelper(damagedRoom, turn2, {
      apiKey: "test-ai-key",
      roomService: mockRoomService,
    });

    // Запросы к мастеру — те, что идут с инструментами. Помимо них возможен фоновый вызов
    // обновления хроники: тест работает с настоящей БД, и у активной кампании может быть история.
    const dmCalls = mockGenerateText.mock.calls.map((c) => c[0] as any).filter((c) => c.tools);
    expect(dmCalls).toHaveLength(2);

    const [call1, call2] = dmCalls;
    // Ввод раунда — либо prompt (истории нет), либо последнее сообщение после истории кампании
    const roundInput = (c: any): string =>
      typeof c.prompt === "string" ? c.prompt : String(c.messages[c.messages.length - 1].content);

    // Системный промпт должен быть 100% идентичен (KV-кэш)
    expect(call1.system).toBe(call2.system);
    expect(call1.system).not.toContain("раунде 1");
    expect(call1.system).not.toContain("раунде 2");
    expect(call1.system).not.toContain("8/20");
    expect(call1.system).not.toContain("ранен");

    // Динамический срез раунда должен быть в prompt
    expect(roundInput(call1)).toContain("Раунд 1");
    expect(roundInput(call2)).toContain("Раунд 2");
    expect(roundInput(call2)).toContain("8/20");
    expect(roundInput(call2)).toContain("ранен");
  });

  it("passes stopWhen to generateText and extracts narrative from subsequent steps when step 0 contains only tool calls", async () => {
    const { generateText } = await import("ai");
    const mockGenerateText = vi.mocked(generateText);

    mockGenerateText.mockResolvedValueOnce({
      text: "",
      steps: [
        {
          text: "",
          toolCalls: [{ toolName: "start_combat", args: {} }],
        },
        {
          text: "Твоё «ОРУ» ещё звенит, когда улица взрывается движением!",
          toolCalls: [],
        },
      ],
    } as any);

    const room: RoomWithParticipants = {
      id: "room-step-test",
      code: "STEPS",
      name: "Тестовая комната",
      hostUserId: "user-1",
      status: "active",
      startingLevel: 1,
      maxLevel: 5,
      partyBond: "strangers",
      campaignSettings: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      participants: [
        {
          id: "p1",
          roomId: "room-step-test",
          userId: "user-1",
          characterId: "c1",
          character: { name: "Клык", className: "Варвар", level: 1 },
          isHost: true,
          isReady: true,
          joinedAt: new Date().toISOString(),
        },
      ],
    };

    const turn: RoomTurn = {
      id: "turn-steps",
      roomId: "room-step-test",
      roundNumber: 1,
      status: "waiting",
      playerInputs: {
        "user-1": {
          userId: "user-1",
          characterName: "Клык",
          actionText: "я ору",
          submittedAt: 100,
        },
      },
      createdAt: new Date().toISOString(),
    };

    const mockRoomService = {
      resolveRoomTurn: vi.fn().mockImplementation((_roomId, narrative) => ({
        completedTurn: { ...turn, status: "completed", dmResponse: narrative },
        nextTurn: { id: "turn-steps-2", roomId: "room-step-test", roundNumber: 2, status: "waiting", playerInputs: {}, createdAt: new Date().toISOString() },
      })),
    } as unknown as RoomService;

    const result = await resolveActiveRoomTurnHelper(room, turn, {
      apiKey: "test-key",
      roomService: mockRoomService,
    });

    // Последний запрос к мастеру (с инструментами); после него возможен фоновый вызов хроники
    const dmCalls = mockGenerateText.mock.calls.map((c) => c[0] as any).filter((c) => c.tools);
    const call = dmCalls[dmCalls.length - 1];
    expect(call.stopWhen).toBeDefined();
    expect(result.dmResponse).toBe("Твоё «ОРУ» ещё звенит, когда улица взрывается движением!");
    expect(result.dmResponse).not.toContain("Мастер оценивает действия отряда в раунде 1...");
  });

  it("never returns hanging loading placeholder when AI throws an error", async () => {
    const { generateText } = await import("ai");
    const mockGenerateText = vi.mocked(generateText);

    mockGenerateText.mockRejectedValueOnce(new Error("Polza timeout"));

    const room: RoomWithParticipants = {
      id: "room-err-test",
      code: "ERRORS",
      name: "Тестовая комната",
      hostUserId: "user-1",
      status: "active",
      startingLevel: 1,
      maxLevel: 5,
      partyBond: "strangers",
      campaignSettings: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      participants: [
        {
          id: "p1",
          roomId: "room-err-test",
          userId: "user-1",
          characterId: "c1",
          character: { name: "Клык", className: "Варвар", level: 1 },
          isHost: true,
          isReady: true,
          joinedAt: new Date().toISOString(),
        },
      ],
    };

    const turn: RoomTurn = {
      id: "turn-err",
      roomId: "room-err-test",
      roundNumber: 1,
      status: "waiting",
      playerInputs: {
        "user-1": {
          userId: "user-1",
          characterName: "Клык",
          actionText: "я ору",
          submittedAt: 100,
        },
      },
      createdAt: new Date().toISOString(),
    };

    const mockRoomService = {
      resolveRoomTurn: vi.fn().mockImplementation((_roomId, narrative) => ({
        completedTurn: { ...turn, status: "completed", dmResponse: narrative },
        nextTurn: { id: "turn-err-2", roomId: "room-err-test", roundNumber: 2, status: "waiting", playerInputs: {}, createdAt: new Date().toISOString() },
      })),
    } as unknown as RoomService;

    // При сбое ИИ раунд не закрывается заглушкой: заявки игроков остаются, ведущий повторяет генерацию
    await expect(
      resolveActiveRoomTurnHelper(room, turn, {
        apiKey: "test-key",
        roomService: mockRoomService,
      })
    ).rejects.toThrow("Заявки игроков сохранены");
    expect(mockRoomService.resolveRoomTurn).not.toHaveBeenCalled();
  });
});


