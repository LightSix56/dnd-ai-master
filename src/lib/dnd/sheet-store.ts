// Единственное место, которое работает с листами персонажей в базе (public.characters).
//
// Лист героя существует в одном экземпляре — строкой этой таблицы, колонка data (JSON).
// Его создаёт и правит сайт с листом персонажа; сайт мастера читает его отсюда напрямую
// и не держит у себя копий. Для каждой кампании у героя своя строка-версия
// (campaign_id + source_character_id), оригинал при этом не меняется.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

export interface SheetRow {
  id: string;
  userId: string;
  /** Имя строки: у версии — «Токсин (Встреча)». Имя героя в игре — sheet.name */
  name: string;
  /** Разобранный лист (characters.data); никогда не строка */
  sheet: Record<string, any>;
  portraitUrl: string | null;
  revision: number;
  campaignId: string | null;
  campaignName: string | null;
  sourceCharacterId: string | null;
}

/** Лист нельзя прочитать или изменить. Сообщение — для показа игроку. */
export class SheetUnavailableError extends Error {
  constructor(message = "Лист персонажа сейчас недоступен. Попробуйте ещё раз.") {
    super(message);
    this.name = "SheetUnavailableError";
  }
}

const COLUMNS =
  "id, user_id, name, data, portrait_url, revision, campaign_id, campaign_name, source_character_id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSheetId(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

function parseSheet(data: unknown): Record<string, any> {
  let value = data;
  // Лист иногда лежит строкой внутри jsonb (двойное кодирование)
  for (let i = 0; i < 2 && typeof value === "string"; i++) {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function toRow(raw: Record<string, any>): SheetRow {
  return {
    id: String(raw.id),
    userId: String(raw.user_id ?? ""),
    name: String(raw.name ?? ""),
    sheet: parseSheet(raw.data),
    portraitUrl: raw.portrait_url ?? null,
    revision: typeof raw.revision === "number" ? raw.revision : 0,
    campaignId: raw.campaign_id ?? null,
    campaignName: raw.campaign_name ?? null,
    sourceCharacterId: raw.source_character_id ?? null,
  };
}

function db(client?: SupabaseClient): SupabaseClient {
  return client ?? getSupabaseAdminClient();
}

/** Лист по id строки. null — такой строки нет. Ошибка базы — SheetUnavailableError. */
export async function loadSheet(id: string, client?: SupabaseClient): Promise<SheetRow | null> {
  if (!isSheetId(id)) return null;
  const { data, error } = await db(client).from("characters").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("[sheet-store] loadSheet:", error.message);
    throw new SheetUnavailableError();
  }
  return data ? toRow(data) : null;
}

/** Несколько листов одним запросом. Отсутствующих строк в результате просто нет. */
export async function loadSheets(ids: string[], client?: SupabaseClient): Promise<Map<string, SheetRow>> {
  const unique = [...new Set(ids.filter(isSheetId))];
  const result = new Map<string, SheetRow>();
  if (unique.length === 0) return result;
  const { data, error } = await db(client).from("characters").select(COLUMNS).in("id", unique);
  if (error) {
    console.error("[sheet-store] loadSheets:", error.message);
    throw new SheetUnavailableError();
  }
  for (const raw of data ?? []) {
    const row = toRow(raw);
    result.set(row.id, row);
  }
  return result;
}

/** Все листы пользователя: оригиналы и версии кампаний, новые сверху */
export async function listUserSheets(userId: string, client?: SupabaseClient): Promise<SheetRow[]> {
  const { data, error } = await db(client)
    .from("characters")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[sheet-store] listUserSheets:", error.message);
    throw new SheetUnavailableError();
  }
  return (data ?? []).map(toRow);
}

/** Имя строки-версии: «Токсин (Встреча)» */
export function versionRowName(heroName: string, campaignName: string): string {
  const hero = (heroName || "").trim() || "Герой";
  const campaign = (campaignName || "").trim() || "кампания";
  return `${hero} (${campaign})`;
}

async function findVersion(
  sourceCharacterId: string,
  campaignId: string,
  client: SupabaseClient
): Promise<SheetRow | null> {
  const { data, error } = await client
    .from("characters")
    .select(COLUMNS)
    .eq("source_character_id", sourceCharacterId)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (error) {
    console.error("[sheet-store] findVersion:", error.message);
    throw new SheetUnavailableError();
  }
  return data ? toRow(data) : null;
}

/**
 * Версия персонажа для кампании: находит существующую или создаёт копированием листа.
 * Оригинал не меняется. Чужой персонаж и версия другой кампании отклоняются.
 */
export async function ensureCampaignVersion(
  input: { userId: string; characterId: string; campaignId: string; campaignName: string },
  client?: SupabaseClient
): Promise<SheetRow> {
  const supabase = db(client);
  const picked = await loadSheet(input.characterId, supabase);
  if (!picked || picked.userId !== input.userId) {
    throw new SheetUnavailableError("Персонаж не найден");
  }

  if (picked.campaignId) {
    if (picked.campaignId === input.campaignId) return picked;
    throw new SheetUnavailableError(
      "Это версия персонажа для другой кампании. Выберите оригинал — для этой кампании будет создана своя версия."
    );
  }

  const existing = await findVersion(picked.id, input.campaignId, supabase);
  if (existing) return existing;

  const heroName = String(picked.sheet.name || picked.name || "Герой");
  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: input.userId,
      name: versionRowName(heroName, input.campaignName),
      data: picked.sheet,
      portrait_url: picked.portraitUrl,
      source_character_id: picked.id,
      campaign_id: input.campaignId,
      campaign_name: input.campaignName || null,
    })
    .select(COLUMNS)
    .single();

  if (error || !data) {
    // Два входа одновременно: версию успел создать параллельный запрос
    if (error?.code === "23505") {
      const raced = await findVersion(picked.id, input.campaignId, supabase);
      if (raced) return raced;
    }
    console.error("[sheet-store] ensureCampaignVersion:", error?.message);
    throw new SheetUnavailableError("Не удалось создать версию персонажа для кампании. Попробуйте ещё раз.");
  }
  return toRow(data);
}

/** Герой, созданный сразу в кампании (быстрое создание, импорт): версия без оригинала */
export async function createCampaignHeroSheet(
  input: { userId: string; campaignId: string; campaignName: string; sheet: Record<string, any> },
  client?: SupabaseClient
): Promise<SheetRow> {
  const heroName = String(input.sheet?.name || "Герой");
  const { data, error } = await db(client)
    .from("characters")
    .insert({
      user_id: input.userId,
      name: versionRowName(heroName, input.campaignName),
      data: input.sheet,
      portrait_url: input.sheet?.portraitUrl ?? null,
      source_character_id: null,
      campaign_id: input.campaignId,
      campaign_name: input.campaignName || null,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    console.error("[sheet-store] createCampaignHeroSheet:", error?.message);
    throw new SheetUnavailableError("Не удалось создать лист героя. Попробуйте ещё раз.");
  }
  return toRow(data);
}

/**
 * Точечная запись игрового состояния (хиты, ячейки, состояния) в лист.
 * Меняются только переданные поля верхнего уровня; остальной лист не трогается.
 * Возвращает новую ревизию строки.
 */
export async function applyGameState(
  id: string,
  patch: Record<string, unknown>,
  client?: SupabaseClient
): Promise<number> {
  if (!patch || Object.keys(patch).length === 0) return -1;
  const { data, error } = await db(client).rpc("apply_character_game_state", { p_id: id, p_patch: patch });
  if (error) {
    console.error("[sheet-store] applyGameState:", error.message);
    throw new SheetUnavailableError("Не удалось записать изменения в лист персонажа.");
  }
  return typeof data === "number" ? data : Number(data) || 0;
}

/** Начисление опыта в лист. Возвращает новый итог. */
export async function addExperience(id: string, amount: number, client?: SupabaseClient): Promise<number> {
  const { data, error } = await db(client).rpc("add_character_experience", {
    p_id: id,
    p_amount: Math.trunc(Number(amount) || 0),
  });
  if (error) {
    console.error("[sheet-store] addExperience:", error.message);
    throw new SheetUnavailableError("Не удалось начислить опыт в лист персонажа.");
  }
  return typeof data === "number" ? data : Number(data) || 0;
}
