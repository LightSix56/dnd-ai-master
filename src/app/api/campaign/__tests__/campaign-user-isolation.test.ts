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
  const campaignFindFirstMock = vi.fn();
  const campaignFindUniqueMock = vi.fn();
  const campaignCreateMock = vi.fn();
  const campaignUpdateMock = vi.fn();
  const campaignUpdateManyMock = vi.fn();
  const campaignDeleteMock = vi.fn();

  return {
    db: {
      campaign: {
        findMany: campaignFindManyMock,
        findFirst: campaignFindFirstMock,
        findUnique: campaignFindUniqueMock,
        create: campaignCreateMock,
        update: campaignUpdateMock,
        updateMany: campaignUpdateManyMock,
        delete: campaignDeleteMock,
      },
    },
    __dbMocks: {
      campaignFindManyMock,
      campaignFindFirstMock,
      campaignFindUniqueMock,
      campaignCreateMock,
      campaignUpdateMock,
      campaignUpdateManyMock,
      campaignDeleteMock,
    },
  };
});

import { GET as getCampaignList } from "../list/route";
import { GET as getActiveCampaign } from "../active/route";
import { POST as activateCampaign } from "../activate/route";
import { POST as deleteCampaign } from "../delete/route";
import { POST as createCampaign, GET as getCampaignBase } from "../route";

describe("Campaign User Isolation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/campaign/list", () => {
    it("returns only campaigns belonging to authenticated user", async () => {
      const { __mocks } = await import("@/lib/supabase/client") as any;
      const { __dbMocks } = await import("@/lib/db") as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: { id: "user-alpha" },
        error: null,
      });

      __dbMocks.campaignFindManyMock.mockResolvedValueOnce([
        { id: "c1", name: "Alpha's Campaign", userId: "user-alpha" },
      ]);

      const req = new Request("http://localhost:3000/api/campaign/list", {
        headers: { Authorization: "Bearer valid-token" },
      });

      const res = await getCampaignList(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(__dbMocks.campaignFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-alpha" },
        })
      );
      expect(data.campaigns).toHaveLength(1);
      expect(data.campaigns[0].name).toBe("Alpha's Campaign");
    });

    it("returns unassigned/guest campaigns if user is unauthenticated", async () => {
      const { __mocks } = await import("@/lib/supabase/client") as any;
      const { __dbMocks } = await import("@/lib/db") as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: null,
        error: "No auth header",
      });

      __dbMocks.campaignFindManyMock.mockResolvedValueOnce([
        { id: "c-guest", name: "Guest Campaign", userId: null },
      ]);

      const req = new Request("http://localhost:3000/api/campaign/list");
      const res = await getCampaignList(req);
      expect(res.status).toBe(200);

      expect(__dbMocks.campaignFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: null },
        })
      );
    });
  });

  describe("GET /api/campaign/active", () => {
    it("returns active campaign specifically for the authenticated user", async () => {
      const { __mocks } = await import("@/lib/supabase/client") as any;
      const { __dbMocks } = await import("@/lib/db") as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: { id: "user-beta" },
        error: null,
      });

      __dbMocks.campaignFindFirstMock.mockResolvedValueOnce({
        id: "c-beta-active",
        name: "Beta Active Campaign",
        userId: "user-beta",
        isActive: true,
      });

      const req = new Request("http://localhost:3000/api/campaign/active", {
        headers: { Authorization: "Bearer beta-token" },
      });

      const res = await getActiveCampaign(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(__dbMocks.campaignFindFirstMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-beta", isActive: true },
        })
      );
      expect(data.campaign.id).toBe("c-beta-active");
    });
  });

  describe("POST /api/campaign", () => {
    it("assigns userId and only deactivates previous campaigns of the same user", async () => {
      const { __mocks } = await import("@/lib/supabase/client") as any;
      const { __dbMocks } = await import("@/lib/db") as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: { id: "user-gamma" },
        error: null,
      });

      __dbMocks.campaignCreateMock.mockResolvedValueOnce({
        id: "c-new-gamma",
        name: "Gamma New Campaign",
        userId: "user-gamma",
        isActive: true,
      });

      const req = new Request("http://localhost:3000/api/campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer gamma-token",
        },
        body: JSON.stringify({
          name: "Gamma New Campaign",
          makeActive: true,
        }),
      });

      const res = await createCampaign(req);
      expect(res.status).toBe(200);

      expect(__dbMocks.campaignUpdateManyMock).toHaveBeenCalledWith({
        where: { userId: "user-gamma", isActive: true },
        data: { isActive: false },
      });

      expect(__dbMocks.campaignCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-gamma",
            name: "Gamma New Campaign",
            isActive: true,
          }),
        })
      );
    });
  });

  describe("POST /api/campaign/activate", () => {
    it("deactivates user's previous campaigns and activates the chosen one", async () => {
      const { __mocks } = await import("@/lib/supabase/client") as any;
      const { __dbMocks } = await import("@/lib/db") as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: { id: "user-delta" },
        error: null,
      });

      __dbMocks.campaignFindUniqueMock.mockResolvedValueOnce({
        id: "c-delta-2",
        name: "Delta Campaign 2",
        userId: "user-delta",
      });

      __dbMocks.campaignUpdateMock.mockResolvedValueOnce({
        id: "c-delta-2",
        name: "Delta Campaign 2",
        userId: "user-delta",
        isActive: true,
      });

      const req = new Request("http://localhost:3000/api/campaign/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer delta-token",
        },
        body: JSON.stringify({ campaignId: "c-delta-2" }),
      });

      const res = await activateCampaign(req);
      expect(res.status).toBe(200);

      expect(__dbMocks.campaignUpdateManyMock).toHaveBeenCalledWith({
        where: { userId: "user-delta", isActive: true },
        data: { isActive: false },
      });

      expect(__dbMocks.campaignUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "c-delta-2" },
          data: { isActive: true },
        })
      );
    });

    it("rejects activating a campaign belonging to another user", async () => {
      const { __mocks } = await import("@/lib/supabase/client") as any;
      const { __dbMocks } = await import("@/lib/db") as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: { id: "user-intruder" },
        error: null,
      });

      __dbMocks.campaignFindUniqueMock.mockResolvedValueOnce({
        id: "c-victim",
        name: "Victim Campaign",
        userId: "user-victim",
      });

      const req = new Request("http://localhost:3000/api/campaign/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer intruder-token",
        },
        body: JSON.stringify({ campaignId: "c-victim" }),
      });

      const res = await activateCampaign(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/доступ запрещён/i);
    });
  });

  describe("POST /api/campaign/delete", () => {
    it("deletes user's own campaign and activates user's replacement if active", async () => {
      const { __mocks } = await import("@/lib/supabase/client") as any;
      const { __dbMocks } = await import("@/lib/db") as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: { id: "user-echo" },
        error: null,
      });

      __dbMocks.campaignFindUniqueMock.mockResolvedValueOnce({
        id: "c-echo-1",
        name: "Echo Campaign 1",
        userId: "user-echo",
        isActive: true,
      });

      __dbMocks.campaignDeleteMock.mockResolvedValueOnce({ id: "c-echo-1" });
      __dbMocks.campaignFindFirstMock.mockResolvedValueOnce({ id: "c-echo-2", userId: "user-echo" });

      const req = new Request("http://localhost:3000/api/campaign/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer echo-token",
        },
        body: JSON.stringify({ campaignId: "c-echo-1" }),
      });

      const res = await deleteCampaign(req);
      expect(res.status).toBe(200);

      expect(__dbMocks.campaignDeleteMock).toHaveBeenCalledWith({ where: { id: "c-echo-1" } });
      expect(__dbMocks.campaignFindFirstMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-echo" },
        })
      );
    });

    it("rejects deleting another user's campaign", async () => {
      const { __mocks } = await import("@/lib/supabase/client") as any;
      const { __dbMocks } = await import("@/lib/db") as any;

      __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({
        user: { id: "user-hacker" },
        error: null,
      });

      __dbMocks.campaignFindUniqueMock.mockResolvedValueOnce({
        id: "c-secure",
        name: "Secure Campaign",
        userId: "user-admin",
        isActive: false,
      });

      const req = new Request("http://localhost:3000/api/campaign/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer hacker-token",
        },
        body: JSON.stringify({ campaignId: "c-secure" }),
      });

      const res = await deleteCampaign(req);
      expect(res.status).toBe(403);
    });
  });
});
