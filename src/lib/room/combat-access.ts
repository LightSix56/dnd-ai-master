// Кто чьим бойцом управляет в бою сетевой комнаты (fail-closed).
//
// Правило:
//  - требуется валидный пользователь (userId);
//  - ведущий может всё;
//  - игрок комнаты не может действовать за героя другого игрока;
//  - административные/мастерские действия (урон/хил вручную, правка статов, удаление боя, карта)
//    в сетевой комнате доступны только ведущему (hostUserId);
//  - при ошибке проверки доступ запрещается.

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "./room-service";
import type { RoomWithParticipants } from "./types";

const USER_TTL_MS = 30_000;
const ROOM_TTL_MS = 5_000;
const userCache = new Map<string, { id: string | null; at: number }>();
const roomCache = new Map<string, { room: RoomWithParticipants | null; at: number }>();

/** Действия, совершаемые от лица конкретного бойца, и поле запроса с его id */
const ACTOR_FIELD: Record<string, string> = {
  "move-combatant": "combatantId",
  attack: "attackerId",
  "cast-spell": "casterId",
  "use-ability": "combatantId",
  "transform-wild-shape": "combatantId",
  "revert-wild-shape": "combatantId",
  dash: "combatantId",
  dodge: "combatantId",
  disengage: "combatantId",
  help: "combatantId",
  hide: "combatantId",
  shove: "combatantId",
  "stand-up": "combatantId",
  "drop-prone": "combatantId",
  "set-facing": "combatantId",
  teleport: "combatantId",
  "drink-potion": "combatantId",
  "use-potion": "combatantId",
  "death-save": "combatantId",
  "reaction-response": "combatantId",
};

/** Действия мастера/ведущего: в сетевой комнате доступны только hostUserId */
const HOST_ONLY_ACTIONS = new Set([
  "apply-damage",
  "apply-healing",
  "update-combatant",
  "update-resources",
  "reset-turn",
  "add-combatant",
  "remove-combatant",
  "add-party-member",
  "add-from-library",
  "add-element",
  "remove-element",
  "toggle-door",
  "resize-grid",
  "update-grid",
  "expand-grid-direction",
  "roll-initiative",
  "set-initiative",
  "reposition-combatant",
  "dm-move",
  "add-condition",
  "remove-condition",
  "end-combat",
  "delete-combat",
  "batch-actions",
  "ai-turn",
]);

export function actorIdForAction(action: string, body: Record<string, unknown>): string | null {
  const field = ACTOR_FIELD[action];
  if (!field) return null;
  const value = body[field];
  return typeof value === "string" && value ? value : null;
}

async function resolveUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("Authorization");
  if (!header) return null;
  const key = createHash("sha256").update(header).digest("hex");
  const cached = userCache.get(key);
  if (cached && Date.now() - cached.at < USER_TTL_MS) return cached.id;
  const { user } = await getAuthUserFromRequest(request);
  const id = user?.id ?? null;
  if (userCache.size > 2000) userCache.clear();
  userCache.set(key, { id, at: id ? Date.now() : Date.now() - USER_TTL_MS + 5_000 });
  return id;
}

async function resolveRoom(campaignId: string, roomService?: RoomService): Promise<RoomWithParticipants | null> {
  const cached = roomCache.get(campaignId);
  if (cached && Date.now() - cached.at < ROOM_TTL_MS) return cached.room;
  const room = await (roomService ?? new RoomService()).getActiveRoomByCampaignId(campaignId);
  if (roomCache.size > 500) roomCache.clear();
  roomCache.set(campaignId, { room, at: Date.now() });
  return room;
}

export interface CombatControlDeps {
  userId?: string | null;
  roomService?: RoomService;
}

/**
 * Возвращает текст отказа, если пользователь не вправе выполнить действие боя, иначе null.
 */
export async function checkCombatControl(
  request: Request,
  combatId: string,
  action: string,
  body: Record<string, unknown>,
  deps: CombatControlDeps = {}
): Promise<string | null> {
  try {
    const userId = deps.userId !== undefined ? deps.userId : await resolveUserId(request);
    if (!userId) {
      return "Требуется авторизация для управления боем.";
    }

    const isHostOnly = HOST_ONLY_ACTIONS.has(action);
    const actorId = actorIdForAction(action, body);
    if (!isHostOnly && !actorId) return null;

    const combat = await db.combat.findUnique({ where: { id: combatId }, select: { campaignId: true } });
    if (!combat?.campaignId) return null;

    const room = await resolveRoom(combat.campaignId, deps.roomService);
    if (!room) return null;
    if (room.hostUserId === userId) return null;

    const me = room.participants.find((p) => p.userId === userId);
    if (!me) return "Вы не являетесь участником комнаты этого боя.";

    if (isHostOnly) {
      return "Это действие доступно только ведущему комнаты.";
    }

    if (!actorId) return null;
    const actor = await db.combatant.findUnique({
      where: { id: actorId },
      select: { name: true, type: true, combatId: true, characterId: true },
    });
    if (!actor || actor.combatId !== combatId || actor.type !== "player") return null;

    let ownerSheetId: string | null = null;
    if (actor.characterId) {
      const hero = await db.character.findUnique({
        where: { id: actor.characterId },
        select: { sheetCharacterId: true },
      });
      ownerSheetId = hero?.sheetCharacterId ?? null;
    }
    const actorName = actor.name.trim().toLowerCase();
    const owner = ownerSheetId
      ? room.participants.find((p) => p.characterId === ownerSheetId)
      : room.participants.find(
          (p) => String(p.character?.name || "").trim().toLowerCase() === actorName
        );
    if (owner && owner.userId !== userId) {
      return `«${actor.name}» — персонаж другого игрока. Управлять им может только его владелец или ведущий.`;
    }
    return null;
  } catch (e) {
    console.warn("[combat-access] проверка отклонена из-за ошибки:", e);
    return "Не удалось проверить права управления боем.";
  }
}

/** Для тестов */
export function resetCombatAccessCaches(): void {
  userCache.clear();
  roomCache.clear();
}
