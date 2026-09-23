// TypeScript типы базы данных Supabase для комнат и синхронизации D&D 5e

export type RoomStatus = "lobby" | "generating" | "active" | "archived";
export type PartyBond = "strangers" | "established";
export type TurnStatus = "waiting" | "resolving" | "completed";

export interface RoomRecord {
  id: string;
  code: string;
  name: string;
  host_user_id: string;
  status: RoomStatus;
  starting_level: number;
  max_level: number;
  party_bond: PartyBond;
  campaign_settings: Record<string, unknown>;
  story_arc?: unknown;
  created_at: string;
  updated_at: string;
}

export interface RoomParticipantRecord {
  id: string;
  room_id: string;
  user_id: string;
  character_id: string;
  character_snapshot: Record<string, unknown>;
  is_host: boolean;
  is_ready: boolean;
  joined_at: string;
}

export interface RoomTurnRecord {
  id: string;
  room_id: string;
  round_number: number;
  status: TurnStatus;
  player_inputs: Record<
    string,
    {
      text: string;
      characterName: string;
      submittedAt: string;
    }
  >;
  dm_response?: string | null;
  created_at: string;
}

export interface SupabaseCharacterRecord {
  id: string;
  user_id: string;
  name: string;
  data: Record<string, unknown>;
  portrait_url?: string | null;
  created_at: string;
  updated_at: string;
}
