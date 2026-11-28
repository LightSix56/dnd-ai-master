import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const {
  getAuthUserMock,
  denyCombatAccessMock,
  denyCampaignAccessMock,
  checkCombatControlMock,
  dbMock,
} = vi.hoisted(() => ({
  getAuthUserMock: vi.fn(),
  denyCombatAccessMock: vi.fn(),
  denyCampaignAccessMock: vi.fn(),
  checkCombatControlMock: vi.fn(),
  dbMock: {
    combat: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    combatant: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
    mapElement: { findFirst: vi.fn(), deleteMany: vi.fn(), delete: vi.fn(), create: vi.fn(), update: vi.fn() },
    character: { findUnique: vi.fn(), update: vi.fn() },
    attackLibrary: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    spellLibrary: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    abilityLibrary: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    characterPreset: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/client")>();
  return {
    ...actual,
    getAuthUserFromRequest: getAuthUserMock,
  };
});

vi.mock("@/lib/auth/campaign-access", () => ({
  AUTH_REQUIRED_MESSAGE: "Войдите в аккаунт, чтобы продолжить.",
  getRequestUserId: vi.fn(async (req: Request) => {
    const res = await getAuthUserMock(req);
    return res?.user?.id ?? null;
  }),
  denyCombatAccess: denyCombatAccessMock,
  denyCampaignAccess: denyCampaignAccessMock,
}));

vi.mock("@/lib/room/combat-access", () => ({
  checkCombatControl: checkCombatControlMock,
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST as createArenaPost } from "../create-arena/route";
import { POST as mapsPost } from "../maps/route";
import { POST as combatCreatePost } from "../create/route";
import { GET as combatActiveGet } from "../active/route";
import { POST as libraryPost, DELETE as libraryDelete } from "../../library/route";
import { POST as librarySeedPost } from "../../library/seed/route";
import { POST as presetsPost, DELETE as presetsDelete } from "../presets/route";
import { POST as actionPost } from "../action/route";

describe("Combat, Library & Presets Security Hardening", () => {
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    getAuthUserMock.mockResolvedValue({ user: null, error: "Unauthorized" });
    denyCombatAccessMock.mockImplementation(async (req: Request) => {
      const res = await getAuthUserMock(req);
      return res?.user?.id ? null : Response.json({ error: "Unauthorized" }, { status: 401 });
    });
    denyCampaignAccessMock.mockImplementation(async (req: Request) => {
      const res = await getAuthUserMock(req);
      return res?.user?.id ? null : Response.json({ error: "Unauthorized" }, { status: 401 });
    });
    checkCombatControlMock.mockResolvedValue(null);
    dbMock.$transaction.mockImplementation(async (fn: any) => fn(dbMock));
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
  });

  it("create-arena rejects unauthenticated requests in dev and returns 404 in production", async () => {
    const unauth = await createArenaPost(
      new Request("http://localhost/api/combat/create-arena", {
        method: "POST",
        body: JSON.stringify({ campaignId: "camp-1" }),
      })
    );
    expect(unauth.status).toBe(401);

    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const prod = await createArenaPost(
      new Request("http://localhost/api/combat/create-arena", {
        method: "POST",
        body: JSON.stringify({ campaignId: "camp-1" }),
      })
    );
    expect(prod.status).toBe(404);
  });

  it("maps POST enforces combat access and rejects unsafe backgroundUrl schemes", async () => {
    denyCombatAccessMock.mockResolvedValueOnce(Response.json({ error: "Unauthorized" }, { status: 401 }));
    const denied = await mapsPost(
      new Request("http://localhost/api/combat/maps", {
        method: "POST",
        body: JSON.stringify({ combatId: "c1", customMap: { backgroundUrl: "/maps/a.png" } }),
      })
    );
    expect(denied.status).toBe(401);

    getAuthUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    dbMock.combat.findUnique.mockResolvedValue({ id: "c1", campaignId: "camp-1" });
    const badJs = await mapsPost(
      new Request("http://localhost/api/combat/maps", {
        method: "POST",
        body: JSON.stringify({ combatId: "c1", customMap: { backgroundUrl: "javascript:alert(1)" } }),
      })
    );
    expect(badJs.status).toBe(400);

    const badSvg = await mapsPost(
      new Request("http://localhost/api/combat/maps", {
        method: "POST",
        body: JSON.stringify({
          combatId: "c1",
          customMap: { backgroundUrl: "data:image/svg+xml;base64,PHN2Zz4=" },
        }),
      })
    );
    expect(badSvg.status).toBe(400);
  });

  it("combat/create and combat/active require authentication", async () => {
    const createRes = await combatCreatePost(
      new Request("http://localhost/api/combat/create", {
        method: "POST",
        body: JSON.stringify({ name: "Test" }),
      })
    );
    expect(createRes.status).toBe(401);

    const activeRes = await combatActiveGet(new Request("http://localhost/api/combat/active"));
    expect(activeRes.status).toBe(401);
  });

  it("library, library/seed, and presets mutations require authentication and validate CR", async () => {
    expect((await libraryPost(new Request("http://localhost/api/library", { method: "POST", body: JSON.stringify({ kind: "attack", name: "X" }) }))).status).toBe(401);
    expect((await libraryDelete(new Request("http://localhost/api/library", { method: "DELETE", body: JSON.stringify({ kind: "attack", id: "1" }) }))).status).toBe(401);
    expect((await librarySeedPost(new Request("http://localhost/api/library/seed", { method: "POST" }))).status).toBe(401);
    expect((await presetsPost(new NextRequest("http://localhost/api/combat/presets", { method: "POST", body: JSON.stringify({ name: "X" }) }))).status).toBe(401);
    expect((await presetsDelete(new NextRequest("http://localhost/api/combat/presets?id=custom-1", { method: "DELETE" }))).status).toBe(401);

    getAuthUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const badCr = await presetsPost(
      new NextRequest("http://localhost/api/combat/presets", {
        method: "POST",
        headers: { Authorization: "Bearer tok" },
        body: JSON.stringify({ name: "Evil", cr: "alert(1)" }),
      })
    );
    expect(badCr.status).toBe(400);
  });

  it("combat/action prevents cross-combat IDOR and blocks manual edits during pendingReaction", async () => {
    getAuthUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    // Target combatant belongs to another combat -> updateMany returns count: 0
    dbMock.combat.findUnique.mockResolvedValue({
      id: "combat-A",
      campaignId: "camp-A",
      pendingReaction: null,
      combatants: [],
      mapElements: [],
      turnOrder: "[]",
      log: "[]",
      updatedAt: new Date(),
    });
    dbMock.combatant.updateMany.mockResolvedValue({ count: 0 });
    dbMock.combatant.deleteMany.mockResolvedValue({ count: 0 });
    dbMock.mapElement.deleteMany.mockResolvedValue({ count: 0 });

    const idorUpdate = await actionPost(
      new Request("http://localhost/api/combat/action", {
        method: "POST",
        body: JSON.stringify({
          action: "update-combatant",
          combatId: "combat-A",
          combatantId: "victim-in-combat-B",
          updates: { hpCurrent: 0 },
        }),
      })
    );
    expect(idorUpdate.status).toBe(404);
    expect(dbMock.combatant.update).not.toHaveBeenCalled();

    const idorElement = await actionPost(
      new Request("http://localhost/api/combat/action", {
        method: "POST",
        body: JSON.stringify({
          action: "remove-element",
          combatId: "combat-A",
          elementId: "el-in-combat-B",
        }),
      })
    );
    expect(idorElement.status).toBe(404);
    expect(dbMock.mapElement.delete).not.toHaveBeenCalled();

    // Pending reaction blocks manual mutations too
    dbMock.combat.findUnique.mockResolvedValue({
      id: "combat-A",
      campaignId: "camp-A",
      pendingReaction: JSON.stringify({
        id: "p1",
        action: "move-combatant",
        body: {},
        seed: 1,
        decisions: {},
        prompt: { key: "0:h1", reactorId: "h1", reactorName: "Hero", title: "?", text: "?", options: [] },
        createdAt: new Date().toISOString(),
      }),
      combatants: [],
      mapElements: [],
      turnOrder: "[]",
      log: "[]",
      updatedAt: new Date(),
    });

    const blockedReset = await actionPost(
      new Request("http://localhost/api/combat/action", {
        method: "POST",
        body: JSON.stringify({
          action: "reset-turn",
          combatId: "combat-A",
          combatantId: "h1",
        }),
      })
    );
    expect(blockedReset.status).toBe(400);
  });

  it("batch-actions does not sync potion consumption to Character DB when ReactionPrompt interrupts", async () => {
    getAuthUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const heroRow = {
      id: "h1",
      combatId: "combat-1",
      characterId: "char-1",
      name: "Герой",
      type: "player",
      color: "#3b82f6",
      x: 5,
      y: 5,
      hpCurrent: 5,
      hpMax: 20,
      hpTemp: 0,
      ac: 15,
      speed: 30,
      initiative: 10,
      initiativeTiebreak: 1,
      dexMod: 2,
      conditions: "[]",
      isHidden: false,
      hasActed: false,
      className: "",
      level: 1,
      size: "medium",
      movementUsed: 0,
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      attacksPerAction: 1,
      attacksMadeThisAction: 0,
      extraActions: 0,
      hotbar: "[]",
      attacks: JSON.stringify([
        {
          id: "atk1",
          name: "Меч",
          attackBonus: 5,
          damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "action",
        },
      ]),
      spells: "{}",
      abilities: "[]",
      concentration: null,
      wildShape: null,
      facing: "E",
      saves: "{}",
      abilityMods: "{}",
      profBonus: 2,
      isAIControlled: false,
      potions: JSON.stringify([{ id: "pot-1", name: "Зелье лечения", quantity: 1 }]),
      monsterData: "{}",
    };
    const enemyRow = {
      ...heroRow,
      id: "e1",
      characterId: null,
      name: "Гоблин",
      type: "enemy",
      x: 6,
      y: 5,
      hpCurrent: 10,
      hpMax: 10,
      isAIControlled: true,
      potions: "[]",
    };

    dbMock.combat.findUnique.mockResolvedValue({
      id: "combat-1",
      campaignId: "camp-1",
      name: "Test",
      status: "active",
      round: 1,
      currentTurnIndex: 0,
      turnOrder: JSON.stringify(["e1", "h1"]),
      gridWidth: 20,
      gridHeight: 15,
      cellSize: 40,
      log: "[]",
      pendingReaction: null,
      combatants: [heroRow, enemyRow],
      mapElements: [],
      updatedAt: new Date(),
    });
    dbMock.character.findUnique.mockResolvedValue({
      inventory: JSON.stringify([{ id: "pot-1", name: "Зелье лечения", quantity: 1 }]),
    });
    dbMock.combat.update.mockResolvedValue({});

    const res = await actionPost(
      new Request("http://localhost/api/combat/action", {
        method: "POST",
        body: JSON.stringify({
          action: "batch-actions",
          combatId: "combat-1",
          actions: [
            { action: "drink-potion", combatantId: "h1", potionId: "pot-1" },
            { action: "move-combatant", combatantId: "e1", x: 6, y: 9 },
          ],
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pendingReaction).toBeDefined();
    // Because ReactionPrompt rolled back the batch before saveState, Character DB MUST NOT be updated!
    expect(dbMock.character.update).not.toHaveBeenCalled();
  });
});
