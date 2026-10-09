import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "@/lib/room/room-service";
import { resolveActiveRoomTurnHelper } from "@/lib/room/resolve-turn-helper";
import { calculateTurnReadiness } from "@/lib/room/turn-batcher";

// Генерация раунда ограничена 240 с внутри помощника; запас нужен, чтобы функция успела
// сама вернуть раунд в ожидание, а не была оборвана платформой.
export const maxDuration = 300;

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

    // Досрочно завершить раунд может только ведущий. Но если все заявки уже поданы, а мастер
    // так и не ответил (функция оборвалась), запустить генерацию заново вправе любой участник:
    // иначе раунд зависает, когда ведущий отошёл.
    const isHost = room.hostUserId === user.id;
    const notHostError = NextResponse.json(
      { error: "Только Ведущий (Host) может завершить раунд" },
      { status: 403 }
    );
    if (!isHost && !room.participants?.some((p) => p.userId === user.id)) {
      return notHostError;
    }

    const activeTurn = await roomService.getActiveTurn(room.id);
    if (!activeTurn) {
      return NextResponse.json({ error: "Нет активного раунда" }, { status: 404 });
    }

    if (!isHost) {
      const readiness = calculateTurnReadiness(room.participants || [], activeTurn.playerInputs);
      if (!readiness.isAllReady) return notHostError;
    }

    const body = await request.json().catch(() => ({}));

    // Модель ДМ задаёт ведущий и хранит комната; модель из запроса другого игрока не используем
    const roomDmModel = await roomService.pickRoomModel(room, user.id, "dmModel", body.model);
    const roomCheapModel = await roomService.pickRoomModel(room, user.id, "cheapModel", body.cheapModel);

    const locked = await roomService.lockTurnForResolving(activeTurn.id);
    if (!locked) {
      return NextResponse.json(
        { error: "Раунд уже находится в процессе обработки ИИ-Мастером" },
        { status: 409 }
      );
    }

    const wantsStream =
      Boolean(body.stream) ||
      request.headers.get("accept")?.includes("text/event-stream") ||
      new URL(request.url).searchParams.get("stream") === "true";

    if (wantsStream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const sendEvent = (data: any) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            sendEvent({ type: "status", status: "🎲 Мастер оценивает действия отряда..." });

            const result = await resolveActiveRoomTurnHelper(room, activeTurn, {
              dmResponse: body.dmResponse,
              gmWhisperDirective: body.gmWhisperDirective,
              afkCharacters: body.afkCharacters,
              apiKey: body.apiKey,
              model: roomDmModel,
              cheapModel: roomCheapModel,
              authMode: body.authMode,
              baseURL: body.baseURL,
              roomService,
              onStatus: (status) => sendEvent({ type: "status", status }),
              onChunk: (delta, fullText) => sendEvent({ type: "chunk", delta, fullText }),
            });

            sendEvent({
              type: "finish",
              completedTurn: result.completedTurn,
              nextTurn: result.nextTurn,
              dmResponse: result.dmResponse,
              stats: result.stats,
            });
            controller.close();
          } catch (streamErr: any) {
            await roomService.unlockTurnFromResolving(activeTurn.id).catch(() => {});
            sendEvent({
              type: "error",
              error: streamErr?.message || "Ошибка генерации хода",
            });
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    let result;
    try {
      result = await resolveActiveRoomTurnHelper(room, activeTurn, {
        dmResponse: body.dmResponse,
        gmWhisperDirective: body.gmWhisperDirective,
        afkCharacters: body.afkCharacters,
        apiKey: body.apiKey,
        model: roomDmModel,
        cheapModel: roomCheapModel,
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
