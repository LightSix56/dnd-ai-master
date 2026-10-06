import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    character: {
      findMany: vi.fn(),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { db } from "@/lib/db";
import { ensureCompanions } from "../ensure-companions";

describe("ensureCompanions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.character.findMany).mockResolvedValue([
      { id: "p1", name: "Пятно", type: "player", level: 3, isAlive: true },
      { id: "n1", name: "Марта", type: "npc", level: 1, isAlive: true },
      { id: "c1", name: "Гарру", type: "companion", level: 3, isAlive: true },
    ] as any);
  });

  it("новых спутников заводит с уровнем героя, известного NPC делает спутником, существующих не дублирует", async () => {
    await ensureCompanions("camp-1", [
      { name: "Марта" },
      { name: "кестрел", class: "Жрец" },
      { name: "Гарру" },
      { name: "Кестрел" },
    ]);
    expect(db.character.update).toHaveBeenCalledWith({ where: { id: "n1" }, data: { type: "companion" } });
    expect(db.character.create).toHaveBeenCalledTimes(1);
    const data = vi.mocked(db.character.create).mock.calls[0][0].data as any;
    expect(data).toMatchObject({ campaignId: "camp-1", name: "кестрел", type: "companion", class: "Жрец", level: 3, hpMax: 22 });
  });

  it("без списка ничего не делает", async () => {
    await ensureCompanions("camp-1", undefined);
    expect(db.character.findMany).not.toHaveBeenCalled();
  });
});
