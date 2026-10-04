// Тесты новой схемы контекста мастера: стабильный префикс, история из БД, хроника блоками.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateText, store } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  store: {
    messages: [] as Array<{ id: string; role: string; content: string }>,
    summaries: [] as Array<{ content: string; fromTurn: number; toTurn: number }>,
    memories: [] as Array<{ subject: string; content: string; importance: number }>,
    characters: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: mockGenerateText };
});

vi.mock("@/lib/ai/client", () => ({
  createClient: vi.fn(() => ({ chat: vi.fn((m: string) => ({ modelId: m })) })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    summary: {
      findMany: vi.fn(async () => [...store.summaries].sort((a, b) => a.toTurn - b.toTurn)),
      findFirst: vi.fn(async () => [...store.summaries].sort((a, b) => b.toTurn - a.toTurn)[0] ?? null),
      create: vi.fn(async ({ data }: { data: { content: string; fromTurn: number; toTurn: number } }) => {
        store.summaries.push({ content: data.content, fromTurn: data.fromTurn, toTurn: data.toTurn });
        return data;
      }),
    },
    chatMessage: {
      findMany: vi.fn(async ({ skip = 0 }: { skip?: number }) => store.messages.slice(skip)),
    },
    memory: {
      findMany: vi.fn(async () => store.memories),
    },
    character: {
      findMany: vi.fn(async () => store.characters),
    },
    gameEvent: {
      findMany: vi.fn(async () => []),
    },
  },
}));

import { buildFrozenSystemPrompt, stripVolatileNotes, extractNoteInsights } from "../frozen-prefix";
import {
  buildDmHistory,
  chronicleFromSummaries,
  CHRONICLE_HEADER,
  COMPACT_BLOCK,
  MIN_VERBATIM,
} from "../dm-history";
import { fetchEphemeralSceneTail } from "../ephemeral-tail";
import { compactHistory } from "../../compact";
import { selectCharactersForSync } from "../../scene-synchronizer";

function fillMessages(n: number) {
  store.messages = Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    role: i % 2 === 0 ? "user" : "assistant",
    content: `Сообщение ${i}`,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  store.messages = [];
  store.summaries = [];
  store.memories = [];
  store.characters = [];
});

describe("замороженный системный промпт", () => {
  const ctx = (notes: string) => ({
    name: "Кампания",
    setting: "Забытые Королевства",
    tone: "dark",
    partyMembers: [
      {
        id: "1",
        name: "Торин",
        race: "Дварф",
        class: "Воин",
        level: 3,
        background: "Был тяжело ранен под Мифрил-Холлом и потерял отряд.",
        notes,
      },
    ],
  });

  it("не меняется, когда летописец переписывает статус героя или дописывает заметку", () => {
    const a = buildFrozenSystemPrompt(ctx("[Статус: стоит у двери с топором]\nСтарый ветеран клана.") as any);
    const b = buildFrozenSystemPrompt(
      ctx("[Статус: крадётся по коридору]\nСтарый ветеран клана.\n• боится магии огня") as any
    );
    expect(a).toBe(b);
    expect(a).toContain("Старый ветеран клана.");
    expect(a).not.toContain("Статус:");
    expect(a).not.toContain("боится магии огня");
  });

  it("не портит текст автозаменами: предыстория и правила остаются как написаны", () => {
    const p = buildFrozenSystemPrompt(ctx("") as any);
    expect(p).toContain("Был тяжело ранен под Мифрил-Холлом");
    expect(p).toContain("HP");
  });

  it("разбирает заметки на досье и пункты летописца", () => {
    const notes = "[Статус: спит]\nДосье.\n• клятва мести\n• боится воды";
    expect(stripVolatileNotes(notes)).toBe("Досье.");
    expect(extractNoteInsights(notes)).toEqual(["клятва мести", "боится воды"]);
    expect(stripVolatileNotes("[Статус: спит]")).toBeNull();
  });
});

describe("история мастера из БД", () => {
  it("без хроники отдаёт всё дословно", async () => {
    fillMessages(10);
    const h = await buildDmHistory("c");
    expect(h.messages).toHaveLength(10);
    expect(h.compactedCount).toBe(0);
    expect(h.messages[0]).toEqual({ role: "user", content: "Сообщение 0" });
  });

  it("с хроникой: первая запись — хроника, дальше только несжатые сообщения", async () => {
    fillMessages(50);
    store.summaries = [{ content: "## Хроника\n- герои вошли в город", fromTurn: 0, toTurn: 24 }];
    const h = await buildDmHistory("c");
    expect(h.compactedCount).toBe(24);
    expect(h.verbatimCount).toBe(26);
    expect(String(h.messages[0].content)).toContain(CHRONICLE_HEADER);
    expect(String(h.messages[0].content)).toContain("герои вошли в город");
    expect(h.messages[1].content).toBe("Сообщение 24");
    expect(h.messages[h.messages.length - 1].content).toBe("Сообщение 49");
  });

  it("между обновлениями хроники история только дописывается — префикс совпадает побайтово", async () => {
    fillMessages(30);
    store.summaries = [{ content: "хроника", fromTurn: 0, toTurn: 8 }];
    const before = await buildDmHistory("c");
    store.messages.push({ id: "m30", role: "user", content: "Сообщение 30" });
    store.messages.push({ id: "m31", role: "assistant", content: "Сообщение 31" });
    const after = await buildDmHistory("c");
    expect(after.messages.slice(0, before.messages.length)).toEqual(before.messages);
    expect(after.messages.length).toBe(before.messages.length + 2);
  });

  it("служебные заглушки об ошибках связи в историю не попадают", async () => {
    store.messages = [
      { id: "a", role: "user", content: "Иду в таверну" },
      { id: "b", role: "assistant", content: "⚠️ Ошибка связи с ИИ" },
      { id: "c", role: "user", content: "Иду в таверну" },
    ];
    const h = await buildDmHistory("c");
    expect(h.messages.map((m) => m.content)).toEqual(["Иду в таверну", "Иду в таверну"]);
  });

  it("старые цепочки сводок склеиваются по порядку, новая скользящая хроника берётся одна", () => {
    const legacy = [
      { content: "вторая", fromTurn: 6, toTurn: 12 },
      { content: "первая", fromTurn: 0, toTurn: 6 },
    ];
    expect(chronicleFromSummaries(legacy)).toBe("первая\nвторая");
    expect(chronicleFromSummaries([...legacy, { content: "полная хроника", fromTurn: 0, toTurn: 36 }])).toBe(
      "полная хроника"
    );
    expect(chronicleFromSummaries([])).toBe("");
  });
});

describe("обновление хроники", () => {
  const chronicle = "## Хроника\n- " + "событие ".repeat(20);

  it("не запускается, пока за пределами дословного окна не накопился блок", async () => {
    fillMessages(MIN_VERBATIM + COMPACT_BLOCK - 1);
    expect(await compactHistory({ campaignId: "c", apiKey: "k" })).toBe(0);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("вливает блок в хронику, оставляя дословный хвост нетронутым", async () => {
    fillMessages(MIN_VERBATIM + COMPACT_BLOCK);
    mockGenerateText.mockResolvedValue({ text: chronicle, usage: {} });
    const n = await compactHistory({ campaignId: "c", apiKey: "k", model: "dm-model" });
    expect(n).toBe(COMPACT_BLOCK);
    expect(store.summaries).toEqual([{ content: chronicle.trim(), fromTurn: 0, toTurn: COMPACT_BLOCK }]);

    const prompt = mockGenerateText.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Сообщение 0");
    expect(prompt).toContain(`Сообщение ${COMPACT_BLOCK - 1}`);
    expect(prompt).not.toContain(`Сообщение ${COMPACT_BLOCK}\n`);
    // хронику пишет модель рассказчика
    expect(mockGenerateText.mock.calls[0][0].model.modelId).toBe("dm-model");

    const h = await buildDmHistory("c");
    expect(h.verbatimCount).toBe(MIN_VERBATIM);
  });

  it("следующее обновление получает прошлую хронику и продолжает с её границы", async () => {
    fillMessages(MIN_VERBATIM + COMPACT_BLOCK * 2);
    store.summaries = [{ content: "ПРОШЛАЯ ХРОНИКА", fromTurn: 0, toTurn: COMPACT_BLOCK }];
    mockGenerateText.mockResolvedValue({ text: chronicle, usage: {} });
    await compactHistory({ campaignId: "c", apiKey: "k" });
    const prompt = mockGenerateText.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("ПРОШЛАЯ ХРОНИКА");
    expect(prompt).toContain(`Сообщение ${COMPACT_BLOCK}`);
    expect(prompt).not.toContain("Сообщение 0\n");
    expect(store.summaries[store.summaries.length - 1].toTurn).toBe(COMPACT_BLOCK * 2);
  });

  it("слишком короткий ответ модели не затирает хронику", async () => {
    fillMessages(MIN_VERBATIM + COMPACT_BLOCK);
    mockGenerateText.mockResolvedValue({ text: "ок", usage: {} });
    expect(await compactHistory({ campaignId: "c", apiKey: "k" })).toBe(0);
    expect(store.summaries).toHaveLength(0);
  });

  it("если границу уже сдвинул другой экземпляр, результат отбрасывается", async () => {
    fillMessages(MIN_VERBATIM + COMPACT_BLOCK);
    mockGenerateText.mockImplementation(async () => {
      store.summaries.push({ content: "чужая хроника", fromTurn: 0, toTurn: COMPACT_BLOCK });
      return { text: chronicle, usage: {} };
    });
    expect(await compactHistory({ campaignId: "c", apiKey: "k" })).toBe(0);
    expect(store.summaries).toHaveLength(1);
  });
});

describe("срез сцены", () => {
  it("показывает статус и заметки героя, NPC только из сцены и факты памяти о присутствующих", async () => {
    store.characters = [
      {
        name: "Торин",
        type: "player",
        hpCurrent: 10,
        hpMax: 20,
        ac: 16,
        notes: "[Статус: держит дверь]\nДосье\n• боится огня",
        inScene: true,
      },
      { name: "Мирта", type: "npc", hpCurrent: 8, hpMax: 8, relation: 60, notes: "[Статус: прячется за стойкой]", inScene: true },
      { name: "Барон Вейл", type: "npc", hpCurrent: 30, hpMax: 30, relation: 0, notes: null, inScene: false },
    ];
    store.memories = [
      { subject: "Мирта", content: "задолжала гильдии воров", importance: 6 },
      { subject: "Пророчество", content: "три луны сойдутся над башней", importance: 9 },
      { subject: "Старый мост", content: "скрипит", importance: 3 },
    ];
    const tail = await fetchEphemeralSceneTail("c");
    expect(tail).toContain("Торин (HP 10/20, ранен, AC 16)");
    expect(tail).toContain("сейчас: держит дверь");
    expect(tail).toContain("замечено: боится огня");
    expect(tail).toContain("Мирта [здоров] (союзник) — прячется за стойкой");
    expect(tail).not.toContain("Барон Вейл");
    expect(tail).toContain("Мирта: задолжала гильдии воров");
    expect(tail).toContain("Пророчество: три луны сойдутся над башней");
    expect(tail).not.toContain("Старый мост");
  });
});

describe("летописец: отбор персонажей", () => {
  const chars = [
    { name: "Торин", type: "player", inScene: true },
    { name: "Мирта", type: "npc", inScene: true },
    { name: "Гуннар Каменный Кулак", type: "companion", inScene: false },
    { name: "Барон Вейл", type: "npc", inScene: false },
  ];

  it("берёт героев, присутствующих и упомянутых (в том числе в косвенном падеже)", () => {
    const picked = selectCharactersForSync(chars, "Зову Гуннара на помощь", "Дверь трещит под ударами.");
    expect(picked.map((c) => c.name)).toEqual(["Торин", "Мирта", "Гуннар Каменный Кулак"]);
  });

  it("не тащит в запрос тех, кого нет в сцене и о ком не говорили", () => {
    const picked = selectCharactersForSync(chars, "Осматриваю зал", "В зале тихо.");
    expect(picked.map((c) => c.name)).toEqual(["Торин", "Мирта"]);
  });
});
