import { describe, it, expect } from "vitest";
import {
  extractPartyRosterFromParticipants,
  synthesizePartyRosterPrompt,
  getCombatDifficultyConfig,
  buildPartyAct1Prompt,
  type PartyRosterMember,
  type PartyArcGenerationParams,
} from "../party-arc-generator";

describe("party-arc-generator", () => {
  const sampleParty: PartyRosterMember[] = [
    {
      id: "p1",
      name: "Торин Железностоп",
      race: "Горный дварф",
      className: "Жрец (Домен Войны)",
      level: 1,
      background: "Служитель культа",
      bonds: "Ищет древнюю реликвию своего предка, украденную культистами",
      flaws: "Упрям и подозрителен к незнакомцам",
    },
    {
      id: "p2",
      name: "Лира Теневой Шаг",
      race: "Лесной эльф",
      className: "Плут (Вор)",
      level: 1,
      background: "Беспризорник",
      bonds: "Долг перед гильдией воров, за ней охотятся сборщики долгов",
      flaws: "Не может пройти мимо блестящей драгоценности",
    },
  ];

  it("extracts party roster correctly from room participant snapshots", () => {
    const rawParticipants = [
      {
        id: "part-1",
        userId: "user-1",
        characterSnapshot: {
          id: "char-1",
          name: "Торин Железностоп",
          race: "Горный дварф",
          className: "Жрец",
          level: 1,
          background: "Служитель культа",
          bonds: "Священная реликвия",
        },
      },
      {
        id: "part-2",
        userId: "user-2",
        characterSnapshot: {
          character: {
            name: "Лира Теневой Шаг",
            race: "Лесной эльф",
            class: "Плут",
            level: 1,
            data: {
              background: "Беспризорник",
            },
          },
        },
      },
      {
        id: "part-3",
        userId: "user-3",
        characterSnapshot: null, // participant choosing
      },
    ];

    const roster = extractPartyRosterFromParticipants(rawParticipants);
    expect(roster).toHaveLength(2);
    expect(roster[0].name).toBe("Торин Железностоп");
    expect(roster[0].className).toBe("Жрец");
    expect(roster[1].name).toBe("Лира Теневой Шаг");
    expect(roster[1].className).toBe("Плут");
  });

  it("synthesizes rich party roster prompt with backstory bonds and flaws", () => {
    const prompt = synthesizePartyRosterPrompt(sampleParty);

    expect(prompt).toContain("Торин Железностоп");
    expect(prompt).toContain("Горный дварф");
    expect(prompt).toContain("Жрец (Домен Войны)");
    expect(prompt).toContain("Ищет древнюю реликвию");
    expect(prompt).toContain("Лира Теневой Шаг");
    expect(prompt).toContain("Долг перед гильдией воров");
    expect(prompt).toContain("Personal Plot Hook");
  });

  it("returns correct combat difficulty configuration and encounter probability distribution", () => {
    const easy = getCombatDifficultyConfig("easy");
    expect(easy.probabilities).toEqual({ easy: 0.6, medium: 0.3, hard: 0.1, deadly: 0.0 });

    const normal = getCombatDifficultyConfig("normal");
    expect(normal.probabilities).toEqual({ easy: 0.0, medium: 0.5, hard: 0.3, deadly: 0.2 });

    const hard = getCombatDifficultyConfig("hard");
    expect(hard.probabilities).toEqual({ easy: 0.0, medium: 0.2, hard: 0.4, deadly: 0.4 });

    const brutal = getCombatDifficultyConfig("brutal");
    expect(brutal.probabilities).toEqual({ easy: 0.0, medium: 0.1, hard: 0.3, deadly: 0.6 });
  });

  it("builds organic dynamic Act 1 prompt without rigid sequence", () => {
    const params: PartyArcGenerationParams = {
      title: "Падение Чёрной Цитадели",
      setting: "Готический хоррор",
      tone: "Мрачный и напряжённый",
      difficulty: "hard",
      levelFrom: 1,
      levelTo: 10,
      startingSituation: "captives_or_survivors",
      party: sampleParty,
      customDmNotes: "Сделать кульминацию в затопленном склепе",
    };

    const prompt = buildPartyAct1Prompt(params);

    // Prompt MUST specify generating ONLY Act 1
    expect(prompt).toContain("ТОЛЬКО АКТ 1");
    expect(prompt).toContain("Падение Чёрной Цитадели");
    expect(prompt).toContain("Готический хоррор");
    expect(prompt).toContain("captives_or_survivors");
    expect(prompt).toContain("Торин Железностоп");
    expect(prompt).toContain("Лира Теневой Шаг");
    expect(prompt).toContain("Сделать кульминацию в затопленном склепе");
    // Explicit ban on rigid templates
    expect(prompt).toContain("ЗАПРЕЩЕНО использовать шаблонную фиксированную последовательность сцен");
  });
});
