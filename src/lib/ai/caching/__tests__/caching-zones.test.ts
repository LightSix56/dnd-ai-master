import { describe, it, expect, vi } from "vitest";
import { buildFrozenSystemPrompt, getDeterministicTools } from "../frozen-prefix";
import {
  formatSceneSnapshot,
  injectEphemeralTailToLastUserMessage,
  fetchEphemeralSceneTail,
  type EphemeralSceneState,
} from "../ephemeral-tail";
import type { ModelMessage } from "ai";

vi.mock("@/lib/db", () => ({
  db: {
    character: {
      findMany: vi.fn().mockResolvedValue([
        {
          name: "Торгрим",
          type: "player",
          hpCurrent: 24,
          hpMax: 24,
          ac: 18,
          location: "Подземелье",
          relation: 0,
        },
        {
          name: "Лира",
          type: "player",
          hpCurrent: 12,
          hpMax: 16,
          ac: 13,
          location: "Подземелье",
          relation: 0,
        },
        {
          name: "Гоблин-часовой",
          type: "enemy",
          hpCurrent: 2,
          hpMax: 7,
          ac: 15,
          location: "У входа",
          relation: -50,
        },
      ]),
    },
    gameEvent: {
      findMany: vi.fn().mockResolvedValue([
        { description: "Входная решётка захлопнулась", turn: 1 },
      ]),
    },
  },
}));

describe("Caching Zones - Frozen Prefix", () => {
  it("produces byte-for-byte identical prompt regardless of volatile character HP or wounds", () => {
    const baseContext = {
      name: "Тестовая кампания",
      setting: "Забытые Королевства",
      tone: "heroic",
      partyMembers: [
        {
          id: "1",
          name: "Торгрим",
          race: "Дворф",
          class: "Жрец",
          level: 3,
          background: "Служитель культа",
          personality: "Упрямый, преданный клану",
        },
      ],
    };

    const prompt1 = buildFrozenSystemPrompt(baseContext);
    const prompt2 = buildFrozenSystemPrompt(baseContext);

    expect(prompt1).toBe(prompt2);
    expect(prompt1).not.toContain("HP");
    expect(prompt1).not.toContain("хитов");
    expect(prompt1).not.toContain("ранен");
    expect(prompt1).toContain("Торгрим");
    expect(prompt1).toContain("Дворф");
    expect(prompt1).toContain("Жрец");
  });

  it("handles undefined campaign context with sensible defaults", () => {
    const prompt = buildFrozenSystemPrompt(undefined);
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe("string");
    expect(prompt).not.toContain("HP");
  });

  it("sorts tool keys deterministically in lexicographical order", () => {
    const rawTools = {
      roll_dice: { name: "roll_dice" },
      calculate: { name: "calculate" },
      search_web: { name: "search_web" },
      fetch_page: { name: "fetch_page" },
    };
    const sorted = getDeterministicTools(rawTools);
    expect(Object.keys(sorted)).toEqual(["calculate", "fetch_page", "roll_dice", "search_web"]);
  });
});

describe("Caching Zones - Ephemeral Tail Formatting", () => {
  it("formats EphemeralSceneState into a structured scene snapshot block", () => {
    const state: EphemeralSceneState = {
      roundNumber: 4,
      partyStatus: [
        { name: "Торгрим", hpCurrent: 24, hpMax: 24, ac: 18 },
        { name: "Лира", hpCurrent: 12, hpMax: 16, ac: 13, condition: "ранена" },
      ],
      npcStatus: [
        { name: "Гоблин-часовой", healthCondition: "тяжело ранен", relation: "враг" },
      ],
      recentEvents: [
        { description: "Входная решётка захлопнулась", turn: 3 },
        { description: "Торгрим зажёг факел", turn: 4 },
      ],
    };

    const snapshot = formatSceneSnapshot(state);

    expect(snapshot).toContain("[ОБСТАНОВКА И СТАТУС СЦЕНЫ (Раунд 4)]:");
    expect(snapshot).toContain("- Отряд: Торгрим (HP 24/24, AC 18), Лира (HP 12/16, ранена, AC 13)");
    expect(snapshot).toContain("- NPC/Враги: Гоблин-часовой [тяжело ранен]");
    expect(snapshot).toContain("- Последние события: Входная решётка захлопнулась; Торгрим зажёг факел");
  });

  it("handles empty/default state without throwing", () => {
    const state: EphemeralSceneState = {
      partyStatus: [],
      npcStatus: [],
      recentEvents: [],
    };

    const snapshot = formatSceneSnapshot(state);
    expect(snapshot).toContain("[ОБСТАНОВКА И СТАТУС СЦЕНЫ");
  });
});

describe("Caching Zones - Ephemeral Tail Injection", () => {
  it("injects ephemeral scene state into the last user message without altering previous messages", () => {
    const history: ModelMessage[] = [
      { role: "user", content: "Привет, мастер" },
      { role: "assistant", content: "Приветствую, герой" },
      { role: "user", content: "Иду к северным воротам" },
    ];

    const tail = "[СЦЕНА: Торгрим HP 14/20]";
    const updated = injectEphemeralTailToLastUserMessage(history, tail);

    expect(updated).toHaveLength(3);
    // Reference equality checks: previous messages MUST NOT be altered
    expect(updated[0]).toBe(history[0]);
    expect(updated[1]).toBe(history[1]);

    // Last user message content is updated
    const lastMsgContent = updated[2].content;
    expect(typeof lastMsgContent === "string" ? lastMsgContent : JSON.stringify(lastMsgContent)).toContain("Иду к северным воротам");
    expect(typeof lastMsgContent === "string" ? lastMsgContent : JSON.stringify(lastMsgContent)).toContain(tail);
  });

  it("handles user message with parts array", () => {
    const history: ModelMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Осматриваю зал" },
        ] as any,
      },
    ];

    const tail = "[СЦЕНА: Раунд 1]";
    const updated = injectEphemeralTailToLastUserMessage(history, tail);

    expect(updated).toHaveLength(1);
    const content = updated[0].content;
    if (typeof content === "string") {
      expect(content).toContain("Осматриваю зал");
      expect(content).toContain(tail);
    } else {
      const text = (content as any[]).map((p) => p.text || "").join(" ");
      expect(text).toContain("Осматриваю зал");
      expect(text).toContain(tail);
    }
  });

  it("returns original array if no user message exists", () => {
    const history: ModelMessage[] = [
      { role: "assistant", content: "Тьма сгущается..." },
    ];

    const updated = injectEphemeralTailToLastUserMessage(history, "tail");
    expect(updated).toEqual(history);
  });
});

describe("Caching Zones - fetchEphemeralSceneTail with DB mock", () => {
  it("queries prisma DB for character HP, NPC statuses and game events and formats snapshot", async () => {
    const result = await fetchEphemeralSceneTail("camp-123", 2);
    expect(result).toContain("[ОБСТАНОВКА И СТАТУС СЦЕНЫ (Раунд 2)]:");
    expect(result).toContain("Торгрим (HP 24/24, AC 18)");
    expect(result).toContain("Лира (HP 12/16");
    expect(result).toContain("Гоблин-часовой");
    expect(result).toContain("Входная решётка захлопнулась");
  });
});
