import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db
vi.mock("@/lib/db", () => {
  return {
    db: {
      combat: {
        findUnique: vi.fn(),
      },
    },
  };
});

import { db } from "@/lib/db";
import { GET } from "../[id]/route";

describe("GET /api/combat/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if combatId is missing", async () => {
    const req = new Request("http://localhost:3000/api/combat/");
    const res = await GET(req, { params: Promise.resolve({ id: "" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 404 if combat is not found", async () => {
    vi.mocked(db.combat.findUnique).mockResolvedValueOnce(null);
    const req = new Request("http://localhost:3000/api/combat/not-found");
    const res = await GET(req, { params: Promise.resolve({ id: "not-found" }) });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 200 and hydrated combat with combatants and attacks", async () => {
    const mockRow = {
      id: "combat-123",
      name: "Схватка со стражей",
      status: "active",
      round: 1,
      currentTurnIndex: 0,
      turnOrder: "[]",
      gridWidth: 20,
      gridHeight: 15,
      cellSize: 40,
      backgroundUrl: null,
      log: "[]",
      combatants: [
        {
          id: "c-1",
          name: "Стражник",
          type: "enemy",
          color: "#ef4444",
          x: 10,
          y: 5,
          hpCurrent: 16,
          hpMax: 16,
          ac: 14,
          speed: 30,
          attacks: JSON.stringify([
            { id: "atk-1", name: "Алебарда", attackBonus: 4, damage: [{ dice: "1d10", mod: 2, type: "slashing" }] },
          ]),
          abilities: JSON.stringify([
            { id: "abl-1", name: "Командный строй" },
          ]),
          spells: "{}",
          conditions: "[]",
          hotbar: "[]",
          potions: "[]",
        },
      ],
      mapElements: [
        { id: "map-1", type: "wall", x: 2, y: 3, width: 1, height: 1, properties: "{}" },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(db.combat.findUnique).mockResolvedValueOnce(mockRow as any);

    const req = new Request("http://localhost:3000/api/combat/combat-123");
    const res = await GET(req, { params: Promise.resolve({ id: "combat-123" }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.combat).toBeDefined();
    expect(data.combat.id).toBe("combat-123");
    expect(data.combat.name).toBe("Схватка со стражей");
    expect(data.combat.combatants).toHaveLength(1);

    const enemy = data.combat.combatants[0];
    expect(enemy.name).toBe("Стражник");
    expect(enemy.attacks).toHaveLength(1);
    expect(enemy.attacks[0].name).toBe("Алебарда");
    expect(enemy.abilities).toHaveLength(1);
    expect(enemy.abilities[0].name).toBe("Командный строй");
  });
});
