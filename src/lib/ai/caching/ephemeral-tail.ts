// Ephemeral Tail (Зона 3 кэширования LLM)
// Содержит волатильное состояние сцены: текущие HP персонажей, статусы NPC/врагов,
// недавние события и броски кубиков.
// КАТЕГОРИЧЕСКОЕ ПРАВИЛО: инжектируется ИСКЛЮЧИТЕЛЬНО в хвост последнего
// пользовательского сообщения. Это гарантирует неизменность (100% Cache Hit)
// всех токенов префикса (Зона 1) и предшествующей истории (Зона 2).

import type { ModelMessage } from "ai";
import { db } from "@/lib/db";
import { extractNoteInsights } from "./frozen-prefix";

/** Сколько NPC, заметок летописца и фактов памяти помещается в срез сцены */
const MAX_NPCS_IN_TAIL = 12;
const MAX_INSIGHTS_PER_HERO = 4;
const MAX_MEMORIES_IN_TAIL = 8;
const MEMORY_CHAR_LIMIT = 220;

function statusFromNotes(notes?: string | null): string | undefined {
  if (!notes) return undefined;
  const m = notes.match(/\[(?:Статус|Состояние):\s*([^\]]+)\]/i);
  return m ? m[1].trim() : undefined;
}

export interface EphemeralPartyMemberState {
  name: string;
  hpCurrent: number;
  hpMax: number;
  hpTemp?: number;
  ac?: number;
  location?: string;
  condition?: string;
  /** Что герой делает прямо сейчас (тег [Статус: …] летописца) */
  status?: string;
  /** Черты и факты, замеченные летописцем по ходу игры */
  insights?: string[];
}

export interface EphemeralNpcState {
  name: string;
  healthCondition: string;
  relation?: string;
  location?: string;
  /** Что NPC делает прямо сейчас */
  status?: string;
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
  /** Важные факты долгой памяти, относящиеся к сцене */
  memories?: string[];
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

  const npcs = state.npcStatus.map((npc) => {
    let base = `${npc.name} [${npc.healthCondition}]`;
    if (npc.relation && npc.relation !== "нейтрален") base += ` (${npc.relation})`;
    return npc.status ? `${base} — ${npc.status}` : base;
  });

  const npcLine = npcs.length > 0 ? `- NPC/Враги: ${npcs.join(", ")}` : `- NPC/Враги: —`;

  const events = state.recentEvents.map((e) => e.description);
  const eventsLine =
    events.length > 0 ? `- Последние события: ${events.join("; ")}` : `- Последние события: —`;

  const lines = [roundHeader, partyLine];

  const heroNotes = state.partyStatus
    .map((p) => {
      const bits: string[] = [];
      if (p.location) bits.push(`где: ${p.location}`);
      if (p.status) bits.push(`сейчас: ${p.status}`);
      if (p.insights && p.insights.length > 0) bits.push(`замечено: ${p.insights.join("; ")}`);
      return bits.length > 0 ? `${p.name} — ${bits.join("; ")}` : "";
    })
    .filter(Boolean);
  if (heroNotes.length > 0) lines.push(`- Герои подробнее: ${heroNotes.join(" | ")}`);

  lines.push(npcLine, eventsLine);

  if (state.memories && state.memories.length > 0) {
    lines.push(`- Память (важные факты): ${state.memories.join("; ")}`);
  }

  return lines.join("\n");
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
      take: 200,
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
        status: statusFromNotes(c.notes),
        insights: extractNoteInsights(c.notes).slice(-MAX_INSIGHTS_PER_HERO),
      });
    } else {
      // В срез идут только те, кто сейчас в сцене: остальные NPC кампании мастеру в этот ход не нужны
      if (c.inScene === false) continue;
      if (npcStatus.length >= MAX_NPCS_IN_TAIL) continue;

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
        status: statusFromNotes(c.notes),
      });
    }
  }

  const recentEvents: EphemeralRecentEvent[] = events.map((e) => ({
    description: e.description,
    turn: e.turn,
  }));

  const sceneNames = [...partyStatus.map((p) => p.name), ...npcStatus.map((n) => n.name)];
  const memories = await fetchRelevantMemories(campaignId, sceneNames);

  return formatSceneSnapshot({
    roundNumber,
    partyStatus,
    npcStatus,
    recentEvents,
    memories,
  });
}

/**
 * Факты долгой памяти для среза сцены: сначала о тех, кто сейчас в сцене, затем самые важные.
 * Раньше память писалась, но читалась только если мастер сам вызывал recall_memories.
 */
export async function fetchRelevantMemories(campaignId: string, sceneNames: string[]): Promise<string[]> {
  try {
    const rows =
      (await db.memory.findMany({
        where: { campaignId, isArchived: false },
        orderBy: [{ importance: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        take: 60,
        select: { subject: true, content: true, importance: true },
      })) ?? [];
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const names = sceneNames.map((n) => n.toLowerCase()).filter((n) => n.length >= 3);
    const aboutScene = (subject: string) => {
      const s = (subject || "").toLowerCase();
      if (!s) return false;
      return names.some((n) => s.includes(n) || n.includes(s) || s.includes(n.split(" ")[0]));
    };

    const picked: typeof rows = [];
    for (const r of rows) if (aboutScene(r.subject) && picked.length < MAX_MEMORIES_IN_TAIL) picked.push(r);
    for (const r of rows) {
      if (picked.length >= MAX_MEMORIES_IN_TAIL) break;
      if (r.importance >= 8 && !picked.includes(r)) picked.push(r);
    }

    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of picked) {
      const text = `${r.subject}: ${r.content}`.replace(/\s+/g, " ").trim();
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text.length > MEMORY_CHAR_LIMIT ? `${text.slice(0, MEMORY_CHAR_LIMIT - 1)}…` : text);
    }
    return out;
  } catch {
    // Память — подсказка, а не необходимость: без неё ход всё равно состоится
    return [];
  }
}

// Алиас для обратной совместимости со спецификацией архитектуры
export const buildEphemeralSceneTail = fetchEphemeralSceneTail;
