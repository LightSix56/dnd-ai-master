import { NextResponse } from "next/server";
import { getAuthUserFromRequest, getSupabaseAdminClient } from "@/lib/supabase/client";
import { RoomService } from "@/lib/room/room-service";

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
    const isReady = typeof body.isReady === "boolean" ? body.isReady : true;

    const roomService = new RoomService();
    const room = await roomService.getRoomByCode(code);
    if (!room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }

    const supabase = getSupabaseAdminClient();
    const { error: updateError } = await supabase
      .from("room_participants")
      .update({ is_ready: isReady })
      .eq("room_id", room.id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, isReady }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
