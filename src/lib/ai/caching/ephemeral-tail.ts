// Ephemeral Tail (Зона 3 кэширования LLM)
// Содержит волатильное состояние сцены: текущие HP персонажей, статусы NPC/врагов,
// недавние события и броски кубиков.
// КАТЕГОРИЧЕСКОЕ ПРАВИЛО: инжектируется ИСКЛЮЧИТЕЛЬНО в хвост последнего
// пользовательского сообщения. Это гарантирует неизменность (100% Cache Hit)
// всех токенов префикса (Зона 1) и предшествующей истории (Зона 2).

import type { ModelMessage } from "ai";
import { db } from "@/lib/db";

export interface EphemeralPartyMemberState {
  name: string;
  hpCurrent: number;
  hpMax: number;
  hpTemp?: number;
  ac?: number;
  location?: string;
  condition?: string;
}

export interface EphemeralNpcState {
  name: string;
  healthCondition: string;
  relation?: string;
  location?: string;
}

export interface EphemeralRecentEvent {
  description: string;
  turn?: number;
}

export interface EphemeralSceneState {
  roundNumber?: number;
  partyStatus: EphemeralPartyMemberState[];
  npcStatus: EphemeralNpcState[];
  recentEvents: EphemeralRecentEvent[];
}

/**
 * Формирует компактный структурированный текстовый срез состояния сцены для инжекции.
 */
export function formatSceneSnapshot(state: EphemeralSceneState): string {
  const roundHeader =
    state.roundNumber !== undefined
      ? `[ОБСТАНОВКА И СТАТУС СЦЕНЫ (Раунд ${state.roundNumber})]:`
      : `[ОБСТАНОВКА И СТАТУС СЦЕНЫ]:`;

  const partyMembers = state.partyStatus.map((p) => {
    const parts: string[] = [`HP ${p.hpCurrent}/${p.hpMax}${p.hpTemp ? `+${p.hpTemp}` : ""}`];
    if (p.condition) parts.push(p.condition);
    if (p.ac !== undefined) parts.push(`AC ${p.ac}`);
    return `${p.name} (${parts.join(", ")})`;
  });

  const partyLine =
    partyMembers.length > 0 ? `- Отряд: ${partyMembers.join(", ")}` : `- Отряд: —`;

  const npcs = state.npcStatus.map((npc) => `${npc.name} [${npc.healthCondition}]`);

  const npcLine = npcs.length > 0 ? `- NPC/Враги: ${npcs.join(", ")}` : `- NPC/Враги: —`;

  const events = state.recentEvents.map((e) => e.description);
  const eventsLine =
    events.length > 0 ? `- Последние события: ${events.join("; ")}` : `- Последние события: —`;

  return `${roundHeader}\n${partyLine}\n${npcLine}\n${eventsLine}`;
}

/**
 * Находит последнее сообщение с role: "user" и дописывает ephemeralTail в его конец.
 * ВСЕ предыдущие сообщения массива остаются 100% нетронутыми по ссылкам и содержимому!
 */
export function injectEphemeralTailToLastUserMessage(
  messages: ModelMessage[],
  ephemeralTail: string
): ModelMessage[] {
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIndex = i;
      break;
    }
  }

  if (lastUserIndex === -1) {
    return messages;
  }

  const updated = [...messages];
  const targetMsg = messages[lastUserIndex];

  let newContent: any;
  if (typeof targetMsg.content === "string") {
    newContent = `${targetMsg.content}\n\n${ephemeralTail}`;
  } else if (Array.isArray(targetMsg.content)) {
    const parts = [...(targetMsg.content as any[])];
    let lastTextPartIdx = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i]?.type === "text") {
        lastTextPartIdx = i;
        break;
      }
    }

    if (lastTextPartIdx >= 0) {
      parts[lastTextPartIdx] = {
        ...parts[lastTextPartIdx],
        text: `${parts[lastTextPartIdx].text}\n\n${ephemeralTail}`,
      };
    } else {
      parts.push({ type: "text", text: `\n\n${ephemeralTail}` });
    }
    newContent = parts;
  } else {
    newContent = `${String(targetMsg.content ?? "")}\n\n${ephemeralTail}`;
  }

  updated[lastUserIndex] = {
    ...targetMsg,
    content: newContent,
  };

  return updated;
}

/**
 * Запрашивает текущее состояние отряда, NPC и свежих событий сцены из БД
 * и возвращает отформатированный ephemeral tail.
 */
export async function fetchEphemeralSceneTail(
  campaignId: string,
  roundNumber?: number
): Promise<string> {
  const [characters, events] = await Promise.all([
    db.character.findMany({
      where: { campaignId, isAlive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }, { id: "asc" }],
      take: 20,
    }),
    db.gameEvent.findMany({
      where: { campaignId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 6,
    }),
  ]);

  const partyStatus: EphemeralPartyMemberState[] = [];
  const npcStatus: EphemeralNpcState[] = [];

  for (const c of characters) {
    if (c.type === "player") {
      let condition: string | undefined;
      if (c.hpCurrent <= 0) {
        condition = "без сознания";
      } else if (c.hpCurrent <= c.hpMax * 0.3) {
        condition = "тяжело ранен";
      } else if (c.hpCurrent < c.hpMax) {
        condition = "ранен";
      }

      partyStatus.push({
        name: c.name,
        hpCurrent: c.hpCurrent,
        hpMax: c.hpMax,
        hpTemp: c.hpTemp && c.hpTemp > 0 ? c.hpTemp : undefined,
        ac: c.ac,
        location: c.location ?? undefined,
        condition,
      });
    } else {
      let healthCondition = "здоров";
      if (c.hpCurrent <= 0) {
        healthCondition = "без сознания";
      } else if (c.hpCurrent <= c.hpMax * 0.3) {
        healthCondition = "тяжело ранен";
      } else if (c.hpCurrent < c.hpMax) {
        healthCondition = "ранен";
      }

      let relation = "нейтрален";
      if (c.type === "enemy" || (c.relation ?? 0) <= -30) {
        relation = "враг";
      } else if ((c.relation ?? 0) < 0) {
        relation = "насторожен";
      } else if (c.type === "companion" || (c.relation ?? 0) >= 50) {
        relation = "союзник";
      }

      npcStatus.push({
        name: c.name,
        healthCondition,
        relation,
        location: c.location ?? undefined,
      });
    }
  }

  const recentEvents: EphemeralRecentEvent[] = events.map((e) => ({
    description: e.description,
    turn: e.turn,
  }));

  return formatSceneSnapshot({
    roundNumber,
    partyStatus,
    npcStatus,
    recentEvents,
  });
}

// Алиас для обратной совместимости со спецификацией архитектуры
export const buildEphemeralSceneTail = fetchEphemeralSceneTail;
