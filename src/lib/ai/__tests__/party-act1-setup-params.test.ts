import { describe, it, expect } from "vitest";
import { buildPartyAct1Prompt, type PartyArcGenerationParams } from "../party-arc-generator";

const base: PartyArcGenerationParams = {
  title: "Тест",
  setting: "Тёмное фэнтези",
  tone: "dark",
  difficulty: "brutal",
  levelFrom: 1,
  levelTo: 10,
  startingSituation: "patron_contract",
  party: [],
  customDmNotes: null,
};

describe("buildPartyAct1Prompt: параметры окна попадают в промпт Акта 1", () => {
  it("carries the party relations and the DM style", () => {
    const prompt = buildPartyAct1Prompt({ ...base, partyTies: "friends", dmStyle: "tactical" });
    expect(prompt).toContain("Отношения в отряде:");
    expect(prompt).toContain("Соклановцы");
    expect(prompt).toContain("Стиль мастера: tactical");
  });

  it("carries the starting situation", () => {
    const prompt = buildPartyAct1Prompt({ ...base, partyTies: "friends" });
    expect(prompt).toContain("Начальная связь героев:");
    expect(prompt).toContain("Код: patron_contract");
  });
});
