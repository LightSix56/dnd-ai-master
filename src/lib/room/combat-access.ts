// Кто чьим бойцом управляет в бою сетевой комнаты.
//
// Правило намеренно узкое: игрок комнаты не может действовать за героя ДРУГОГО игрока.
// Ведущий может всё; враги, спутники и NPC не закреплены ни за кем (их ходы запускает
// любой клиент); бой вне комнаты и запросы без токена не ограничиваются. Это защита от
// случайного и намеренного «хода за товарища», а не полноценное разграничение прав:
// клиент, не приславший токен, по-прежнему проходит.

import { db } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "./room-service";
import type { RoomWithParticipants } from "./types";

const USER_TTL_MS = 60_000;
const ROOM_TTL_MS = 15_000;
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
};

export function actorIdForAction(action: string, body: Record<string, unknown>): string | null {
  const field = ACTOR_FIELD[action];
  if (!field) return null;
  const value = body[field];
  return typeof value === "string" && value ? value : null;
}

async function resolveUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("Authorization");
  if (!header) return null;
  const cached = userCache.get(header);
  if (cached && Date.now() - cached.at < USER_TTL_MS) return cached.id;
  const { user } = await getAuthUserFromRequest(request);
  const id = user?.id ?? null;
  if (userCache.size > 2000) userCache.clear();
  userCache.set(header, { id, at: Date.now() });
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
 * Возвращает текст отказа, если этот игрок не вправе управлять бойцом, иначе null.
 * Любой сбой проверки трактуется как «разрешено»: бой не должен останавливаться из-за неё.
 */
export async function checkCombatControl(
  request: Request,
  combatId: string,
  action: string,
  body: Record<string, unknown>,
  deps: CombatControlDeps = {}
): Promise<string | null> {
  try {
    const actorId = actorIdForAction(action, body);
    if (!actorId) return null;

    const userId = deps.userId !== undefined ? deps.userId : await resolveUserId(request);
    if (!userId) return null;

    const actor = await db.combatant.findUnique({
      where: { id: actorId },
      select: { name: true, type: true, combatId: true },
    });
    if (!actor || actor.combatId !== combatId || actor.type !== "player") return null;

    const combat = await db.combat.findUnique({ where: { id: combatId }, select: { campaignId: true } });
    if (!combat?.campaignId) return null;

    const room = await resolveRoom(combat.campaignId, deps.roomService);
    if (!room) return null;
    if (room.hostUserId === userId) return null;

    const me = room.participants.find((p) => p.userId === userId);
    if (!me) return null;

    const actorName = actor.name.trim().toLowerCase();
    const owner = room.participants.find(
      (p) => String((p.characterSnapshot as { name?: string } | null)?.name || "").trim().toLowerCase() === actorName
    );
    if (owner && owner.userId !== userId) {
      return `«${actor.name}» — персонаж другого игрока. Управлять им может только его владелец или ведущий.`;
    }
    return null;
  } catch (e) {
    console.warn("[combat-access] проверка пропущена из-за ошибки:", e);
    return null;
  }
}

/** Для тестов */
export function resetCombatAccessCaches(): void {
  userCache.clear();
  roomCache.clear();
}
