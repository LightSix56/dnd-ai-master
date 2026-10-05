-- =============================================================================
-- Migration: 009_function_security_hardening.sql
-- Purpose: закрыть замечания проверки безопасности Supabase (Security Advisor).
--
-- 1. У функций фиксируется search_path: иначе вызывающий может подменить схему поиска
--    и подсунуть функции свою таблицу или оператор с тем же именем.
-- 2. Триггер создания профиля handle_new_user (SECURITY DEFINER) нельзя вызывать через
--    REST API (/rest/v1/rpc/handle_new_user). Триггер от этого не перестаёт работать:
--    право EXECUTE при срабатывании триггера не проверяется.
--
-- get_character_share (публичные ссылки на лист) и is_room_member (используется в
-- правилах доступа комнат) открыты намеренно и не меняются.
--
-- Скрипт можно запускать повторно.
-- =============================================================================

ALTER FUNCTION public.room_submit_turn_input(uuid, text, jsonb) SET search_path = public;
ALTER FUNCTION public.bump_character_revision() SET search_path = public;
ALTER FUNCTION public.protect_character_campaign_fields() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
