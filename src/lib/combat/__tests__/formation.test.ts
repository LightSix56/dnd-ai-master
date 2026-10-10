import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { planFormation, type FormationInput } from "../formation";
import { createTacticalEncounter } from "../generator";
import { db } from "@/lib/db";

const W = 30;
const H = 20;

function input(formation: FormationInput["formation"], enemyCount = 4, blocked: string[] = []): FormationInput {
  return {
    formation,
    width: W,
    height: H,
    blocked: new Set(blocked),
    cover: new Set(),
    heroes: [
      { id: "h1", x: 3, y: 8 },
      { id: "h2", x: 3, y: 10 },
    ],
    enemies: Array.from({ length: enemyCount }, (_, i) => ({ id: `e${i}`, x: 26, y: 5 + i * 3 })),
  };
}

const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe("planFormation", () => {
  it("standard ничего не двигает и никого не застигает врасплох", () => {
    const r = planFormation(input("standard"));
    expect(r.positions.size).toBe(0);
    expect(r.surprised).toBeNull();
  });

  it("close: каждый враг в 1–2 клетках от кого-то из героев, герои на месте", () => {
    const inp = input("close");
    const r = planFormation(inp);
    expect(r.surprised).toBeNull();
    expect(r.positions.has("h1")).toBe(false);
    for (const e of inp.enemies) {
      const spot = r.positions.get(e.id)!;
      const d = Math.min(...inp.heroes.map((h) => cheb(spot, h)));
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(2);
    }
  });

  it("surrounded: отряд в центре, враги со всех сторон, внезапности нет", () => {
    const inp = input("surrounded", 6);
    const r = planFormation(inp);
    expect(r.surprised).toBeNull();
    const heroSpots = inp.heroes.map((h) => r.positions.get(h.id)!);
    const c = { x: Math.floor(W / 2), y: Math.floor(H / 2) };
    for (const s of heroSpots) expect(cheb(s, c)).toBeLessThanOrEqual(1);
    const enemySpots = inp.enemies.map((e) => r.positions.get(e.id)!);
    // враги по разные стороны от отряда
    expect(enemySpots.some((s) => s.x < c.x)).toBe(true);
    expect(enemySpots.some((s) => s.x > c.x)).toBe(true);
    expect(enemySpots.some((s) => s.y < c.y)).toBe(true);
    expect(enemySpots.some((s) => s.y > c.y)).toBe(true);
  });

  it("ambush: герои застигнуты врасплох, враги кольцом вокруг", () => {
    const inp = input("ambush", 5);
    const r = planFormation(inp);
    expect(r.surprised).toBe("heroes");
    const c = { x: Math.floor(W / 2), y: Math.floor(H / 2) };
    for (const e of inp.enemies) {
      const d = cheb(r.positions.get(e.id)!, c);
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(6);
    }
  });

  it("party_ambush: врасплох застигнуты враги, герои вокруг них", () => {
    const inp = input("party_ambush", 3);
    const r = planFormation(inp);
    expect(r.surprised).toBe("enemies");
    expect(inp.heroes.every((h) => r.positions.has(h.id))).toBe(true);
  });

  it("никто не встаёт на заблокированную клетку и друг на друга", () => {
    const blocked: string[] = [];
    for (let x = 12; x <= 17; x++) for (let y = 8; y <= 12; y++) blocked.push(`${x},${y}`);
    for (const f of ["ambush", "close", "surrounded", "party_ambush"] as const) {
      const r = planFormation(input(f, 6, blocked));
      const used = new Set<string>();
      for (const s of r.positions.values()) {
        const k = `${s.x},${s.y}`;
        expect(blocked).not.toContain(k);
        expect(used.has(k)).toBe(false);
        used.add(k);
      }
    }
  });
});

describe("расстановка в созданном бою", () => {
  let campaignId: string;

  beforeEach(async () => {
    const campaign = await db.campaign.create({ data: { name: "Расстановка " + Date.now(), isActive: true } });
    campaignId = campaign.id;
    for (const name of ["Лира", "Добрун", "Марта"]) {
      await db.character.create({
        data: { campaignId, name, type: name === "Лира" ? "player" : "companion", class: "Воин", level: 3, hpCurrent: 20, hpMax: 20, ac: 14, speed: 30 },
      });
    }
  });

  afterEach(async () => {
    const combats = await db.combat.findMany({ where: { campaignId } });
    for (const c of combats) {
      await db.mapElement.deleteMany({ where: { combatId: c.id } });
      await db.combatant.deleteMany({ where: { combatId: c.id } });
    }
    await db.combat.deleteMany({ where: { campaignId } });
    await db.character.deleteMany({ where: { campaignId } });
    await db.campaign.deleteMany({ where: { id: campaignId } });
  });

  const hasSurprised = (conditions: string | null) => (JSON.parse(conditions || "[]") as Array<{ type: string }>).some((c) => c.type === "surprised");

  it("засада на отряд: застигнуты врасплох только участвующие герои", async () => {
    const encounter = await createTacticalEncounter({
      campaignId, name: "Засада", biome: "forest", difficulty: "easy", formation: "ambush", participantNames: ["Лира", "Марта"],
    });
    expect(encounter.formation).toBe("ambush");
    expect(encounter.surprised).toBe("heroes");
    const all = await db.combatant.findMany({ where: { combatId: encounter.combatId } });
    const heroes = all.filter((c) => c.type !== "enemy");
    expect(heroes.map((h) => h.name).sort()).toEqual(["Лира", "Марта"]);
    expect(heroes.every((h) => hasSurprised(h.conditions))).toBe(true);
    expect(all.filter((c) => c.type === "enemy").some((e) => hasSurprised(e.conditions))).toBe(false);
  });

  it("засада героев: врасплох застигнуты враги", async () => {
    const encounter = await createTacticalEncounter({ campaignId, name: "Засада героев", biome: "forest", difficulty: "easy", formation: "party_ambush" });
    expect(encounter.surprised).toBe("enemies");
    const all = await db.combatant.findMany({ where: { combatId: encounter.combatId } });
    expect(all.filter((c) => c.type === "enemy").every((e) => hasSurprised(e.conditions))).toBe(true);
    expect(all.filter((c) => c.type !== "enemy").some((h) => hasSurprised(h.conditions))).toBe(false);
  });

  it("без formation всё как раньше: никто не застигнут", async () => {
    const encounter = await createTacticalEncounter({ campaignId, name: "Обычный бой", biome: "forest", difficulty: "easy" });
    expect(encounter.formation).toBe("standard");
    expect(encounter.surprised).toBeNull();
    const all = await db.combatant.findMany({ where: { combatId: encounter.combatId } });
    expect(all.some((c) => hasSurprised(c.conditions))).toBe(false);
  });

  it("ближний контакт: враги в 1–2 клетках от героев", async () => {
    const encounter = await createTacticalEncounter({ campaignId, name: "Стража напала", biome: "urban", difficulty: "easy", formation: "close" });
    const all = await db.combatant.findMany({ where: { combatId: encounter.combatId } });
    const heroes = all.filter((c) => c.type !== "enemy");
    for (const e of all.filter((c) => c.type === "enemy")) {
      const d = Math.min(...heroes.map((h) => Math.max(Math.abs(h.x - e.x), Math.abs(h.y - e.y))));
      expect(d).toBeLessThanOrEqual(2);
    }
  });
});
