import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService, RoomRuleError } from "@/lib/room/room-service";

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

    // Клиент присылает только то, КЕМ играть: id листа либо данные для быстрого создания.
    // Сам лист сервер читает из базы — присланным из браузера данным о герое не доверяем.
    const body = await request.json().catch(() => ({}));
    const characterId = typeof body.characterId === "string" ? body.characterId.trim() : "";
    const create =
      body.create && typeof body.create === "object" && typeof body.create.name === "string"
        ? {
            name: String(body.create.name).slice(0, 80),
            race: typeof body.create.race === "string" ? body.create.race.slice(0, 60) : undefined,
            className: typeof body.create.className === "string" ? body.create.className.slice(0, 60) : undefined,
          }
        : undefined;

    if (!characterId && !create) {
      return NextResponse.json({ error: "Не выбран персонаж" }, { status: 400 });
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
      characterId: characterId || undefined,
      create,
      isHost,
    });

    return NextResponse.json({ participant }, { status: 200 });
  } catch (err) {
    const msg = (err as Error).message || "Внутренняя ошибка при подключении";
    const status = msg.includes("требуется ровно") ? 400 : err instanceof RoomRuleError ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
