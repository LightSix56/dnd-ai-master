import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "@/lib/room/room-service";
import {
  PartyLeveledError,
  acknowledgePartyLevels,
  isCombatActive,
  loadLevelChanges,
} from "@/lib/room/party-leveled";
import { SheetUnavailableError } from "@/lib/dnd/sheet-store";

type RouteProps = { params: Promise<{ code: string }> };

/** Комната и её кампания — только для ведущего и участников этой комнаты */
async function resolveRoom(request: Request, props: RouteProps) {
  const { user, error: authError } = await getAuthUserFromRequest(request);
  if (!user) {
    return { fail: NextResponse.json({ error: authError || "Необходима авторизация" }, { status: 401 }) };
  }
  const code = (await props.params)?.code?.trim();
  if (!code) return { fail: NextResponse.json({ error: "Код комнаты не указан" }, { status: 400 }) };

  const roomService = new RoomService();
  const room = await roomService.getRoomByCode(code);
  if (!room) return { fail: NextResponse.json({ error: "Комната не найдена" }, { status: 404 }) };

  const isMember = room.hostUserId === user.id || room.participants.some((p) => p.userId === user.id);
  if (!isMember) {
    return { fail: NextResponse.json({ error: "Вы не участник этой комнаты" }, { status: 403 }) };
  }
  return { room, roomService };
}

/** Кто из героев вырос в уровне с момента, когда мастеру сообщали в последний раз */
export async function GET(request: Request, props: RouteProps) {
  try {
    const resolved = await resolveRoom(request, props);
    if (resolved.fail) return resolved.fail;
    const campaignId = resolved.room.campaignId;
    if (!campaignId) return NextResponse.json({ changes: [], combatActive: false });

    const [changes, combatActive] = await Promise.all([loadLevelChanges(campaignId), isCombatActive(campaignId)]);
    return NextResponse.json({ changes, combatActive });
  } catch (err) {
    if (err instanceof SheetUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[API party-leveled GET]", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

/** «Партия прокачалась»: сообщение мастеру в историю кампании и всем игрокам комнаты */
export async function POST(request: Request, props: RouteProps) {
  try {
    const resolved = await resolveRoom(request, props);
    if (resolved.fail) return resolved.fail;
    const { room, roomService } = resolved;
    if (!room.campaignId) {
      return NextResponse.json({ error: "Кампания ещё не начата." }, { status: 409 });
    }

    const result = await acknowledgePartyLevels(room.campaignId);
    await roomService.broadcastDmStream(room.id, { type: "party_leveled", note: result.note });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PartyLeveledError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof SheetUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[API party-leveled POST]", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
