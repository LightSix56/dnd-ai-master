import { describe, it, expect } from "vitest";
import {
  bundleTurnInputs,
  calculateTurnReadiness,
  type PlayerTurnInput,
} from "../turn-batcher";

describe("turn-batcher", () => {
  const sampleInputs: Record<string, PlayerTurnInput> = {
    "user-1": {
      userId: "user-1",
      characterName: "Торин",
      className: "Жрец",
      level: 1,
      actionText: "Зажигаю священное пламя на щите и читаю молитву.",
      submittedAt: 1000,
    },
    "user-2": {
      userId: "user-2",
      characterName: "Лира",
      className: "Плут",
      level: 1,
      actionText: "Бесшумно крадусь вдоль стены и осматриваю коридор.",
      submittedAt: 1005,
    },
  };

  it("bundles multiple player inputs into a single coherent prompt block", () => {
    const prompt = bundleTurnInputs(sampleInputs, { roundNumber: 3 });

    expect(prompt).toContain("Совместный ход отряда — Раунд 3");
    expect(prompt).toContain('Торин (Жрец 1 ур.): "Зажигаю священное пламя на щите и читаю молитву."');
    expect(prompt).toContain('Лира (Плут 1 ур.): "Бесшумно крадусь вдоль стены и осматриваю коридор."');
  });

  it("includes DM whisper directive with clear hidden instructions when provided", () => {
    const prompt = bundleTurnInputs(sampleInputs, {
      roundNumber: 1,
      gmWhisperDirective: "За дверью не гоблины, а испуганный кузнец с вилами.",
    });

    expect(prompt).toContain("Скрытая директива ведущего");
    expect(prompt).toContain("За дверью не гоблины, а испуганный кузнец с вилами.");
  });

  it("handles AFK characters cleanly with defensive holding stance", () => {
    const prompt = bundleTurnInputs(sampleInputs, {
      roundNumber: 2,
      afkCharacters: [{ name: "Кроуг", className: "Варвар" }],
    });

    expect(prompt).toContain("Кроуг (Варвар)");
    expect(prompt).toContain("держит позицию");
  });

  it("calculates turn readiness correctly based on room participants and inputs", () => {
    const participants = [
      { userId: "user-1", characterSnapshot: { name: "Торин" } },
      { userId: "user-2", characterSnapshot: { name: "Лира" } },
      { userId: "user-3", characterSnapshot: { name: "Кроуг" } },
    ];

    const partialInputs: Record<string, PlayerTurnInput> = {
      "user-1": sampleInputs["user-1"],
    };

    const status1 = calculateTurnReadiness(participants, partialInputs);
    expect(status1.readyCount).toBe(1);
    expect(status1.totalCount).toBe(3);
    expect(status1.isAllReady).toBe(false);
    expect(status1.pendingUserIds).toEqual(["user-2", "user-3"]);

    const fullInputs = {
      ...sampleInputs,
      "user-3": {
        userId: "user-3",
        characterName: "Кроуг",
        className: "Варвар",
        level: 1,
        actionText: "Готовлю топор.",
        submittedAt: 1010,
      },
    };

    const status2 = calculateTurnReadiness(participants, fullInputs);
    expect(status2.readyCount).toBe(3);
    expect(status2.totalCount).toBe(3);
    expect(status2.isAllReady).toBe(true);
    expect(status2.pendingUserIds).toEqual([]);
  });
});
