import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService, RoomRuleError } from "@/lib/room/room-service";
import { calculateTurnReadiness, type PlayerTurnInput } from "@/lib/room/turn-batcher";
import { resolveActiveRoomTurnHelper } from "@/lib/room/resolve-turn-helper";

// Последний ход раунда запускает генерацию ответа мастера в этом же запросе —
// стандартного лимита времени функции на это может не хватить.
// Генерация раунда ограничена 240 с внутри помощника; запас нужен, чтобы функция успела
// сама вернуть раунд в ожидание, а не была оборвана платформой.
export const maxDuration = 300;

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

    // Модель ДМ задаёт ведущий и хранит комната, а не игрок, который отправил ход последним
    const roomDmModel = await roomService.pickRoomDmModel(room, user.id, body.model);

    const input: PlayerTurnInput = {
      userId: user.id,
      characterName: participant.character?.name || "Герой",
      className: participant.character?.className || undefined,
      actionText,
      submittedAt: Date.now(),
    };

    let turn;
    try {
      turn = await roomService.submitPlayerAction(room.id, user.id, input);
    } catch (submitErr) {
      // Нарушение правил раунда (уже ходил, мастер уже отвечает) — это не сбой сервера
      if (submitErr instanceof RoomRuleError) {
        return NextResponse.json({ error: submitErr.message }, { status: 409 });
      }
      throw submitErr;
    }

    const readiness = calculateTurnReadiness(room.participants || [], turn.playerInputs);
    if (readiness.isAllReady) {
      const locked = await roomService.lockTurnForResolving(turn.id);
      if (locked) {
        try {
          // Автоматический старт генерации мира
          const resolveResult = await resolveActiveRoomTurnHelper(room, turn, {
            apiKey: body.apiKey,
            model: roomDmModel,
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
          // Ход игрока уже записан. Мастер не ответил (нет ключа, сбой провайдера) —
          // раунд остаётся ждать: ведущий может повторить генерацию кнопкой завершения раунда.
          await roomService.unlockTurnFromResolving(turn.id);
          console.error("[API /api/room/[code]/turn POST] auto-resolve failed:", resolveErr);
          return NextResponse.json(
            {
              success: true,
              resolved: false,
              turn,
              readiness,
              resolveError: (resolveErr as Error)?.message || "Мастер не смог описать раунд",
            },
            { status: 200 }
          );
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
