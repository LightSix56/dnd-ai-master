import { describe, it, expect } from "vitest";
import { buildSystemPrompt, type CampaignContext } from "../system-prompt";
import { buildFrozenSystemPrompt } from "../caching/frozen-prefix";

const solo: CampaignContext = {
  name: "Тест",
  setting: "Туманный город",
  tone: "dark",
  partyMembers: [{ id: "1", name: "Ирга", race: "Человек", class: "Плут", level: 1, background: "Беглянка" }],
};

const party: CampaignContext = {
  ...solo,
  partyMembers: [
    ...(solo.partyMembers ?? []),
    { id: "2", name: "Торгрим", race: "Дворф", class: "Жрец", level: 1 },
  ],
};

describe("системный промпт: вступительная сцена", () => {
  it("содержит правила вступления для одного героя и для отряда", () => {
    for (const ctx of [solo, party, undefined]) {
      const prompt = buildSystemPrompt(ctx);
      expect(prompt).toContain("### Вступительная сцена");
      expect(prompt).toMatch(/Не придумывай (?:герою|героям) то, чего нет в /);
    }
  });

  it("вступление для отряда требует задействовать каждого героя, для одного героя этого нет", () => {
    expect(buildSystemPrompt(party)).toContain("КАЖДОГО героя поровну");
    expect(buildSystemPrompt(party)).toContain("не делай за них выбор");
    expect(buildSystemPrompt(solo)).not.toContain("КАЖДОГО героя поровну");
    expect(buildSystemPrompt(solo)).toContain("Не придумывай герою то, чего нет в досье и листе");
  });

  it("не ломает кэш: замороженный префикс не зависит от изменчивых заметок о герое", () => {
    const withVolatile: CampaignContext = {
      ...solo,
      partyMembers: [{ ...solo.partyMembers![0], notes: "Характер: осторожная\n[Статус: ранена]\n• боится огня" }],
    };
    const withOtherVolatile: CampaignContext = {
      ...solo,
      partyMembers: [{ ...solo.partyMembers![0], notes: "Характер: осторожная\n[Статус: здорова]\n• любит кошек" }],
    };
    expect(buildFrozenSystemPrompt(withVolatile)).toBe(buildFrozenSystemPrompt(withOtherVolatile));
  });

  it("повторная сборка даёт тот же текст побайтно", () => {
    expect(buildFrozenSystemPrompt(party)).toBe(buildFrozenSystemPrompt(party));
  });
});
