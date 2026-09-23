import { NextResponse } from "next/server";
import { RoomService } from "@/lib/room/room-service";

export async function GET(
  _request: Request,
  props: { params: Promise<{ code: string }> }
) {
  try {
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

    return NextResponse.json({ room }, { status: 200 });
  } catch (err) {
    console.error("[API /api/room/[code]] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
