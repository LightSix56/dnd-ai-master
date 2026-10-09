import { describe, it, expect, vi, beforeEach } from "vitest";

const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", async (orig) => ({
  ...(await orig<typeof import("ai")>()),
  generateText: generateTextMock,
}));

import { generateStoryArc, type ArcGenerationParams } from "../story-arc";

const base: ArcGenerationParams = {
  name: "Кампания",
  setting: "Тёмное фэнтези",
  tone: "dark",
  difficulty: "brutal",
  dmStyle: "tactical",
  ruleStrictness: "standard",
  levelFrom: 1,
  levelTo: 10,
  partyTies: "friends",
  startingSituation: "patron_contract",
};

// Возвращаем промпт первого запроса к модели; ответ не важен: нас интересует текст промпта
async function firstPromptFor(params: ArcGenerationParams): Promise<string> {
  generateTextMock.mockRejectedValue(new Error("stop after first prompt"));
  await generateStoryArc({
    params,
    model: "test-model",
    apiKey: "test-key",
    authMode: "bearer",
    baseURL: "https://example.test/v1",
  }).catch(() => undefined);
  return String(generateTextMock.mock.calls[0][0].prompt);
}

describe("generateStoryArc: завязка и отношения попадают в промпт", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it("states how the heroes started when a situation is chosen", async () => {
    const prompt = await firstPromptFor(base);
    expect(prompt).toContain("Как герои начали: Контракт гильдии или лорда");
    expect(prompt).toContain("Отношения в отряде:");
    expect(prompt).toContain("Соклановцы");
  });

  it("omits the starting situation line when it is not set (old campaigns)", async () => {
    const prompt = await firstPromptFor({ ...base, startingSituation: null });
    expect(prompt).not.toContain("Как герои начали");
    expect(prompt).not.toContain("undefined");
  });

  it("keeps old tone labels readable in the prompt", async () => {
    const prompt = await firstPromptFor({ ...base, tone: "Мрачный и напряженный", startingSituation: null });
    expect(prompt).toContain("Тон: Мрачный и напряженный");
  });
});
