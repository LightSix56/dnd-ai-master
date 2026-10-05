import { describe, it, expect } from "vitest";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { splitHeroWrite, applyHeroSheetWrite, liveHeroRows, liveNestedHeroes, withNestedHeroLink } from "../hero-db-hooks";

const SHEET_ID = "11111111-1111-4111-8111-111111111111";

function client(sheet: Record<string, any> = { name: "Токсин", level: 3, hpMax: 24, hpCurrent: 11, experiencePoints: 100 }) {
  return fakeSupabase({
    tables: { characters: [{ id: SHEET_ID, user_id: "u1", name: "Токсин (Встреча)", data: sheet, revision: 0, campaign_id: "c1" }] },
  });
}

describe("splitHeroWrite", () => {
  it("routes game state to the sheet, keeps campaign fields in prisma, drops build fields", () => {
    const split = splitHeroWrite({
      hpCurrent: 5,
      hpTemp: 2,
      experiencePoints: { increment: 50 },
      level: 4,
      profBonus: 2,
      hpMax: 99,
      ac: 20,
      str: 18,
      location: "Таверна",
      notes: "[Статус: ранен]",
      inventory: "[]",
    });
    expect(split.prismaData).toEqual({ location: "Таверна", notes: "[Статус: ранен]", inventory: "[]" });
    expect(split.sheetOps).toEqual({ hpCurrent: 5, hpTemp: 2, experiencePoints: { increment: 50 } });
    expect(split.dropped.sort()).toEqual(["ac", "hpMax", "level", "profBonus", "str"]);
  });

  it("a write without sheet fields is passed through untouched", () => {
    const data = { location: "Лес", relation: 10 };
    const split = splitHeroWrite(data);
    expect(split.prismaData).toEqual(data);
    expect(split.sheetOps).toEqual({});
    expect(split.dropped).toEqual([]);
  });
});

describe("applyHeroSheetWrite", () => {
  it("linked hero hp goes to the sheet", async () => {
    const c = client();
    await applyHeroSheetWrite(SHEET_ID, { hpCurrent: 5, hpTemp: 2 }, c as any);
    expect(c.tables.characters[0].data).toMatchObject({ hpCurrent: 5, hpTemp: 2, hpMax: 24, name: "Токсин" });
  });

  it("hit points are clamped to 0..hpMax of the sheet", async () => {
    const c = client();
    await applyHeroSheetWrite(SHEET_ID, { hpCurrent: 999 }, c as any);
    expect(c.tables.characters[0].data.hpCurrent).toBe(24);
    await applyHeroSheetWrite(SHEET_ID, { hpCurrent: -7 }, c as any);
    expect(c.tables.characters[0].data.hpCurrent).toBe(0);
  });

  it("relative hp change is applied to the current sheet value", async () => {
    const c = client();
    await applyHeroSheetWrite(SHEET_ID, { hpCurrent: { decrement: 4 } }, c as any);
    expect(c.tables.characters[0].data.hpCurrent).toBe(7);
    await applyHeroSheetWrite(SHEET_ID, { hpCurrent: { increment: 100 } }, c as any);
    expect(c.tables.characters[0].data.hpCurrent).toBe(24);
  });

  it("experience increment uses the atomic rpc, a plain number sets the total", async () => {
    const c = client();
    await applyHeroSheetWrite(SHEET_ID, { experiencePoints: { increment: 50 } }, c as any);
    expect(c.rpcCalls.at(-1)).toEqual({ name: "add_character_experience", args: { p_id: SHEET_ID, p_amount: 50 } });
    expect(c.tables.characters[0].data.experiencePoints).toBe(150);
    await applyHeroSheetWrite(SHEET_ID, { experiencePoints: 900 }, c as any);
    expect(c.tables.characters[0].data.experiencePoints).toBe(900);
  });

  it("no ops means no database call", async () => {
    const c = client();
    await applyHeroSheetWrite(SHEET_ID, {}, c as any);
    expect(c.calls).toHaveLength(0);
    expect(c.rpcCalls).toHaveLength(0);
  });
});

describe("liveHeroRows", () => {
  it("overlays rows that carry a sheet link and leaves selected-column rows alone", async () => {
    const c = client();
    const rows = await liveHeroRows(
      [
        { id: "ch-1", name: "Старое", level: 1, hpCurrent: 10, hpMax: 10, sheetCharacterId: SHEET_ID },
        { campaignId: "c1" }, // результат select без ссылки на лист
        { id: "npc", name: "Трактирщик", level: 1, sheetCharacterId: null },
      ],
      c as any
    );
    expect(rows[0]).toMatchObject({ name: "Токсин", level: 3, hpCurrent: 11, hpMax: 24 });
    expect(rows[1]).toEqual({ campaignId: "c1" });
    expect(rows[2]).toMatchObject({ name: "Трактирщик", sheet: null, sheetMissing: false });
    expect(c.calls).toHaveLength(1);
  });

  it("null and non-object results pass through", async () => {
    const c = client();
    expect(await liveHeroRows(null, c as any)).toBeNull();
    expect(await liveHeroRows({ count: 3 } as any, c as any)).toEqual({ count: 3 });
    expect(c.calls).toHaveLength(0);
  });
});

describe("кампания, прочитанная вместе с героями", () => {
  it("heroes nested in a campaign get their live sheet, one database call for all campaigns", async () => {
    const c = client();
    const campaigns = await liveNestedHeroes(
      [
        { id: "c1", characters: [{ id: "ch-1", name: "Старое", level: 1, sheetCharacterId: SHEET_ID }] },
        { id: "c2", characters: [{ id: "npc", name: "Трактирщик", level: 1, sheetCharacterId: null }] },
        { id: "c3" },
      ],
      c as any
    );
    expect(campaigns[0].characters![0]).toMatchObject({ name: "Токсин", level: 3 });
    expect(campaigns[1].characters![0]).toMatchObject({ name: "Трактирщик", level: 1 });
    expect(campaigns[2]).toEqual({ id: "c3" });
    expect(c.calls).toHaveLength(1);
  });

  it("a nested select of sheet-owned fields gets the sheet link added", () => {
    const args = { where: { id: "c1" }, include: { characters: { select: { name: true, level: true } } } };
    expect(withNestedHeroLink(args).include.characters.select).toEqual({ name: true, level: true, sheetCharacterId: true });
    const untouched = { where: { id: "c1" }, include: { characters: { select: { relation: true } } } };
    expect(withNestedHeroLink(untouched)).toEqual(untouched);
    const plain = { where: { id: "c1" }, include: { characters: true } };
    expect(withNestedHeroLink(plain)).toEqual(plain);
  });
});
