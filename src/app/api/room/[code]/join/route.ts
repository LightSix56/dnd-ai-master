import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
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
    const characterSnapshot = body.characterSnapshot;
    const characterId = body.characterId || characterSnapshot?.id || `char_${Date.now()}`;

    if (!characterSnapshot) {
      return NextResponse.json(
        { error: "Необходимо передать characterSnapshot" },
        { status: 400 }
      );
    }

    const roomService = new RoomService();
    const room = await roomService.getRoomByCode(code);
    if (!room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }

    const isHost = room.hostUserId === user.id;
    const participant = await roomService.joinRoom({
      roomId: room.id,
      userId: user.id,
      characterId,
      characterSnapshot,
      isHost,
    });

    return NextResponse.json({ participant }, { status: 200 });
  } catch (err) {
    const msg = (err as Error).message || "Внутренняя ошибка при подключении";
    const status = msg.includes("требуется ровно") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
