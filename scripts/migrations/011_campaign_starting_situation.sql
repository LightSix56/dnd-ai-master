-- Migration: 011_campaign_starting_situation.sql
-- Начальная связь героев (завязка Акта 1). NULL у старых кампаний: промпт её не выводит.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "startingSituation" TEXT;
