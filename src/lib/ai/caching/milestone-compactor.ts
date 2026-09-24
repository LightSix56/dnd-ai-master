// Milestone History Compactor (Зона 2 кэширования LLM)
// Реализует дискретное сжатие истории диалога по стандарту DeepSeek KV-cache.
//
// В отличие от стандартного скользящего окна FIFO (slice(-N)), которое сдвигает
// смещение токенов и сбрасывает кэш префикса в 0% на каждом шаге,
// Milestone Compactor удерживает историю строго append-only.
// При превышении maxVerbatim он сжимает дискретный чанк из chunkSize старых сообщений
// в одну структурированную веху-хронику, сохраняя остальные сообщения нетронутыми.
// За счёт этого инвалидация кэша происходит дискретно 1 раз за 20-30 ходов!

import type { ModelMessage } from "ai";

export const DEFAULT_MAX_VERBATIM = 30;
export const DEFAULT_CHUNK_SIZE = 18;

export interface MilestoneCompactorOptions {
  /**
   * Максимальное количество сообщений, сохраняемых до срабатывания сжатия.
   * По умолчанию: 30.
   */
  maxVerbatim?: number;

  /**
   * Количество старых сообщений, сжимаемых в одну веху при превышении порога.
   * По умолчанию: 18.
   */
  chunkSize?: number;

  /**
   * Роль создаваемого сообщения-вехи.
   * По умолчанию: "user" (обеспечивает чередование user/assistant и совместимость с API).
   */
  role?: "user" | "system";
}

/**
 * Безопасно извлекает текстовое содержимое сообщения ModelMessage
 * независимо от формата: string, массив parts ({ type: "text", text: string }) или иной.
 */
export function extractMessageText(message: ModelMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return (message.content as any[])
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return message.content != null ? String(message.content) : "";
}

/**
 * Извлекает строки-пункты из существующей хроники событий, если сообщение уже являлось вехой.
 */
function extractExistingChronicleBullets(text: string): string[] {
  const lines = text.split("\n");
  const bullets: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      bullets.push(trimmed);
    }
  }
  return bullets;
}

/**
 * Формирует компактный пункт сводки для одного сообщения.
 */
function formatMessageBullet(message: ModelMessage): string {
  const roleLabel =
    message.role === "user"
      ? "Игрок"
      : message.role === "assistant"
      ? "Мастер"
      : message.role === "system"
      ? "Система"
      : message.role;

  let rawText = extractMessageText(message);

  // Очищаем от случайных хвостов динамической сцены, если они были внедрены в user message
  rawText = rawText
    .replace(/\n\n\[(?:ОБСТАНОВКА И СТАТУС СЦЕНЫ|СЦЕНА)[^]*$/i, "")
    .trim();

  // Нормализуем пробелы и переносы для компактности
  const normalized = rawText.replace(/\s+/g, " ").trim();

  // Ограничиваем длину отдельного пункта, чтобы хроника не разрасталась неограниченно
  const textSnippet =
    normalized.length > 300 ? `${normalized.slice(0, 297)}...` : normalized;

  return `- ${roleLabel}: ${textSnippet}`;
}

/**
 * Дискретно сжимает старую историю сообщений в веху-хронику при превышении maxVerbatim.
 *
 * Если messages.length <= maxVerbatim, возвращает исходный массив без изменений (Append-Only).
 * Если messages.length > maxVerbatim, берёт первые chunkSize сообщений, сворачивает их
 * в одно сообщение-веху и объединяет с оставшимися сообщениями:
 *   [milestoneMessage, ...messages.slice(chunkSize)]
 */
export function compactHistoryWithMilestones(
  messages: ModelMessage[],
  options?: MilestoneCompactorOptions
): ModelMessage[] {
  const maxVerbatim =
    options?.maxVerbatim && options.maxVerbatim > 0
      ? options.maxVerbatim
      : DEFAULT_MAX_VERBATIM;

  const chunkSize =
    options?.chunkSize && options.chunkSize > 0
      ? options.chunkSize
      : DEFAULT_CHUNK_SIZE;

  const milestoneRole = options?.role ?? "user";

  // Если длина истории не превышает порог, сохраняем исходный массив неизменным
  if (messages.length <= maxVerbatim) {
    return messages;
  }

  // Защита от выхода за границы: оставляем как минимум 1 актуальное сообщение в хвосте
  const actualChunkSize = Math.max(1, Math.min(chunkSize, messages.length - 1));
  const chunk = messages.slice(0, actualChunkSize);
  const remaining = messages.slice(actualChunkSize);

  // Определяем диапазон раундов для заголовка
  let startRound = 1;
  let endRound = Math.max(1, Math.ceil(actualChunkSize / 2));

  const firstMsgText = extractMessageText(chunk[0]);
  const prevChronicleMatch = firstMsgText.match(
    /\[ХРОНИКА РАННИХ СОБЫТИЙ \(Раунды?\s*(\d+)[–-](\d+)\)\]/i
  );

  if (prevChronicleMatch) {
    const prevEnd = parseInt(prevChronicleMatch[2], 10);
    if (!isNaN(prevEnd)) {
      endRound = prevEnd + Math.max(1, Math.ceil((actualChunkSize - 1) / 2));
    }
  }

  const header = `[ХРОНИКА РАННИХ СОБЫТИЙ (Раунды ${startRound}–${endRound})]:`;

  // Собираем пункты сводки
  const bullets: string[] = [];

  for (const msg of chunk) {
    const text = extractMessageText(msg);
    if (text.includes("[ХРОНИКА РАННИХ СОБЫТИЙ")) {
      // Распаковываем существующие пункты предыдущей хроники
      const existingBullets = extractExistingChronicleBullets(text);
      if (existingBullets.length > 0) {
        bullets.push(...existingBullets);
      } else {
        bullets.push(formatMessageBullet(msg));
      }
    } else {
      bullets.push(formatMessageBullet(msg));
    }
  }

  const milestoneContent = `${header}\n${bullets.join("\n")}`;

  const milestoneMessage: ModelMessage = {
    role: milestoneRole,
    content: milestoneContent,
  };

  return [milestoneMessage, ...remaining];
}
