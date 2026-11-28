import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAuthUserMock, dbMock, getRoomByCodeMock, getActiveTurnMock } = vi.hoisted(() => ({
  getAuthUserMock: vi.fn(),
  dbMock: {
    campaign: { findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    character: { findMany: vi.fn() },
  },
  getRoomByCodeMock: vi.fn(),
  getActiveTurnMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/client")>();
  return {
    ...actual,
    getAuthUserFromRequest: getAuthUserMock,
    getSupabaseAdminClient: vi.fn(() => ({})),
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/room/room-service", () => ({
  RoomService: class {
    getRoomByCode = getRoomByCodeMock;
    getActiveTurn = getActiveTurnMock;
    getActiveRoomByCampaignId = vi.fn().mockResolvedValue(null);
  },
}));

vi.mock("@/lib/auth/campaign-access", () => ({
  AUTH_REQUIRED_MESSAGE: "Войдите в аккаунт, чтобы продолжить.",
  getRequestUserId: vi.fn(async (req: Request) => {
    const res = await getAuthUserMock(req);
    return res?.user?.id ?? null;
  }),
  denyCampaignAccess: vi.fn(async (req: Request) => {
    const res = await getAuthUserMock(req);
    return res?.user?.id ? null : Response.json({ error: "Unauthorized" }, { status: 401 });
  }),
}));

import { POST as deleteCampaignPost } from "../../campaign/delete/route";
import { POST as createRoomPost } from "../create/route";
import { GET as getRoomGet } from "../[code]/route";
import { GET as getRoomTurnGet } from "../[code]/turn/route";
import { POST as chatPost } from "../../chat/route";
import { GET as authCallbackGet } from "../../auth/callback/route";
import { NextRequest } from "next/server";

describe("Campaign, Room, Chat & Auth Security Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthUserMock.mockResolvedValue({ user: null, error: "Unauthorized" });
  });

  it("POST /api/campaign/delete requires auth and blocks deleting ownerless campaigns", async () => {
    const unauth = await deleteCampaignPost(
      new Request("http://localhost/api/campaign/delete", {
        method: "POST",
        body: JSON.stringify({ campaignId: "c1" }),
      })
    );
    expect(unauth.status).toBe(401);

    getAuthUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    dbMock.campaign.findUnique.mockResolvedValue({ id: "c-orphan", name: "Orphan", userId: null });
    const orphanRes = await deleteCampaignPost(
      new Request("http://localhost/api/campaign/delete", {
        method: "POST",
        headers: { Authorization: "Bearer tok" },
        body: JSON.stringify({ campaignId: "c-orphan" }),
      })
    );
    expect(orphanRes.status).toBe(403);
  });

  it("POST /api/room/create requires authenticated user even when campaignId is supplied", async () => {
    const res = await createRoomPost(
      new Request("http://localhost/api/room/create", {
        method: "POST",
        body: JSON.stringify({ name: "Room", campaignId: "c1" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/room/[code] requires auth and redacts sensitive character fields for non-members", async () => {
    const unauth = await getRoomGet(new Request("http://localhost/api/room/ABC-12"), {
      params: Promise.resolve({ code: "ABC-12" }),
    });
    expect(unauth.status).toBe(401);

    getAuthUserMock.mockResolvedValue({ user: { id: "outsider-1" }, error: null });
    getRoomByCodeMock.mockResolvedValue({
      id: "r1",
      code: "ABC-12",
      name: "Lobby",
      hostUserId: "host-1",
      status: "lobby",
      startingLevel: 1,
      maxLevel: 5,
      partyBond: "strangers",
      campaignId: "camp-1",
      storyArc: { secret: "spoiler" },
      participants: [{ id: "p1", userId: "host-1", characterId: "s1" }],
    });
    dbMock.character.findMany.mockResolvedValue([
      {
        id: "ch1",
        name: "Герой",
        race: "Эльф",
        class: "Воин",
        level: 1,
        notes: "Секретная заметка",
        inventory: '["Секрет"]',
        spells: '["Огненный шар"]',
        sheetCharacterId: "s1",
      },
    ]);

    const res = await getRoomGet(
      new Request("http://localhost/api/room/ABC-12", { headers: { Authorization: "Bearer tok" } }),
      { params: Promise.resolve({ code: "ABC-12" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.room.storyArc).toBeUndefined();
    expect(json.campaignCharacters[0].notes).toBeUndefined();
    expect(json.campaignCharacters[0].inventory).toBeUndefined();
    expect(json.campaignCharacters[0].spells).toBeUndefined();
  });

  it("GET /api/room/[code]/turn requires auth and room membership", async () => {
    const unauth = await getRoomTurnGet(new Request("http://localhost/api/room/ABC-12/turn"), {
      params: Promise.resolve({ code: "ABC-12" }),
    });
    expect(unauth.status).toBe(401);

    getAuthUserMock.mockResolvedValue({ user: { id: "outsider-1" }, error: null });
    getRoomByCodeMock.mockResolvedValue({
      id: "r1",
      code: "ABC-12",
      hostUserId: "host-1",
      participants: [{ id: "p1", userId: "player-1" }],
    });

    const forbidden = await getRoomTurnGet(
      new Request("http://localhost/api/room/ABC-12/turn", { headers: { Authorization: "Bearer tok" } }),
      { params: Promise.resolve({ code: "ABC-12" }) }
    );
    expect(forbidden.status).toBe(403);
  });

  it("POST /api/chat requires auth even when no campaignId is passed", async () => {
    const res = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Привет" }] }],
          apiKey: "sk-test-key-123456",
        }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/callback does not reflect query tokens into redirect hash", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/auth/callback?access_token=evil&refresh_token=evil2&next=/dashboard"
    );
    const res = await authCallbackGet(req);
    const location = res.headers.get("location") || "";
    expect(location).not.toContain("access_token=evil");
    expect(location).not.toContain("refresh_token=evil2");
  });
});
