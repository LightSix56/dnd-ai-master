-- =============================================================================
-- Migration: 005_claim_orphan_campaigns.sql
-- Purpose: закрепить за владельцем кампании, созданные до того, как вход в аккаунт
--          стал обязательным (у них "userId" пустой).
--
-- После обновления такие кампании не показываются в списке никому. Этот скрипт
-- отдаёт их одному аккаунту — после этого они снова появятся у него на главной
-- и станут недоступны остальным.
--
-- ПЕРЕД ЗАПУСКОМ: замените почту в строке ниже на почту аккаунта, которому
-- должны достаться кампании (та, с которой вы входите через Google).
-- =============================================================================

DO $$
DECLARE
  owner_email text := 'ЗАМЕНИТЕ@НА.ПОЧТУ';
  owner_id text;
  moved int;
BEGIN
  SELECT id::text INTO owner_id FROM auth.users WHERE lower(email) = lower(owner_email) LIMIT 1;
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Аккаунт с почтой % не найден в auth.users', owner_email;
  END IF;

  UPDATE "Campaign" SET "userId" = owner_id WHERE "userId" IS NULL;
  GET DIAGNOSTICS moved = ROW_COUNT;
  RAISE NOTICE 'Закреплено кампаний: % (владелец %)', moved, owner_email;
END $$;

-- Проверка: кампаний без владельца остаться не должно
SELECT count(*) AS campaigns_without_owner FROM "Campaign" WHERE "userId" IS NULL;
