import { NextResponse } from "next/server";
import { RoomService } from "@/lib/room/room-service";
import { db } from "@/lib/db";

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

    const campaignId =
      room.campaignId ||
      (room.campaignSettings as any)?.campaignId ||
      (room as any).campaign_settings?.campaignId;

    let campaignCharacters: any[] = [];
    if (campaignId) {
      try {
        const chars = await db.character.findMany({
          where: { campaignId, type: "player" },
          orderBy: { createdAt: "asc" },
        });

        const participants = room.participants || [];
        campaignCharacters = chars.map((c) => {
          const assignedParticipant = participants.find(
            (p) =>
              p.characterId === c.id ||
              (p.characterSnapshot as any)?.id === c.id ||
              (p.characterSnapshot as any)?.name?.trim().toLowerCase() === c.name.trim().toLowerCase()
          );

          return {
            id: c.id,
            name: c.name,
            race: c.race || "Гуманоид",
            className: c.class || "Приключенец",
            subclass: c.subclass,
            level: c.level || room.startingLevel || 1,
            hpCurrent: c.hpCurrent,
            hpMax: c.hpMax,
            ac: c.ac,
            str: c.str,
            dex: c.dex,
            con: c.con,
            int: c.int,
            wis: c.wis,
            cha: c.cha,
            speed: c.speed,
            inventory: c.inventory,
            spells: c.spells,
            notes: c.notes,
            assignedTo: assignedParticipant
              ? {
                  userId: assignedParticipant.userId,
                  characterName: (assignedParticipant.characterSnapshot as any)?.name || c.name,
                }
              : null,
          };
        });
      } catch (dbErr) {
        console.warn("[API /api/room/[code]] Failed to query campaign characters:", dbErr);
      }
    }

    return NextResponse.json(
      {
        room,
        participants: room.participants || [],
        campaignCharacters,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[API /api/room/[code]] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
