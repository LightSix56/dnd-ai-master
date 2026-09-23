import { NextResponse } from "next/server";
import { generateText } from "ai";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "@/lib/room/room-service";
import { bundleTurnInputs } from "@/lib/room/turn-batcher";
import { createClient, type AuthMode } from "@/lib/ai/client";
import { resolveDmModel } from "@/lib/ai/models";
import { db } from "@/lib/db";

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
    let narrative = typeof body.dmResponse === "string" ? body.dmResponse.trim() : "";

    const prompt = bundleTurnInputs(activeTurn.playerInputs || {}, {
      roundNumber: activeTurn.roundNumber,
      gmWhisperDirective: body.gmWhisperDirective,
      afkCharacters: body.afkCharacters,
    });

    if (!narrative) {
      const cleanKey = (body.apiKey || process.env.AI_API_KEY || "").trim();
      if (cleanKey) {
        try {
          const client = createClient(cleanKey, body.authMode as AuthMode, body.baseURL);
          const aiModel = resolveDmModel(body.model);

          const partyList = (room.participants || [])
            .map((p) => {
              const s = p.characterSnapshot || {};
              return `- ${s.name || "Герой"} (${s.race || "Раса не указана"}, ${s.className || "Класс не указан"}, ${s.level || room.startingLevel} ур.)`;
            })
            .join("\n");

          const arc = room.storyArc as any;
          const act = arc?.act || arc?.acts?.[0];
          const actContext = act
            ? `\n### Сюжетный контекст Акта 1 («${act.name || "Акт 1"}», уровни ${act.levelFrom || room.startingLevel}-${act.levelTo || room.startingLevel + 2}):
- Главная цель отряда: ${act.goal || "Исследовать угрозу"}
- Краткое содержание: ${act.summary || ""}
- Кульминационная цель: ${act.climaxObjective || ""}
${act.personalHooks?.length ? `- Личные сюжетные зацепки героев:\n${act.personalHooks.map((h: any) => `  * ${h.characterName}: ${h.hook}`).join("\n")}` : ""}
${arc?.villains?.length ? `- Антагонисты на сцене:\n${arc.villains.map((v: any) => `  * ${v.name} (${v.role}): ${v.motivation}`).join("\n")}` : ""}`
            : "";

          const system = `Ты — опытный Dungeon Master (Ведущий) в настольной ролевой игре D&D 5-й редакции.
Ты ведёшь кооперативную кампанию для живого отряда игроков.

## КАМПАНИЯ: «${(room.campaignSettings as any)?.title || room.name}»
- Сеттинг: ${(room.campaignSettings as any)?.setting || "Фэнтези"}
- Тон: ${(room.campaignSettings as any)?.tone || "Героический"}
- Сложность боёв: ${(room.campaignSettings as any)?.difficulty || "normal"}
- Стартовый уровень: ${room.startingLevel} (максимальный уровень кампании: ${room.maxLevel})

## СОСТАВ ОТРЯДА:
${partyList || "- Герои приключения"}
${actContext}

## ПРАВИЛА И ПОВЕДЕНИЕ ВЕДУЩЕГО (D&D 5e):
1. **СВЯЗНОЕ ПОВЕСТВОВАНИЕ:**
   - Перед тобой одновременные действия всех участников партии в раунде ${activeTurn.roundNumber}.
   - Сплети их заявки в единую динамичную, кинематографичную сцену (2-4 содержательных абзаца).
   - Опиши последствия каждого действия, реакцию окружающего мира, врагов и NPC.
2. **ПРАВИЛА ОТДЫХА И ПОВЫШЕНИЯ УРОВНЯ (REST & LEVEL-UP RULES):**
   - **Запрет прокачки в бою:** персонажи категорически НЕ могут повышать уровень, изучать новые заклинания или восстанавливать базовые ячейки/хиты посреди тактической схватки.
   - **Условия повышения уровня:** повышение уровня происходит исключительно во время **продолжительного отдыха (Long Rest / сон не менее 8 часов)** в безопасном укрытии (лагерь с дозором, таверна, святилище) и с подтверждения Ведущего при достижении сюжетной вехи или порога опыта (XP).
   - Если герои завершают важную веху текущего Акта 1 или побеждают босса — отметь возможность отдыха и прокачки при следующем безопасном ночлеге.
3. **ТАЙНОЕ УКАЗАНИЕ ВЕДУЩЕГО (GM WHISPER):**
   - Если передана скрытая директива от Человека-Мастера, органично и скрытно интегрируй её в повествование как естественное событие мира, не упоминая игрокам сам факт шёпота.
4. **ФОРМАТ ЗАВЕРШЕНИЯ РАУНДА:**
   - Закончи описание новой изменившейся обстановкой и кратким вопросом к отряду: «Что вы делаете дальше?».
   - Отвечай на русском языке, образно, атмосферно, в аутентичном средневековом стиле D&D 5e.`;

          const { text } = await generateText({
            model: client.chat(aiModel),
            system,
            prompt,
            temperature: 0.7,
          });
          narrative = text.trim();
        } catch (aiErr: any) {
          console.error("[turn/resolve] AI call failed, fallback:", aiErr);
          narrative = `Мастер оценивает действия отряда в раунде ${activeTurn.roundNumber}...`;
        }
      } else {
        narrative = `Мастер оценивает действия отряда в раунде ${activeTurn.roundNumber}...`;
      }
    }

    const result = await roomService.resolveRoomTurn(room.id, narrative);

    if (room.campaignId) {
      try {
        await db.chatMessage.create({
          data: {
            campaignId: room.campaignId,
            role: "user",
            content: prompt,
            turn: activeTurn.roundNumber,
          },
        });
        await db.chatMessage.create({
          data: {
            campaignId: room.campaignId,
            role: "assistant",
            content: narrative,
            turn: activeTurn.roundNumber,
          },
        });
      } catch (dbErr) {
        console.warn("[turn/resolve] Failed to save chat messages in SQLite:", dbErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        completedTurn: result.completedTurn,
        nextTurn: result.nextTurn,
        dmResponse: narrative,
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
