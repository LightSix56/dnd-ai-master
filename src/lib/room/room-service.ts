import type { SupabaseClient } from "@supabase/supabase-js";
import { generateRoomCode, normalizeRoomCode } from "./code-gen";
import { validateCharacterForRoom } from "./validation";
import type {
  CreateRoomInput,
  JoinRoomInput,
  ParticipantCharacter,
  Room,
  RoomParticipant,
  RoomWithParticipants,
  RoomTurn,
} from "./types";
import type { PlayerTurnInput } from "./turn-batcher";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { db } from "@/lib/db";
import {
  extractPartyRosterFromParticipants,
  generatePartyAwareAct1,
  type PartyAwareAct1,
  type StartingSituation,
} from "@/lib/ai/party-arc-generator";
import { extractCharacterStats, getArchetypeAbilityScores } from "@/lib/dnd/import-character";
import {
  SheetUnavailableError,
  applyGameState,
  createCampaignHeroSheet,
  ensureCampaignVersion,
  isSheetId,
  loadSheet,
  loadSheets,
  type SheetRow,
} from "@/lib/dnd/sheet-store";
import { currentHitPoints } from "@/lib/dnd/hero-overlay";
import type { AuthMode } from "@/lib/ai/client";
import { normalizeCampaignSetup } from "@/lib/campaign/setup-params";

// Значения приходят из окна настройки в сыром виде: нормализация внутри startRoomCampaign
export interface StartRoomCampaignInput {
  title: string;
  setting: string;
  tone?: string;
  difficulty?: string;
  startingSituation?: string;
  levelTo?: number;
  customDmNotes?: string | null;
  dmStyle?: string;
  partyTies?: string;
  ruleStrictness?: string;
}

export interface StartRoomCampaignResult {
  success: boolean;
  campaignId: string;
  room: Room;
  arc: PartyAwareAct1;
}

function mapRoomFromDb(row: Record<string, any>): Room {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    hostUserId: row.host_user_id,
    status: row.status,
    startingLevel: row.starting_level,
    maxLevel: row.max_level,
    partyBond: row.party_bond,
    campaignSettings: row.campaign_settings || {},
    campaignId: row.campaign_settings?.campaignId || row.campaign_id || null,
    storyArc: row.story_arc,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Краткие сведения о герое участника — из его листа в базе; ничего не хранится */
export function summarizeSheet(characterId: string, row: SheetRow | null | undefined): ParticipantCharacter {
  if (!row) {
    return { id: characterId, name: "Лист недоступен", level: 1, missing: true };
  }
  const sheet = row.sheet;
  const stats = extractCharacterStats(sheet);
  const level = Math.trunc(Number(sheet.level));
  return {
    id: row.id,
    name: String(sheet.name || row.name || "Герой").trim(),
    level: Number.isFinite(level) && level >= 1 ? level : 1,
    race: sheet.race || undefined,
    className: sheet.className || sheet.class || undefined,
    subclass: sheet.subclass || undefined,
    portraitUrl: row.portraitUrl ?? sheet.portraitUrl ?? null,
    hpMax: stats.hpMax,
    hpCurrent: currentHitPoints(sheet, stats.hpMax),
    armorClass: stats.ac,
    condition:
      Array.isArray(sheet.conditions) && sheet.conditions.length > 0
        ? sheet.conditions.map(String).join(", ")
        : undefined,
  };
}

function mapParticipantFromDb(
  row: Record<string, any>,
  sheets?: Map<string, SheetRow>
): RoomParticipant {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    characterId: row.character_id,
    character: summarizeSheet(row.character_id, sheets?.get(row.character_id)),
    isHost: Boolean(row.is_host),
    isReady: Boolean(row.is_ready),
    joinedAt: row.joined_at,
  };
}

/** Стартовый лист героя, созданного прямо в комнате или взятого из героев кампании без листа */
function buildStarterSheet(input: {
  name: string;
  race?: string | null;
  className?: string | null;
  subclass?: string | null;
  level: number;
  scores?: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  hpMax?: number | null;
  hpCurrent?: number | null;
  armorClass?: number | null;
  speed?: number | null;
}): Record<string, any> {
  const scores = input.scores ?? getArchetypeAbilityScores(input.className);
  const sheet: Record<string, any> = {
    name: input.name.trim(),
    race: input.race || "",
    className: input.className || "",
    subclass: input.subclass || "",
    level: input.level,
    experiencePoints: 0,
    abilityScores: {
      СИЛ: scores.str, ЛОВ: scores.dex, ТЕЛ: scores.con, ИНТ: scores.int, МДР: scores.wis, ХАР: scores.cha,
    },
    speed: input.speed && input.speed > 0 ? input.speed : 30,
  };
  if (input.armorClass && input.armorClass > 0) sheet.armorClass = input.armorClass;
  // Хиты: заданные явно либо расчётные по классу и уровню
  const stats = extractCharacterStats({ ...sheet, hpMax: input.hpMax ?? undefined });
  sheet.hpMax = stats.hpMax;
  sheet.hpCurrent =
    typeof input.hpCurrent === "number" && input.hpCurrent >= 0 ? Math.min(input.hpCurrent, stats.hpMax) : stats.hpMax;
  sheet.hpTemp = 0;
  if (!sheet.armorClass) sheet.armorClass = stats.ac;
  return sheet;
}

function mapTurnFromDb(row: Record<string, any>): RoomTurn {
  return {
    id: row.id,
    roomId: row.room_id,
    roundNumber: row.round_number,
    status: row.status,
    playerInputs: row.player_inputs || {},
    dmResponse: row.dm_response || null,
    createdAt: row.created_at,
  };
}

/** Нарушение правил комнаты: роуты отдают такие ошибки как 409, а не как сбой сервера */
export class RoomRuleError extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Через сколько секунд без «пульса» блокировка «мастер думает» считается зависшей.
 * Пока мастер пишет, функция обновляет метку каждые RESOLVE_HEARTBEAT_SECONDS; если метка
 * старше этого порога — функция убита (таймаут, сбой), и раунд можно перехватить.
 */
export const STALE_RESOLVE_LOCK_SECONDS = 50;
export const RESOLVE_HEARTBEAT_SECONDS = 15;

export class RoomService {
  private broadcastChannels = new Map<string, any>();

  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getSupabaseAdminClient();
  }

  /**
   * Создаёт новую комнату в статусе 'lobby' с уникальным кодом
   */
  async createRoom(hostUserId: string, input: CreateRoomInput): Promise<Room> {
    const code = generateRoomCode();
    const startingLevel = Math.max(1, Math.min(20, input.startingLevel || 1));
    const maxLevel = Math.max(startingLevel, Math.min(20, input.maxLevel || 20));

    const campaignSettings = {
      ...(input.campaignSettings || {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
    };

    const { data, error } = await this.client
      .from("rooms")
      .insert({
        code,
        name: input.name.trim(),
        host_user_id: hostUserId,
        status: input.campaignId ? "active" : "lobby",
        starting_level: startingLevel,
        max_level: maxLevel,
        party_bond: input.partyBond || "strangers",
        campaign_settings: campaignSettings,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Не удалось создать комнату: ${error?.message || "Неизвестная ошибка"}`);
    }

    return mapRoomFromDb(data);
  }

  /**
   * Закрывает / архивирует активную комнату для указанной кампании
   */
  async closeRoomByCampaignId(campaignId: string): Promise<boolean> {
    if (!campaignId) return false;
    const { error } = await this.client
      .from("rooms")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .filter("campaign_settings->>campaignId", "eq", campaignId);

    return !error;
  }

  /**
   * Находит активную комнату для кампании
   */
  async getActiveRoomByCampaignId(campaignId: string): Promise<RoomWithParticipants | null> {
    if (!campaignId) return null;
    const { data, error } = await this.client
      .from("rooms")
      .select("*, room_participants(*)")
      .filter("campaign_settings->>campaignId", "eq", campaignId)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const room = mapRoomFromDb(data);
    const participants = await this.mapParticipants(data.room_participants, room);

    return {
      ...room,
      participants,
    };
  }

  /** Участники с краткими сведениями о героях, прочитанными из листов одним запросом */
  private async mapParticipants(rows: unknown, room?: Room): Promise<RoomParticipant[]> {
    const list = Array.isArray(rows) ? (rows as Record<string, any>[]) : [];
    if (list.length === 0) return [];
    let sheets: Map<string, SheetRow> | undefined;
    try {
      sheets = await loadSheets(list.map((r) => r.character_id), this.client);
    } catch (e) {
      // Комнату всё равно показываем: герои будут помечены «лист недоступен»
      console.warn("[room-service] не удалось прочитать листы участников:", e);
    }
    if (sheets && room?.campaignId) {
      await this.moveOriginalsToVersions(list, sheets, room);
    }
    const usernames = await this.loadUsernames(list.map((r) => r.user_id));
    return list.map((r) => ({
      ...mapParticipantFromDb(r, sheets),
      username: usernames.get(r.user_id) ?? null,
    }));
  }

  /** Ники игроков из profiles; без ников комната всё равно показывается */
  private async loadUsernames(userIds: unknown[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    // В profiles id — uuid; служебные id ведущего вида host_campaign_* сломали бы запрос
    const ids = [...new Set(userIds.filter((id): id is string => typeof id === "string" && UUID_RE.test(id)))];
    if (ids.length === 0) return names;
    try {
      const { data, error } = await this.client.from("profiles").select("id, username").in("id", ids);
      if (error) throw new Error(error.message);
      for (const row of (data as Array<{ id: string; username: string | null }>) || []) {
        if (row.username?.trim()) names.set(row.id, row.username.trim());
      }
    } catch (e) {
      console.warn("[room-service] не удалось прочитать ники участников:", e);
    }
    return names;
  }

  /**
   * В комнате с кампанией участник должен играть версией героя для этой кампании.
   * К оригиналу он привязан в двух случаях: вошёл в лобби до старта кампании или комната
   * начата до появления версий. Здесь такие привязки переводятся на версию (один раз):
   * оригинал не меняется, герой кампании получает ссылку на лист версии.
   */
  private async moveOriginalsToVersions(
    rows: Record<string, any>[],
    sheets: Map<string, SheetRow>,
    room: Room
  ): Promise<void> {
    const campaignId = room.campaignId as string;
    const pending = rows.filter((r) => {
      const sheet = sheets.get(r.character_id);
      return sheet && !sheet.campaignId;
    });
    if (pending.length === 0) return;

    const campaignName = await this.resolveCampaignName(
      campaignId,
      (room.campaignSettings || {}) as Record<string, any>,
      room.name
    );
    for (const row of pending) {
      try {
        const version = await ensureCampaignVersion(
          { userId: row.user_id, characterId: row.character_id, campaignId, campaignName },
          this.client
        );
        const { error } = await this.client
          .from("room_participants")
          .update({ character_id: version.id })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
        await this.linkHeroToCampaign(campaignId, version, null, true);
        row.character_id = version.id;
        // после переноса прогресса лист версии изменился — перечитываем
        const fresh = await loadSheet(version.id, this.client);
        sheets.set(version.id, fresh ?? version);
      } catch (e) {
        console.warn("[room-service] не удалось перевести участника на версию героя:", e);
      }
    }
  }

  /**
   * Удаляет участника комнаты по ID кампании и ID героя кампании
   */
  async removeParticipantByCharacter(campaignId: string, characterId: string): Promise<boolean> {
    if (!campaignId || !characterId) return false;
    const activeRoom = await this.getActiveRoomByCampaignId(campaignId);
    if (!activeRoom) return false;
    // Участник привязан к листу героя, а не к строке кампании
    const hero = await db.character.findUnique({
      where: { id: characterId },
      select: { sheetCharacterId: true },
    });
    const sheetId = hero?.sheetCharacterId || (isSheetId(characterId) ? characterId : null);
    if (!sheetId) return false;
    const { error } = await this.client
      .from("room_participants")
      .delete()
      .eq("room_id", activeRoom.id)
      .eq("character_id", sheetId);
    return !error;
  }

  /**
   * Выход из комнаты. Игрок уходит один: удаляется только его строка участника.
   * Ведущий закрывает комнату для всех: она архивируется, войти в неё больше нельзя
   * (строки участников остаются — по статусу клиенты понимают, что стол закрыт, а не что их выгнали).
   */
  async leaveRoom(roomId: string, userId: string): Promise<{ closed: boolean }> {
    const room = await this.getRoomById(roomId);
    if (!room) throw new RoomRuleError("Комната не найдена.");

    if (room.hostUserId === userId) {
      const ok = await this.updateRoomStatus(roomId, "archived");
      if (!ok) throw new Error("Не удалось закрыть комнату.");
      return { closed: true };
    }

    const { error } = await this.client
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);
    if (error) throw new Error(`Не удалось выйти из комнаты: ${error.message}`);
    return { closed: false };
  }

  /**
   * Ведущий исключает участника. Исключённый может сразу войти снова — это не бан.
   */
  async kickParticipant(roomId: string, hostUserId: string, participantId: string): Promise<void> {
    const room = await this.getRoomById(roomId);
    if (!room) throw new RoomRuleError("Комната не найдена.");
    if (room.hostUserId !== hostUserId) {
      throw new RoomRuleError("Исключать игроков может только ведущий.");
    }

    const { data, error } = await this.client
      .from("room_participants")
      .select("id, user_id")
      .eq("id", participantId)
      .eq("room_id", roomId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new RoomRuleError("Участник не найден.");
    if (data.user_id === hostUserId) {
      throw new RoomRuleError("Ведущий не может исключить себя — чтобы уйти, закройте комнату.");
    }

    const { error: deleteError } = await this.client
      .from("room_participants")
      .delete()
      .eq("id", participantId)
      .eq("room_id", roomId);
    if (deleteError) throw new Error(`Не удалось исключить игрока: ${deleteError.message}`);
  }

  /**
   * Получает комнату по коду (с участниками)
   */
  async getRoomByCode(code: string): Promise<RoomWithParticipants | null> {
    const cleanCode = normalizeRoomCode(code);
    const { data, error } = await this.client
      .from("rooms")
      .select("*, room_participants(*)")
      .eq("code", cleanCode)
      .single();

    if (error || !data) {
      return null;
    }

    const room = mapRoomFromDb(data);
    const participants = await this.mapParticipants(data.room_participants, room);

    return {
      ...room,
      participants,
    };
  }

  /**
   * Получает комнату по ID
   */
  async getRoomById(id: string): Promise<Room | null> {
    const { data, error } = await this.client
      .from("rooms")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return mapRoomFromDb(data);
  }

  /**
   * Подключает игрока к комнате с выбранным персонажем.
   *
   * Лист героя не копируется: участнику записывается только id строки листа.
   * Если у комнаты уже есть кампания, для героя берётся (или создаётся) его версия
   * для этой кампании — оригинал и другие кампании не меняются.
   */
  async joinRoom(input: JoinRoomInput): Promise<RoomParticipant> {
    // 1. Комната
    const { data: roomData, error: roomError } = await this.client
      .from("rooms")
      .select("id, name, starting_level, status, campaign_settings")
      .eq("id", input.roomId)
      .single();

    if (roomError || !roomData) {
      throw new Error("Комната не найдена.");
    }

    if (!["lobby", "active", "in_campaign", "in_progress"].includes(roomData.status)) {
      throw new Error(`Невозможно присоединиться к комнате со статусом "${roomData.status}".`);
    }

    const settings = (roomData.campaign_settings || {}) as Record<string, any>;
    const campaignId: string | null = settings.campaignId || null;
    const campaignName = campaignId ? await this.resolveCampaignName(campaignId, settings, roomData.name) : "";

    let sheet: SheetRow;
    /** Герой кампании, которого выбрали по его id (вкладка «Герои кампании») */
    let pickedHeroId: string | null = null;
    try {
      // 2. Лист героя
      if (input.create) {
        if (!campaignId) {
          throw new RoomRuleError("Создать героя можно после того, как ведущий начнёт кампанию.");
        }
        const name = (input.create.name || "").trim();
        if (!name) throw new RoomRuleError("Укажите имя персонажа");
        sheet = await createCampaignHeroSheet(
          {
            userId: input.userId,
            campaignId,
            campaignName,
            sheet: buildStarterSheet({
              name,
              race: input.create.race,
              className: input.create.className,
              level: roomData.starting_level || 1,
            }),
          },
          this.client
        );
      } else if (isSheetId(input.characterId)) {
        const picked = await loadSheet(input.characterId, this.client);
        if (!picked || picked.userId !== input.userId) {
          throw new RoomRuleError("Персонаж не найден среди ваших героев.");
        }
        sheet = picked;
      } else {
        const adopted = await this.sheetForCampaignHero(input, campaignId, campaignName);
        sheet = adopted.sheet;
        pickedHeroId = adopted.heroId;
      }

      if (sheet.campaignId && sheet.campaignId !== campaignId) {
        throw new RoomRuleError(
          "Это версия персонажа для другой кампании. Выберите оригинал — для этой кампании будет создана своя версия."
        );
      }

      // 3. Уровень. Версия этой кампании уже играет за этим столом и могла вырасти — её не проверяем.
      const existingVersion =
        sheet.campaignId === campaignId && campaignId
          ? sheet
          : campaignId
            ? await this.findExistingVersion(sheet.id, campaignId)
            : null;
      if (!existingVersion) {
        const validation = validateCharacterForRoom(
          { name: String(sheet.sheet.name || sheet.name), level: Number(sheet.sheet.level) },
          roomData.starting_level
        );
        if (!validation.valid) {
          throw new Error(validation.error || "Уровень персонажа не соответствует кампании.");
        }
      }

      // 4. Имя героя не должно совпадать с героем другого игрока этой комнаты
      const heroName = String((existingVersion ?? sheet).sheet.name || sheet.name || "Герой").trim();
      const { data: others } = await this.client
        .from("room_participants")
        .select("user_id, character_id")
        .eq("room_id", input.roomId)
        .neq("user_id", input.userId);
      const otherRows = Array.isArray(others) ? others : [];
      if (otherRows.length > 0) {
        const otherSheets = await loadSheets(otherRows.map((p: any) => p.character_id), this.client);
        const wanted = heroName.toLowerCase();
        for (const other of otherSheets.values()) {
          const otherName = String(other.sheet.name || other.name || "").trim().toLowerCase();
          if (otherName && otherName === wanted) {
            throw new RoomRuleError(`Персонаж «${heroName}» уже выбран другим игроком в этой комнате`);
          }
        }
      }

      // 5. Версия для кампании
      if (campaignId) {
        sheet =
          existingVersion ??
          (await ensureCampaignVersion(
            { userId: input.userId, characterId: sheet.id, campaignId, campaignName },
            this.client
          ));
      }
    } catch (e) {
      if (e instanceof SheetUnavailableError) throw new RoomRuleError(e.message);
      throw e;
    }

    // 6. Участник комнаты (1 игрок = 1 персонаж): хранится только id строки листа.
    const { data: participantData, error: partError } = await this.client
      .from("room_participants")
      .upsert(
        {
          room_id: input.roomId,
          user_id: input.userId,
          character_id: sheet.id,
          is_host: Boolean(input.isHost),
          is_ready: false,
        },
        { onConflict: "room_id,user_id" }
      )
      .select()
      .single();

    if (partError || !participantData) {
      throw new Error(`Ошибка подключения к комнате: ${partError?.message || "Сбой записи"}`);
    }

    // 7. Герой в базе кампании — только ссылка на лист
    if (campaignId) {
      try {
        await this.linkHeroToCampaign(campaignId, sheet, pickedHeroId, true);
      } catch (err) {
        console.warn("[room-service] не удалось привязать героя к кампании:", err);
      }
    }

    return mapParticipantFromDb(participantData, new Map([[sheet.id, sheet]]));
  }

  private async resolveCampaignName(
    campaignId: string,
    settings: Record<string, any>,
    roomName?: string | null
  ): Promise<string> {
    try {
      const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { name: true } });
      if (campaign?.name) return campaign.name;
    } catch {
      // название возьмём из настроек комнаты
    }
    return String(settings.title || roomName || "Кампания");
  }

  private async findExistingVersion(sourceCharacterId: string, campaignId: string): Promise<SheetRow | null> {
    const { data } = await this.client
      .from("characters")
      .select("id")
      .eq("source_character_id", sourceCharacterId)
      .eq("campaign_id", campaignId)
      .maybeSingle();
    return data?.id ? loadSheet(data.id, this.client) : null;
  }

  /**
   * Игрок выбрал героя кампании по его id. Если у героя уже есть лист — играть им может
   * только владелец листа. Если листа нет (герой создан мастером) — лист создаётся
   * из сведений о герое и закрепляется за игроком.
   */
  private async sheetForCampaignHero(
    input: JoinRoomInput,
    campaignId: string | null,
    campaignName: string
  ): Promise<{ sheet: SheetRow; heroId: string }> {
    const hero = input.characterId
      ? await db.character.findUnique({ where: { id: String(input.characterId) } })
      : null;
    if (!hero || !campaignId || hero.campaignId !== campaignId || !["player", "companion"].includes(hero.type)) {
      throw new RoomRuleError("Персонаж не найден среди героев этой кампании.");
    }
    if (hero.sheetCharacterId) {
      const linked = await loadSheet(hero.sheetCharacterId, this.client);
      if (linked && linked.userId !== input.userId) {
        throw new RoomRuleError(`Персонаж «${hero.name}» уже занят другим игроком`);
      }
      if (linked) return { sheet: linked, heroId: hero.id };
    }
    const sheet = await createCampaignHeroSheet(
      {
        userId: input.userId,
        campaignId,
        campaignName,
        sheet: buildStarterSheet({
          name: hero.name,
          race: hero.race,
          className: hero.class,
          subclass: hero.subclass,
          level: hero.level || 1,
          scores: { str: hero.str, dex: hero.dex, con: hero.con, int: hero.int, wis: hero.wis, cha: hero.cha },
          hpMax: hero.hpMax,
          hpCurrent: hero.hpCurrent,
          armorClass: hero.ac,
          speed: hero.speed,
        }),
      },
      this.client
    );
    return { sheet, heroId: hero.id };
  }

  /**
   * Строка героя в базе кампании: хранит ссылку на лист и то, что относится к самой игре.
   * Характеристики, хиты и лист сюда не копируются — они читаются из листа.
   */
  private async linkHeroToCampaign(
    campaignId: string,
    sheet: SheetRow,
    pickedHeroId?: string | null,
    carryCampaignProgress = false
  ): Promise<void> {
    const name = String(sheet.sheet.name || sheet.name || "Герой").trim();
    const level = Math.max(1, Math.trunc(Number(sheet.sheet.level)) || 1);
    const heroes = await db.character.findMany({ where: { campaignId } });

    const linked = heroes.find((c) => c.sheetCharacterId === sheet.id);
    if (linked) {
      if (linked.name !== name || linked.type !== "player") {
        await db.character.update({ where: { id: linked.id }, data: { name, type: "player" } });
      }
      return;
    }

    // Герой кампании, которого надо привязать: выбранный явно (в том числе с устаревшей ссылкой
    // на удалённый лист) либо одноимённый герой без листа (кампании, начатые до версий)
    const lower = name.toLowerCase();
    const target = heroes.find(
      (c) =>
        (pickedHeroId && c.id === pickedHeroId) ||
        (!c.sheetCharacterId &&
          ["player", "companion"].includes(c.type) &&
          c.name.trim().toLowerCase() === lower)
    );
    if (target) {
      // Прогресс, накопленный в кампании до появления версий, лежал в строке героя —
      // переносим его в лист, иначе герой «потерял бы» заработанный опыт и раны
      if (!target.sheetCharacterId && carryCampaignProgress) {
        await this.carryProgressToSheet(target, sheet);
      }
      await db.character.update({
        where: { id: target.id },
        data: { name, type: "player", sheetCharacterId: sheet.id, sheetLevelSeen: level },
      });
      return;
    }

    try {
      await db.character.create({
        data: { campaignId, name, type: "player", sheetCharacterId: sheet.id, sheetLevelSeen: level },
      });
    } catch (e) {
      // Параллельный запрос уже создал героя с этой ссылкой (уникальный индекс) — это не ошибка
      if ((e as { code?: string })?.code !== "P2002") throw e;
    }
  }

  private async carryProgressToSheet(
    hero: { experiencePoints?: number | null; hpCurrent?: number | null; hpMax?: number | null },
    sheet: SheetRow
  ): Promise<void> {
    const patch: Record<string, unknown> = {};
    const heroXp = Math.trunc(Number(hero.experiencePoints)) || 0;
    const sheetXp = Math.trunc(Number(sheet.sheet.experiencePoints)) || 0;
    if (heroXp > sheetXp) patch.experiencePoints = heroXp;

    const sheetMax = extractCharacterStats(sheet.sheet).hpMax;
    const heroHp = Math.trunc(Number(hero.hpCurrent));
    const heroMax = Math.trunc(Number(hero.hpMax));
    // Раны переносим, только если герой в кампании действительно был ранен
    if (Number.isFinite(heroHp) && Number.isFinite(heroMax) && heroHp >= 0 && heroHp < heroMax) {
      patch.hpCurrent = Math.min(heroHp, sheetMax);
    }
    if (Object.keys(patch).length > 0) await applyGameState(sheet.id, patch, this.client);
  }

  /**
   * Переключает статус готовности участника
   */
  async setParticipantReady(roomId: string, userId: string, isReady: boolean): Promise<boolean> {
    const { error } = await this.client
      .from("room_participants")
      .update({ is_ready: isReady })
      .eq("room_id", roomId)
      .eq("user_id", userId);

    return !error;
  }

  /**
   * Модель комнаты для роли: "dmModel" (ДМ) или "cheapModel" (служебная).
   * Ход разрешают разные игроки, поэтому модель не берём из запроса того, кто нажал последним:
   * её задаёт ведущий и хранит комната. Остальные используют сохранённую.
   */
  async pickRoomModel(
    room: RoomWithParticipants,
    userId: string,
    role: "dmModel" | "cheapModel",
    requested?: string
  ): Promise<string | undefined> {
    const stored = (room.campaignSettings as Record<string, any>)?.[role] as string | undefined;
    // После старта кампании модель не меняем: экономия токенов и непрерывность повествования
    if (room.status !== "lobby" && stored) return stored;
    if (userId !== room.hostUserId || !requested?.trim()) return stored || undefined;

    const model = requested.trim();
    const { data: row, error: readError } = await this.client
      .from("rooms")
      .select("campaign_settings")
      .eq("id", room.id)
      .single();
    if (readError || !row) return stored || model;

    const settings = (row.campaign_settings || {}) as Record<string, any>;
    const { error } = await this.client
      .from("rooms")
      .update({ campaign_settings: { ...settings, [role]: model }, updated_at: new Date().toISOString() })
      .eq("id", room.id);
    if (error) console.error(`[room] не удалось сохранить модель (${role}):`, error.message);
    return model;
  }

  /**
   * Обновляет статус комнаты ('lobby' | 'generating' | 'active' | 'archived')
   */
  async updateRoomStatus(roomId: string, status: Room["status"]): Promise<boolean> {
    const { error } = await this.client
      .from("rooms")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", roomId);

    return !error;
  }

  /**
   * Запускает кампанию в комнате: валидирует отряд, генерирует Акт 1 под героев,
   * создает локальную кампанию и переводит комнату в статус 'active'.
   */
  async startRoomCampaign(
    code: string,
    hostUserId: string,
    input: StartRoomCampaignInput,
    options?: { model?: string; apiKey?: string; authMode?: AuthMode; baseURL?: string }
  ): Promise<StartRoomCampaignResult> {
    const normalizedCode = normalizeRoomCode(code);
    const roomWithParticipants = await this.getRoomByCode(normalizedCode);
    if (!roomWithParticipants) {
      throw new Error(`Комната с кодом ${code} не найдена`);
    }
    // Все параметры окна нормализуются один раз; дальше по функции используется только setup
    const setup = normalizeCampaignSetup(
      input as unknown as Record<string, unknown>,
      roomWithParticipants.startingLevel
    );

    if (roomWithParticipants.hostUserId !== hostUserId) {
      const isHostInParts = roomWithParticipants.participants.some(
        (p) => p.userId === hostUserId && p.isHost
      );
      if (!isHostInParts) {
        throw new Error("Только создатель комнаты (Человек-ДМ) может запустить кампанию");
      }
    }

    // Отряд — из живых листов участников
    const participantSheets = await loadSheets(
      roomWithParticipants.participants.map((p) => p.characterId),
      this.client
    );
    const party = extractPartyRosterFromParticipants(
      roomWithParticipants.participants
        .filter((p) => participantSheets.has(p.characterId))
        .map((p) => ({ id: p.characterId, userId: p.userId, sheet: participantSheets.get(p.characterId)!.sheet }))
    );
    if (party.length === 0) {
      throw new Error("В комнате нет ни одного выбранного персонажа");
    }

    for (const member of party) {
      const validation = validateCharacterForRoom(
        member as unknown as Record<string, unknown>,
        roomWithParticipants.startingLevel
      );
      if (!validation.valid) {
        throw new Error(`Персонаж ${member.name} не подходит: ${validation.error}`);
      }
    }

    let arc: PartyAwareAct1;
    try {
      arc = await generatePartyAwareAct1(
        {
          title: setup.title,
          setting: setup.setting,
          tone: setup.tone,
          difficulty: setup.difficulty,
          startingSituation: setup.startingSituation,
          levelFrom: roomWithParticipants.startingLevel,
          levelTo: setup.levelTo,
          party,
          customDmNotes: setup.customDmNotes,
          dmStyle: setup.dmStyle,
          partyTies: setup.partyTies,
          ruleStrictness: input.ruleStrictness,
        },
        options
      );
    } catch (arcErr) {
      // Фолбэк на базовый каркас Акта 1 в случае сбоя сети / отсутствия API-ключа.
      // Причину пишем в лог: раньше сбой был не виден, и стол просто получал заготовку.
      console.error("[room-service] сюжет под отряд не сгенерирован, используется заготовка:", arcErr);
      const actLevelTo = Math.min(
        setup.levelTo,
        Math.max(roomWithParticipants.startingLevel + 2, 3)
      );
      arc = {
        title: setup.title,
        premise: `Герои отправляются навстречу опасностям в мире «${setup.setting}».`,
        mainThreat: "Древняя зловещая сила пробуждается и грозит разрушить хрупкий порядок.",
        levelFrom: roomWithParticipants.startingLevel,
        levelTo: setup.levelTo,
        villains: [
          {
            name: "Мастер теней",
            role: "Главный антагонист",
            motivation: "Захват власти над регионом",
            secret: "Использует древнюю забытую магию",
            appearsInAct: 1,
          },
          {
            name: "Командор наёмников",
            role: "Лейтенант Акта 1",
            motivation: "Жажда золота и власти",
            secret: "Втайне боится своего господина",
            appearsInAct: 1,
          },
        ],
        act: {
          name: "Акт 1: Первые тени",
          levelFrom: roomWithParticipants.startingLevel,
          levelTo: actLevelTo,
          goal: "Выяснить источник беспокойства в регионе и остановить передовой отряд культа.",
          summary: "Отряд сталкивается с первыми проявлениями угрозы, преодолевает засады и раскрывает зловещий замысел.",
          climaxObjective: "Разбить лагерь передового отряда культа и спасти пленников.",
          personalHooks: party.map((m) => ({
            characterName: m.name,
            hook: `Слухи о происходящем напрямую затрагивают прошлое ${m.name}.`,
          })),
          scenes: [
            {
              name: "Сцена 1: Зов к оружию",
              sceneType: "social",
              location: "Перепутье дорог",
              description: "Беженцы и встревоженные стражники приносят вести о нападении на окрестные земли.",
              encounter: "Диалог со свидетелями и выбор направления расследования.",
            },
            {
              name: "Сцена 2: Следы на тракте",
              sceneType: "exploration",
              location: "Опушка леса",
              description: "Разбитый караван и следы борьбы ведут в глубь диких земель.",
              encounter: "Поиск улик, ловушки на тропе.",
            },
            {
              name: "Сцена 3: Засада разведчиков",
              sceneType: "combat",
              location: "Узкое ущелье",
              description: "Вражеские дозорные атакуют отряд с возвышенности.",
              encounter: "Тактический бой с использованием укрытий.",
            },
            {
              name: "Сцена 4: Лагерь приспешников",
              sceneType: "stealth",
              location: "Старая застава",
              description: "Укрепленный форпост с патрулями и пленниками.",
              encounter: "Возможность скрытного проникновения или штурма.",
            },
            {
              name: "Сцена 5: Кульминация Акта 1",
              sceneType: "climax",
              location: "Командный шатёр / Ритуальный круг",
              description: "Схватка с лейтенантом и предотвращение ритуала.",
              encounter: "Решающий бой Акта 1.",
            },
          ],
          twist: "У поверженного врага обнаружена печать, указывающая на предателя среди местной знати.",
          branches: [
            { ifPlayer: "Пощадить и допросить лейтенанта", then: "Отряд узнает точное расположение цитадели BBEG." },
            { ifPlayer: "Уничтожить врагов без переговоров", then: "Культисты в столице не узнают о провале форпоста." },
          ],
          rewards: "Золото, трофеи, повышение уровня и зацепка ко 2-му Акту.",
        },
        finaleHint: "Раскрытие предательства выведет отряд на глобальную политическую арену.",
      };
    }

    // Формируем вводное описание мира и приключения от ИИ-Мастера
    const openingNarrative = [
      `📖 **${arc.title}**`,
      arc.premise ? `${arc.premise}` : "",
      arc.act ? `**${arc.act.name}: ${arc.act.goal}**\n${arc.act.summary}` : "",
      arc.act?.scenes?.[0]?.description ? `📍 *${arc.act.scenes[0].description}*` : "",
      "Что предпринимают ваши персонажи?",
    ]
      .filter(Boolean)
      .join("\n\n");

    let campaignId = "";
    try {
      const campaign = await db.campaign.create({
        data: {
          // Владелец кампании стола — ведущий: без владельца она была бы доступна кому угодно по id
          userId: roomWithParticipants.hostUserId || null,
          name: setup.title,
          setting: setup.setting,
          tone: setup.tone,
          difficulty: setup.difficulty,
          dmStyle: setup.dmStyle,
          partyTies: setup.partyTies,
          startingSituation: setup.startingSituation,
          ruleStrictness: input.ruleStrictness || "standard",
          levelFrom: roomWithParticipants.startingLevel,
          levelTo: setup.levelTo,
          startingLevel: roomWithParticipants.startingLevel,
          worldDescription: null,
          customDmNotes: setup.customDmNotes,
          storyArc: JSON.stringify(arc),
          // Сюжет уже готов: без статуса клиент не показывал кнопку «Начать приключение»
          arcStatus: "ready",
          // Кампания, начатая за столом, — сетевая: с главной она открывается через комнату
          mode: "network",
        },
      });
      campaignId = campaign.id;

      // Каждому герою — своя версия для этой кампании; оригиналы остаются как были
      for (const participant of roomWithParticipants.participants) {
        const original = participantSheets.get(participant.characterId);
        if (!original) continue;
        const version = await ensureCampaignVersion(
          {
            userId: participant.userId,
            characterId: original.id,
            campaignId: campaign.id,
            campaignName: setup.title,
          },
          this.client
        );
        if (version.id !== participant.characterId) {
          const { error: rebindError } = await this.client
            .from("room_participants")
            .update({ character_id: version.id })
            .eq("id", participant.id);
          if (rebindError) {
            throw new Error(`Не удалось привязать версию героя: ${rebindError.message}`);
          }
        }
        await this.linkHeroToCampaign(campaign.id, version);
      }
      // Вступление в чат не пишем: его рассказывает сам мастер, когда ведущий нажмёт
      // «Начать приключение» (как в одиночной игре). Раньше сюда клался шаблон из плана
      // сюжета — он раскрывал цель акта и скрывал кнопку начала.
    } catch (dbErr) {
      console.warn("[room-service] Failed to create local campaign in SQLite, fallback generated ID:", dbErr);
      campaignId = `camp_${Date.now()}`;
    }

    const { data: updatedRoomData, error: updateError } = await this.client
      .from("rooms")
      .update({
        status: "active",
        campaign_settings: {
          ...roomWithParticipants.campaignSettings,
          campaignId,
          title: setup.title,
          setting: setup.setting,
          tone: setup.tone,
          difficulty: setup.difficulty,
          dmStyle: setup.dmStyle,
          partyTies: setup.partyTies,
          startingSituation: setup.startingSituation,
          levelTo: setup.levelTo,
          customDmNotes: setup.customDmNotes,
          openingNarrative,
        },
        story_arc: arc,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomWithParticipants.id)
      .select()
      .single();

    if (updateError || !updatedRoomData) {
      throw new Error(`Не удалось обновить статус комнаты: ${updateError?.message || "Ошибка записи"}`);
    }

    const updatedRoom = mapRoomFromDb(updatedRoomData);

    // Инициализируем раунд 1 в room_turns
    try {
      await this.client.from("room_turns").insert({
        room_id: updatedRoom.id,
        round_number: 1,
        status: "waiting",
        player_inputs: {},
        dm_response: openingNarrative,
      });
    } catch (turnErr) {
      console.warn("[room-service] Не удалось создать начальный раунд:", turnErr);
    }

    return {
      success: true,
      campaignId,
      room: updatedRoom,
      arc,
    };
  }

  /**
   * Получает активный раунд комнаты
   */
  async getActiveTurn(roomId: string): Promise<RoomTurn | null> {
    const { data, error } = await this.client
      .from("room_turns")
      .select("*")
      .eq("room_id", roomId)
      .order("round_number", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }
    return mapTurnFromDb(data);
  }

  /**
   * Отправляет или обновляет действие игрока в текущем раунде
   */
  async submitPlayerAction(
    roomId: string,
    userId: string,
    input: PlayerTurnInput
  ): Promise<RoomTurn> {
    const activeTurn = await this.getActiveTurn(roomId);
    if (!activeTurn) {
      const { data: newTurn, error: createError } = await this.client
        .from("room_turns")
        .insert({
          room_id: roomId,
          round_number: 1,
          status: "waiting",
          player_inputs: { [userId]: input },
        })
        .select()
        .single();

      if (createError || !newTurn) {
        throw new Error(`Не удалось создать раунд: ${createError?.message || "Ошибка записи"}`);
      }
      return mapTurnFromDb(newTurn);
    }

    if (activeTurn.status === "resolving") {
      throw new RoomRuleError("Мастер уже описывает этот раунд — отправьте действие в следующем");
    }
    if (activeTurn.status === "completed") {
      throw new RoomRuleError("Раунд уже завершён — обновите страницу и отправьте действие в новом раунде");
    }
    if (activeTurn.playerInputs?.[userId]?.actionText?.trim()) {
      throw new RoomRuleError("Сказанного не вернёшь: вы уже отправили действие в этом раунде");
    }

    // Атомарная запись (миграция 003): ход дописывается одной командой UPDATE, поэтому
    // одновременная отправка двумя игроками больше не затирает чей-то ход.
    const rpc = (this.client as any).rpc;
    if (typeof rpc === "function") {
      const { data: rpcData, error: rpcError } = await rpc.call(this.client, "room_submit_turn_input", {
        p_turn_id: activeTurn.id,
        p_user_id: userId,
        p_input: input,
      });
      if (!rpcError) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (row) return mapTurnFromDb(row);
        // Ни одной строки: пока мы шли, раунд ушёл в обработку или ход уже записан
        const fresh = await this.getActiveTurn(roomId);
        if (fresh?.id === activeTurn.id && fresh.playerInputs?.[userId]) {
          throw new RoomRuleError("Сказанного не вернёшь: вы уже отправили действие в этом раунде");
        }
        throw new RoomRuleError("Мастер уже описывает этот раунд — отправьте действие в следующем");
      }
      // Функции в БД ещё нет (миграция не применена) — работаем по-старому
      console.warn("[RoomService.submitPlayerAction] room_submit_turn_input недоступна, запись без атомарности:", rpcError.message);
    }

    const updatedInputs = {
      ...activeTurn.playerInputs,
      [userId]: input,
    };

    const { data, error } = await this.client
      .from("room_turns")
      .update({
        player_inputs: updatedInputs,
      })
      .eq("id", activeTurn.id)
      .eq("status", "waiting")
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Не удалось обновить действие игрока: ${error.message}`);
    }
    if (!data) {
      throw new RoomRuleError("Мастер уже описывает этот раунд — отправьте действие в следующем");
    }

    return mapTurnFromDb(data);
  }

  /**
   * Атомарно блокирует раунд для генерации ответа ДМ (waiting -> resolving).
   * Возвращает true, если блокировка успешно захвачена текущим запросом,
   * и false, если другой параллельный запрос уже выполняет генерацию.
   */
  async lockTurnForResolving(turnId: string): Promise<boolean> {
    const now = new Date().toISOString();

    // Обычный захват: waiting -> resolving, с меткой времени (колонка из миграции 003)
    let { data, error } = await this.client
      .from("room_turns")
      .update({ status: "resolving", resolving_started_at: now })
      .eq("id", turnId)
      .eq("status", "waiting")
      .select("id")
      .maybeSingle();

    if (error) {
      // Колонки ещё нет — захватываем без метки времени, как раньше
      ({ data, error } = await this.client
        .from("room_turns")
        .update({ status: "resolving" })
        .eq("id", turnId)
        .eq("status", "waiting")
        .select("id")
        .maybeSingle());
      return !error && !!data;
    }
    if (data) return true;

    // Перехват зависшей блокировки: функция, начавшая обработку, упала или была убита по
    // таймауту и не вернула раунд в waiting. Без этого раунд оставался заблокирован навсегда.
    try {
      const cutoff = new Date(Date.now() - STALE_RESOLVE_LOCK_SECONDS * 1000).toISOString();
      const takeover = await this.client
        .from("room_turns")
        .update({ resolving_started_at: now })
        .eq("id", turnId)
        .eq("status", "resolving")
        .lt("resolving_started_at", cutoff)
        .select("id")
        .maybeSingle();

      return !takeover.error && !!takeover.data;
    } catch {
      return false;
    }
  }

  /** «Пульс» генерации: пока метка свежая, раунд никто не перехватит */
  async touchResolvingLock(turnId: string): Promise<void> {
    try {
      await this.client
        .from("room_turns")
        .update({ resolving_started_at: new Date().toISOString() })
        .eq("id", turnId)
        .eq("status", "resolving");
    } catch {
      // пульс не критичен
    }
  }

  /**
   * Рассылает игрокам комнаты ход работы мастера (статус, текст по мере написания, итог).
   * Клиенты слушают событие dm_stream канала room:<id>. Сбой рассылки игру не останавливает:
   * итог раунда клиенты всё равно получат опросом.
   */
  async broadcastDmStream(roomId: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const client = this.client as any;
      if (typeof client?.channel !== "function") return;
      let channel = this.broadcastChannels.get(roomId);
      if (!channel) {
        channel = client.channel(`room:${roomId}`);
        this.broadcastChannels.set(roomId, channel);
      }
      if (typeof channel.httpSend === "function") {
        await channel.httpSend("dm_stream", payload);
      } else {
        await channel.send({ type: "broadcast", event: "dm_stream", payload });
      }
    } catch (e) {
      console.warn("[RoomService] рассылка dm_stream не удалась:", (e as Error)?.message);
    }
  }

  /**
   * Снимает блокировку в случае сбоя генерации (resolving -> waiting)
   */
  async unlockTurnFromResolving(turnId: string): Promise<void> {
    await this.client
      .from("room_turns")
      .update({ status: "waiting" })
      .eq("id", turnId)
      .eq("status", "resolving");
  }

  /**
   * Завершает текущий раунд с ответом ДМ и создаёт следующий раунд
   */
  async resolveRoomTurn(
    roomId: string,
    dmResponse: string,
    expectedTurnId?: string
  ): Promise<{ completedTurn: RoomTurn; nextTurn: RoomTurn; alreadyCompleted?: boolean }> {
    const activeTurn = await this.getActiveTurn(roomId);
    if (!activeTurn) {
      throw new Error("Нет активного раунда для завершения");
    }

    // Раунд, который мы описывали, уже закрыт другим запросом (перехват зависшей блокировки,
    // пока первая функция всё же дописала ответ). Последний раунд комнаты — уже следующий:
    // закрывать его нашим текстом нельзя, иначе пропадёт целый раунд заявок.
    if (expectedTurnId && activeTurn.id !== expectedTurnId) {
      const { data: doneRow } = await this.client
        .from("room_turns")
        .select("*")
        .eq("id", expectedTurnId)
        .maybeSingle();
      return {
        completedTurn: doneRow ? mapTurnFromDb(doneRow) : activeTurn,
        nextTurn: activeTurn,
        alreadyCompleted: true,
      };
    }
    if (expectedTurnId && activeTurn.status === "completed") {
      throw new Error("Раунд уже завершён");
    }

    const { data: completedData, error: completeError } = await this.client
      .from("room_turns")
      .update({
        status: "completed",
        dm_response: dmResponse,
      })
      .eq("id", activeTurn.id)
      .select()
      .single();

    if (completeError || !completedData) {
      throw new Error(`Не удалось завершить раунд: ${completeError?.message || "Ошибка обновления"}`);
    }

    const nextRoundNumber = (activeTurn.roundNumber || 1) + 1;
    const { data: nextData, error: nextError } = await this.client
      .from("room_turns")
      .insert({
        room_id: roomId,
        round_number: nextRoundNumber,
        status: "waiting",
        player_inputs: {},
        dm_response: null,
      })
      .select()
      .single();

    if (nextError || !nextData) {
      throw new Error(`Не удалось создать следующий раунд: ${nextError?.message || "Ошибка создания"}`);
    }

    return {
      completedTurn: mapTurnFromDb(completedData),
      nextTurn: mapTurnFromDb(nextData),
    };
  }
}

export async function startRoomCampaign(
  code: string,
  hostUserId: string,
  input: StartRoomCampaignInput,
  options?: { model?: string; apiKey?: string; authMode?: AuthMode; baseURL?: string }
): Promise<StartRoomCampaignResult> {
  const service = new RoomService();
  return service.startRoomCampaign(code, hostUserId, input, options);
}

export async function getActiveTurn(roomId: string, client?: SupabaseClient): Promise<RoomTurn | null> {
  const service = new RoomService(client);
  return service.getActiveTurn(roomId);
}

export async function submitPlayerAction(
  roomId: string,
  userId: string,
  input: PlayerTurnInput,
  client?: SupabaseClient
): Promise<RoomTurn> {
  const service = new RoomService(client);
  return service.submitPlayerAction(roomId, userId, input);
}

export async function resolveRoomTurn(
  roomId: string,
  dmResponse: string,
  client?: SupabaseClient
): Promise<{ completedTurn: RoomTurn; nextTurn: RoomTurn }> {
  const service = new RoomService(client);
  return service.resolveRoomTurn(roomId, dmResponse);
}
