import { describe, it, expect, vi } from "vitest";
import { RoomService } from "@/lib/room/room-service";
import { calculateTurnReadiness, type PlayerTurnInput } from "@/lib/room/turn-batcher";
import { resolveActiveRoomTurnHelper } from "@/lib/room/resolve-turn-helper";
import type { RoomWithParticipants, RoomTurn } from "@/lib/room/types";

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

  it("calculates turn readiness: isAllReady becomes true when all participants with characterSnapshot submit actions", () => {
    const participants = [
      { userId: "user-1", characterSnapshot: { name: "Торин" } },
      { userId: "user-2", characterSnapshot: { name: "Эльфийка" } },
      { userId: "user-3", characterSnapshot: null },
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
    expect(mockRoomService.resolveRoomTurn).toHaveBeenCalledWith("room-1", "Удар сокрушает преграду.");
  });

  it("resolves active room turn with fallback narrative when no API key provided", async () => {
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
      const result = await resolveActiveRoomTurnHelper(room, activeTurn, {
        roomService: mockRoomService,
      });

      expect(result.dmResponse).toBe("Мастер оценивает действия отряда в раунде 3...");
      expect(result.completedTurn.status).toBe("completed");
      expect(result.nextTurn.roundNumber).toBe(4);
    } finally {
      process.env.AI_API_KEY = originalKey;
    }
  });
});

