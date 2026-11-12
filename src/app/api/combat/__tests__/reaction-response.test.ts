// Окно реакции через настоящий роут: запрос → окно → ответ → повтор действия.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "../action/route";
import { db } from "@/lib/db";
import { dehydrateCombatant } from "@/lib/combat/serialize";
import { enemy, hero } from "@/lib/combat/__tests__/helpers/fighter-harness";

const call = async (body: Record<string, unknown>) => {
  const res = await POST(
    new Request("http://localhost/api/combat/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, data: await res.json() };
};

describe("reaction-response", () => {
  let combatId: string;

  beforeEach(async () => {
    const combat = await db.combat.create({
      data: { name: "Окно реакции", gridWidth: 30, gridHeight: 30, status: "active", round: 1, turnOrder: "[]", log: "[]" },
    });
    combatId = combat.id;
    const h = hero("h", "", 1, { x: 5, y: 5 });
    const e = enemy("e", 6, 5, { attacks: [] });
    const rows = [h, e];
    const ids: string[] = [];
    for (const c of rows) {
      const row = await db.combatant.create({ data: { combatId, ...(dehydrateCombatant(c) as any) } });
      ids.push(row.id);
    }
    // Ход врага: он убегает от героя
    await db.combat.update({ where: { id: combatId }, data: { turnOrder: JSON.stringify([ids[1], ids[0]]), currentTurnIndex: 0 } });
    (globalThis as any).__ids = { h: ids[0], e: ids[1] };
  });

  afterEach(async () => {
    await db.combatant.deleteMany({ where: { combatId } });
    await db.combat.deleteMany({ where: { id: combatId } });
  });

  const ids = () => (globalThis as any).__ids as { h: string; e: string };

  it("игрок решает: окно, отказ — враг уходит; состояние до ответа не меняется", async () => {
    const first = await call({ action: "move-combatant", combatId, combatantId: ids().e, x: 6, y: 9 });
    expect(first.status).toBe(200);
    expect(first.data.pendingReaction.prompt.reactorId).toBe(ids().h);
    expect(first.data.combat.pendingReaction.id).toBe(first.data.pendingReaction.id);

    // Враг не сдвинулся, остальные действия отклоняются
    const row = await db.combatant.findUnique({ where: { id: ids().e } });
    expect(row!.y).toBe(5);
    const blocked = await call({ action: "end-turn", combatId });
    expect(blocked.status).toBe(400);
    expect(blocked.data.error).toContain("реакци");

    // Чужое окно и чужой боец
    const stale = await call({ action: "reaction-response", combatId, combatantId: ids().h, promptId: "other", choice: "decline" });
    expect(stale.status).toBe(409);
    const wrongBody = await call({ action: "reaction-response", combatId, combatantId: ids().e, promptId: first.data.pendingReaction.id, choice: "decline" });
    expect(wrongBody.status).toBe(403);
    const badChoice = await call({ action: "reaction-response", combatId, combatantId: ids().h, promptId: first.data.pendingReaction.id, choice: "fireball" });
    expect(badChoice.status).toBe(400);

    const done = await call({
      action: "reaction-response",
      combatId,
      combatantId: ids().h,
      promptId: first.data.pendingReaction.id,
      choice: "decline",
    });
    expect(done.status).toBe(200);
    expect(done.data.opportunityAttacks).toHaveLength(0);
    expect(done.data.combat.pendingReaction).toBeNull();
    const moved = await db.combatant.findUnique({ where: { id: ids().e } });
    expect(moved!.y).toBe(9);
    const hero = await db.combatant.findUnique({ where: { id: ids().h } });
    expect(hero!.reactionUsed).toBe(false);

    // Повторный ответ на закрытое окно
    const again = await call({ action: "reaction-response", combatId, combatantId: ids().h, promptId: first.data.pendingReaction.id, choice: "decline" });
    expect(again.status).toBe(409);
  });

  it("«Да»: атака по возможности, враг остановлен в клетке удара, реакция потрачена", async () => {
    const first = await call({ action: "move-combatant", combatId, combatantId: ids().e, x: 6, y: 9 });
    const done = await call({
      action: "reaction-response",
      combatId,
      combatantId: ids().h,
      promptId: first.data.pendingReaction.id,
      choice: "opportunity-attack",
    });
    expect(done.status).toBe(200);
    expect(done.data.opportunityAttacks).toHaveLength(1);
    expect(done.data.path).toEqual([{ x: 6, y: 6 }]);
    const moved = await db.combatant.findUnique({ where: { id: ids().e } });
    expect(moved!.y).toBe(6);
    const heroRow = await db.combatant.findUnique({ where: { id: ids().h } });
    expect(heroRow!.reactionUsed).toBe(true);
  });
});
