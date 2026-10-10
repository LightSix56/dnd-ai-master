import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakePrisma } from "@/lib/testing/fake-prisma";
import { fakeSupabase, type FakeSupabase } from "@/lib/testing/fake-supabase";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({ prisma: null as any, supabase: null as any }));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => state.prisma[prop as string] }),
}));
vi.mock("@/lib/supabase/client", () => ({
  getAuthUserFromRequest: async () => ({ user: { id: USER_ID }, error: null }),
  getSupabaseAdminClient: () => state.supabase,
}));

import { POST as deleteCampaign } from "../delete/route";

const ORIGINAL = "22222222-2222-4222-8222-222222222222";
const VERSION = "33333333-3333-4333-8333-333333333333";
const OTHER_VERSION = "44444444-4444-4444-8444-444444444444";

function sheetRow(id: string, campaignId: string | null) {
  return { id, user_id: USER_ID, name: id, data: {}, campaign_id: campaignId, source_character_id: campaignId ? ORIGINAL : null };
}

function setup(options: { failTables?: string[] } = {}) {
  state.prisma = fakePrisma({
    campaign: [{ id: "camp-1", userId: USER_ID, name: "Кампания", isActive: false }],
    character: [{ id: "hero-1", campaignId: "camp-1", name: "Токсин", type: "player", sheetCharacterId: VERSION }],
  });
  const supabase: FakeSupabase = fakeSupabase({
    tables: {
      characters: [sheetRow(ORIGINAL, null), sheetRow(VERSION, "camp-1"), sheetRow(OTHER_VERSION, "camp-2")],
      rooms: [
        { id: "room-1", status: "active", campaign_settings: { campaignId: "camp-1" } },
        { id: "room-2", status: "active", campaign_settings: { campaignId: "camp-2" } },
      ],
      room_participants: [
        { id: "seat-1", room_id: "room-1", user_id: USER_ID, character_id: VERSION },
        { id: "seat-2", room_id: "room-2", user_id: USER_ID, character_id: OTHER_VERSION },
      ],
    },
    failTables: options.failTables,
  });
  state.supabase = supabase;
  return supabase;
}

function request() {
  return new Request("http://localhost/api/campaign/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
    body: JSON.stringify({ campaignId: "camp-1" }),
  });
}

describe("POST /api/campaign/delete — версии героев", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("удаляет версию этой кампании, оригинал и чужие версии остаются", async () => {
    const supabase = setup();
    const res = await deleteCampaign(request());
    expect(res.status).toBe(200);
    expect(supabase.tables.characters.map((r) => r.id).sort()).toEqual([ORIGINAL, OTHER_VERSION].sort());
    expect(state.prisma.campaign.rows).toHaveLength(0);
  });

  it("сетевая кампания: стол закрывается, место участника освобождается, иначе база не даст удалить версию", async () => {
    const supabase = setup();
    await deleteCampaign(request());
    expect(supabase.tables.room_participants.map((r) => r.id)).toEqual(["seat-2"]);
    const statuses = Object.fromEntries(supabase.tables.rooms.map((r) => [r.id, r.status]));
    expect(statuses).toEqual({ "room-1": "archived", "room-2": "active" });
  });

  it("если версии удалить не удалось, кампания остаётся и возвращается ошибка", async () => {
    setup({ failTables: ["characters"] });
    const res = await deleteCampaign(request());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Не удалось удалить версии героев, кампания не удалена");
    expect(state.prisma.campaign.rows).toHaveLength(1);
  });
});
