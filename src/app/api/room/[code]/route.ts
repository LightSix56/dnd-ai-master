import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "@/lib/room/room-service";
import { db } from "@/lib/db";

export async function GET(
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

    const participants = room.participants || [];
    const isMember =
      room.hostUserId === user.id || participants.some((p) => p.userId === user.id);

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

        campaignCharacters = chars.map((c) => {
          // Герой занят, если его лист выбран участником комнаты
          const assignedParticipant = c.sheetCharacterId
            ? participants.find((p) => p.characterId === c.sheetCharacterId)
            : undefined;

          if (!isMember) {
            return {
              id: c.id,
              name: c.name,
              race: c.race || "Гуманоид",
              className: c.class || "Приключенец",
              subclass: c.subclass,
              level: c.level || room.startingLevel || 1,
              assignedTo: assignedParticipant
                ? {
                    userId: assignedParticipant.userId,
                    characterName: c.name,
                  }
                : null,
            };
          }

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
            sheetCharacterId: c.sheetCharacterId,
            assignedTo: assignedParticipant
              ? {
                  userId: assignedParticipant.userId,
                  characterName: c.name,
                }
              : null,
          };
        });
      } catch (dbErr) {
        console.warn("[API /api/room/[code]] Failed to query campaign characters:", dbErr);
      }
    }

    const safeRoom = isMember
      ? room
      : {
          ...room,
          storyArc: undefined,
        };

    return NextResponse.json(
      {
        room: safeRoom,
        participants,
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
