import { describe, it, expect } from "vitest";
import { partyAwareAct1Schema } from "../party-arc-generator";

describe("partyAwareAct1Schema — терпимость к ответу модели", () => {
  it("принимает мелкие отклонения вместо того, чтобы выбросить весь сюжет", () => {
    const parsed = partyAwareAct1Schema.parse({
      title: "Легенда",
      premise: "Завязка",
      // число строкой, поле mainThreat пропущено
      levelFrom: "1",
      levelTo: 5,
      villains: [{ name: "Некромант", role: "Злодей", motivation: "Власть", secret: "Брат героя" }],
      act: {
        name: "Акт 1",
        levelFrom: 1,
        levelTo: 3,
        goal: "Найти культ",
        summary: "Кратко",
        climaxObjective: "Сразить жреца",
        scenes: [
          { name: "Сцена 1", sceneType: "social/exploration", location: "Таверна", description: "…", encounter: "…" },
          ...Array.from({ length: 8 }, (_, i) => ({
            name: `Сцена ${i + 2}`,
            sceneType: "combat",
            location: "Лес",
            description: "…",
            encounter: "…",
          })),
        ],
        twist: "Поворот",
        rewards: "Золото",
        // branches и personalHooks пропущены
      },
      finaleHint: "Финал",
    });

    expect(parsed.levelFrom).toBe(1);
    expect(parsed.mainThreat).toBe("");
    expect(parsed.act.scenes).toHaveLength(7);
    expect(parsed.act.scenes[0].sceneType).toBe("exploration");
    expect(parsed.act.branches).toEqual([]);
    expect(parsed.act.personalHooks).toEqual([]);
  });

  it("без сцен и злодеев сюжет не принимается", () => {
    expect(() =>
      partyAwareAct1Schema.parse({ title: "X", villains: [], act: { name: "A", scenes: [] } })
    ).toThrow();
  });
});
