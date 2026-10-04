-- =============================================================================
-- Migration: 004_room_read_policies.sql
-- Purpose: правила чтения (RLS) для таблиц комнат, чтобы Supabase Realtime
--          доставлял изменения игрокам мгновенно, а не только через опрос.
--
-- Что разрешается: вошедший пользователь может ЧИТАТЬ комнату, её участников
-- и раунды, если он сам участник этой комнаты (или её ведущий).
-- Что НЕ меняется: запись (INSERT/UPDATE/DELETE) из браузера по-прежнему
-- запрещена — правил на запись нет, всё пишет сервер сервисным ключом.
--
-- Скрипт можно запускать повторно.
-- =============================================================================

-- Проверка «текущий пользователь состоит в комнате».
-- SECURITY DEFINER нужен, чтобы правило на room_participants не ссылалось
-- само на себя (иначе Postgres выдаёт ошибку бесконечной рекурсии).
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = p_room_id AND rp.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = p_room_id AND r.host_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_room_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_room_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid) TO authenticated;

-- RLS уже включён; строки оставлены, чтобы скрипт был самодостаточным.
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rooms_select_members ON public.rooms;
CREATE POLICY rooms_select_members ON public.rooms
  FOR SELECT TO authenticated
  USING (public.is_room_member(id));

DROP POLICY IF EXISTS room_participants_select_members ON public.room_participants;
CREATE POLICY room_participants_select_members ON public.room_participants
  FOR SELECT TO authenticated
  USING (public.is_room_member(room_id));

DROP POLICY IF EXISTS room_turns_select_members ON public.room_turns;
CREATE POLICY room_turns_select_members ON public.room_turns
  FOR SELECT TO authenticated
  USING (public.is_room_member(room_id));

GRANT SELECT ON public.rooms, public.room_participants, public.room_turns TO authenticated;
