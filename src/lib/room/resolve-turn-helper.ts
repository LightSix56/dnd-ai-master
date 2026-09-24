import { generateText } from "ai";
import { bundleTurnInputs } from "./turn-batcher";
import { createClient, type AuthMode } from "@/lib/ai/client";
import { resolveDmModel } from "@/lib/ai/models";
import { db } from "@/lib/db";
import { RoomService } from "./room-service";
import type { Room, RoomParticipant, RoomTurn, RoomWithParticipants } from "./types";

export interface ResolveActiveRoomTurnOptions {
  dmResponse?: string;
  gmWhisperDirective?: string;
  afkCharacters?: Array<{ name: string; className?: string }>;
  apiKey?: string;
  model?: string;
  authMode?: string;
  baseURL?: string;
  roomService?: RoomService;
}

export interface ResolveActiveRoomTurnResult {
  completedTurn: RoomTurn;
  nextTurn: RoomTurn;
  dmResponse: string;
}

/**
 * Единая переиспользуемая функция резолвинга активного хода комнаты.
 * Используется как при авто-резолвинге (когда все участники готовы),
 * так и при ручном принудительном завершении раунда Человеком-ДМом.
 */
export async function resolveActiveRoomTurnHelper(
  room: Room | RoomWithParticipants,
  activeTurn: RoomTurn,
  options?: ResolveActiveRoomTurnOptions
): Promise<ResolveActiveRoomTurnResult> {
  const roomService = options?.roomService || new RoomService();

  let afkCharacters = options?.afkCharacters;
  if (!afkCharacters && "participants" in room && Array.isArray(room.participants)) {
    const activeParticipants = room.participants.filter(
      (p) => Boolean(p.characterSnapshot && ((p.characterSnapshot as any).name || (p.characterSnapshot as any).characterName))
    );
    const submittedUserIds = new Set(Object.keys(activeTurn.playerInputs || {}));
    const pending = activeParticipants.filter((p) => !submittedUserIds.has(p.userId));
    if (pending.length > 0) {
      afkCharacters = pending.map((p) => {
        const snap = p.characterSnapshot as any;
        return {
          name: snap?.name || snap?.characterName || "Герой",
          className: snap?.className || snap?.class,
        };
      });
    }
  }

  const prompt = bundleTurnInputs(activeTurn.playerInputs || {}, {
    roundNumber: activeTurn.roundNumber,
    gmWhisperDirective: options?.gmWhisperDirective,
    afkCharacters,
  });

  let narrative = typeof options?.dmResponse === "string" ? options.dmResponse.trim() : "";

  if (!narrative) {
    const cleanKey = (options?.apiKey || process.env.AI_API_KEY || "").trim();
    if (cleanKey) {
      try {
        const client = createClient(cleanKey, options?.authMode as AuthMode, options?.baseURL);
        const aiModel = resolveDmModel(options?.model);

        const participants: RoomParticipant[] =
          "participants" in room && Array.isArray(room.participants)
            ? room.participants
            : [];

        const partyList = participants
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
        console.error("[resolveActiveRoomTurnHelper] AI call failed, fallback:", aiErr);
        narrative = `Мастер оценивает действия отряда в раунде ${activeTurn.roundNumber}...`;
      }
    } else {
      narrative = `Мастер оценивает действия отряда в раунде ${activeTurn.roundNumber}...`;
    }
  }

  const result = await roomService.resolveRoomTurn(room.id, narrative);

  const campaignId = room.campaignId || (room.campaignSettings as any)?.campaignId;
  if (campaignId) {
    try {
      await db.chatMessage.create({
        data: {
          campaignId,
          role: "user",
          content: prompt,
          turn: activeTurn.roundNumber,
        },
      });
      await db.chatMessage.create({
        data: {
          campaignId,
          role: "assistant",
          content: narrative,
          turn: activeTurn.roundNumber,
        },
      });
    } catch (dbErr) {
      console.warn("[resolveActiveRoomTurnHelper] Failed to save chat messages in SQLite:", dbErr);
    }
  }

  return {
    completedTurn: result.completedTurn,
    nextTurn: result.nextTurn,
    dmResponse: narrative,
  };
}
