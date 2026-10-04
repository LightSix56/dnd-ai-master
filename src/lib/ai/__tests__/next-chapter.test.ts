// Следующий акт двигает мир: новые злодеи, перемены в мире, судьбы знакомых NPC, противники акта.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateText, dbMock } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  dbMock: {
    campaign: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
    summary: { findMany: vi.fn(async () => [{ content: "## Хроника\n- отряд сорвал ритуал в штольне", fromTurn: 0, toTurn: 24 }]) },
    chatMessage: { findMany: vi.fn(async () => [{ role: "assistant", content: "Морна бежит в горы." }]) },
    memory: { create: vi.fn(async () => ({})) },
    character: { findMany: vi.fn(), update: vi.fn(async () => ({})) },
  },
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: mockGenerateText };
});
vi.mock("@/lib/ai/client", () => ({
  createClient: vi.fn(() => ({ chat: vi.fn((m: string) => ({ modelId: m })) })),
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { generateNextChapter, parseStoryArc } from "../story-arc";
import { buildSystemPrompt } from "../system-prompt";

const act1 = {
  name: "Тени в штольне",
  levelFrom: 1,
  levelTo: 2,
  goal: "Найти шахтёров",
  summary: "Отряд спускается в штольню.",
  scenes: [{ name: "С1", location: "Таверна", description: "Слухи", encounter: "Диалог" }],
  twist: "Староста знал",
  branches: [{ ifPlayer: "пощадят", then: "узнают путь" }],
  rewards: "Золото",
};

const arc = {
  title: "Пепел над Громовым Ручьём",
  premise: "Шахтёры пропадают.",
  mainThreat: "Культ Пепла будит элементаля.",
  levelFrom: 1,
  levelTo: 8,
  villains: [{ name: "Морна", role: "шпионка", motivation: "месть", secret: "сестра старосты", appearsInAct: 1 }],
  acts: [act1],
  finale: "Элементаль проснётся.",
  generatedAt: "2026-10-01",
  model: "m",
};

const generated = {
  act: {
    name: "Огонь под горой",
    levelFrom: 2,
    levelTo: 4,
    goal: "Остановить культ в предгорьях",
    summary: "Культ ушёл в горы.",
    scenes: [{ name: "С1", location: "Перевал", description: "Засада", encounter: "Бой" }],
    twist: "Барон в сговоре",
    branches: [{ ifPlayer: "штурм", then: "потери" }],
    rewards: "Реликвия",
    worldChanges: ["Громовой Ручей опустел: жители бегут на юг", "На тракте появились заставы барона"],
    npcDevelopments: [
      { name: "Староста Бранн", change: "арестован людьми барона, сидит в остроге" },
      { name: "Неизвестный Никто", change: "не должен ни на что повлиять" },
    ],
    enemies: [{ name: "Пепельные культисты", description: "фанатики с огненными заговорами" }],
  },
  newVillains: [
    { name: "Барон Вейл", role: "покровитель культа", motivation: "власть", secret: "должник культа" },
    { name: "Морна", role: "повтор", motivation: "-", secret: "-" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.campaign.findUnique.mockResolvedValue({
    id: "c1",
    tone: "dark",
    dmStyle: "balanced",
    startingLevel: 1,
    levelTo: 8,
    arcModel: null,
    storyArc: JSON.stringify(arc),
    characters: [
      { name: "Торин", type: "player", level: 2, relation: 0, notes: null },
      { name: "Староста Бранн", type: "npc", level: 1, relation: 10, notes: "Трусоват." },
    ],
    memories: [{ category: "quest", subject: "Штольня", content: "ритуал сорван" }],
  });
  dbMock.character.findMany.mockResolvedValue([{ id: "n1", name: "Староста Бранн", notes: "Трусоват." }]);
  mockGenerateText.mockResolvedValue({ text: JSON.stringify(generated) });
});

describe("генерация следующего акта", () => {
  it("опирается на то, что реально было за столом: хронику, последние реплики, известных NPC", async () => {
    await generateNextChapter({ campaignId: "c1", outcome: "Ритуал сорван, Морна сбежала", apiKey: "k" });
    const prompt = mockGenerateText.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("отряд сорвал ритуал в штольне");
    expect(prompt).toContain("Морна бежит в горы.");
    expect(prompt).toContain("Староста Бранн");
    expect(prompt).toContain("Акт 1 «Тени в штольне»");
    expect(prompt).toContain("Ритуал сорван, Морна сбежала");
  });

  it("добавляет акт и новых злодеев акта, не дублируя известных", async () => {
    const res = await generateNextChapter({ campaignId: "c1", outcome: "x", apiKey: "k" });
    expect(res.actNumber).toBe(2);

    const saved = parseStoryArc((dbMock.campaign.update.mock.calls[0] as any)[0].data.storyArc)!;
    expect(saved.acts).toHaveLength(2);
    expect(saved.acts[1].enemies?.[0].name).toBe("Пепельные культисты");
    expect(saved.villains.map((v) => v.name)).toEqual(["Морна", "Барон Вейл"]);
    expect(saved.villains[1].appearsInAct).toBe(2);
  });

  it("двигает мир: перемены уходят в память, у знакомого NPC меняется состояние", async () => {
    await generateNextChapter({ campaignId: "c1", outcome: "x", apiKey: "k" });

    const memories = dbMock.memory.create.mock.calls.map((c: any) => c[0].data);
    expect(memories).toHaveLength(2);
    expect(memories[0]).toMatchObject({ category: "world", subject: "Мир к началу Акта 2", importance: 8 });
    expect(memories[0].content).toContain("Громовой Ручей опустел");

    // обновлён только NPC, который действительно есть в кампании
    expect(dbMock.character.update).toHaveBeenCalledTimes(1);
    const upd = (dbMock.character.update.mock.calls[0] as any)[0];
    expect(upd.where).toEqual({ id: "n1" });
    expect(upd.data.notes).toBe("[Статус: арестован людьми барона, сидит в остроге]\nТрусоват.");
    expect(upd.data.inScene).toBe(false);
  });

  it("мастер видит новый акт целиком: перемены мира, судьбы NPC, противников и нового злодея", async () => {
    await generateNextChapter({ campaignId: "c1", outcome: "x", apiKey: "k" });
    const saved = parseStoryArc((dbMock.campaign.update.mock.calls[0] as any)[0].data.storyArc)!;

    const prompt = buildSystemPrompt({ name: "К", setting: "FR", tone: "dark", storyArc: saved, currentAct: 1 } as any);
    expect(prompt).toContain("ТЕКУЩИЙ АКТ 2 из 2: «Огонь под горой»");
    expect(prompt).toContain("На тракте появились заставы барона");
    expect(prompt).toContain("Староста Бранн: арестован людьми барона");
    expect(prompt).toContain("Пепельные культисты: фанатики с огненными заговорами");
    expect(prompt).toContain("**Барон Вейл**");
  });

  it("старый формат ответа (один акт без обёртки) отклоняется и запрашивается заново", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: JSON.stringify(generated.act) })
      .mockResolvedValueOnce({ text: JSON.stringify(generated) });
    const res = await generateNextChapter({ campaignId: "c1", outcome: "x", apiKey: "k" });
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(res.act.name).toBe("Огонь под горой");
  });
});
