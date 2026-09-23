import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "@/lib/room/room-service";
import type { PartyBond } from "@/lib/room/types";

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthUserFromRequest(request);
    const body = await request.json().catch(() => ({}));

    const campaignId =
      typeof body.campaignId === "string" && body.campaignId.trim()
        ? body.campaignId.trim()
        : undefined;

    const hostUserId =
      user?.id ||
      (typeof body.hostUserId === "string" && body.hostUserId.trim()
        ? body.hostUserId.trim()
        : campaignId
        ? `host_campaign_${campaignId}`
        : null);

    if (!hostUserId) {
      return NextResponse.json(
        { error: authError || "Необходима авторизация или привязка к кампании" },
        { status: 401 }
      );
    }

    if (typeof body.name === "string" && !body.name.trim()) {
      return NextResponse.json({ error: "Необходимо указать название комнаты" }, { status: 400 });
    }

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "Поход искателей приключений";

    const startingLevel =
      typeof body.startingLevel === "number" && Number.isFinite(body.startingLevel)
        ? Math.max(1, Math.min(20, Math.floor(body.startingLevel)))
        : 1;

    const maxLevel =
      typeof body.maxLevel === "number" && Number.isFinite(body.maxLevel)
        ? Math.max(startingLevel, Math.min(20, Math.floor(body.maxLevel)))
        : 20;

    const partyBond: PartyBond = body.partyBond === "established" ? "established" : "strangers";

    const roomService = new RoomService();

    // Если для этой кампании уже есть активная комната, возвращаем её
    if (campaignId) {
      const existing = await roomService.getActiveRoomByCampaignId(campaignId);
      if (existing) {
        return NextResponse.json({ room: existing }, { status: 200 });
      }
    }

    const room = await roomService.createRoom(hostUserId, {
      name,
      startingLevel,
      maxLevel,
      partyBond,
      campaignId,
      campaignSettings: typeof body.campaignSettings === "object" ? body.campaignSettings : {},
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (err) {
    console.error("[API /api/room/create] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка при создании комнаты" },
      { status: 500 }
    );
  }
}
