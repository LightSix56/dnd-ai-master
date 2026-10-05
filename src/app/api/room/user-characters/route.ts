import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { filterUserCharactersForRoom } from "@/lib/room/validation";
import { RoomService } from "@/lib/room/room-service";
import { listUserSheets, SheetUnavailableError } from "@/lib/dnd/sheet-store";
import { sheetsForRoomPicker } from "@/lib/room/picker";

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: authError || "Необходима авторизация" }, { status: 401 });
    }

    const url = new URL(request.url);
    const startingLevelParam = url.searchParams.get("startingLevel");
    const startingLevel = startingLevelParam ? parseInt(startingLevelParam, 10) : 1;
    const validatedStartingLevel =
      Number.isFinite(startingLevel) && startingLevel >= 1 && startingLevel <= 20 ? startingLevel : 1;

    let campaignId: string | null = null;
    const roomCode = url.searchParams.get("roomCode");
    if (roomCode) {
      const room = await new RoomService().getRoomByCode(roomCode);
      campaignId = room?.campaignId ?? null;
    }

    const rows = sheetsForRoomPicker(await listUserSheets(user.id), campaignId);
    // Форма строки — как у сайта листа: { id, name, data, portrait_url, campaign_* }
    const characters = rows.map((r) => ({
      id: r.id,
      name: String(r.sheet.name || r.name),
      data: r.sheet,
      portrait_url: r.portraitUrl,
      campaign_id: r.campaignId,
      campaign_name: r.campaignName,
      source_character_id: r.sourceCharacterId,
    }));

    // Версия этой кампании подходит всегда: герой мог вырасти выше стартового уровня стола
    const versions = characters.filter((c) => c.campaign_id);
    const evaluated = filterUserCharactersForRoom(
      characters.filter((c) => !c.campaign_id),
      validatedStartingLevel
    );

    return NextResponse.json(
      {
        startingLevel: validatedStartingLevel,
        compliant: [...versions, ...evaluated.compliant],
        nonCompliant: evaluated.nonCompliant,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof SheetUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[API /api/room/user-characters] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
