-- =============================================================================
-- Migration: 003_room_turn_safety.sql
-- Purpose: надёжность раундов в сетевых комнатах.
--   1) Атомарная запись хода игрока. Раньше сервер читал JSON player_inputs,
--      дописывал ход и писал обратно — при одновременной отправке двумя игроками
--      один ход затирался.
--   2) Метка времени начала обработки раунда. Если функция, вызвавшая мастера,
--      упала, раунд оставался в статусе resolving навсегда; теперь зависшую
--      блокировку можно перехватить по времени.
-- Безопасно для повторного запуска. Код работает и без этой миграции
-- (по-старому, без этих гарантий), поэтому порядок выкладки не важен.
-- =============================================================================

ALTER TABLE public.room_turns
  ADD COLUMN IF NOT EXISTS resolving_started_at TIMESTAMPTZ DEFAULT NULL;

-- Дописывает ход игрока одной командой UPDATE. Возвращает обновлённую строку,
-- либо ничего — если раунд уже обрабатывается/завершён или игрок уже ходил.
CREATE OR REPLACE FUNCTION public.room_submit_turn_input(
  p_turn_id UUID,
  p_user_id TEXT,
  p_input JSONB
)
RETURNS SETOF public.room_turns
LANGUAGE sql
AS $$
  UPDATE public.room_turns
     SET player_inputs = player_inputs || jsonb_build_object(p_user_id, p_input)
   WHERE id = p_turn_id
     AND status = 'waiting'
     AND NOT (player_inputs ? p_user_id)
  RETURNING *;
$$;
