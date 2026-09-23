-- =============================================================================
-- Migration: 001_create_rooms_schema.sql
-- Purpose: Co-op Multiplayer Lobby, Participants, and Turn Batching
-- =============================================================================

-- 1. Таблица комнат
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'generating', 'active', 'archived')),
  starting_level INT NOT NULL DEFAULT 1 CHECK (starting_level >= 1 AND starting_level <= 20),
  max_level INT NOT NULL DEFAULT 20 CHECK (max_level >= starting_level AND max_level <= 20),
  party_bond TEXT NOT NULL DEFAULT 'strangers' CHECK (party_bond IN ('strangers', 'established')),
  campaign_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  story_arc JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индекс для мгновенного поиска комнаты по коду из ссылки (например "DRAGON-42")
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms (code);
CREATE INDEX IF NOT EXISTS idx_rooms_host_user_id ON public.rooms (host_user_id);

-- 2. Участники комнаты и их выбранные персонажи
CREATE TABLE IF NOT EXISTS public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE RESTRICT,
  character_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_host BOOLEAN NOT NULL DEFAULT false,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_room_participant_user UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON public.room_participants (room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON public.room_participants (user_id);

-- 3. Раунды одновременного ввода (Turn Batching)
CREATE TABLE IF NOT EXISTS public.room_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round_number INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'resolving', 'completed')),
  player_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  dm_response TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_turns_room_id ON public.room_turns (room_id);

-- 4. Включение Supabase Realtime для комнат и участников
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_turns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_turns;
  END IF;
END $$;
