import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    combat: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));
vi.mock("@/lib/auth/campaign-access", () => ({ denyCombatAccess: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/room/combat-access", () => ({ checkCombatControl: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/combat/xp-award", () => ({
  awardCombatVictoryXP: vi.fn().mockResolvedValue({ combatId: "combat-1", totalXP: 300, xpPerPlayer: 300, awardedCharacters: [] }),
}));
vi.mock("@/lib/combat/combat-sheet-sync", () => ({ syncCombatToSheets: vi.fn().mockResolvedValue({ synced: 1, skipped: false }) }));

import { db } from "@/lib/db";
import { awardCombatVictoryXP } from "@/lib/combat/xp-award";
import { POST } from "../action/route";

function fighter(id: string, type: string, hpCurrent: number) {
  return {
    id, name: id, type, color: "#fff", x: 1, y: 1, hpCurrent, hpMax: 10, ac: 12, speed: 30,
    attacks: "[]", spells: "{}", abilities: "[]", hotbar: "[]", conditions: "[]", saves: "{}", abilityMods: "{}",
  };
}

function combatRow(enemyHp: number, heroHp: number) {
  return {
    id: "combat-1", name: "Засада", status: "active", round: 1, currentTurnIndex: 0, turnOrder: "[]",
    gridWidth: 20, gridHeight: 15, cellSize: 40, log: "[]", campaignId: "camp-1",
    createdAt: new Date(), updatedAt: new Date(), mapElements: [],
    combatants: [fighter("Пятно", "player", heroHp), fighter("Головорез 1", "enemy", enemyHp), fighter("Головорез 2", "enemy", enemyHp)],
  };
}

async function endCombat(clientOutcome: string) {
  const req = new Request("http://localhost/api/combat/action", {
    method: "POST",
    body: JSON.stringify({ action: "end-combat", combatId: "combat-1", outcome: clientOutcome }),
  });
  return POST(req);
}

describe("end-combat: победу определяет сервер", () => {
  beforeEach(() => vi.clearAllMocks());

  it("враги на 0 хитов — опыт начисляется, даже если клиент не знал о победе", async () => {
    vi.mocked(db.combat.findUnique).mockResolvedValue(combatRow(0, 8) as any);
    const res = await endCombat("ended");
    expect(awardCombatVictoryXP).toHaveBeenCalledWith("combat-1");
    expect((await res.json()).outcome).toBe("players");
  });

  it("враги живы — опыта нет, даже если клиент прислал victory", async () => {
    vi.mocked(db.combat.findUnique).mockResolvedValue(combatRow(5, 8) as any);
    const res = await endCombat("victory");
    expect(awardCombatVictoryXP).not.toHaveBeenCalled();
    expect((await res.json()).outcome).toBeNull();
  });
});
