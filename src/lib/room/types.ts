// Типы бизнес-логики комнат и мультиплеерного лобби D&D 5e

export type RoomStatus = "lobby" | "generating" | "active" | "archived";
export type PartyBond = "strangers" | "established";
export type TurnStatus = "waiting" | "resolving" | "completed";

export interface CreateRoomInput {
  name: string;
  startingLevel: number;
  maxLevel?: number;
  partyBond?: PartyBond;
  campaignSettings?: Record<string, unknown>;
  campaignId?: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostUserId: string;
  status: RoomStatus;
  startingLevel: number;
  maxLevel: number;
  partyBond: PartyBond;
  campaignSettings: Record<string, unknown>;
  campaignId?: string | null;
  storyArc?: unknown;
  createdAt: string;
  updatedAt: string;
}

/**
 * Краткие сведения о герое участника. Собираются при чтении из листа в базе
 * (public.characters) и нигде не хранятся.
 */
export interface ParticipantCharacter {
  /** id строки листа (у героя кампании — его версии для этой кампании) */
  id: string;
  name: string;
  level: number;
  race?: string;
  className?: string;
  subclass?: string;
  portraitUrl?: string | null;
  hpMax?: number;
  hpCurrent?: number;
  armorClass?: number;
  /** Состояния героя из листа, одной строкой (для сводки мастеру) */
  condition?: string;
  /** Лист не найден в базе: герой выбран, но показать и сыграть им нельзя */
  missing?: boolean;
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  /** id строки листа в public.characters */
  characterId: string;
  character: ParticipantCharacter;
  isHost: boolean;
  isReady: boolean;
  joinedAt: string;
}

export interface RoomWithParticipants extends Room {
  participants: RoomParticipant[];
}

export interface JoinRoomInput {
  roomId: string;
  userId: string;
  /**
   * Кем играть: id листа игрока (оригинал или версия этой кампании) либо id героя кампании.
   * Не нужен, если передан create.
   */
  characterId?: string;
  /** Быстрое создание героя прямо в кампании комнаты */
  create?: { name: string; race?: string; className?: string };
  isHost?: boolean;
}

export interface RoomTurn {
  id: string;
  roomId: string;
  roundNumber: number;
  status: "waiting" | "resolving" | "completed";
  playerInputs: Record<string, import("./turn-batcher").PlayerTurnInput>;
  dmResponse?: string | null;
  createdAt: string;
}
