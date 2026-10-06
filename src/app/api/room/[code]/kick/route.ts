import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService, RoomRuleError } from "@/lib/room/room-service";
import { invalidateCampaignAccess } from "@/lib/auth/campaign-access";

/** Ведущий исключает участника: body { participantId } */
export async function POST(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: authError || "Необходима авторизация" }, { status: 401 });
    }

    const params = await props.params;
    const code = params?.code?.trim();
    if (!code) {
      return NextResponse.json({ error: "Код комнаты не указан" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const participantId = typeof body.participantId === "string" ? body.participantId.trim() : "";
    if (!participantId) {
      return NextResponse.json({ error: "Не указан участник" }, { status: 400 });
    }

    const roomService = new RoomService();
    const room = await roomService.getRoomByCode(code);
    if (!room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }
    if (room.hostUserId !== user.id) {
      return NextResponse.json({ error: "Исключать игроков может только ведущий" }, { status: 403 });
    }

    await roomService.kickParticipant(room.id, user.id, participantId);
    if (room.campaignId) invalidateCampaignAccess(room.campaignId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const status = err instanceof RoomRuleError ? 409 : 500;
    if (status === 500) console.error("[API /api/room/[code]/kick] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка сервера" },
      { status }
    );
  }
}
