import { describe, it, expect, vi } from "vitest";
import { fakePrisma } from "@/lib/testing/fake-prisma";

const state = vi.hoisted(() => ({ prisma: null as any }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => state.prisma[prop as string] }),
}));

import {
  PARTY_LEVELED_TEXT,
  acknowledgePartyLevels,
  buildPartyLeveledNote,
  findLevelChanges,
  PartyLeveledError,
} from "../party-leveled";

// Герой, каким его отдаёт @/lib/db: уровень и класс — уже из живого листа
function hero(patch: Record<string, any>) {
  return {
    id: "ch-1", campaignId: "camp-1", name: "Токсин", type: "player", class: "Плут",
    level: 1, sheetCharacterId: "sheet-1", sheetLevelSeen: 1, sheet: { name: "Токсин" }, sheetMissing: false,
    ...patch,
  };
}

describe("findLevelChanges", () => {
  it("no changes when levels match", () => {
    expect(findLevelChanges([hero({ level: 2, sheetLevelSeen: 2 })])).toEqual([]);
  });

  it("detects a hero whose sheet level is above the seen level", () => {
    expect(findLevelChanges([hero({ level: 3, sheetLevelSeen: 1 })])).toEqual([
      { characterId: "ch-1", name: "Токсин", className: "Плут", fromLevel: 1, toLevel: 3 },
    ]);
  });

  it("first sight of a hero (sheetLevelSeen null) is not a change", () => {
    expect(findLevelChanges([hero({ level: 4, sheetLevelSeen: null })])).toEqual([]);
  });

  it("heroes without a sheet, with a missing sheet, and npcs are ignored", () => {
    expect(
      findLevelChanges([
        hero({ id: "a", level: 5, sheetLevelSeen: 1, sheetCharacterId: null, sheet: null }),
        hero({ id: "b", level: 5, sheetLevelSeen: 1, sheet: null, sheetMissing: true }),
        hero({ id: "c", level: 5, sheetLevelSeen: 1, type: "npc" }),
      ])
    ).toEqual([]);
  });

  it("a level lower than the seen one is not reported", () => {
    expect(findLevelChanges([hero({ level: 1, sheetLevelSeen: 3 })])).toEqual([]);
  });
});

describe("buildPartyLeveledNote", () => {
  it("note lists every changed hero", () => {
    const note = buildPartyLeveledNote([
      { characterId: "a", name: "Токсин", className: "Плут", fromLevel: 1, toLevel: 2 },
      { characterId: "b", name: "Клык", className: "", fromLevel: 2, toLevel: 3 },
    ]);
    expect(note.split("\n")).toEqual([
      "Партия прокачала уровень, посмотри их листы заново.",
      "Токсин — 2 ур. (Плут), был 1",
      "Клык — 3 ур., был 2",
    ]);
    expect(PARTY_LEVELED_TEXT).toBe("Партия прокачала уровень, посмотри их листы заново.");
  });
});

describe("acknowledgePartyLevels", () => {
  function setup(characters: Record<string, any>[], combats: Record<string, any>[] = []) {
    state.prisma = fakePrisma({ character: characters, combat: combats });
  }

  it("acknowledge stores a user-role message and updates sheetLevelSeen", async () => {
    setup([
      hero({ id: "ch-1", level: 2, sheetLevelSeen: 1 }),
      hero({ id: "ch-2", name: "Клык", class: "Воин", level: 1, sheetLevelSeen: 1, sheetCharacterId: "sheet-2" }),
      hero({ id: "ch-3", name: "Мира", class: "Жрец", level: 3, sheetLevelSeen: null, sheetCharacterId: "sheet-3" }),
    ]);

    const result = await acknowledgePartyLevels("camp-1");

    expect(result.changes).toHaveLength(1);
    expect(result.note).toContain("Токсин — 2 ур. (Плут), был 1");
    const messages = state.prisma.chatMessage.rows;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ campaignId: "camp-1", role: "user" });
    expect(messages[0].content).toBe(`[Система] ${result.note}`);
    const seen = Object.fromEntries(state.prisma.character.rows.map((c: any) => [c.id, c.sheetLevelSeen]));
    // у впервые увиденного героя уровень просто запоминается
    expect(seen).toEqual({ "ch-1": 2, "ch-2": 1, "ch-3": 3 });
  });

  it("a second press right after does nothing new", async () => {
    setup([hero({ level: 2, sheetLevelSeen: 1 })]);
    await acknowledgePartyLevels("camp-1");
    await expect(acknowledgePartyLevels("camp-1")).rejects.toThrow("Никто из партии ещё не повысил уровень.");
    expect(state.prisma.chatMessage.rows).toHaveLength(1);
  });

  it("post during combat is refused", async () => {
    setup([hero({ level: 2, sheetLevelSeen: 1 })], [{ id: "cb", campaignId: "camp-1", status: "active" }]);
    const attempt = acknowledgePartyLevels("camp-1");
    await expect(attempt).rejects.toBeInstanceOf(PartyLeveledError);
    await expect(attempt).rejects.toThrow("Сначала завершите бой.");
    expect(state.prisma.chatMessage.rows).toHaveLength(0);
    expect(state.prisma.character.rows[0].sheetLevelSeen).toBe(1);
  });

  it("an ended combat does not block", async () => {
    setup([hero({ level: 2, sheetLevelSeen: 1 })], [{ id: "cb", campaignId: "camp-1", status: "ended" }]);
    const result = await acknowledgePartyLevels("camp-1");
    expect(result.changes).toHaveLength(1);
  });
});
