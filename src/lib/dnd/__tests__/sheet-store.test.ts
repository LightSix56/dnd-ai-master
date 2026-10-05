import { describe, it, expect } from "vitest";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import {
  SheetUnavailableError,
  addExperience,
  applyGameState,
  createCampaignHeroSheet,
  ensureCampaignVersion,
  listUserSheets,
  loadSheet,
  loadSheets,
  versionRowName,
} from "../sheet-store";

const USER = "user-1";
const OTHER = "user-2";
const ORIGINAL = "11111111-1111-4111-8111-111111111111";

function db(extra: Record<string, any>[] = []) {
  return fakeSupabase({
    unique: { characters: [["source_character_id", "campaign_id"]] },
    tables: {
      characters: [
        {
          id: ORIGINAL,
          user_id: USER,
          name: "Токсин",
          data: { name: "Токсин", level: 1, className: "Плут", hpCurrent: 9 },
          portrait_url: "http://img/p.png",
          revision: 4,
          campaign_id: null,
          campaign_name: null,
          source_character_id: null,
        },
        ...extra,
      ],
    },
  });
}

const asClient = (c: ReturnType<typeof fakeSupabase>) => c as any;

describe("sheet-store: чтение", () => {
  it("loadSheet returns the parsed sheet with its revision", async () => {
    const row = await loadSheet(ORIGINAL, asClient(db()));
    expect(row).toMatchObject({
      id: ORIGINAL,
      userId: USER,
      name: "Токсин",
      revision: 4,
      campaignId: null,
      sourceCharacterId: null,
      portraitUrl: "http://img/p.png",
    });
    expect(row?.sheet.className).toBe("Плут");
  });

  it("loadSheet parses double-encoded data", async () => {
    const client = db([
      { id: "22222222-2222-4222-8222-222222222222", user_id: USER, name: "Клык", data: JSON.stringify({ name: "Клык", level: 2 }), revision: 0 },
    ]);
    const row = await loadSheet("22222222-2222-4222-8222-222222222222", asClient(client));
    expect(row?.sheet).toEqual({ name: "Клык", level: 2 });
  });

  it("loadSheet returns null for a missing row and throws SheetUnavailableError on db error", async () => {
    expect(await loadSheet("33333333-3333-4333-8333-333333333333", asClient(db()))).toBeNull();
    const broken = fakeSupabase({ failTables: ["characters"] });
    await expect(loadSheet(ORIGINAL, asClient(broken))).rejects.toBeInstanceOf(SheetUnavailableError);
  });

  it("loadSheet does not touch the database for an empty or non-uuid id", async () => {
    const client = db();
    expect(await loadSheet("", asClient(client))).toBeNull();
    expect(await loadSheet("cuid-like-id", asClient(client))).toBeNull();
    expect(client.calls).toHaveLength(0);
  });

  it("loadSheets returns a map and makes no call for an empty list", async () => {
    const client = db();
    expect((await loadSheets([], asClient(client))).size).toBe(0);
    expect(client.calls).toHaveLength(0);
    const map = await loadSheets([ORIGINAL, ORIGINAL, "33333333-3333-4333-8333-333333333333"], asClient(client));
    expect([...map.keys()]).toEqual([ORIGINAL]);
    expect(client.calls).toHaveLength(1);
  });

  it("listUserSheets returns only that user's rows", async () => {
    const client = db([{ id: "44444444-4444-4444-8444-444444444444", user_id: OTHER, name: "Чужой", data: {}, revision: 0 }]);
    const rows = await listUserSheets(USER, asClient(client));
    expect(rows.map((r) => r.id)).toEqual([ORIGINAL]);
  });
});

describe("sheet-store: версии кампаний", () => {
  it("version row name is \"<hero> (<campaign>)\" and sheet.name stays the hero name", async () => {
    expect(versionRowName("Токсин", "Встреча")).toBe("Токсин (Встреча)");
    expect(versionRowName("  Токсин ", "")).toBe("Токсин (кампания)");
    const client = db();
    const version = await ensureCampaignVersion(
      { userId: USER, characterId: ORIGINAL, campaignId: "camp-1", campaignName: "Встреча" },
      asClient(client)
    );
    expect(version.name).toBe("Токсин (Встреча)");
    expect(version.sheet.name).toBe("Токсин");
    expect(version.campaignId).toBe("camp-1");
    expect(version.campaignName).toBe("Встреча");
    expect(version.sourceCharacterId).toBe(ORIGINAL);
    expect(version.portraitUrl).toBe("http://img/p.png");
    expect(version.id).not.toBe(ORIGINAL);
  });

  it("ensureCampaignVersion is idempotent", async () => {
    const client = db();
    const input = { userId: USER, characterId: ORIGINAL, campaignId: "camp-1", campaignName: "Встреча" };
    const first = await ensureCampaignVersion(input, asClient(client));
    const second = await ensureCampaignVersion(input, asClient(client));
    expect(second.id).toBe(first.id);
    expect(client.tables.characters).toHaveLength(2);
  });

  it("two campaigns give two versions and the original stays untouched", async () => {
    const client = db();
    const before = structuredClone(client.tables.characters[0]);
    const a = await ensureCampaignVersion({ userId: USER, characterId: ORIGINAL, campaignId: "camp-1", campaignName: "Встреча" }, asClient(client));
    const b = await ensureCampaignVersion({ userId: USER, characterId: ORIGINAL, campaignId: "camp-2", campaignName: "Яма" }, asClient(client));
    expect(a.id).not.toBe(b.id);
    expect(client.tables.characters).toHaveLength(3);
    expect(client.tables.characters[0]).toEqual(before);
  });

  it("passing the version itself returns it instead of copying a copy", async () => {
    const client = db();
    const version = await ensureCampaignVersion({ userId: USER, characterId: ORIGINAL, campaignId: "camp-1", campaignName: "Встреча" }, asClient(client));
    const again = await ensureCampaignVersion({ userId: USER, characterId: version.id, campaignId: "camp-1", campaignName: "Встреча" }, asClient(client));
    expect(again.id).toBe(version.id);
    expect(client.tables.characters).toHaveLength(2);
  });

  it("ensureCampaignVersion rejects a row of another user", async () => {
    const client = db();
    await expect(
      ensureCampaignVersion({ userId: OTHER, characterId: ORIGINAL, campaignId: "camp-1", campaignName: "Встреча" }, asClient(client))
    ).rejects.toBeInstanceOf(SheetUnavailableError);
    expect(client.tables.characters).toHaveLength(1);
  });

  it("ensureCampaignVersion rejects a version of another campaign", async () => {
    const client = db();
    const version = await ensureCampaignVersion({ userId: USER, characterId: ORIGINAL, campaignId: "camp-1", campaignName: "Встреча" }, asClient(client));
    await expect(
      ensureCampaignVersion({ userId: USER, characterId: version.id, campaignId: "camp-2", campaignName: "Яма" }, asClient(client))
    ).rejects.toBeInstanceOf(SheetUnavailableError);
    expect(client.tables.characters).toHaveLength(2);
  });

  it("a lost insert race re-reads the version created by the other request", async () => {
    const client = db();
    // Чужой запрос успел создать версию между нашим поиском и вставкой
    const realFrom = client.from.bind(client);
    let injected = false;
    (client as any).from = (table: string) => {
      const q = realFrom(table);
      const realInsert = q.insert.bind(q);
      q.insert = (payload: any) => {
        if (!injected) {
          injected = true;
          client.tables.characters.push({ ...payload, id: "99999999-9999-4999-8999-999999999999", revision: 0 });
        }
        return realInsert(payload);
      };
      return q;
    };
    const version = await ensureCampaignVersion({ userId: USER, characterId: ORIGINAL, campaignId: "camp-1", campaignName: "Встреча" }, asClient(client));
    expect(version.id).toBe("99999999-9999-4999-8999-999999999999");
    expect(client.tables.characters).toHaveLength(2);
  });

  it("createCampaignHeroSheet inserts a version without an original", async () => {
    const client = db();
    const row = await createCampaignHeroSheet(
      { userId: USER, campaignId: "camp-1", campaignName: "Встреча", sheet: { name: "Борин", level: 1 } },
      asClient(client)
    );
    expect(row.name).toBe("Борин (Встреча)");
    expect(row.sourceCharacterId).toBeNull();
    expect(row.campaignId).toBe("camp-1");
    expect(row.sheet).toEqual({ name: "Борин", level: 1 });
  });
});

describe("sheet-store: запись игрового состояния", () => {
  it("applyGameState calls rpc apply_character_game_state with the patch", async () => {
    const client = db();
    const revision = await applyGameState(ORIGINAL, { hpCurrent: 3 }, asClient(client));
    expect(client.rpcCalls).toEqual([{ name: "apply_character_game_state", args: { p_id: ORIGINAL, p_patch: { hpCurrent: 3 } } }]);
    expect(revision).toBe(5);
    expect(client.tables.characters[0].data).toMatchObject({ hpCurrent: 3, className: "Плут" });
  });

  it("applyGameState with an empty patch does nothing", async () => {
    const client = db();
    await applyGameState(ORIGINAL, {}, asClient(client));
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("addExperience returns the new total and fails loudly for a missing row", async () => {
    const client = db();
    expect(await addExperience(ORIGINAL, 120, asClient(client))).toBe(120);
    expect(await addExperience(ORIGINAL, 200, asClient(client))).toBe(320);
    await expect(addExperience("33333333-3333-4333-8333-333333333333", 5, asClient(client))).rejects.toBeInstanceOf(SheetUnavailableError);
  });
});
