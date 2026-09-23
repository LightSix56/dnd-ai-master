import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as createRoomPost } from "../create/route";
import { GET as getRoomGet } from "../[code]/route";
import { POST as joinRoomPost } from "../[code]/join/route";
import { GET as getUserCharactersGet } from "../user-characters/route";

// Mock Supabase Auth and DB calls
vi.mock("@/lib/supabase/client", () => {
  return {
    getAuthUserFromRequest: vi.fn(),
    getSupabaseAdminClient: vi.fn(),
    getSupabaseServerClient: vi.fn(),
  };
});

import { getAuthUserFromRequest, getSupabaseAdminClient } from "@/lib/supabase/client";

describe("Room API Routes (Phase 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/room/create", () => {
    it("returns 401 if user is not authenticated", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: null,
        error: "Unauthorized",
      });

      const req = new Request("http://localhost/api/room/create", {
        method: "POST",
        body: JSON.stringify({ name: "Новая комната", startingLevel: 1 }),
      });

      const res = await createRoomPost(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Unauthorized");
    });

    it("returns 400 if name is missing", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: { id: "user-123" } as any,
        error: null,
      });

      const req = new Request("http://localhost/api/room/create", {
        method: "POST",
        body: JSON.stringify({ name: "", startingLevel: 1 }),
      });

      const res = await createRoomPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("название");
    });

    it("creates room and returns 201 with room object", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: { id: "user-123" } as any,
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "room-id-1",
          code: "DRAGON-99",
          name: "Лобби Героев",
          host_user_id: "user-123",
          status: "lobby",
          starting_level: 1,
          max_level: 20,
          party_bond: "strangers",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      vi.mocked(getSupabaseAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
      } as any);

      const req = new Request("http://localhost/api/room/create", {
        method: "POST",
        body: JSON.stringify({ name: "Лобби Героев", startingLevel: 1 }),
      });

      const res = await createRoomPost(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.room.code).toBe("DRAGON-99");
      expect(json.room.startingLevel).toBe(1);
    });
  });

  describe("GET /api/room/[code]", () => {
    it("returns 404 if room not found", async () => {
      vi.mocked(getSupabaseAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
            }),
          }),
        }),
      } as any);

      const req = new Request("http://localhost/api/room/UNKNOWN-99");
      const res = await getRoomGet(req, { params: Promise.resolve({ code: "UNKNOWN-99" }) });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/room/user-characters", () => {
    it("returns compliant and nonCompliant characters filtered by startingLevel", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: { id: "user-123" } as any,
        error: null,
      });

      vi.mocked(getSupabaseAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: "c1", name: "Кроуг", data: { level: 1 } },
                  { id: "c2", name: "Морден", data: { level: 5 } },
                ],
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const req = new Request("http://localhost/api/room/user-characters?startingLevel=1");
      const res = await getUserCharactersGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.compliant).toHaveLength(1);
      expect(json.compliant[0].name).toBe("Кроуг");
      expect(json.nonCompliant).toHaveLength(1);
      expect(json.nonCompliant[0].name).toBe("Морден");
      expect(json.nonCompliant[0].reason).toContain("5 уровень");
    });
  });
});
