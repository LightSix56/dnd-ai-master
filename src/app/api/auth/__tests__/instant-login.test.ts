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

import { POST } from "../instant-login/route";

describe("POST /api/auth/instant-login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if email is missing or empty", async () => {
    const req = new Request("http://localhost:3000/api/auth/instant-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it("generates a magiclink token_hash for a valid email", async () => {
    const { __mocks } = await import("@/lib/supabase/client") as any;
    __mocks.generateLinkMock.mockResolvedValueOnce({
      data: {
        properties: {
          hashed_token: "mock-hashed-token-12345",
        },
      },
      error: null,
    });

    const req = new Request("http://localhost:3000/api/auth/instant-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "kuks081180@gmail.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.token_hash).toBe("mock-hashed-token-12345");
    expect(json.email).toBe("kuks081180@gmail.com");
  });

  it("returns 500 when Supabase admin fails", async () => {
    const { __mocks } = await import("@/lib/supabase/client") as any;
    __mocks.generateLinkMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Supabase rate limit or user error" },
    });

    const req = new Request("http://localhost:3000/api/auth/instant-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "kuks081180@gmail.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Supabase rate limit or user error");
  });
});
