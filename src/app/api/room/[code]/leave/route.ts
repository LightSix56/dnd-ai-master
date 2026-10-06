import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService, RoomRuleError } from "@/lib/room/room-service";
import { invalidateCampaignAccess } from "@/lib/auth/campaign-access";

/**
 * Выход из комнаты. Игрок уходит один; ведущий закрывает комнату для всех.
 * Ответ: { closed } — true, если комната закрыта (вышел ведущий).
 */
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

    const roomService = new RoomService();
    const room = await roomService.getRoomByCode(code);
    if (!room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }

    const { closed } = await roomService.leaveRoom(room.id, user.id);
    // Закрытая комната или ушедший игрок больше не дают доступа к кампании
    if (room.campaignId) invalidateCampaignAccess(room.campaignId);

    return NextResponse.json({ success: true, closed }, { status: 200 });
  } catch (err) {
    const status = err instanceof RoomRuleError ? 409 : 500;
    if (status === 500) console.error("[API /api/room/[code]/leave] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка сервера" },
      { status }
    );
  }
}
