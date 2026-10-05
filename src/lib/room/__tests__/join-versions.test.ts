import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeSupabase, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { fakePrisma } from "@/lib/testing/fake-prisma";

const state = vi.hoisted(() => ({ prisma: null as any }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => state.prisma[prop as string] }),
}));
vi.mock("@/lib/ai/party-arc-generator", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/party-arc-generator")>()),
  generatePartyAwareAct1: vi.fn().mockRejectedValue(new Error("no llm in tests")),
}));

import { RoomService, RoomRuleError } from "../room-service";

const HOST = "user-host";
const GUEST = "user-guest";
const TOXIN = "11111111-1111-4111-8111-111111111111";
const FANG = "22222222-2222-4222-8222-222222222222";
const ROOM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const toxinSheet = { name: "Токсин", className: "Плут", race: "Полурослик", level: 1, hpMax: 9, hpCurrent: 9 };
const fangSheet = { name: "Клык", className: "Воин", race: "Полуорк", level: 1, hpMax: 12, hpCurrent: 12 };

function setup(options: { campaignId?: string | null; startingLevel?: number } = {}) {
  const campaignId = options.campaignId === undefined ? "camp-1" : options.campaignId;
  const supabase = fakeSupabase({
    unique: { characters: [["source_character_id", "campaign_id"]] },
    tables: {
      rooms: [
        {
          id: ROOM,
          code: "DRAGON-42",
          name: "Стол",
          host_user_id: HOST,
          status: campaignId ? "active" : "lobby",
          starting_level: options.startingLevel ?? 1,
          max_level: 20,
          campaign_settings: campaignId ? { campaignId, title: "Встреча" } : {},
        },
      ],
      room_participants: [],
      characters: [
        { id: TOXIN, user_id: HOST, name: "Токсин", data: toxinSheet, portrait_url: null, revision: 0, campaign_id: null, campaign_name: null, source_character_id: null },
        { id: FANG, user_id: GUEST, name: "Клык", data: fangSheet, portrait_url: null, revision: 0, campaign_id: null, campaign_name: null, source_character_id: null },
      ],
    },
  });
  state.prisma = fakePrisma({ campaign: campaignId ? [{ id: campaignId, name: "Встреча", userId: HOST }] : [] });
  return { supabase, service: new RoomService(supabase as any) };
}

const versionsOf = (s: FakeSupabase, source: string) =>
  s.tables.characters.filter((c) => c.source_character_id === source);

describe("joinRoom: версии персонажа для кампании", () => {
  beforeEach(() => {
    state.prisma = fakePrisma();
  });

  it("join in a campaign room creates a version and binds it", async () => {
    const { supabase, service } = setup();
    const participant = await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN, isHost: true });

    const versions = versionsOf(supabase, TOXIN);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ campaign_id: "camp-1", campaign_name: "Встреча", name: "Токсин (Встреча)", user_id: HOST });
    expect(participant.characterId).toBe(versions[0].id);
    expect(participant.character).toMatchObject({ id: versions[0].id, name: "Токсин", level: 1, className: "Плут", race: "Полурослик" });
    expect(supabase.tables.room_participants[0].character_id).toBe(versions[0].id);

    // оригинал не тронут
    expect(supabase.tables.characters.find((c) => c.id === TOXIN)).toMatchObject({ data: toxinSheet, revision: 0, campaign_id: null });

    // в базе кампании — только ссылка на лист, без копии характеристик и листа в заметках
    const heroes = state.prisma.character.rows;
    expect(heroes).toHaveLength(1);
    expect(heroes[0]).toMatchObject({ campaignId: "camp-1", name: "Токсин", type: "player", sheetCharacterId: versions[0].id, sheetLevelSeen: 1 });
    expect(heroes[0].notes ?? null).toBeNull();
  });

  it("participant upsert never contains a sheet", async () => {
    const { supabase, service } = setup();
    await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN });
    expect(supabase.tables.room_participants[0].character_snapshot).toEqual({});
  });

  it("rejoin reuses the version", async () => {
    const { supabase, service } = setup();
    const first = await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN });
    const second = await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN });
    const third = await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: first.characterId });
    expect(second.characterId).toBe(first.characterId);
    expect(third.characterId).toBe(first.characterId);
    expect(versionsOf(supabase, TOXIN)).toHaveLength(1);
    expect(supabase.tables.room_participants).toHaveLength(1);
    expect(state.prisma.character.rows).toHaveLength(1);
  });

  it("a hero who levelled up in the campaign can rejoin although the table started at level 1", async () => {
    const { supabase, service } = setup();
    const first = await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN });
    const version = supabase.tables.characters.find((c) => c.id === first.characterId)!;
    version.data = { ...version.data, level: 3 };
    const again = await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN });
    expect(again.characterId).toBe(first.characterId);
    expect(again.character.level).toBe(3);
  });

  it("rejects foreign version", async () => {
    const { supabase, service } = setup();
    await expect(service.joinRoom({ roomId: ROOM, userId: GUEST, characterId: TOXIN })).rejects.toBeInstanceOf(RoomRuleError);
    expect(supabase.tables.room_participants).toHaveLength(0);
    expect(versionsOf(supabase, TOXIN)).toHaveLength(0);
    expect(state.prisma.character.rows).toHaveLength(0);
  });

  it("rejects a version that belongs to another campaign", async () => {
    const { supabase, service } = setup();
    supabase.tables.characters.push({
      id: "33333333-3333-4333-8333-333333333333", user_id: HOST, name: "Токсин (Яма)", data: toxinSheet, revision: 0,
      campaign_id: "camp-other", campaign_name: "Яма", source_character_id: TOXIN,
    });
    await expect(
      service.joinRoom({ roomId: ROOM, userId: HOST, characterId: "33333333-3333-4333-8333-333333333333" })
    ).rejects.toBeInstanceOf(RoomRuleError);
    expect(supabase.tables.room_participants).toHaveLength(0);
  });

  it("join in a lobby without campaign binds the original and creates nothing", async () => {
    const { supabase, service } = setup({ campaignId: null });
    const participant = await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN });
    expect(participant.characterId).toBe(TOXIN);
    expect(supabase.tables.characters).toHaveLength(2);
    expect(state.prisma.character.rows).toHaveLength(0);
  });

  it("level below starting level is rejected using the live sheet", async () => {
    const { supabase, service } = setup({ startingLevel: 3 });
    await expect(service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN })).rejects.toThrow(/требуется ровно 3/);
    expect(supabase.tables.room_participants).toHaveLength(0);
    expect(versionsOf(supabase, TOXIN)).toHaveLength(0);
  });

  it("two players cannot bring heroes with the same name", async () => {
    const { supabase, service } = setup();
    supabase.tables.characters.find((c) => c.id === FANG)!.data = { ...fangSheet, name: "токсин " };
    await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN });
    await expect(service.joinRoom({ roomId: ROOM, userId: GUEST, characterId: FANG })).rejects.toBeInstanceOf(RoomRuleError);
    expect(supabase.tables.room_participants).toHaveLength(1);
  });

  it("quick-created hero becomes a version without an original", async () => {
    const { supabase, service } = setup();
    const participant = await service.joinRoom({
      roomId: ROOM,
      userId: GUEST,
      create: { name: "Борин", race: "Дварф", className: "Воин" },
    });
    const row = supabase.tables.characters.find((c) => c.id === participant.characterId)!;
    expect(row).toMatchObject({ user_id: GUEST, campaign_id: "camp-1", source_character_id: null, name: "Борин (Встреча)" });
    expect(row.data).toMatchObject({ name: "Борин", className: "Воин", race: "Дварф", level: 1 });
    expect(row.data.abilityScores["СИЛ"]).toBe(16);
    expect(row.data.hpMax).toBeGreaterThan(0);
  });

  it("quick create is refused while the room has no campaign", async () => {
    const { service } = setup({ campaignId: null });
    await expect(
      service.joinRoom({ roomId: ROOM, userId: GUEST, create: { name: "Борин", race: "Дварф", className: "Воин" } })
    ).rejects.toBeInstanceOf(RoomRuleError);
  });

  it("an unassigned campaign hero is adopted: gets a sheet and a link, keeps one row", async () => {
    const { supabase, service } = setup();
    const hero = await state.prisma.character.create({
      data: { campaignId: "camp-1", name: "Мира", type: "player", race: "Эльф", class: "Жрец", level: 1, str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 12, hpMax: 10, hpCurrent: 10, ac: 15, speed: 30 },
    });
    const participant = await service.joinRoom({ roomId: ROOM, userId: GUEST, characterId: hero.id });
    const row = supabase.tables.characters.find((c) => c.id === participant.characterId)!;
    expect(row).toMatchObject({ user_id: GUEST, campaign_id: "camp-1", source_character_id: null });
    expect(row.data).toMatchObject({ name: "Мира", className: "Жрец", level: 1, hpMax: 10, armorClass: 15 });
    expect(state.prisma.character.rows).toHaveLength(1);
    expect(state.prisma.character.rows[0].sheetCharacterId).toBe(participant.characterId);
  });

  it("a campaign hero already played by someone else cannot be taken", async () => {
    const { service } = setup();
    const first = await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN });
    const hero = state.prisma.character.rows[0];
    expect(hero.sheetCharacterId).toBe(first.characterId);
    await expect(service.joinRoom({ roomId: ROOM, userId: GUEST, characterId: hero.id })).rejects.toBeInstanceOf(RoomRuleError);
  });
});

describe("startRoomCampaign: оригиналы становятся версиями", () => {
  it("startRoomCampaign converts originals to versions", async () => {
    const { supabase, service } = setup({ campaignId: null });
    await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN, isHost: true });
    await service.joinRoom({ roomId: ROOM, userId: GUEST, characterId: FANG });

    const result = await service.startRoomCampaign("DRAGON-42", HOST, {
      title: "Встреча", setting: "Форготтен", tone: "героика", difficulty: "normal", startingSituation: "tavern" as any,
    });

    const campaignId = result.campaignId;
    const toxinVersion = versionsOf(supabase, TOXIN)[0];
    const fangVersion = versionsOf(supabase, FANG)[0];
    expect(toxinVersion).toMatchObject({ campaign_id: campaignId, campaign_name: "Встреча", user_id: HOST });
    expect(fangVersion).toMatchObject({ campaign_id: campaignId, user_id: GUEST });

    const byUser = Object.fromEntries(supabase.tables.room_participants.map((p) => [p.user_id, p.character_id]));
    expect(byUser).toEqual({ [HOST]: toxinVersion.id, [GUEST]: fangVersion.id });

    // оригиналы не тронуты
    expect(supabase.tables.characters.find((c) => c.id === TOXIN)).toMatchObject({ data: toxinSheet, revision: 0 });
    expect(supabase.tables.characters.find((c) => c.id === FANG)).toMatchObject({ data: fangSheet, revision: 0 });

    const heroes = state.prisma.character.rows.filter((c: any) => c.campaignId === campaignId);
    expect(heroes.map((h: any) => h.sheetCharacterId).sort()).toEqual([toxinVersion.id, fangVersion.id].sort());
    for (const hero of heroes) {
      expect(hero.type).toBe("player");
      expect(String(hero.notes ?? "")).not.toContain("{");
    }
  });
});
