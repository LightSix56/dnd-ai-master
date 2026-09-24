import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => {
  const generateLinkMock = vi.fn();
  return {
    getSupabaseAdminClient: () => ({
      auth: {
        admin: {
          generateLink: generateLinkMock,
        },
      },
    }),
    __mocks: { generateLinkMock },
  };
});

import { POST } from "../guest-login/route";

describe("POST /api/auth/guest-login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a guest magiclink token_hash without requiring user input", async () => {
    const { __mocks } = (await import("@/lib/supabase/client")) as any;
    __mocks.generateLinkMock.mockResolvedValueOnce({
      data: {
        properties: {
          hashed_token: "mock-guest-token-9999",
        },
      },
      error: null,
    });

    const req = new Request("http://localhost:3000/api/auth/guest-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.token_hash).toBe("mock-guest-token-9999");
    expect(json.email).toMatch(/guest_.*@guest\.dnd-master\.local/);
    expect(json.isGuest).toBe(true);
  });

  it("handles Supabase admin error gracefully", async () => {
    const { __mocks } = (await import("@/lib/supabase/client")) as any;
    __mocks.generateLinkMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Internal auth service failure" },
    });

    const req = new Request("http://localhost:3000/api/auth/guest-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal auth service failure");
  });
});
