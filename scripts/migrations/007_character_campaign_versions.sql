-- =============================================================================
-- Migration: 007_character_campaign_versions.sql
-- Purpose: версии персонажа для кампаний и единый лист для двух сайтов.
--
-- Что добавляется:
--   * в public.characters — ссылка на оригинал, кампания, её название и
--     счётчик изменений строки (revision);
--   * две служебные функции, которыми сайт мастера точечно пишет в лист
--     итоги игры (хиты, ячейки, состояния, опыт), не заменяя весь лист;
--   * в таблицы кампании ("Character", "Combat") — ссылка героя на его лист
--     и отметка «итоги боя записаны в лист».
--
-- Ничего не удаляется и не переписывается. Старый код продолжает работать.
-- Скрипт можно запускать повторно.
-- =============================================================================

-- 1. Новые колонки листа --------------------------------------------------------

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS source_character_id uuid
    REFERENCES public.characters(id) ON DELETE SET NULL;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS campaign_id text;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS campaign_name text;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;

-- Одна версия на пару «оригинал + кампания»
CREATE UNIQUE INDEX IF NOT EXISTS characters_source_campaign_uidx
  ON public.characters (source_character_id, campaign_id)
  WHERE source_character_id IS NOT NULL AND campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS characters_campaign_idx
  ON public.characters (campaign_id)
  WHERE campaign_id IS NOT NULL;

-- 2. Счётчик изменений ----------------------------------------------------------
-- Увеличивается при каждом изменении строки. По нему сайт листа понимает,
-- что лист успели изменить с другой стороны, и не затирает чужую запись.

CREATE OR REPLACE FUNCTION public.bump_character_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.revision = COALESCE(OLD.revision, 0) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_revision ON public.characters;
CREATE TRIGGER bump_revision
  BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.bump_character_revision();

-- 3. Поля кампании меняет только сервер -------------------------------------------
-- Из браузера нельзя ни объявить персонажа версией чужой кампании, ни отвязать его.

CREATE OR REPLACE FUNCTION public.protect_character_campaign_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.campaign_id = NULL;
    NEW.campaign_name = NULL;
    NEW.source_character_id = NULL;
  ELSE
    NEW.campaign_id = OLD.campaign_id;
    NEW.campaign_name = OLD.campaign_name;
    NEW.source_character_id = OLD.source_character_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_campaign_fields ON public.characters;
CREATE TRIGGER protect_campaign_fields
  BEFORE INSERT OR UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.protect_character_campaign_fields();

-- 4. Точечная запись итогов игры --------------------------------------------------
-- Лист в колонке data иногда лежит строкой внутри jsonb (двойное кодирование) —
-- обе функции сначала приводят его к обычному объекту.

CREATE OR REPLACE FUNCTION public.apply_character_game_state(p_id uuid, p_patch jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revision integer;
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'apply_character_game_state: patch must be a json object';
  END IF;

  UPDATE public.characters
     SET data = (CASE WHEN jsonb_typeof(data) = 'string' THEN (data #>> '{}')::jsonb ELSE data END) || p_patch
   WHERE id = p_id
  RETURNING revision INTO v_revision;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'apply_character_game_state: character % not found', p_id;
  END IF;
  RETURN v_revision;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_character_experience(p_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  UPDATE public.characters c
     SET data = jsonb_set(
           n.sheet,
           '{experiencePoints}',
           to_jsonb(
             GREATEST(
               0,
               COALESCE(
                 CASE WHEN (n.sheet ->> 'experiencePoints') ~ '^-?[0-9]+$'
                      THEN (n.sheet ->> 'experiencePoints')::integer END,
                 0
               ) + COALESCE(p_amount, 0)
             )
           ),
           true
         )
    FROM (
      SELECT id,
             CASE WHEN jsonb_typeof(data) = 'string' THEN (data #>> '{}')::jsonb ELSE data END AS sheet
        FROM public.characters
       WHERE id = p_id
    ) n
   WHERE c.id = n.id
  RETURNING (c.data ->> 'experiencePoints')::integer INTO v_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'add_character_experience: character % not found', p_id;
  END IF;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_character_game_state(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_character_experience(uuid, integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.apply_character_game_state(uuid, jsonb) FROM anon;
    REVOKE ALL ON FUNCTION public.add_character_experience(uuid, integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.apply_character_game_state(uuid, jsonb) FROM authenticated;
    REVOKE ALL ON FUNCTION public.add_character_experience(uuid, integer) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.apply_character_game_state(uuid, jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION public.add_character_experience(uuid, integer) TO service_role;
  END IF;
END;
$$;

-- 5. Таблицы кампании ------------------------------------------------------------

ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "sheetCharacterId" text;
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "sheetLevelSeen" integer;
CREATE INDEX IF NOT EXISTS "Character_sheetCharacterId_idx" ON "Character" ("sheetCharacterId");

ALTER TABLE "Combat" ADD COLUMN IF NOT EXISTS "sheetSyncedAt" timestamp(3);

-- =============================================================================
-- ПРОВЕРКА (выполнить после скрипта, результат — 4 строки):
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'characters'
--    AND column_name IN ('source_character_id', 'campaign_id', 'campaign_name', 'revision');
-- =============================================================================
