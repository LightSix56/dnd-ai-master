import { describe, it, expect } from "vitest";
import {
  compactHistoryWithMilestones,
  extractMessageText,
  DEFAULT_MAX_VERBATIM,
  DEFAULT_CHUNK_SIZE,
} from "../milestone-compactor";
import type { ModelMessage } from "ai";

describe("Milestone History Compactor (DeepSeek Prompt Caching)", () => {
  it("keeps history strictly append-only when below or equal to maxVerbatim threshold", () => {
    const messages: ModelMessage[] = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Message ${i + 1}`,
    }));

    const result = compactHistoryWithMilestones(messages, { maxVerbatim: 20 });
    expect(result.length).toBe(15);
    // Strict reference equality: array should not even be copied if no compaction needed
    expect(result).toBe(messages);
  });

  it("returns original array when messages.length === maxVerbatim", () => {
    const messages: ModelMessage[] = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Message ${i + 1}`,
    }));

    const result = compactHistoryWithMilestones(messages, { maxVerbatim: 30 });
    expect(result.length).toBe(30);
    expect(result).toBe(messages);
  });

  it("compacts the oldest chunk into a single milestone when threshold is exceeded", () => {
    const messages: ModelMessage[] = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Message ${i + 1}`,
    }));

    const result = compactHistoryWithMilestones(messages, {
      maxVerbatim: 20,
      chunkSize: 10,
    });

    // 10 messages compressed into 1 milestone summary + 15 remaining = 16 messages
    expect(result.length).toBe(16);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toContain("[ХРОНИКА РАННИХ СОБЫТИЙ");
    expect(result[0].content).toContain("Message 1");
    expect(result[0].content).toContain("Message 10");

    // The remaining messages start right from index 10 (Message 11)
    expect(result[1].content).toBe("Message 11");
    expect(result[result.length - 1].content).toBe("Message 25");

    // Reference equality checks for untouched tail messages
    expect(result[1]).toBe(messages[10]);
    expect(result[result.length - 1]).toBe(messages[24]);
  });

  it("uses default values (maxVerbatim = 30, chunkSize = 18) when options are omitted", () => {
    expect(DEFAULT_MAX_VERBATIM).toBe(30);
    expect(DEFAULT_CHUNK_SIZE).toBe(18);

    const messages: ModelMessage[] = Array.from({ length: 35 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Turn ${i + 1}`,
    }));

    const result = compactHistoryWithMilestones(messages);

    // 18 messages compacted into 1 milestone + (35 - 18) = 18 messages
    expect(result.length).toBe(18);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toContain("[ХРОНИКА РАННИХ СОБЫТИЙ");
    expect(result[0].content).toContain("Turn 1");
    expect(result[0].content).toContain("Turn 18");
    expect(result[1].content).toBe("Turn 19");
    expect(result[result.length - 1].content).toBe("Turn 35");
  });

  it("correctly extracts text from both plain strings and parts arrays", () => {
    const stringMsg: ModelMessage = {
      role: "user",
      content: "Простой текстовый запрос",
    };
    expect(extractMessageText(stringMsg)).toBe("Простой текстовый запрос");

    const partsMsg: ModelMessage = {
      role: "assistant",
      content: [
        { type: "text", text: "Часть 1 ответа." },
        { type: "text", text: "Часть 2 ответа." },
      ] as any,
    };
    expect(extractMessageText(partsMsg)).toBe("Часть 1 ответа.\nЧасть 2 ответа.");

    const mixedPartsMsg: ModelMessage = {
      role: "user",
      content: [
        { type: "image", image: "https://example.com/map.png" },
        { type: "text", text: "Что на карте?" },
      ] as any,
    };
    expect(extractMessageText(mixedPartsMsg)).toBe("Что на карте?");
  });

  it("compacts messages with complex parts content without crashing or rendering [object Object]", () => {
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: "Герой атакует мечом дракона" }] as any,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Удар наносит 12 урона!" }] as any,
      },
      {
        role: "user",
        content: "Отступаю за колонну",
      },
    ];

    const result = compactHistoryWithMilestones(messages, {
      maxVerbatim: 2,
      chunkSize: 2,
    });

    expect(result.length).toBe(2);
    expect(result[0].content).toContain("Герой атакует мечом дракона");
    expect(result[0].content).toContain("Удар наносит 12 урона!");
    expect(result[0].content).not.toContain("[object Object]");
    expect(result[1].content).toBe("Отступаю за колонну");
  });

  it("handles chaining when history already starts with an existing chronicle milestone", () => {
    const initialChronicle: ModelMessage = {
      role: "user",
      content:
        "[ХРОНИКА РАННИХ СОБЫТИЙ (Раунды 1–5)]:\n- Игрок: Зашли в подземелье\n- Мастер: Факелы погасли",
    };

    const regularMessages: ModelMessage[] = Array.from({ length: 24 }, (_, i) => ({
      role: i % 2 === 0 ? ("assistant" as const) : ("user" as const),
      content: `Событие ${i + 1}`,
    }));

    const allMessages = [initialChronicle, ...regularMessages]; // length = 25

    const result = compactHistoryWithMilestones(allMessages, {
      maxVerbatim: 20,
      chunkSize: 10,
    });

    expect(result.length).toBe(16);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toContain("[ХРОНИКА РАННИХ СОБЫТИЙ");
    expect(result[0].content).toContain("Зашли в подземелье");
    expect(result[0].content).toContain("Факелы погасли");
    expect(result[0].content).toContain("Событие 1");
    expect(result[1].content).toBe("Событие 10");
  });
});
