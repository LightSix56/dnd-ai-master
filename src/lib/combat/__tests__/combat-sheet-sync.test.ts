import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeSupabase, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { fakePrisma } from "@/lib/testing/fake-prisma";

const state = vi.hoisted(() => ({ prisma: null as any, supabase: null as any }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => state.prisma[prop as string] }),
}));
vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: () => state.supabase }));

import { combatantToSheetPatch, endActiveCombats, syncCombatToSheets } from "../combat-sheet-sync";

const TOXIN = "11111111-1111-4111-8111-111111111111";
const FANG = "22222222-2222-4222-8222-222222222222";

const wizardSheet = {
  name: "Токсин", level: 3, hpMax: 20, hpCurrent: 20, hpTemp: 0,
  spellSlots: { 1: { totalSlots: 4, expendedSlots: 0 }, 2: { totalSlots: 2, expendedSlots: 1 } },
  conditions: [],
  equipment: "посох",
};

function combatant(patch: Record<string, any>) {
  return {
    id: `cb-${patch.characterId ?? patch.name}`, combatId: "combat-1", type: "player", name: "Токсин",
    hpCurrent: 7, hpMax: 20, hpTemp: 2, conditions: "[]", spells: "{}", characterId: null, ...patch,
  };
}

function setup(combatants: Record<string, any>[], characters: Record<string, any>[], sheets: Record<string, any>[] = []) {
  state.supabase = fakeSupabase({ tables: { characters: sheets } });
  state.prisma = fakePrisma({
    combat: [{ id: "combat-1", campaignId: "camp-1", status: "ended", sheetSyncedAt: null }],
    combatant: combatants,
    character: characters,
  });
  return state.supabase as FakeSupabase;
}

describe("combatantToSheetPatch", () => {
  it("writes hit points, temporary hit points and conditions", () => {
    const patch = combatantToSheetPatch(
      combatant({ conditions: JSON.stringify([{ type: "poisoned" }, { type: "prone", duration: 1 }]) }),
      wizardSheet
    );
    expect(patch).toMatchObject({ hpCurrent: 7, hpTemp: 2, conditions: ["poisoned", "prone"] });
  });

  it("spell slots are written as expended, clamped", () => {
    const patch = combatantToSheetPatch(
      combatant({ spells: JSON.stringify({ slots: { 1: { max: 4, used: 3 }, 2: { max: 2, used: 9 }, 3: { max: 2, used: 1 } }, known: [] }) }),
      wizardSheet
    );
    expect(patch.spellSlots).toEqual({
      1: { totalSlots: 4, expendedSlots: 3 },
      2: { totalSlots: 2, expendedSlots: 2 },
    });
  });

  it("a combatant without slot data leaves the sheet's slots alone", () => {
    const patch = combatantToSheetPatch(combatant({ spells: "{}" }), wizardSheet);
    expect("spellSlots" in patch).toBe(false);
  });

  it("unknown conditions are dropped", () => {
    const patch = combatantToSheetPatch(
      combatant({ conditions: JSON.stringify([{ type: "dodging" }, { type: "helping" }, { type: "stunned" }, { type: "stunned" }]) }),
      wizardSheet
    );
    expect(patch.conditions).toEqual(["stunned"]);
  });

  it("hit points are clamped to the sheet maximum and never negative", () => {
    expect(combatantToSheetPatch(combatant({ hpCurrent: 99 }), wizardSheet).hpCurrent).toBe(20);
    expect(combatantToSheetPatch(combatant({ hpCurrent: -4, hpTemp: -1 }), wizardSheet)).toMatchObject({ hpCurrent: 0, hpTemp: 0 });
  });

  it("a sheet without hpMax clamps to the hero's effective maximum, not to 1", () => {
    const blank = { ...wizardSheet, hpMax: null };
    expect(combatantToSheetPatch(combatant({ hpCurrent: 7 }), blank, 24).hpCurrent).toBe(7);
    expect(combatantToSheetPatch(combatant({ hpCurrent: 30 }), blank, 24).hpCurrent).toBe(24);
  });

  it("levelled sheet conditions the combat cannot express are kept", () => {
    const sheet = { ...wizardSheet, conditions: ["exhaustion:2", "poisoned", "custom-curse"] };
    const patch = combatantToSheetPatch(combatant({ conditions: JSON.stringify([{ type: "prone" }]) }), sheet);
    // poisoned бой знает и к концу боя его нет — снято; exhaustion:2 и своё состояние бой не ведёт — остаются
    expect(patch.conditions).toEqual(["exhaustion:2", "custom-curse", "prone"]);
  });

  it("broken json in the combatant does not throw", () => {
    const patch = combatantToSheetPatch(combatant({ conditions: "{oops", spells: "nope" }), wizardSheet);
    expect(patch).toMatchObject({ hpCurrent: 7, conditions: [] });
  });
});

describe("syncCombatToSheets", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("linked hero state goes to the sheet, unlinked hero to the campaign row", async () => {
    const supabase = setup(
      [
        combatant({ characterId: "ch-toxin", conditions: JSON.stringify([{ type: "poisoned" }]) }),
        combatant({ characterId: "ch-npc", name: "Спутник", type: "companion", hpCurrent: 3, hpTemp: 0 }),
        combatant({ name: "Гоблин", type: "enemy", hpCurrent: 0 }),
      ],
      [
        { id: "ch-toxin", campaignId: "camp-1", name: "Токсин", type: "player", sheetCharacterId: TOXIN, sheet: wizardSheet },
        { id: "ch-npc", campaignId: "camp-1", name: "Спутник", type: "companion", sheetCharacterId: null, hpCurrent: 11, hpMax: 11 },
      ],
      [{ id: TOXIN, user_id: "u1", name: "Токсин (Встреча)", data: wizardSheet, revision: 0 }]
    );

    const result = await syncCombatToSheets("combat-1");

    expect(result).toEqual({ synced: 2, skipped: false });
    expect(supabase.tables.characters[0].data).toMatchObject({ hpCurrent: 7, hpTemp: 2, conditions: ["poisoned"], equipment: "посох", level: 3 });
    expect(state.prisma.character.rows.find((c: any) => c.id === "ch-npc")).toMatchObject({ hpCurrent: 3, hpTemp: 0 });
    expect(state.prisma.combat.rows[0].sheetSyncedAt).toBeInstanceOf(Date);
  });

  it("second sync is a no-op", async () => {
    const supabase = setup(
      [combatant({ characterId: "ch-toxin" })],
      [{ id: "ch-toxin", campaignId: "camp-1", name: "Токсин", type: "player", sheetCharacterId: TOXIN, sheet: wizardSheet }],
      [{ id: TOXIN, user_id: "u1", name: "Токсин (Встреча)", data: wizardSheet, revision: 0 }]
    );
    await syncCombatToSheets("combat-1");
    const callsAfterFirst = supabase.rpcCalls.length;
    // игрок успел отдохнуть на сайте листа — повторная запись итогов боя не должна это затереть
    supabase.tables.characters[0].data = { ...supabase.tables.characters[0].data, hpCurrent: 20 };

    const second = await syncCombatToSheets("combat-1");

    expect(second).toEqual({ synced: 0, skipped: true });
    expect(supabase.rpcCalls.length).toBe(callsAfterFirst);
    expect(supabase.tables.characters[0].data.hpCurrent).toBe(20);
  });

  it("one failing hero does not block the others and sync is retried", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = setup(
      [combatant({ characterId: "ch-toxin" }), combatant({ characterId: "ch-fang", name: "Клык", hpCurrent: 5 })],
      [
        { id: "ch-toxin", campaignId: "camp-1", name: "Токсин", type: "player", sheetCharacterId: TOXIN, sheet: wizardSheet },
        { id: "ch-fang", campaignId: "camp-1", name: "Клык", type: "player", sheetCharacterId: FANG, sheet: { name: "Клык", hpMax: 12, hpCurrent: 12 } },
      ],
      // листа Токсина в базе нет — запись в него упадёт
      [{ id: FANG, user_id: "u2", name: "Клык (Встреча)", data: { name: "Клык", hpMax: 12, hpCurrent: 12 }, revision: 0 }]
    );

    const result = await syncCombatToSheets("combat-1");

    expect(result).toEqual({ synced: 1, skipped: false });
    expect(supabase.tables.characters[0].data.hpCurrent).toBe(5);
    expect(state.prisma.combat.rows[0].sheetSyncedAt).toBeNull();
  });

  it("a hero whose sheet is missing in the view is skipped, not written with defaults", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = setup(
      [combatant({ characterId: "ch-toxin" })],
      [{ id: "ch-toxin", campaignId: "camp-1", name: "Токсин", type: "player", sheetCharacterId: TOXIN, sheet: null, sheetMissing: true }],
      []
    );
    const result = await syncCombatToSheets("combat-1");
    expect(result.synced).toBe(0);
    expect(supabase.rpcCalls).toHaveLength(0);
    expect(state.prisma.combat.rows[0].sheetSyncedAt).toBeNull();
  });

  it("an unknown combat is reported as skipped", async () => {
    setup([], [], []);
    expect(await syncCombatToSheets("nope")).toEqual({ synced: 0, skipped: true });
  });

  it("uses the hero's effective maximum when the sheet has no hpMax", async () => {
    const blank = { name: "Клык", className: "Воин", level: 1, hpMax: null, hpCurrent: 0 };
    const supabase = setup(
      [combatant({ characterId: "ch-fang", name: "Клык", hpCurrent: 7, hpMax: 12 })],
      [{ id: "ch-fang", campaignId: "camp-1", name: "Клык", type: "player", sheetCharacterId: FANG, sheet: blank, hpMax: 12 }],
      [{ id: FANG, user_id: "u2", name: "Клык (Встреча)", data: blank, revision: 0 }]
    );
    await syncCombatToSheets("combat-1");
    expect(supabase.tables.characters[0].data.hpCurrent).toBe(7);
  });
});

describe("endActiveCombats", () => {
  it("a combat replaced by a new one still writes its results before it is ended", async () => {
    const supabase = setup(
      [combatant({ characterId: "ch-toxin", hpCurrent: 0 })],
      [{ id: "ch-toxin", campaignId: "camp-1", name: "Токсин", type: "player", sheetCharacterId: TOXIN, sheet: wizardSheet, hpMax: 20 }],
      [{ id: TOXIN, user_id: "u1", name: "Токсин (Встреча)", data: wizardSheet, revision: 0 }]
    );
    state.prisma.combat.rows[0].status = "active";

    const ended = await endActiveCombats({ campaignId: "camp-1" });

    expect(ended).toBe(1);
    expect(state.prisma.combat.rows[0].status).toBe("ended");
    expect(state.prisma.combat.rows[0].sheetSyncedAt).toBeInstanceOf(Date);
    expect(supabase.tables.characters[0].data.hpCurrent).toBe(0);
  });

  it("an earlier ended combat whose results were never written is retried", async () => {
    const supabase = setup(
      [combatant({ characterId: "ch-toxin", hpCurrent: 3 })],
      [{ id: "ch-toxin", campaignId: "camp-1", name: "Токсин", type: "player", sheetCharacterId: TOXIN, sheet: wizardSheet, hpMax: 20 }],
      [{ id: TOXIN, user_id: "u1", name: "Токсин (Встреча)", data: wizardSheet, revision: 0 }]
    );
    // бой уже завершён, но запись итогов тогда не удалась
    expect(state.prisma.combat.rows[0]).toMatchObject({ status: "ended", sheetSyncedAt: null });

    await endActiveCombats({ campaignId: "camp-1" });

    expect(supabase.tables.characters[0].data.hpCurrent).toBe(3);
  });

  it("combats of other campaigns are not touched", async () => {
    setup([], [], []);
    state.prisma.combat.rows.push({ id: "other", campaignId: "camp-2", status: "active", sheetSyncedAt: null });
    await endActiveCombats({ campaignId: "camp-1" });
    expect(state.prisma.combat.rows.find((c: any) => c.id === "other").status).toBe("active");
  });
});
