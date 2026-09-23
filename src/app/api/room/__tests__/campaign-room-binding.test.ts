import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as createRoomPost } from "../create/route";
import { GET as getCampaignRoomGet, DELETE as closeCampaignRoomDelete } from "../campaign/[campaignId]/route";

// Mock Supabase
vi.mock("@/lib/supabase/client", () => {
  return {
    getAuthUserFromRequest: vi.fn(),
    getSupabaseAdminClient: vi.fn(),
    getSupabaseServerClient: vi.fn(),
  };
});

import { getAuthUserFromRequest, getSupabaseAdminClient } from "@/lib/supabase/client";

describe("Campaign Room Binding API", () => {
  let mockRoomsDb: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoomsDb = [];

    // Mock Supabase admin client methods
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            insert: vi.fn((insertData: any) => {
              const row = {
                id: `room-${Date.now()}-${Math.random()}`,
                ...insertData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              mockRoomsDb.push(row);
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: row, error: null }),
                }),
              };
            }),
            select: vi.fn().mockReturnValue({
              filter: vi.fn((path: string, op: string, val: string) => {
                const filtered = mockRoomsDb.filter((r) => {
                  if (path === "campaign_settings->>campaignId" && op === "eq") {
                    return r.campaign_settings?.campaignId === val;
                  }
                  return true;
                });
                return {
                  neq: vi.fn((field: string, neqVal: string) => {
                    const nonArchived = filtered.filter((r) => r[field] !== neqVal);
                    return {
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          maybeSingle: vi.fn().mockResolvedValue({
                            data: nonArchived[0] || null,
                            error: null,
                          }),
                        }),
                      }),
                    };
                  }),
                };
              }),
            }),
            update: vi.fn((updateData: any) => {
              return {
                filter: vi.fn((path: string, op: string, val: string) => {
                  mockRoomsDb.forEach((r) => {
                    if (path === "campaign_settings->>campaignId" && op === "eq") {
                      if (r.campaign_settings?.campaignId === val) {
                        Object.assign(r, updateData);
                      }
                    }
                  });
                  return Promise.resolve({ error: null });
                }),
              };
            }),
          };
        }
        return {} as any;
      }),
    };

    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockAdmin as any);
  });

  it("creates a room for a campaign even without Supabase user session (local DM)", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
      user: null,
      error: "No token",
    });

    const req = new Request("http://localhost/api/room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: "camp-alpha-123",
        name: "Поход в Подземелье",
        startingLevel: 5,
      }),
    });

    const res = await createRoomPost(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.room).toBeDefined();
    expect(data.room.campaignId).toBe("camp-alpha-123");
    expect(data.room.startingLevel).toBe(5);
    expect(data.room.hostUserId).toBe("host_campaign_camp-alpha-123");
  });

  it("returns existing active room when called again for the same campaignId", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      user: null,
      error: "No token",
    });

    // 1. Create first time
    const req1 = new Request("http://localhost/api/room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: "camp-beta-456",
        name: "Осада замка",
        startingLevel: 3,
      }),
    });
    const res1 = await createRoomPost(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    const firstRoomCode = data1.room.code;

    // 2. Call create again for same campaign
    const req2 = new Request("http://localhost/api/room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: "camp-beta-456",
      }),
    });
    const res2 = await createRoomPost(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.room.code).toBe(firstRoomCode);
  });

  it("gets active room via GET /api/room/campaign/[campaignId]", async () => {
    // Seed a room for camp-gamma
    mockRoomsDb.push({
      id: "room-gamma",
      code: "GAM777",
      name: "Кампания Гамма",
      host_user_id: "host_gamma",
      status: "lobby",
      starting_level: 4,
      max_level: 20,
      party_bond: "strangers",
      campaign_settings: { campaignId: "camp-gamma-789" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const req = new Request("http://localhost/api/room/campaign/camp-gamma-789");
    const res = await getCampaignRoomGet(req, {
      params: Promise.resolve({ campaignId: "camp-gamma-789" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.room).toBeDefined();
    expect(data.room.code).toBe("GAM777");
  });

  it("closes room via DELETE /api/room/campaign/[campaignId]", async () => {
    mockRoomsDb.push({
      id: "room-delta",
      code: "DEL999",
      name: "Кампания Дельта",
      host_user_id: "host_delta",
      status: "lobby",
      starting_level: 1,
      max_level: 20,
      party_bond: "strangers",
      campaign_settings: { campaignId: "camp-delta-999" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const req = new Request("http://localhost/api/room/campaign/camp-delta-999", {
      method: "DELETE",
    });
    const res = await closeCampaignRoomDelete(req, {
      params: Promise.resolve({ campaignId: "camp-delta-999" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockRoomsDb[0].status).toBe("archived");
  });
});
