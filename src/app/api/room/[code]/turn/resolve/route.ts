import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "@/lib/room/room-service";
import { resolveActiveRoomTurnHelper } from "@/lib/room/resolve-turn-helper";

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

    if (room.hostUserId !== user.id) {
      return NextResponse.json(
        { error: "Только Ведущий (Host) может завершить раунд" },
        { status: 403 }
      );
    }

    const activeTurn = await roomService.getActiveTurn(room.id);
    if (!activeTurn) {
      return NextResponse.json({ error: "Нет активного раунда" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    const locked = await roomService.lockTurnForResolving(activeTurn.id);
    if (!locked) {
      return NextResponse.json(
        { error: "Раунд уже находится в процессе обработки ИИ-Мастером" },
        { status: 409 }
      );
    }

    let result;
    try {
      result = await resolveActiveRoomTurnHelper(room, activeTurn, {
        dmResponse: body.dmResponse,
        gmWhisperDirective: body.gmWhisperDirective,
        afkCharacters: body.afkCharacters,
        apiKey: body.apiKey,
        model: body.model,
        authMode: body.authMode,
        baseURL: body.baseURL,
        roomService,
      });
    } catch (resolveErr) {
      await roomService.unlockTurnFromResolving(activeTurn.id);
      throw resolveErr;
    }

    return NextResponse.json(
      {
        success: true,
        completedTurn: result.completedTurn,
        nextTurn: result.nextTurn,
        dmResponse: result.dmResponse,
        stats: result.stats,
      },
      { status: 200 }
    );

  } catch (err: any) {
    console.error("[API /api/room/[code]/turn/resolve POST] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
