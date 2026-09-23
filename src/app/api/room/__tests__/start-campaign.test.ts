import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../[code]/start-campaign/route";
import * as roomService from "@/lib/room/room-service";
import * as supabaseClient from "@/lib/supabase/client";

vi.mock("@/lib/room/room-service");
vi.mock("@/lib/supabase/client");

describe("POST /api/room/[code]/start-campaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests with 401", async () => {
    vi.spyOn(supabaseClient, "getAuthUserFromRequest").mockResolvedValue({
      user: null,
      error: "Требуется авторизация",
    });

    const request = new Request("http://localhost/api/room/DRAGON-42/start-campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Забытые катакомбы",
        setting: "Тёмное фэнтези",
        tone: "Мрачный",
        difficulty: "hard",
        startingSituation: "strangers",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ code: "DRAGON-42" }) });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Требуется авторизация");
  });

  it("returns 400 when required fields are missing", async () => {
    vi.spyOn(supabaseClient, "getAuthUserFromRequest").mockResolvedValue({
      user: {
        id: "host-1",
        email: "host@example.com",
      } as any,
      error: null,
    });

    const request = new Request("http://localhost/api/room/DRAGON-42/start-campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // missing title, setting, etc.
        difficulty: "hard",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ code: "DRAGON-42" }) });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("starts campaign successfully when host submits valid parameters", async () => {
    vi.spyOn(supabaseClient, "getAuthUserFromRequest").mockResolvedValue({
      user: {
        id: "host-1",
        email: "host@example.com",
      } as any,
      error: null,
    });

    vi.spyOn(roomService, "startRoomCampaign").mockResolvedValue({
      success: true,
      campaignId: "camp-123",
      room: {
        id: "room-1",
        code: "DRAGON-42",
        status: "in_progress",
        campaignId: "camp-123",
      } as any,
      arc: {
        title: "Забытые катакомбы",
        act: { name: "Акт 1: Пробуждение" },
      } as any,
    });

    const request = new Request("http://localhost/api/room/DRAGON-42/start-campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Забытые катакомбы",
        setting: "Тёмное фэнтези",
        tone: "Мрачный",
        difficulty: "hard",
        startingSituation: "captives_or_survivors",
        levelTo: 10,
        customDmNotes: "Склеп с нежитью",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ code: "DRAGON-42" }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.campaignId).toBe("camp-123");
    expect(roomService.startRoomCampaign).toHaveBeenCalledWith(
      "DRAGON-42",
      "host-1",
      expect.objectContaining({
        title: "Забытые катакомбы",
        setting: "Тёмное фэнтези",
        difficulty: "hard",
        startingSituation: "captives_or_survivors",
      }),
      expect.anything()
    );
  });
});
