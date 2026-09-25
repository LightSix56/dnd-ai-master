import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "@/lib/room/room-service";
import { calculateTurnReadiness, type PlayerTurnInput } from "@/lib/room/turn-batcher";
import { resolveActiveRoomTurnHelper } from "@/lib/room/resolve-turn-helper";

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

    const turn = await roomService.getActiveTurn(room.id);
    const readiness = turn
      ? calculateTurnReadiness(room.participants || [], turn.playerInputs)
      : null;
    return NextResponse.json({ turn, readiness }, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/room/[code]/turn GET] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

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
    const actionText = typeof body.actionText === "string" ? body.actionText.trim() : "";
    if (!actionText) {
      return NextResponse.json({ error: "Действие игрока не может быть пустым" }, { status: 400 });
    }

    const roomService = new RoomService();
    const room = await roomService.getRoomByCode(code);
    if (!room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }

    const participant = room.participants?.find((p) => p.userId === user.id);
    if (!participant) {
      return NextResponse.json(
        { error: "Вы не являетесь участником этой комнаты" },
        { status: 403 }
      );
    }

    const input: PlayerTurnInput = {
      userId: user.id,
      characterName: participant.characterSnapshot?.name || "Герой",
      className: participant.characterSnapshot?.className || undefined,
      actionText,
      submittedAt: Date.now(),
    };

    const turn = await roomService.submitPlayerAction(room.id, user.id, input);

    const readiness = calculateTurnReadiness(room.participants || [], turn.playerInputs);
    if (readiness.isAllReady) {
      const locked = await roomService.lockTurnForResolving(turn.id);
      if (locked) {
        try {
          // Автоматический старт генерации мира
          const resolveResult = await resolveActiveRoomTurnHelper(room, turn, {
            apiKey: body.apiKey,
            model: body.model,
            authMode: body.authMode,
            baseURL: body.baseURL,
            roomService,
          });
          return NextResponse.json(
            {
              success: true,
              resolved: true,
              dmResponse: resolveResult.dmResponse,
              completedTurn: resolveResult.completedTurn,
              nextTurn: resolveResult.nextTurn,
              stats: resolveResult.stats,
            },
            { status: 200 }
          );

        } catch (resolveErr) {
          await roomService.unlockTurnFromResolving(turn.id);
          throw resolveErr;
        }
      } else {
        // Другой параллельный запрос уже выполняет генерацию этого раунда
        return NextResponse.json(
          {
            success: true,
            resolved: false,
            resolving: true,
            turn: { ...turn, status: "resolving" },
            readiness,
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        resolved: false,
        turn,
        readiness,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[API /api/room/[code]/turn POST] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
