import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomService } from "../room-service";
import type { PlayerTurnInput } from "../turn-batcher";

describe("RoomService - Turn management", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits player action and updates player_inputs in active turn", async () => {
    const existingTurn = {
      id: "turn-1",
      room_id: "room-1",
      round_number: 1,
      status: "waiting",
      player_inputs: {},
      dm_response: null,
      created_at: new Date().toISOString(),
    };

    const updatedTurn = {
      ...existingTurn,
      player_inputs: {
        "user-1": {
          userId: "user-1",
          characterName: "Торин",
          actionText: "Атакую молотом.",
          submittedAt: 12345,
        },
      },
    };

    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "room_turns") {
          return {
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
                  single: vi.fn().mockResolvedValue({ data: updatedTurn, error: null }),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };

    const service = new RoomService(mockSupabase as any);
    const input: PlayerTurnInput = {
      userId: "user-1",
      characterName: "Торин",
      actionText: "Атакую молотом.",
      submittedAt: 12345,
    };

    const turn = await service.submitPlayerAction("room-1", "user-1", input);
    expect(turn.playerInputs["user-1"].actionText).toBe("Атакую молотом.");
    expect(mockSupabase.from).toHaveBeenCalledWith("room_turns");
  });

  it("resolves active turn and initializes next round", async () => {
    const currentTurn = {
      id: "turn-1",
      room_id: "room-1",
      round_number: 1,
      status: "waiting",
      player_inputs: {
        "user-1": { userId: "user-1", characterName: "Торин", actionText: "Защищаюсь" },
      },
      dm_response: null,
    };

    const completedTurn = {
      ...currentTurn,
      status: "completed",
      dm_response: "Враг отступает перед вашей защитой.",
    };

    const nextTurn = {
      id: "turn-2",
      room_id: "room-1",
      round_number: 2,
      status: "waiting",
      player_inputs: {},
      dm_response: null,
    };

    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "room_turns") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: currentTurn, error: null }),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: completedTurn, error: null }),
                })),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: nextTurn, error: null }),
              })),
            })),
          };
        }
        return {};
      }),
    };

    const service = new RoomService(mockSupabase as any);
    const result = await service.resolveRoomTurn(
      "room-1",
      "Враг отступает перед вашей защитой."
    );

    expect(result.completedTurn.status).toBe("completed");
    expect(result.completedTurn.dmResponse).toBe("Враг отступает перед вашей защитой.");
    expect(result.nextTurn.roundNumber).toBe(2);
    expect(result.nextTurn.status).toBe("waiting");
  });
});
