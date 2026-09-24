import type { SupabaseClient } from "@supabase/supabase-js";
import { generateRoomCode, normalizeRoomCode } from "./code-gen";
import { validateCharacterForRoom } from "./validation";
import type {
  CreateRoomInput,
  JoinRoomInput,
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
import type { AuthMode } from "@/lib/ai/client";

export interface StartRoomCampaignInput {
  title: string;
  setting: string;
  tone: string;
  difficulty: "easy" | "normal" | "hard" | "brutal";
  startingSituation: StartingSituation;
  levelTo?: number;
  customDmNotes?: string | null;
  dmStyle?: string;
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

function mapParticipantFromDb(row: Record<string, any>): RoomParticipant {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    characterId: row.character_id,
    characterSnapshot: row.character_snapshot || {},
    isHost: Boolean(row.is_host),
    isReady: Boolean(row.is_ready),
    joinedAt: row.joined_at,
  };
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

export class RoomService {
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
    const participants = Array.isArray(data.room_participants)
      ? data.room_participants.map(mapParticipantFromDb)
      : [];

    return {
      ...room,
      participants,
    };
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
    const participants = Array.isArray(data.room_participants)
      ? data.room_participants.map(mapParticipantFromDb)
      : [];

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
   * Подключает игрока к комнате с выбранным персонажем
   * СТРОГО валидирует уровень персонажа
   */
  async joinRoom(input: JoinRoomInput): Promise<RoomParticipant> {
    // 1. Проверяем существование комнаты и стартовый уровень
    const { data: roomData, error: roomError } = await this.client
      .from("rooms")
      .select("id, starting_level, status, campaign_settings")
      .eq("id", input.roomId)
      .single();

    if (roomError || !roomData) {
      throw new Error("Комната не найдена.");
    }

    if (roomData.status !== "lobby" && roomData.status !== "active") {
      throw new Error(`Невозможно присоединиться к комнате со статусом "${roomData.status}".`);
    }

    // 2. Строгая валидация уровня персонажа
    const validation = validateCharacterForRoom(input.characterSnapshot, roomData.starting_level);
    if (!validation.valid) {
      throw new Error(validation.error || "Уровень персонажа не соответствует кампании.");
    }

    // 3. Добавляем или обновляем запись участника (1 игрок = 1 персонаж в комнате)
    const { data: participantData, error: partError } = await this.client
      .from("room_participants")
      .upsert(
        {
          room_id: input.roomId,
          user_id: input.userId,
          character_id: input.characterId,
          character_snapshot: input.characterSnapshot,
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

    // 4. Если кампания уже активна, добавляем/обновляем персонажа в кампании
    const campaignId = (roomData.campaign_settings as any)?.campaignId;
    if (campaignId) {
      try {
        const snap = input.characterSnapshot as any;
        const name = (snap?.name || snap?.characterSnapshot?.name || "Герой").trim();
        const existing = await db.character.findFirst({
          where: { campaignId, name },
        });
        if (!existing) {
          await db.character.create({
            data: {
              campaignId,
              name,
              type: "player",
              race: snap?.race || snap?.characterSnapshot?.race || null,
              class: snap?.className || snap?.class || snap?.characterSnapshot?.className || null,
              subclass: snap?.subclass || snap?.characterSnapshot?.subclass || null,
              level: snap?.level || snap?.characterSnapshot?.level || roomData.starting_level || 1,
              notes: JSON.stringify(snap),
            },
          });
        }
      } catch (err) {
        console.warn("[room-service] Failed to sync participant to campaign db.character:", err);
      }
    }

    return mapParticipantFromDb(participantData);
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

    if (roomWithParticipants.hostUserId !== hostUserId) {
      const isHostInParts = roomWithParticipants.participants.some(
        (p) => p.userId === hostUserId && p.isHost
      );
      if (!isHostInParts) {
        throw new Error("Только создатель комнаты (Человек-ДМ) может запустить кампанию");
      }
    }

    const party = extractPartyRosterFromParticipants(roomWithParticipants.participants);
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
          title: input.title,
          setting: input.setting,
          tone: input.tone,
          difficulty: input.difficulty,
          startingSituation: input.startingSituation,
          levelFrom: roomWithParticipants.startingLevel,
          levelTo: input.levelTo || Math.max(roomWithParticipants.startingLevel + 4, 5),
          party,
          customDmNotes: input.customDmNotes,
          dmStyle: input.dmStyle,
          ruleStrictness: input.ruleStrictness,
        },
        options
      );
    } catch {
      // Фолбэк на базовый каркас Акта 1 в случае сбоя сети / отсутствия API-ключа
      const actLevelTo = Math.min(
        input.levelTo || 5,
        Math.max(roomWithParticipants.startingLevel + 2, 3)
      );
      arc = {
        title: input.title,
        premise: `Герои отправляются навстречу опасностям в мире «${input.setting}».`,
        mainThreat: "Древняя зловещая сила пробуждается и грозит разрушить хрупкий порядок.",
        levelFrom: roomWithParticipants.startingLevel,
        levelTo: input.levelTo || 10,
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

    let campaignId = "";
    try {
      const campaign = await db.campaign.create({
        data: {
          name: input.title,
          setting: input.setting,
          tone: input.tone,
          difficulty: input.difficulty,
          dmStyle: input.dmStyle || "balanced",
          ruleStrictness: input.ruleStrictness || "standard",
          levelFrom: roomWithParticipants.startingLevel,
          levelTo: input.levelTo || Math.max(roomWithParticipants.startingLevel + 4, 5),
          startingLevel: roomWithParticipants.startingLevel,
          worldDescription: input.setting,
          customDmNotes: input.customDmNotes || null,
          storyArc: JSON.stringify(arc),
        },
      });
      campaignId = campaign.id;

      for (const m of party) {
        await db.character.create({
          data: {
            campaignId: campaign.id,
            name: m.name,
            type: "player",
            race: m.race || null,
            class: m.className || null,
            subclass: m.subclass || null,
            level: m.level,
            notes: JSON.stringify(m),
          },
        });
      }
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
          title: input.title,
          setting: input.setting,
          tone: input.tone,
          difficulty: input.difficulty,
          startingSituation: input.startingSituation,
          levelTo: input.levelTo,
          customDmNotes: input.customDmNotes,
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
        dm_response: null,
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
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Не удалось обновить действие игрока: ${error?.message || "Ошибка обновления"}`);
    }

    return mapTurnFromDb(data);
  }

  /**
   * Завершает текущий раунд с ответом ДМ и создаёт следующий раунд
   */
  async resolveRoomTurn(
    roomId: string,
    dmResponse: string
  ): Promise<{ completedTurn: RoomTurn; nextTurn: RoomTurn }> {
    const activeTurn = await this.getActiveTurn(roomId);
    if (!activeTurn) {
      throw new Error("Нет активного раунда для завершения");
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
