import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => {
  const getAuthUserFromRequestMock = vi.fn();
  const selectMock = vi.fn();
  const eqMock = vi.fn();
  const orderMock = vi.fn();

  const queryBuilder = {
    select: selectMock.mockReturnThis(),
    eq: eqMock.mockReturnThis(),
    order: orderMock,
  };

  const adminClient = {
    from: vi.fn(() => queryBuilder),
  };

  return {
    getAuthUserFromRequest: getAuthUserFromRequestMock,
    getSupabaseAdminClient: () => adminClient,
    __mocks: {
      getAuthUserFromRequestMock,
      selectMock,
      eqMock,
      orderMock,
      adminClient,
    },
  };
});

import { GET } from "../characters/route";

describe("GET /api/account/characters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if user is not authenticated", async () => {
    const { __mocks } = await import("@/lib/supabase/client") as any;
    __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
      user: null,
      error: "Отсутствует токен",
    });

    const req = new Request("http://localhost:3000/api/account/characters", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("returns mapped user characters when authenticated", async () => {
    const { __mocks } = await import("@/lib/supabase/client") as any;
    __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
      user: { id: "user-123", email: "hero@dnd.su" },
      error: null,
    });

    __mocks.orderMock.mockResolvedValueOnce({
      data: [
        {
          id: "char-1",
          name: "Элинора Райдер",
          portrait_url: null,
          data: {
            className: "Плут",
            race: "Кенку",
            level: 3,
            armorClass: 16,
            hpMax: 24,
            hpCurrent: 24,
          },
          created_at: "2026-09-11T15:25:08Z",
          updated_at: "2026-09-12T07:57:59Z",
        },
      ],
      error: null,
    });

    const req = new Request("http://localhost:3000/api/account/characters", {
      method: "GET",
      headers: { Authorization: "Bearer valid-token" },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.characters).toHaveLength(1);
    expect(json.characters[0].name).toBe("Элинора Райдер");
    expect(json.characters[0].race).toBe("Кенку");
    expect(json.characters[0].className).toBe("Плут");
    expect(json.characters[0].level).toBe(3);
    expect(json.characters[0].ac).toBe(16);
  });
});
