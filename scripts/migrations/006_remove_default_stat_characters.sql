-- =============================================================================
-- Migration: 006_remove_default_stat_characters.sql
-- Purpose: удалить случайно созданных персонажей со стандартным набором
--          характеристик (все шесть равны 10).
--
-- Откуда они взялись: при выборе «героя кампании» в сетевой комнате в аккаунт
-- записывалась урезанная карточка без характеристик — сайт листа показывал её
-- как персонажа со всеми десятками. Причина устранена в коде.
--
-- УДАЛЕНИЕ НЕОБРАТИМО. Сначала выполните ШАГ 1 и посмотрите, что попадёт под
-- удаление. Если в списке есть нужный персонаж — не запускайте ШАГ 2.
--
-- Что НЕ удаляется:
--   * персонажи, которыми прямо сейчас играют в незакрытой сетевой комнате
--     (в ШАГЕ 1 у них in_open_room = true) — иначе игроков выбросило бы из игры;
--   * NPC и враги в кампаниях: у них десятки бывают намеренно.
-- =============================================================================

-- ШАГ 1. Просмотр: что будет удалено ------------------------------------------

-- 1а. Персонажи аккаунтов (их показывает сайт с листом персонажа)
WITH sheets AS (
  SELECT c.id, c.name, c.user_id, c.updated_at,
         CASE WHEN jsonb_typeof(c.data::jsonb) = 'string'
              THEN (c.data::jsonb #>> '{}')::jsonb
              ELSE c.data::jsonb END AS d
  FROM public.characters c
)
SELECT s.id, s.name, u.email, s.updated_at,
       EXISTS (
         SELECT 1 FROM public.room_participants rp
         JOIN public.rooms r ON r.id = rp.room_id
         WHERE rp.character_id = s.id AND r.status <> 'archived'
       ) AS in_open_room
FROM sheets s
LEFT JOIN auth.users u ON u.id = s.user_id
WHERE jsonb_typeof(s.d) = 'object'
  AND COALESCE(s.d->'abilityScores'->>'СИЛ', '10') = '10'
  AND COALESCE(s.d->'abilityScores'->>'ЛОВ', '10') = '10'
  AND COALESCE(s.d->'abilityScores'->>'ТЕЛ', '10') = '10'
  AND COALESCE(s.d->'abilityScores'->>'ИНТ', '10') = '10'
  AND COALESCE(s.d->'abilityScores'->>'МДР', '10') = '10'
  AND COALESCE(s.d->'abilityScores'->>'ХАР', '10') = '10'
ORDER BY s.updated_at DESC;

-- 1б. Герои игроков внутри кампаний ИИ-мастера
SELECT ch.id, ch.name, ch.class, ch.level, ca.name AS campaign
FROM "Character" ch
JOIN "Campaign" ca ON ca.id = ch."campaignId"
WHERE ch.type = 'player'
  AND ch.str = 10 AND ch.dex = 10 AND ch.con = 10
  AND ch."int" = 10 AND ch.wis = 10 AND ch.cha = 10
ORDER BY ca.name, ch.name;

-- ШАГ 2. Удаление --------------------------------------------------------------
-- Запускайте только после просмотра результатов ШАГА 1.
-- Всё идёт одной транзакцией: при любой ошибке не удалится ничего.

BEGIN;

CREATE TEMP TABLE _default_stat_sheets ON COMMIT DROP AS
WITH sheets AS (
  SELECT c.id,
         CASE WHEN jsonb_typeof(c.data::jsonb) = 'string'
              THEN (c.data::jsonb #>> '{}')::jsonb
              ELSE c.data::jsonb END AS d
  FROM public.characters c
)
SELECT s.id
FROM sheets s
WHERE jsonb_typeof(s.d) = 'object'
  AND COALESCE(s.d->'abilityScores'->>'СИЛ', '10') = '10'
  AND COALESCE(s.d->'abilityScores'->>'ЛОВ', '10') = '10'
  AND COALESCE(s.d->'abilityScores'->>'ТЕЛ', '10') = '10'
  AND COALESCE(s.d->'abilityScores'->>'ИНТ', '10') = '10'
  AND COALESCE(s.d->'abilityScores'->>'МДР', '10') = '10'
  AND COALESCE(s.d->'abilityScores'->>'ХАР', '10') = '10'
  -- тех, кем играют в незакрытой комнате, не трогаем
  AND NOT EXISTS (
    SELECT 1 FROM public.room_participants rp
    JOIN public.rooms r ON r.id = rp.room_id
    WHERE rp.character_id = s.id AND r.status <> 'archived'
  );

-- 2а. Записи участников закрытых комнат, ссылающиеся на удаляемых персонажей
DELETE FROM public.room_participants rp
USING _default_stat_sheets t
WHERE rp.character_id = t.id;

-- 2б. Персонажи аккаунтов
DELETE FROM public.characters c
USING _default_stat_sheets t
WHERE c.id = t.id;

-- 2в. Герои игроков в кампаниях
DELETE FROM "Character"
WHERE type = 'player'
  AND str = 10 AND dex = 10 AND con = 10
  AND "int" = 10 AND wis = 10 AND cha = 10;

COMMIT;
