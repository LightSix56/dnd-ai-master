import { describe, it, expect } from "vitest";
import { RoomService, RoomRuleError } from "../room-service";
import { fakeSupabase } from "@/lib/testing/fake-supabase";

const HOST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function setup() {
  return fakeSupabase({
    tables: {
      rooms: [
        {
          id: "room-1",
          code: "DRAGON-42",
          name: "Стол",
          host_user_id: HOST,
          status: "active",
          starting_level: 1,
          max_level: 20,
          party_bond: "strangers",
          campaign_settings: { campaignId: "camp-1" },
        },
      ],
      room_participants: [
        { id: "p-host", room_id: "room-1", user_id: HOST, character_id: "c1", is_host: true, is_ready: true },
        { id: "p-player", room_id: "room-1", user_id: PLAYER, character_id: "c2", is_host: false, is_ready: true },
      ],
      profiles: [
        { id: HOST, username: "Мастер" },
        { id: PLAYER, username: "  " },
      ],
      characters: [],
    },
  });
}

describe("RoomService: выход и исключение", () => {
  it("игрок уходит один — комната остаётся активной", async () => {
    const client = setup();
    const service = new RoomService(client as any);

    const result = await service.leaveRoom("room-1", PLAYER);

    expect(result.closed).toBe(false);
    expect(client.tables.room_participants.map((p: any) => p.id)).toEqual(["p-host"]);
    expect(client.tables.rooms[0].status).toBe("active");
  });

  it("ведущий закрывает комнату для всех: архив, участники остаются", async () => {
    const client = setup();
    const service = new RoomService(client as any);

    const result = await service.leaveRoom("room-1", HOST);

    expect(result.closed).toBe(true);
    expect(client.tables.rooms[0].status).toBe("archived");
    expect(client.tables.room_participants).toHaveLength(2);
    expect(await service.getActiveRoomByCampaignId("camp-1")).toBeNull();
  });

  it("ведущий исключает игрока", async () => {
    const client = setup();
    const service = new RoomService(client as any);

    await service.kickParticipant("room-1", HOST, "p-player");

    expect(client.tables.room_participants.map((p: any) => p.id)).toEqual(["p-host"]);
  });

  it("не ведущий исключать не может, ведущий не исключает себя", async () => {
    const client = setup();
    const service = new RoomService(client as any);

    await expect(service.kickParticipant("room-1", PLAYER, "p-host")).rejects.toBeInstanceOf(RoomRuleError);
    await expect(service.kickParticipant("room-1", HOST, "p-host")).rejects.toBeInstanceOf(RoomRuleError);
    await expect(service.kickParticipant("room-1", HOST, "nobody")).rejects.toBeInstanceOf(RoomRuleError);
    expect(client.tables.room_participants).toHaveLength(2);
  });

  it("участники приходят с никами из profiles", async () => {
    const client = setup();
    const service = new RoomService(client as any);

    const room = await service.getRoomByCode("DRAGON-42");

    const byId = Object.fromEntries((room?.participants || []).map((p) => [p.id, p.username]));
    expect(byId).toEqual({ "p-host": "Мастер", "p-player": null });
  });
});
