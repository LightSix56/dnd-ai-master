import { describe, it, expect, vi } from "vitest";
import { RoomService } from "../room-service";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import type { CreateRoomInput } from "../types";

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

  it("retrieves a room with participants by code, heroes come from their sheets", async () => {
    const SHEET = "11111111-1111-4111-8111-111111111111";
    const client = fakeSupabase({
      tables: {
        rooms: [
          {
            id: "room-uuid-1",
            code: "DRAGON-42",
            name: "Кампания Севера",
            host_user_id: "user-host-1",
            status: "lobby",
            starting_level: 1,
            max_level: 20,
            party_bond: "strangers",
            campaign_settings: {},
          },
        ],
        room_participants: [
          {
            id: "p1",
            room_id: "room-uuid-1",
            user_id: "user-host-1",
            character_id: SHEET,
            // устаревший снимок в строке участника не читается
            character_snapshot: { name: "Старое имя", level: 9 },
            is_host: true,
            is_ready: true,
          },
          {
            id: "p2",
            room_id: "room-uuid-1",
            user_id: "user-2",
            character_id: "22222222-2222-4222-8222-222222222222",
            character_snapshot: {},
            is_host: false,
            is_ready: false,
          },
        ],
        characters: [
          { id: SHEET, user_id: "user-host-1", name: "Кроуг", data: { name: "Кроуг", level: 2, className: "Варвар", hpMax: 25, hpCurrent: 7 }, revision: 3 },
        ],
      },
    });

    const service = new RoomService(client as any);
    const result = await service.getRoomByCode("dragon-42");

    expect(result).not.toBeNull();
    expect(result?.code).toBe("DRAGON-42");
    expect(result?.participants).toHaveLength(2);
    expect(result?.participants[0]).toMatchObject({
      characterId: SHEET,
      character: { id: SHEET, name: "Кроуг", level: 2, className: "Варвар", hpMax: 25, hpCurrent: 7 },
    });
    // лист участника удалён из базы — герой помечен, комната всё равно открывается
    expect(result?.participants[1].character).toMatchObject({ missing: true });
  });
});
