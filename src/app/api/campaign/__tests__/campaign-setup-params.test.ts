import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => {
  const getAuthUserFromRequestMock = vi.fn();
  return {
    getAuthUserFromRequest: getAuthUserFromRequestMock,
    __mocks: { getAuthUserFromRequestMock },
  };
});

vi.mock("@/lib/auth/campaign-access", () => ({
  denyCampaignAccess: vi.fn(async () => null),
}));

vi.mock("@/lib/db", () => {
  const campaignFindUniqueMock = vi.fn();
  const campaignCreateMock = vi.fn();
  const campaignUpdateMock = vi.fn();
  const campaignUpdateManyMock = vi.fn();
  return {
    db: {
      campaign: {
        findUnique: campaignFindUniqueMock,
        create: campaignCreateMock,
        update: campaignUpdateMock,
        updateMany: campaignUpdateManyMock,
      },
    },
    __dbMocks: {
      campaignFindUniqueMock,
      campaignCreateMock,
      campaignUpdateMock,
      campaignUpdateManyMock,
    },
  };
});

import { POST as createCampaign, PATCH as patchCampaign } from "../route";

describe("Campaign setup parameters API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST saves every setup parameter in normalized form", async () => {
    const { __mocks } = (await import("@/lib/supabase/client")) as any;
    const { __dbMocks } = (await import("@/lib/db")) as any;

    __mocks.getAuthUserFromRequestMock.mockResolvedValueOnce({ user: { id: "user-setup" }, error: null });
    __dbMocks.campaignCreateMock.mockResolvedValueOnce({ id: "c-new" });

    const req = new Request("http://localhost:3000/api/campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({
        name: "Т",
        tone: "Мрачный и напряженный",
        difficulty: "deadly",
        startingSituation: "patron_contract",
        levelTo: 12,
        dmStyle: "tactical",
        partyTies: "friends",
        customDmNotes: "  склеп  ",
      }),
    });

    const res = await createCampaign(req);
    expect(res.status).toBe(200);
    expect(__dbMocks.campaignCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tone: "dark",
        difficulty: "brutal",
        startingSituation: "patron_contract",
        levelTo: 12,
        dmStyle: "tactical",
        partyTies: "friends",
        customDmNotes: "склеп",
      }),
    });
  });

  it("PATCH with one field does not reset the other setup fields", async () => {
    const { __dbMocks } = (await import("@/lib/db")) as any;
    __dbMocks.campaignFindUniqueMock.mockResolvedValueOnce({ id: "c1", levelFrom: 3 });
    __dbMocks.campaignUpdateMock.mockResolvedValueOnce({ id: "c1" });

    const req = new Request("http://localhost:3000/api/campaign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "c1", tone: "heroic" }),
    });

    await patchCampaign(req);
    const data = __dbMocks.campaignUpdateMock.mock.calls[0][0].data;
    expect(data).toHaveProperty("tone", "heroic");
    for (const key of ["dmStyle", "partyTies", "startingSituation", "levelTo", "difficulty", "setting"]) {
      expect(data).not.toHaveProperty(key);
    }
  });

  it("PATCH clamps levelTo to 20 using the campaign's own starting level", async () => {
    const { __dbMocks } = (await import("@/lib/db")) as any;
    __dbMocks.campaignFindUniqueMock.mockResolvedValueOnce({ id: "c1", levelFrom: 3 });
    __dbMocks.campaignUpdateMock.mockResolvedValueOnce({ id: "c1" });

    const req = new Request("http://localhost:3000/api/campaign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "c1", levelTo: 50 }),
    });

    await patchCampaign(req);
    expect(__dbMocks.campaignUpdateMock.mock.calls[0][0].data.levelTo).toBe(20);
  });
});
