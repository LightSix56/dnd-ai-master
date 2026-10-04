// Мастер в комнате должен помнить прошлые ходы: история кампании идёт в запрос вместе с вводом раунда.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn().mockResolvedValue({ text: "Мастер описывает исход раунда.", steps: [], usage: {} }),
  };
});

vi.mock("@/lib/ai/client", () => ({
  createClient: vi.fn(() => ({ chat: vi.fn((m: string) => ({ modelId: m })) })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    chatMessage: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    summary: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { generateText } from "ai";
import { db } from "@/lib/db";
import { resolveActiveRoomTurnHelper } from "../resolve-turn-helper";

const room = {
  id: "room-1",
  code: "HIST",
  name: "Обитель Дракона",
  hostUserId: "host",
  status: "active",
  startingLevel: 3,
  maxLevel: 10,
  partyBond: "established",
  campaignId: "camp-1",
  campaignSettings: { title: "Обитель Дракона", setting: "Забытые Королевства", tone: "dark", difficulty: "hard" },
  storyArc: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  participants: [],
} as any;

const turn = {
  id: "turn-3",
  roomId: "room-1",
  roundNumber: 3,
  status: "waiting",
  playerInputs: {
    u1: { userId: "u1", characterName: "Торгрим", actionText: "Открываю саркофаг.", submittedAt: 1 },
  },
  createdAt: new Date().toISOString(),
} as any;

const roomService = {
  resolveRoomTurn: vi.fn().mockImplementation((_id: string, narrative: string) => ({
    completedTurn: { id: "done", dmResponse: narrative, status: "completed" },
    nextTurn: { id: "next", status: "waiting" },
  })),
} as any;

beforeEach(() => {
  vi.mocked(generateText).mockClear();
  vi.mocked(db.chatMessage.findMany).mockResolvedValue([] as any);
  vi.mocked(db.summary.findMany).mockResolvedValue([] as any);
});

describe("история кампании в комнате", () => {
  it("передаёт мастеру хронику и прошлые ходы перед вводом текущего раунда", async () => {
    vi.mocked(db.summary.findMany).mockResolvedValue([
      { content: "## Хроника\n- отряд спустился в склеп", fromTurn: 0, toTurn: 24 },
    ] as any);
    vi.mocked(db.chatMessage.findMany).mockResolvedValue([
      { id: "a", role: "user", content: "Совместный ход отряда — Раунд 2: Торгрим зажигает факел." },
      { id: "b", role: "assistant", content: "Пламя выхватывает из темноты каменный саркофаг." },
    ] as any);

    await resolveActiveRoomTurnHelper(room, turn, { apiKey: "k", roomService });

    const call = vi.mocked(generateText).mock.calls[0][0] as any;
    expect(call.prompt).toBeUndefined();
    expect(call.messages).toHaveLength(4);
    expect(call.messages[0].content).toContain("[ХРОНИКА КАМПАНИИ");
    expect(call.messages[1].content).toContain("зажигает факел");
    expect(call.messages[2].content).toContain("каменный саркофаг");
    expect(call.messages[3].role).toBe("user");
    expect(call.messages[3].content).toContain("Открываю саркофаг.");
  });

  it("в самом первом раунде (истории нет) работает как раньше — одним prompt", async () => {
    await resolveActiveRoomTurnHelper(room, { ...turn, roundNumber: 1 }, { apiKey: "k", roomService });
    const call = vi.mocked(generateText).mock.calls[0][0] as any;
    expect(call.messages).toBeUndefined();
    expect(call.prompt).toContain("Открываю саркофаг.");
  });
});
