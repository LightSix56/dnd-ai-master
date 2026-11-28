import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getAuthUserMock, campaignFindUniqueMock, combatFindUniqueMock, combatantFindUniqueMock, getActiveRoomMock } = vi.hoisted(() => ({
  getAuthUserMock: vi.fn(),
  campaignFindUniqueMock: vi.fn(),
  combatFindUniqueMock: vi.fn(),
  combatantFindUniqueMock: vi.fn(),
  getActiveRoomMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/client")>();
  return {
    ...actual,
    getAuthUserFromRequest: getAuthUserMock,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    campaign: { findUnique: campaignFindUniqueMock },
    combat: { findUnique: combatFindUniqueMock },
    combatant: { findUnique: combatantFindUniqueMock },
    character: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/room/room-service", () => ({
  RoomService: class {
    getActiveRoomByCampaignId = getActiveRoomMock;
  },
}));

import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { checkCampaignAccess, denyCombatAccess, resetCampaignAccessCaches } from "../campaign-access";
import { checkCombatControl, resetCombatAccessCaches } from "@/lib/room/combat-access";

describe("Fail-Closed Access Control", () => {
  const prevServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCampaignAccessCaches();
    resetCombatAccessCaches();
  });

  afterEach(() => {
    if (prevServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceKey;
  });

  it("getSupabaseAdminClient throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getSupabaseAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("checkCampaignAccess denies unauthenticated requests and ownerless/null campaigns", async () => {
    getAuthUserMock.mockResolvedValue({ user: null, error: "No auth" });
    const unauth = await checkCampaignAccess(new Request("http://localhost/api/test"), "camp-1");
    expect(unauth.ok).toBe(false);
    if (!unauth.ok) expect(unauth.status).toBe(401);

    getAuthUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const noCamp = await checkCampaignAccess(
      new Request("http://localhost/api/test", { headers: { Authorization: "Bearer tok-1" } }),
      null
    );
    expect(noCamp.ok).toBe(false);
    if (!noCamp.ok) expect(noCamp.status).toBe(403);

    campaignFindUniqueMock.mockResolvedValue({ userId: null });
    const ownerless = await checkCampaignAccess(
      new Request("http://localhost/api/test", { headers: { Authorization: "Bearer tok-2" } }),
      "camp-orphan"
    );
    expect(ownerless.ok).toBe(false);
    if (!ownerless.ok) expect(ownerless.status).toBe(403);
  });

  it("denyCombatAccess denies unauthenticated requests and combats without campaignId", async () => {
    getAuthUserMock.mockResolvedValue({ user: null, error: "No auth" });
    combatFindUniqueMock.mockResolvedValue({ campaignId: null });
    const resNoAuth = await denyCombatAccess(new Request("http://localhost/api/combat"), "combat-1");
    expect(resNoAuth).not.toBeNull();
    expect(resNoAuth!.status).toBe(401);

    getAuthUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    combatFindUniqueMock.mockResolvedValue({ campaignId: null });
    const resNoCamp = await denyCombatAccess(
      new Request("http://localhost/api/combat", { headers: { Authorization: "Bearer tok-1" } }),
      "combat-1"
    );
    expect(resNoCamp).not.toBeNull();
    expect(resNoCamp!.status).toBe(403);
  });

  it("checkCombatControl denies missing userId, errors, and non-host GM/admin combat actions", async () => {
    getAuthUserMock.mockResolvedValue({ user: null, error: "No auth" });
    const missingAuth = await checkCombatControl(
      new Request("http://localhost/api/combat/action"),
      "combat-1",
      "attack",
      { attackerId: "c1" }
    );
    expect(missingAuth).not.toBeNull();

    combatFindUniqueMock.mockResolvedValue({ campaignId: "camp-1" });
    getActiveRoomMock.mockResolvedValue({
      hostUserId: "host-1",
      participants: [{ userId: "guest-2", characterId: "sheet-2", character: { name: "B" } }],
    });

    const gmActionDenied = await checkCombatControl(
      new Request("http://localhost/api/combat/action"),
      "combat-1",
      "apply-damage",
      { combatantId: "c1", amount: 50 },
      { userId: "guest-2" }
    );
    expect(gmActionDenied).not.toBeNull();

    const deleteDenied = await checkCombatControl(
      new Request("http://localhost/api/combat/action"),
      "combat-1",
      "delete-combat",
      {},
      { userId: "guest-2" }
    );
    expect(deleteDenied).not.toBeNull();

    const hostAllowed = await checkCombatControl(
      new Request("http://localhost/api/combat/action"),
      "combat-1",
      "apply-damage",
      { combatantId: "c1", amount: 50 },
      { userId: "host-1" }
    );
    expect(hostAllowed).toBeNull();
  });
});
