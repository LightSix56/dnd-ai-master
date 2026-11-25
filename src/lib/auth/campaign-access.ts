// Кто имеет доступ к кампании и бою (строгий fail-closed режим).
//
// Правило:
//  - без валидной авторизации доступ запрещён (401);
//  - владелец кампании (Campaign.userId === userId) — всегда;
//  - участник или ведущий активной сетевой комнаты, привязанной к кампании;
//  - кампании без владельца (userId = null) и бои без campaignId не открываются посторонним (403).

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "@/lib/room/room-service";

const USER_TTL_MS = 30_000;
const OWNER_TTL_MS = 10_000;
const ROOM_TTL_MS = 5_000;
const COMBAT_TTL_MS = 60_000;

const userCache = new Map<string, { id: string | null; at: number }>();
const ownerCache = new Map<string, { exists: boolean; userId: string | null; at: number }>();
const roomCache = new Map<string, { members: string[]; at: number }>();
const combatCache = new Map<string, { campaignId: string | null; at: number }>();

export const AUTH_REQUIRED_MESSAGE = "Войдите в аккаунт, чтобы продолжить.";
export const FORBIDDEN_MESSAGE = "Доступ запрещён: это кампания другого пользователя.";

function hashAuthHeader(header: string): string {
  return createHash("sha256").update(header).digest("hex");
}

/** id пользователя из заголовка Authorization (с коротким кэшем по SHA-256 хэшу) */
export async function getRequestUserId(request: Request): Promise<string | null> {
  const header = request.headers?.get("Authorization");
  if (!header) return null;
  const cacheKey = hashAuthHeader(header);
  const cached = userCache.get(cacheKey);
  if (cached && Date.now() - cached.at < USER_TTL_MS) return cached.id;
  let id: string | null = null;
  try {
    const { user } = await getAuthUserFromRequest(request);
    id = user?.id ?? null;
  } catch {
    id = null;
  }
  if (userCache.size > 2000) userCache.clear();
  // Неудачу кэшируем ненадолго: токен мог обновиться
  userCache.set(cacheKey, { id, at: id ? Date.now() : Date.now() - USER_TTL_MS + 5_000 });
  return id;
}

async function campaignOwner(campaignId: string): Promise<{ exists: boolean; userId: string | null }> {
  const cached = ownerCache.get(campaignId);
  if (cached && Date.now() - cached.at < OWNER_TTL_MS) return cached;
  const row = await db.campaign.findUnique({ where: { id: campaignId }, select: { userId: true } });
  const value = { exists: Boolean(row), userId: row?.userId ?? null, at: Date.now() };
  if (ownerCache.size > 2000) ownerCache.clear();
  ownerCache.set(campaignId, value);
  return value;
}

async function roomMembers(campaignId: string): Promise<string[]> {
  const cached = roomCache.get(campaignId);
  if (cached && Date.now() - cached.at < ROOM_TTL_MS) return cached.members;
  let members: string[] = [];
  try {
    const room = await new RoomService().getActiveRoomByCampaignId(campaignId);
    if (room) {
      members = [room.hostUserId, ...room.participants.map((p) => p.userId)].filter(Boolean);
    }
  } catch (e) {
    console.warn("[campaign-access] не удалось проверить комнату кампании:", e);
  }
  if (roomCache.size > 500) roomCache.clear();
  roomCache.set(campaignId, { members, at: Date.now() });
  return members;
}

export type CampaignAccess =
  | { ok: true; userId: string | null }
  | { ok: false; status: 401 | 403; error: string; userId: string | null };

/** Проверяет доступ пользователя запроса к кампании (fail-closed) */
export async function checkCampaignAccess(
  request: Request,
  campaignId: string | null | undefined
): Promise<CampaignAccess> {
  const userId = await getRequestUserId(request);
  if (!userId) return { ok: false, status: 401, error: AUTH_REQUIRED_MESSAGE, userId: null };
  if (!campaignId) return { ok: false, status: 403, error: FORBIDDEN_MESSAGE, userId };

  const owner = await campaignOwner(campaignId);
  // Несуществующую кампанию обработает сам маршрут (404), но только для авторизованного запроса
  if (!owner.exists) return { ok: true, userId };
  // Кампания без владельца (legacy) закрыта для доступа через API
  if (!owner.userId) return { ok: false, status: 403, error: FORBIDDEN_MESSAGE, userId };
  if (owner.userId === userId) return { ok: true, userId };

  const hadCachedRoom = roomCache.has(campaignId);
  let members = await roomMembers(campaignId);
  if (!members.includes(userId) && hadCachedRoom) {
    roomCache.delete(campaignId);
    members = await roomMembers(campaignId);
  }
  if (members.includes(userId)) return { ok: true, userId };

  return { ok: false, status: 403, error: FORBIDDEN_MESSAGE, userId };
}

/** Готовый ответ-отказ или null, если доступ есть */
export async function denyCampaignAccess(
  request: Request,
  campaignId: string | null | undefined
): Promise<Response | null> {
  const access = await checkCampaignAccess(request, campaignId);
  if (access.ok) return null;
  return Response.json({ error: access.error }, { status: access.status });
}

/** То же для боя: доступ определяется кампанией, к которой бой привязан */
export async function denyCombatAccess(
  request: Request,
  combatId: string | null | undefined
): Promise<Response | null> {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_MESSAGE }, { status: 401 });
  }
  if (!combatId) {
    return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
  }
  let entry = combatCache.get(combatId);
  if (!entry || Date.now() - entry.at >= COMBAT_TTL_MS) {
    const row = await db.combat.findUnique({ where: { id: combatId }, select: { campaignId: true } });
    // Несуществующий бой обработает сам маршрут (404)
    if (!row) return null;
    entry = { campaignId: row.campaignId ?? null, at: Date.now() };
    if (combatCache.size > 2000) combatCache.clear();
    combatCache.set(combatId, entry);
  }
  return denyCampaignAccess(request, entry.campaignId);
}

/** После смены владельца или состава комнаты */
export function invalidateCampaignAccess(campaignId?: string): void {
  if (campaignId) {
    ownerCache.delete(campaignId);
    roomCache.delete(campaignId);
  } else {
    ownerCache.clear();
    roomCache.clear();
  }
}

/** Для тестов */
export function resetCampaignAccessCaches(): void {
  userCache.clear();
  ownerCache.clear();
  roomCache.clear();
  combatCache.clear();
}
