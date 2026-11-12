-- Migration: 012_combat_pending_reaction.sql
-- Окно выбора реакции (как в BG3): ожидающее решение игрока хранится в бою.
-- JSON { id, action, body, seed, decisions, prompt }; NULL — решения не ждут.
ALTER TABLE "Combat" ADD COLUMN IF NOT EXISTS "pendingReaction" TEXT;
