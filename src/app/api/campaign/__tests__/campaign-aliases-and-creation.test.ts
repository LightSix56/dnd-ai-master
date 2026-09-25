import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase getAuthUserFromRequest
vi.mock("@/lib/supabase/client", () => {
  const getAuthUserFromRequestMock = vi.fn();
  return {
    getAuthUserFromRequest: getAuthUserFromRequestMock,
    __mocks: { getAuthUserFromRequestMock },
  };
});

// Mock db
vi.mock("@/lib/db", () => {
  const campaignFindManyMock = vi.fn();
  const campaignCreateMock = vi.fn();
  const campaignUpdateManyMock = vi.fn();

  return {
    db: {
      campaign: {
        findMany: campaignFindManyMock,
        create: campaignCreateMock,
        updateMany: campaignUpdateManyMock,
      },
    },
    __dbMocks: {
      campaignFindManyMock,
      campaignCreateMock,
      campaignUpdateManyMock,
    },
  };
});

import { POST as createCampaignAlias } from "../create/route";
import { GET as getAllCampaignsAlias } from "../all/route";
import { POST as createCampaignCanonical, GET as getCampaignCanonical } from "../route";

describe("Campaign Aliases & Creation Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/campaign/create (alias) & POST /api/campaign (canonical)", () => {
    it("POST /api/campaign/create returns JSON with created campaign", async () => {
      const { __mocks } = (await import("@/lib/supabase/client")) as any;
      const { __dbMocks } = (await import("@/lib/db")) as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: { id: "test-user-1" },
        error: null,
      });

      __dbMocks.campaignCreateMock.mockResolvedValueOnce({
        id: "camp-123",
        name: "Балдурс Гейт",
        userId: "test-user-1",
        startingLevel: 3,
        levelFrom: 3,
        levelTo: 7,
        setting: "Forgotten Realms",
      });

      const req = new Request("http://localhost:3000/api/campaign/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
        body: JSON.stringify({
          name: "Балдурс Гейт",
          startingLevel: 3,
        }),
      });

      const res = await createCampaignAlias(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");

      const json = await res.json();
      expect(json).toBeDefined();
      expect(json.campaign).toBeDefined();
      expect(json.campaign.id).toBe("camp-123");
      expect(json.campaign.name).toBe("Балдурс Гейт");
      expect(json.campaign.startingLevel).toBe(3);
    });

    it("POST /api/campaign returns JSON 400 when name is missing", async () => {
      const { __mocks } = (await import("@/lib/supabase/client")) as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: { id: "test-user-1" },
        error: null,
      });

      const req = new Request("http://localhost:3000/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      const res = await createCampaignCanonical(req);
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/json");

      const json = await res.json();
      expect(json.error).toBe("name is required");
    });
  });

  describe("GET /api/campaign/all (alias) & GET /api/campaign (canonical)", () => {
    it("GET /api/campaign/all returns JSON array of campaigns", async () => {
      const { __mocks } = (await import("@/lib/supabase/client")) as any;
      const { __dbMocks } = (await import("@/lib/db")) as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: { id: "test-user-2" },
        error: null,
      });

      __dbMocks.campaignFindManyMock.mockResolvedValueOnce([
        { id: "c1", name: "Кампания 1", userId: "test-user-2" },
        { id: "c2", name: "Кампания 2", userId: "test-user-2" },
      ]);

      const req = new Request("http://localhost:3000/api/campaign/all", {
        headers: { Authorization: "Bearer token-abc" },
      });

      const res = await getAllCampaignsAlias(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");

      const json = await res.json();
      expect(Array.isArray(json.campaigns)).toBe(true);
      expect(json.campaigns.length).toBe(2);
      expect(json.campaigns[0].name).toBe("Кампания 1");
    });
  });
});
