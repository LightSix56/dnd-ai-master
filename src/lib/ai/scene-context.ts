// Сборка контекста сцены для запроса.
//
// Раньше в промпт лился блок на 12К символов: 8 событий целиком + 15 памятей,
// где средняя запись весила 745 символов. При этом промпт ещё и требовал
// вызывать recall_memories — те же данные оплачивались дважды.
//
// Теперь: жёсткий бюджет символов, приоритет по важности и свежести, обрезка
// длинных записей. Всё, что не поместилось, мастер добирает инструментами.

import { db } from "@/lib/db";
import { loadSummaries } from "./compact";

// Бюджеты подобраны так, чтобы блок контекста укладывался примерно в 3К символов
// вместо прежних 12К, сохраняя самое важное.
const MEMORY_BUDGET = 1800;
const EVENT_BUDGET = 700;
const MEMORY_ITEM_LIMIT = 200;
const MAX_MEMORIES = 10;
const MAX_EVENTS = 6;

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

export interface SceneContext {
  text: string;
  memoriesUsed: number;
  eventsUsed: number;
  hasSummary: boolean;
}

export async function buildSceneContext(campaignId: string): Promise<SceneContext | null> {
  const [memories, events, summary, party] = await Promise.all([
    db.memory.findMany({
      where: { campaignId, isArchived: false },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take: MAX_MEMORIES * 2,
    }),
    db.gameEvent.findMany({
      where: { campaignId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: MAX_EVENTS,
    }),
    loadSummaries(campaignId),
    // Живые персонажи с их HP — то, ради чего мастер чаще всего дёргал
    // list_characters отдельным шагом. Строка на персонажа стоит дешевле шага.
    db.character.findMany({
      where: { campaignId, isAlive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }, { id: "asc" }],
      take: 16,
      select: {
        name: true,
        type: true,
        race: true,
        class: true,
        level: true,
        hpCurrent: true,
        hpMax: true,
        ac: true,
        location: true,
        relation: true,
        background: true,
        personality: true,
        bonds: true,
        flaws: true,
        notes: true,
      },
    }),
  ]);

  const sections: string[] = [];

  if (summary) {
    sections.push(`## Что было раньше (сжатая хроника)\n${summary}`);
  }

  if (party.length > 0) {
    const roster = party
      .map((c) => {
        const where = c.location ? `, локация: ${c.location}` : "";
        if (c.type === "player") {
          const who = [c.race, c.class].filter(Boolean).join(" ");
          const bg = c.background ? `, Предыстория: ${c.background}` : "";
          const traits = [
            c.personality ? `черты: ${c.personality}` : "",
            c.bonds ? `узы: ${c.bonds}` : "",
            c.flaws ? `слабость: ${c.flaws}` : "",
          ].filter(Boolean).join("; ");
          const traitDesc = traits ? ` [${traits}]` : "";
          const noteDesc = c.notes ? ` (досье: ${truncate(c.notes, 80)})` : "";
          return `- [Герой отряда: ${c.name}] (${who ? `${who}, ` : ""}${c.level}ур${bg}): HP ${c.hpCurrent}/${c.hpMax}, AC ${c.ac}${where}${traitDesc}${noteDesc}`;
        }

        // Качественный статус NPC без точных цифр HP/AC (экономия токенов и естественный нарратив)
        let healthCondition = "здоров";
        if (c.hpCurrent <= 0) {
          healthCondition = "без сознания / при смерти";
        } else if (c.hpCurrent <= c.hpMax * 0.3) {
          healthCondition = "в тяжёлом состоянии / тяжело ранен";
        } else if (c.hpCurrent < c.hpMax * 0.75) {
          healthCondition = "ранен";
        }

        let relationLabel = "нейтрален";
        if (c.type === "enemy" || c.relation <= -30) {
          relationLabel = "враг";
        } else if (c.relation < 0) {
          relationLabel = "насторожен / неприязнь";
        } else if (c.type === "companion" || c.relation >= 50) {
          relationLabel = "соратник / друг";
        } else if (c.relation > 20) {
          relationLabel = "союзник";
        }

        const role = [c.race, c.class].filter(Boolean).join(" ");
        const roleDesc = role ? ` (${role})` : "";
        const notesDesc = c.notes ? `; состояние: ${truncate(c.notes, 90)}` : "";

        return `- ${c.name}${roleDesc} [${relationLabel}${where}]: ${healthCondition}${notesDesc}`;
      })
      .join("\n");
    sections.push(`## Кто в сцене и рядом\n${roster}`);
  }

  // Памяти по важности, пока не исчерпан бюджет символов.
  let memoryBudget = MEMORY_BUDGET;
  const memoryLines: string[] = [];
  for (const m of memories) {
    if (memoryLines.length >= MAX_MEMORIES) break;
    const itemLimit = m.importance >= 9 || m.category === "quest" ? 450 : MEMORY_ITEM_LIMIT;
    const line = `- [${m.category}] ${m.subject}: ${truncate(m.content, itemLimit)}`;
    if (line.length > memoryBudget) continue;
    memoryBudget -= line.length;
    memoryLines.push(line);
  }
  if (memoryLines.length > 0) {
    sections.push(`## Ключевые факты\n${memoryLines.join("\n")}`);
  }

  let eventBudget = EVENT_BUDGET;
  const eventLines: string[] = [];
  for (const e of events) {
    const line = `- [${e.type}] ${truncate(e.description, 110)}${e.location ? ` (${e.location})` : ""}`;
    if (line.length > eventBudget) break;
    eventBudget -= line.length;
    eventLines.push(line);
  }
  if (eventLines.length > 0) {
    sections.push(`## Последние события\n${eventLines.reverse().join("\n")}`);
  }

  if (sections.length === 0) return null;

  return {
    text: `# КОНТЕКСТ СЦЕНЫ
${sections.join("\n\n")}

Это твоя рабочая память — она уже загружена, повторно её не запрашивай. Не пересказывай этот блок игроку.`,
    memoriesUsed: memoryLines.length,
    eventsUsed: eventLines.length,
    hasSummary: Boolean(summary),
  };
}
