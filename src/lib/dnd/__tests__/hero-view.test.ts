import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeSupabase } from "@/lib/testing/fake-supabase";

const findMany = vi.fn();
vi.mock("@/lib/db", () => ({ db: { character: { findMany: (...a: any[]) => findMany(...a) } } }));

import { overlaySheet, withSheets, loadCampaignHeroes } from "../hero-view";
import type { SheetRow } from "../sheet-store";

const SHEET_ID = "11111111-1111-4111-8111-111111111111";

function sheetRow(sheet: Record<string, any>, patch: Partial<SheetRow> = {}): SheetRow {
  return {
    id: SHEET_ID,
    userId: "user-1",
    name: "Токсин (Встреча)",
    sheet,
    portraitUrl: null,
    revision: 7,
    campaignId: "camp-1",
    campaignName: "Встреча",
    sourceCharacterId: null,
    ...patch,
  };
}

const prismaHero = {
  id: "ch-1",
  campaignId: "camp-1",
  name: "Старое имя",
  type: "player",
  race: null,
  class: null,
  subclass: null,
  level: 1,
  experiencePoints: 0,
  background: null,
  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  hpCurrent: 10, hpMax: 10, hpTemp: 0, ac: 10, speed: 30, profBonus: 2,
  notes: "[Статус: ранен]",
  sheetCharacterId: SHEET_ID,
  sheetLevelSeen: 1,
};

const rogueSheet = {
  name: "Токсин",
  className: "Плут",
  subclass: "Вор",
  race: "Полурослик",
  background: "Преступник",
  level: 3,
  experiencePoints: 950,
  abilityScores: { СИЛ: 8, ЛОВ: 15, ТЕЛ: 14, ИНТ: 12, МДР: 10, ХАР: 13 },
  abilityBonuses: { ЛОВ: 2 },
  hpMax: 24,
  hpCurrent: 11,
  hpTemp: 3,
  armorClass: 15,
  speed: 25,
};

describe("overlaySheet", () => {
  it("overlay takes level, hp and abilities from the sheet", () => {
    const hero = overlaySheet(prismaHero, sheetRow(rogueSheet));
    expect(hero).toMatchObject({
      id: "ch-1",
      name: "Токсин",
      class: "Плут",
      subclass: "Вор",
      race: "Полурослик",
      background: "Преступник",
      level: 3,
      experiencePoints: 950,
      dex: 17,
      con: 14,
      hpMax: 24,
      hpCurrent: 11,
      hpTemp: 3,
      ac: 15,
      speed: 25,
      profBonus: 2,
      sheetRevision: 7,
      sheetMissing: false,
      notes: "[Статус: ранен]",
    });
    expect(hero.sheet).toBe(rogueSheet);
  });

  it("zero hit points stay zero instead of becoming full health", () => {
    const hero = overlaySheet(prismaHero, sheetRow({ ...rogueSheet, hpCurrent: 0 }));
    expect(hero.hpCurrent).toBe(0);
  });

  it("proficiency bonus follows the sheet level", () => {
    expect(overlaySheet(prismaHero, sheetRow({ ...rogueSheet, level: 5 })).profBonus).toBe(3);
    expect(overlaySheet(prismaHero, sheetRow({ ...rogueSheet, level: 17 })).profBonus).toBe(6);
  });

  it("overlay marks missing sheet", () => {
    const hero = overlaySheet(prismaHero, null);
    expect(hero.sheetMissing).toBe(true);
    expect(hero.sheet).toBeNull();
    expect(hero.sheetRevision).toBeNull();
    expect(hero.level).toBe(1);
    expect(hero.name).toBe("Старое имя");
  });

  it("unlinked npc is returned unchanged", () => {
    const npc = { ...prismaHero, id: "npc-1", type: "npc", sheetCharacterId: null, name: "Трактирщик" };
    const view = overlaySheet(npc, sheetRow(rogueSheet));
    expect(view).toEqual({ ...npc, sheet: null, sheetRevision: null, sheetMissing: false });
  });

  it("does not mutate the prisma row", () => {
    const copy = structuredClone(prismaHero);
    overlaySheet(prismaHero, sheetRow(rogueSheet));
    expect(prismaHero).toEqual(copy);
  });
});

describe("withSheets / loadCampaignHeroes", () => {
  beforeEach(() => findMany.mockReset());

  function client() {
    return fakeSupabase({
      tables: {
        characters: [
          { id: SHEET_ID, user_id: "user-1", name: "Токсин (Встреча)", data: rogueSheet, revision: 7, campaign_id: "camp-1" },
          { id: "22222222-2222-4222-8222-222222222222", user_id: "user-2", name: "Клык (Встреча)", data: { name: "Клык", level: 2, className: "Воин" }, revision: 1, campaign_id: "camp-1" },
        ],
      },
    });
  }

  it("withSheets issues one loadSheets call for all heroes", async () => {
    const c = client();
    const heroes = await withSheets(
      [
        prismaHero,
        { ...prismaHero, id: "ch-2", sheetCharacterId: "22222222-2222-4222-8222-222222222222" },
        { ...prismaHero, id: "npc", type: "npc", sheetCharacterId: null },
      ],
      c as any
    );
    expect(c.calls).toHaveLength(1);
    expect(heroes.map((h) => h.name)).toEqual(["Токсин", "Клык", "Старое имя"]);
  });

  it("withSheets makes no database call when nobody is linked", async () => {
    const c = client();
    await withSheets([{ ...prismaHero, sheetCharacterId: null }], c as any);
    expect(c.calls).toHaveLength(0);
  });

  it("a hero whose sheet row is gone is marked missing, others still load", async () => {
    const c = client();
    const heroes = await withSheets(
      [prismaHero, { ...prismaHero, id: "ch-3", sheetCharacterId: "33333333-3333-4333-8333-333333333333" }],
      c as any
    );
    expect(heroes[0].sheetMissing).toBe(false);
    expect(heroes[1].sheetMissing).toBe(true);
  });

  it("rows already overlaid by the database client are not read twice", async () => {
    const c = client();
    const first = await withSheets([prismaHero], c as any);
    const second = await withSheets(first, c as any);
    expect(c.calls).toHaveLength(1);
    expect(second[0]).toBe(first[0]);
  });

  it("loadCampaignHeroes reads prisma rows of the campaign and overlays sheets", async () => {
    findMany.mockResolvedValue([prismaHero]);
    const heroes = await loadCampaignHeroes("camp-1", { type: "player" }, client() as any);
    expect(findMany).toHaveBeenCalledWith({ where: { campaignId: "camp-1", type: "player" }, orderBy: { name: "asc" } });
    expect(heroes[0].level).toBe(3);
  });
});
