import { describe, it, expect, vi } from "vitest";
import { RoomService } from "../room-service";
import type { CreateRoomInput, JoinRoomInput } from "../types";

describe("RoomService (Phase 1)", () => {
  it("creates a room with generated code and default lobby status", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "room-uuid-1",
            code: "DRAGON-42",
            name: "Кампания Севера",
            host_user_id: "user-host-1",
            status: "lobby",
            starting_level: 1,
            max_level: 20,
            party_bond: "strangers",
            campaign_settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    const mockClient = {
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    } as any;

    const service = new RoomService(mockClient);
    const input: CreateRoomInput = {
      name: "Кампания Севера",
      startingLevel: 1,
      maxLevel: 20,
      partyBond: "strangers",
    };

    const room = await service.createRoom("user-host-1", input);

    expect(room.id).toBe("room-uuid-1");
    expect(room.code).toBe("DRAGON-42");
    expect(room.status).toBe("lobby");
    expect(room.startingLevel).toBe(1);
    expect(mockClient.from).toHaveBeenCalledWith("rooms");
  });

  it("retrieves a room with participants by code", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "room-uuid-1",
        code: "DRAGON-42",
        name: "Кампания Севера",
        host_user_id: "user-host-1",
        status: "lobby",
        starting_level: 1,
        max_level: 20,
        party_bond: "strangers",
        campaign_settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        room_participants: [
          {
            id: "p1",
            room_id: "room-uuid-1",
            user_id: "user-host-1",
            character_id: "char-1",
            character_snapshot: { name: "Кроуг", level: 1 },
            is_host: true,
            is_ready: true,
            joined_at: new Date().toISOString(),
          },
        ],
      },
      error: null,
    });

    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      }),
    } as any;

    const service = new RoomService(mockClient);
    const result = await service.getRoomByCode("dragon-42");

    expect(result).not.toBeNull();
    expect(result?.code).toBe("DRAGON-42");
    expect(result?.participants).toHaveLength(1);
    expect(result?.participants[0].characterSnapshot.name).toBe("Кроуг");
  });

  it("validates character level when joining a room and rejects mismatched level", async () => {
    const mockRoomLookup = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "room-uuid-1",
              starting_level: 1,
              status: "lobby",
            },
            error: null,
          }),
        }),
      }),
    });

    const mockClient = {
      from: mockRoomLookup,
    } as any;

    const service = new RoomService(mockClient);
    const joinInput: JoinRoomInput = {
      roomId: "room-uuid-1",
      userId: "user-player-2",
      characterId: "char-invalid-5",
      characterSnapshot: {
        name: "Высокоуровневый Герой",
        level: 5,
      },
    };

    await expect(service.joinRoom(joinInput)).rejects.toThrow(
      /Для этой кампании требуется ровно 1 уровень/
    );
  });

  it("maps non-UUID characterId (e.g. CUID) to a valid UUID and syncs with characters table", async () => {
    const upsertCharacterMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const upsertParticipantMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "p-uuid-1",
            room_id: "room-uuid-1",
            user_id: "user-player-2",
            character_id: "1381c3be-9182-56da-a1dd-4b7b972e7f52",
            character_snapshot: {
              id: "cmufapu7o0001le04i0hbr71x",
              name: "Воин Гром",
              level: 1,
            },
            is_host: false,
            is_ready: false,
            joined_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "room-uuid-1",
                    starting_level: 1,
                    status: "lobby",
                    campaign_settings: {},
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "characters") {
          return {
            upsert: upsertCharacterMock,
          };
        }
        if (table === "room_participants") {
          return {
            upsert: upsertParticipantMock,
          };
        }
        return {};
      }),
    } as any;

    const service = new RoomService(mockClient);
    const cuid = "cmufapu7o0001le04i0hbr71x";
    const result = await service.joinRoom({
      roomId: "room-uuid-1",
      userId: "user-player-2",
      characterId: cuid,
      characterSnapshot: {
        id: cuid,
        name: "Воин Гром",
        level: 1,
      },
      isHost: false,
    });

    expect(upsertCharacterMock).toHaveBeenCalled();
    const charCallArg = upsertCharacterMock.mock.calls[0][0];
    // character_id in characters table must be a valid UUID
    expect(charCallArg.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    expect(upsertParticipantMock).toHaveBeenCalled();
    const partCallArg = upsertParticipantMock.mock.calls[0][0];
    expect(partCallArg.character_id).toBe(charCallArg.id);

    // Mapped participant should keep the original characterId for campaign matching
    expect(result.characterId).toBe(cuid);
  });
});
