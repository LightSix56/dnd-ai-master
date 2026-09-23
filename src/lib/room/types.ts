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

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  characterId: string;
  characterSnapshot: {
    id?: string;
    name: string;
    level: number;
    race?: string;
    className?: string;
    subclass?: string;
    portraitUrl?: string | null;
    [key: string]: unknown;
  };
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
  characterId: string;
  characterSnapshot: RoomParticipant["characterSnapshot"];
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
