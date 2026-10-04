// Доступ к кампании: владелец, участник комнаты, посторонний, гость без входа.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock, authMock, roomMock } = vi.hoisted(() => ({
  dbMock: {
    campaign: { findUnique: vi.fn() },
    combat: { findUnique: vi.fn() },
  },
  authMock: vi.fn(),
  roomMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseAdminClient: vi.fn(() => ({})),
  getAuthUserFromRequest: authMock,
}));
vi.mock("@/lib/room/room-service", () => ({
  RoomService: class {
    getActiveRoomByCampaignId = roomMock;
  },
}));

import {
  checkCampaignAccess,
  denyCampaignAccess,
  denyCombatAccess,
  resetCampaignAccessCaches,
} from "../campaign-access";

function req(token?: string) {
  return new Request("http://localhost/api/x", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  resetCampaignAccessCaches();
  dbMock.campaign.findUnique.mockReset();
  dbMock.combat.findUnique.mockReset();
  roomMock.mockReset();
  authMock.mockReset();
  authMock.mockImplementation(async (r: Request) => {
    const t = r.headers.get("Authorization")?.replace("Bearer ", "");
    return t ? { user: { id: t }, error: null } : { user: null, error: "no" };
  });
});

describe("checkCampaignAccess", () => {
  it("владелец проходит", async () => {
    dbMock.campaign.findUnique.mockResolvedValue({ userId: "owner" });
    const res = await checkCampaignAccess(req("owner"), "c1");
    expect(res.ok).toBe(true);
    expect(roomMock).not.toHaveBeenCalled();
  });

  it("гость без входа получает 401 на чужую кампанию", async () => {
    dbMock.campaign.findUnique.mockResolvedValue({ userId: "owner" });
    const res = await checkCampaignAccess(req(), "c1");
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it("посторонний вошедший пользователь получает 403", async () => {
    dbMock.campaign.findUnique.mockResolvedValue({ userId: "owner" });
    roomMock.mockResolvedValue(null);
    const res = await checkCampaignAccess(req("stranger"), "c1");
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("участник и ведущий комнаты кампании проходят", async () => {
    dbMock.campaign.findUnique.mockResolvedValue({ userId: "owner" });
    roomMock.mockResolvedValue({ hostUserId: "host", participants: [{ userId: "player" }] });
    expect((await checkCampaignAccess(req("player"), "c1")).ok).toBe(true);
    expect((await checkCampaignAccess(req("host"), "c1")).ok).toBe(true);
    expect((await checkCampaignAccess(req("other"), "c1")).ok).toBe(false);
  });

  it("только что вошедший в комнату игрок не упирается в устаревший кэш состава", async () => {
    dbMock.campaign.findUnique.mockResolvedValue({ userId: "owner" });
    roomMock.mockResolvedValueOnce({ hostUserId: "host", participants: [] });
    expect((await checkCampaignAccess(req("late"), "c1")).ok).toBe(false);
    roomMock.mockResolvedValue({ hostUserId: "host", participants: [{ userId: "late" }] });
    expect((await checkCampaignAccess(req("late"), "c1")).ok).toBe(true);
  });

  it("кампания без владельца и несуществующая кампания не блокируются", async () => {
    dbMock.campaign.findUnique.mockResolvedValueOnce({ userId: null });
    expect((await checkCampaignAccess(req(), "legacy")).ok).toBe(true);
    dbMock.campaign.findUnique.mockResolvedValueOnce(null);
    expect((await checkCampaignAccess(req(), "missing")).ok).toBe(true);
  });

  it("сбой проверки комнаты не открывает доступ постороннему", async () => {
    dbMock.campaign.findUnique.mockResolvedValue({ userId: "owner" });
    roomMock.mockRejectedValue(new Error("supabase down"));
    const res = await checkCampaignAccess(req("stranger"), "c1");
    expect(res).toMatchObject({ ok: false, status: 403 });
  });
});

describe("denyCampaignAccess / denyCombatAccess", () => {
  it("возвращает готовый ответ с кодом отказа", async () => {
    dbMock.campaign.findUnique.mockResolvedValue({ userId: "owner" });
    const res = await denyCampaignAccess(req(), "c1");
    expect(res?.status).toBe(401);
    expect(await denyCampaignAccess(req("owner"), "c1")).toBeNull();
  });

  it("бой наследует доступ своей кампании", async () => {
    dbMock.combat.findUnique.mockResolvedValue({ campaignId: "c1" });
    dbMock.campaign.findUnique.mockResolvedValue({ userId: "owner" });
    roomMock.mockResolvedValue(null);
    expect((await denyCombatAccess(req("stranger"), "b1"))?.status).toBe(403);
    expect(await denyCombatAccess(req("owner"), "b1")).toBeNull();
  });

  it("бой без кампании (арена) и несуществующий бой не блокируются", async () => {
    dbMock.combat.findUnique.mockResolvedValueOnce({ campaignId: null });
    expect(await denyCombatAccess(req(), "arena")).toBeNull();
    dbMock.combat.findUnique.mockResolvedValueOnce(null);
    expect(await denyCombatAccess(req(), "missing")).toBeNull();
  });
});
