import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockStreamText } = vi.hoisted(() => ({
  mockStreamText: vi.fn().mockReturnValue({
    toUIMessageStream: vi.fn().mockReturnValue(new ReadableStream()),
  }),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: mockStreamText,
    createUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("ok")),
  };
});

vi.mock("@/lib/ai/client", () => ({
  createClient: vi.fn(() => ({
    chat: vi.fn((modelName: string) => ({ modelId: modelName })),
  })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    campaign: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    character: {
      findMany: vi.fn(),
    },
    gameEvent: {
      findMany: vi.fn(),
    },
    memory: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    summary: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    chatMessage: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { POST } from "../route";
import { db } from "@/lib/db";
import { extractMessageText } from "@/lib/ai/caching";

describe("Solo Chat Endpoint Prompt Caching Integration", () => {
  const sampleCampaign = {
    id: "campaign-alpha",
    name: "Поход в Забытые Королевства",
    setting: "Забытые Королевства",
    tone: "heroic",
    difficulty: "normal",
    language: "ru",
    startingLevel: 3,
    levelFrom: 3,
    levelTo: 10,
    storyArc: null,
    arcCurrentAct: 1,
  };

  const sampleCharacters = [
    {
      id: "char-1",
      campaignId: "campaign-alpha",
      name: "Торгрим",
      type: "player",
      race: "Дворф",
      class: "Жрец",
      level: 3,
      hpCurrent: 14,
      hpMax: 20,
      ac: 16,
      isAlive: true,
      relation: 100,
    },
    {
      id: "char-2",
      campaignId: "campaign-alpha",
      name: "Гоблин-часовой",
      type: "enemy",
      race: "Гоблин",
      class: "Плут",
      level: 1,
      hpCurrent: 7,
      hpMax: 7,
      ac: 13,
      isAlive: true,
      relation: -50,
    },
  ];

  const sampleEvents = [
    {
      id: "event-1",
      campaignId: "campaign-alpha",
      description: "Отряд подошёл к вратам цитадели",
      turn: 1,
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.campaign.findUnique).mockResolvedValue(sampleCampaign as any);
    vi.mocked(db.character.findMany).mockResolvedValue(sampleCharacters as any);
    vi.mocked(db.gameEvent.findMany).mockResolvedValue(sampleEvents as any);
  });

  it("1) forms frozenSystemPrompt without dynamic HP and excludes contextInstructions from instructions", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "test-api-key",
        campaignId: "campaign-alpha",
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "Осматриваю ворота цитадели" }],
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockStreamText).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamText.mock.calls[0][0];

    // instructions должно содержать строго 1 элемент — замороженный системный промпт (без contextInstructions!)
    expect(callArgs.instructions).toHaveLength(1);
    expect(callArgs.instructions[0].role).toBe("system");

    const promptText = callArgs.instructions[0].content;
    // Префикс Зоны 1 не должен содержать волатильных HP персонажей или токенов ранений
    expect(promptText).not.toMatch(/\bHP\b/);
    expect(promptText).not.toContain("14/20");
    expect(promptText).not.toMatch(/[а-яё]*хит[а-яё]*/i);
    expect(promptText).not.toMatch(/[а-яё]*ранен[а-яё]*/i);
  });

  it("2) calls compactHistoryWithMilestones instead of sliding-window slice(-VERBATIM_MESSAGES)", async () => {
    // 35 сообщений превышают default maxVerbatim (30)
    const messages = Array.from({ length: 35 }, (_, i) => ({
      id: `msg-${i + 1}`,
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      parts: [{ type: "text" as const, text: `Ход ${i + 1}: действие игрока или мастера` }],
    }));

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "test-api-key",
        campaignId: "campaign-alpha",
        messages,
      }),
    });

    await POST(req);

    const callArgs = mockStreamText.mock.calls[0][0];
    // Старый код делал slice(-6) -> длина была бы 6
    // compactHistoryWithMilestones сжимает первые 18 сообщений в 1 веху: 35 - 18 + 1 = 18 сообщений
    expect(callArgs.messages.length).toBe(18);
    expect(extractMessageText(callArgs.messages[0])).toContain("[ХРОНИКА РАННИХ СОБЫТИЙ");
    expect(extractMessageText(callArgs.messages[callArgs.messages.length - 1])).toContain("Ход 35");
  });

  it("3) injects ephemeralTail strictly into the last user message and keeps prior messages clean", async () => {
    const messages = [
      {
        id: "msg-1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Первое сообщение игрока" }],
      },
      {
        id: "msg-2",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: "Ответ мастера на первое сообщение" }],
      },
      {
        id: "msg-3",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Финальное действие игрока" }],
      },
    ];

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "test-api-key",
        campaignId: "campaign-alpha",
        messages,
      }),
    });

    await POST(req);

    const callArgs = mockStreamText.mock.calls[0][0];
    const msgs = callArgs.messages;

    expect(msgs).toHaveLength(3);

    const firstText = extractMessageText(msgs[0]);
    const secondText = extractMessageText(msgs[1]);
    const lastText = extractMessageText(msgs[2]);

    // Первые сообщения Зоны 2 остаются 100% чистыми без сведений о сцене
    expect(firstText).toBe("Первое сообщение игрока");
    expect(firstText).not.toContain("[ОБСТАНОВКА И СТАТУС СЦЕНЫ");
    expect(secondText).toBe("Ответ мастера на первое сообщение");
    expect(secondText).not.toContain("[ОБСТАНОВКА И СТАТУС СЦЕНЫ");

    // Исключительно последнее сообщение пользователя содержит срез сцены (Зона 3 Ephemeral Tail)
    expect(lastText).toContain("Финальное действие игрока");
    expect(lastText).toContain("[ОБСТАНОВКА И СТАТУС СЦЕНЫ]:");
    expect(lastText).toContain("Торгрим (HP 14/20");
    expect(lastText).toContain("Гоблин-часовой [здоров]");
    expect(lastText).toContain("Отряд подошёл к вратам цитадели");
  });

  it("4) provides deterministic tools with lexicographically sorted keys for active campaign", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "test-api-key",
        campaignId: "campaign-alpha",
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "Бросаю кубик" }],
          },
        ],
      }),
    });

    await POST(req);

    const callArgs = mockStreamText.mock.calls[0][0];
    const toolKeys = Object.keys(callArgs.tools);

    expect(toolKeys).toEqual([...toolKeys].sort());
    expect(toolKeys[0]).toBe("advance_act");
    expect(toolKeys).toContain("roll_dice");
    expect(toolKeys).toContain("update_character");
  });

  it("5) provides deterministic tools with lexicographically sorted keys for base tools without campaign", async () => {
    vi.mocked(db.campaign.findFirst).mockResolvedValue(null);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "test-api-key",
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "Привет без кампании" }],
          },
        ],
      }),
    });

    await POST(req);

    const callArgs = mockStreamText.mock.calls[0][0];
    const toolKeys = Object.keys(callArgs.tools);

    expect(toolKeys).toEqual([
      "calculate",
      "fetch_page",
      "get_combat_status",
      "roll_dice",
      "search_web",
      "start_combat",
    ]);
    expect(callArgs.instructions).toHaveLength(1);
    expect(callArgs.instructions[0].role).toBe("system");
  });
});
