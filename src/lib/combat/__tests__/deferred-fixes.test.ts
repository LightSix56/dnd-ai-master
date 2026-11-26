import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthUserMock,
  denyCombatAccessMock,
  checkCombatControlMock,
  dbMock,
} = vi.hoisted(() => ({
  getAuthUserMock: vi.fn(),
  denyCombatAccessMock: vi.fn(),
  checkCombatControlMock: vi.fn(),
  dbMock: {
    combat: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    combatant: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
    mapElement: { findFirst: vi.fn(), deleteMany: vi.fn(), delete: vi.fn(), create: vi.fn(), update: vi.fn() },
    character: { findUnique: vi.fn(), update: vi.fn() },
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
  getRequestUserId: vi.fn(async () => "user-1"),
  denyCombatAccess: denyCombatAccessMock,
  denyCampaignAccess: vi.fn(async () => null),
}));

vi.mock("@/lib/room/combat-access", () => ({
  checkCombatControl: checkCombatControlMock,
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST as actionPost } from "@/app/api/combat/action/route";
import { detectArmorType } from "../character-adapter";
import { classHooks } from "../class-hooks";
import { registerKit } from "../class-kit";
import {
  applyEffect,
  attemptHide,
  drinkPotion,
  moveCombatant,
  performAttack,
  transformWildShape,
  useAbility,
} from "../engine";
import { ally, bySrd, enemy, makeState, raceHero } from "./helpers/race-harness";
import type { Combatant } from "../types";

registerKit({
  id: "test-deferred-fixes-kit",
  riders: {
    "test/deferred/reaction-rider": {
      attacks: "weapon",
      reaction: true,
      apply: ({ add }) => {
        add(5, "radiant", true);
        return "реактивный удар +5";
      },
    },
  },
});

function makeDbCombatRow(conditions: Combatant["conditions"]) {
  const heroRow = {
    id: "h1",
    combatId: "combat-1",
    characterId: "char-1",
    name: "Герой",
    type: "player",
    color: "#3b82f6",
    x: 5,
    y: 5,
    hpCurrent: 20,
    hpMax: 20,
    hpTemp: 0,
    ac: 15,
    speed: 30,
    initiative: 15,
    initiativeTiebreak: 1,
    dexMod: 2,
    conditions: JSON.stringify(conditions),
    isHidden: false,
    hasActed: false,
    className: "Воин",
    level: 3,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: "[]",
    attacks: "[]",
    spells: "{}",
    abilities: "[]",
    concentration: null,
    wildShape: null,
    facing: "E",
    saves: "{}",
    abilityMods: "{}",
    profBonus: 2,
    isAIControlled: false,
    potions: "[]",
    monsterData: "{}",
  };
  const allyRow = {
    ...heroRow,
    id: "h2",
    characterId: null,
    name: "Союзник",
    x: 6,
    y: 5,
    conditions: "[]",
  };
  return {
    id: "combat-1",
    campaignId: "camp-1",
    name: "Test",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    turnOrder: JSON.stringify(["h1", "h2"]),
    gridWidth: 20,
    gridHeight: 15,
    cellSize: 40,
    log: "[]",
    pendingReaction: null,
    combatants: [heroRow, allyRow],
    mapElements: [],
    updatedAt: new Date(),
  };
}

describe("Task 6 deferred fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    getAuthUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    denyCombatAccessMock.mockResolvedValue(null);
    checkCombatControlMock.mockResolvedValue(null);
    dbMock.$transaction.mockImplementation(async (fn: any) => fn(dbMock));
    dbMock.combat.updateMany.mockResolvedValue({ count: 1 });
    dbMock.combatant.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. POST /api/combat/action dash/dodge/disengage/help respect canAct & hasPreventOffensiveActions", () => {
    it.each(["dash", "dodge", "disengage", "help"] as const)(
      "blocks %s when paralyzed (!canAct) without spending action",
      async (action) => {
        dbMock.combat.findUnique.mockResolvedValue(makeDbCombatRow([{ type: "paralyzed", durationRounds: 2 }]));
        const res = await actionPost(
          new Request("http://localhost/api/combat/action", {
            method: "POST",
            body: JSON.stringify({ action, combatId: "combat-1", combatantId: "h1", targetId: "h2" }),
          })
        );
        expect(res.status).toBe(400);
        expect(dbMock.combat.update).not.toHaveBeenCalled();
      }
    );

    it.each(["dash", "dodge", "disengage", "help"] as const)(
      "blocks %s when in tortle_shell (hasPreventOffensiveActions) without spending action",
      async (action) => {
        dbMock.combat.findUnique.mockResolvedValue(makeDbCombatRow([{ type: "tortle_shell" }]));
        const res = await actionPost(
          new Request("http://localhost/api/combat/action", {
            method: "POST",
            body: JSON.stringify({ action, combatId: "combat-1", combatantId: "h1", targetId: "h2" }),
          })
        );
        expect(res.status).toBe(400);
        expect(dbMock.combat.update).not.toHaveBeenCalled();
      }
    );

    it("help rejects missing targetId before spending action", async () => {
      dbMock.combat.findUnique.mockResolvedValue(makeDbCombatRow([]));
      const res = await actionPost(
        new Request("http://localhost/api/combat/action", {
          method: "POST",
          body: JSON.stringify({ action: "help", combatId: "combat-1", combatantId: "h1", targetId: "missing" }),
        })
      );
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(dbMock.combatant.update).not.toHaveBeenCalled();
      expect(dbMock.combat.update).not.toHaveBeenCalled();
    });
  });

  describe("2. detectArmorType ignores boots/gloves/gear and detects real armor", () => {
    it("ignores equipped leather boots and gloves", () => {
      expect(
        detectArmorType({
          inventory: [{ name: "Кожаные сапоги", equipped: true, type: "gear", slot: "feet" }],
        })
      ).toBeUndefined();
      expect(
        detectArmorType({
          inventory: [{ name: "Leather Gloves", equipped: true, type: "gear" }],
        })
      ).toBeUndefined();
      expect(
        detectArmorType({
          inventory: [{ name: "Кожаный пояс", equipped: true, slot: "waist" }],
        })
      ).toBeUndefined();
    });

    it("detects actual equipped/slotted armor items", () => {
      expect(
        detectArmorType({
          inventory: [{ name: "Кожаный доспех", equipped: true, type: "armor" }],
        })
      ).toBe("light");
      expect(
        detectArmorType({
          inventory: [{ name: "Латы", slot: "armor" }],
        })
      ).toBe("heavy");
      expect(
        detectArmorType({
          inventory: [{ name: "Кольчужная рубаха", equipped: true, category: "Средний доспех" }],
        })
      ).toBe("medium");
      expect(
        detectArmorType({
          inventory: [{ name: "Усиленная накидка", equipped: true, type: "item", armorCategory: "medium" }],
        })
      ).toBe("medium");
    });
  });

  describe("3. engine.ts guards & freeMove interrupted costFt", () => {
    it("blocks free abilities, attemptHide, drinkPotion, transformWildShape in tortle_shell, while allowing shell exit", () => {
      const tor = raceHero("Тортл", null, "tor-1", 3, {
        x: 2,
        y: 2,
        className: "Друид",
      });
      tor.potions = [{ id: "pot-1", name: "Зелье лечения", type: "heal", formula: "2d4+2", quantity: 1, description: "Восстанавливает хиты", actionCost: "bonus_action" }];
      tor.abilities.push({
        id: "free-test",
        name: "Свободная искра",
        usesMax: 2,
        usesUsed: 0,
        refresh: "long",
        parameters: { name: "Свободная искра", type: "ability", actionCost: "free", targeting: "self", manual: true, description: "free" },
      });
      const foe = enemy("orc", 15, 2);
      const st = makeState([tor, foe]);
      st.mapElements = [{ id: "w1", type: "wall", x: 8, y: 0, width: 1, height: 10 }];

      // Verify hide works normally behind wall, then verify tortle_shell blocks it
      expect(() => attemptHide(st, "tor-1", { skipCost: true })).not.toThrow();
      tor.isHidden = false;

      const shell = bySrd(tor, "race/tortle/pantsirnaya-zashchita");
      useAbility(st, "tor-1", shell.id);
      expect(tor.conditions.some((c) => c.type === "tortle_shell")).toBe(true);

      expect(() => useAbility(st, "tor-1", "free-test")).toThrow();
      expect(() => attemptHide(st, "tor-1")).toThrow(/текущем состоянии/);
      expect(() => drinkPotion(st, "tor-1", "pot-1")).toThrow(/текущем состоянии/);
      expect(() => transformWildShape(st, "tor-1", "wolf")).toThrow(/текущем состоянии/);

      // Exit shell via bonus action still works
      useAbility(st, "tor-1", shell.id);
      expect(tor.conditions.some((c) => c.type === "tortle_shell")).toBe(false);
    });

    it("blocks free abilities and drinkPotion when !canAct (paralyzed)", () => {
      const h = ally("h-para", 2, 2, {
        potions: [{ id: "pot-1", name: "Зелье лечения", type: "heal", formula: "2d4+2", quantity: 1, description: "Восстанавливает хиты", actionCost: "bonus_action" }],
        abilities: [
          {
            id: "free-test",
            name: "Свободная искра",
            usesMax: 2,
            usesUsed: 0,
            refresh: "long",
            parameters: { name: "Свободная искра", type: "ability", actionCost: "free", targeting: "self", manual: true, description: "free" },
          },
        ],
      });
      const st = makeState([h]);
      applyEffect(st, "h-para", { condition: "paralyzed", durationRounds: 2 });

      expect(() => useAbility(st, "h-para", "free-test")).toThrow();
      expect(() => drinkPotion(st, "h-para", "pot-1")).toThrow();
    });

    it("moveCombatant with freeMove returns actual costFt > 0 when interrupted by web or spike_growth", () => {
      const moverWeb = ally("m-web", 0, 2, { speed: 30, saves: { DEX: { prof: false, mod: -2 } } });
      const stWeb = makeState([moverWeb]);
      stWeb.mapElements = [
        {
          id: "web-1",
          type: "spell_zone",
          x: 2,
          y: 0,
          width: 2,
          height: 30,
          properties: { isSpellZone: true, zoneType: "web", saveDC: 20, difficultTerrain: true },
        },
      ];
      vi.spyOn(Math, "random").mockReturnValue(0.05);
      const resWeb = moveCombatant(stWeb, "m-web", { x: 4, y: 2 }, { freeMove: true, budgetFt: 30 });
      expect(resWeb.costFt).toBe(15);
      expect(moverWeb.movementUsed).toBe(0);

      const moverSpike = ally("m-spike", 0, 2, { speed: 30, hpCurrent: 2, hpMax: 20 });
      const stSpike = makeState([moverSpike]);
      stSpike.mapElements = [
        {
          id: "spike-1",
          type: "spell_zone",
          x: 2,
          y: 0,
          width: 2,
          height: 30,
          properties: { isSpellZone: true, zoneType: "spike_growth" },
        },
      ];
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const resSpike = moveCombatant(stSpike, "m-spike", { x: 4, y: 2 }, { freeMove: true, budgetFt: 30 });
      expect(resSpike.costFt).toBe(10);
      expect(moverSpike.movementUsed).toBe(0);
    });
  });

  describe("4. class-kit hitRiders with reaction: true respect hasNoReactions & !canAct", () => {
    it("does not trigger reaction hitRider when attacker has no reactions (slowed/tortle_shell) or cannot act", () => {
      const makeFighter = (id: string, conditions: Combatant["conditions"]) =>
        ally(id, 5, 5, {
          conditions,
          attacks: [
            {
              id: "sword",
              name: "Меч",
              kind: "melee",
              range: { normal: 5 },
              attackBonus: 20,
              damage: [{ dice: "1d6", mod: 2, type: "slashing" }],
              actionCost: "action",
            },
          ],
          abilities: [
            {
              id: "rider-1",
              name: "Реактивный разряд",
              usesMax: 0,
              usesUsed: 0,
              refresh: "none",
              parameters: { name: "Реактивный разряд", type: "ability", actionCost: "free", srdKey: "test/deferred/reaction-rider" },
            },
          ],
        });

      const attNormal = makeFighter("att-ok", []);
      const foe1 = enemy("foe-1", 6, 5, { ac: 10, hpMax: 40, hpCurrent: 40 });
      const st1 = makeState([attNormal, foe1]);
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      performAttack(st1, "att-ok", "foe-1", "sword");
      // 1d6(4)+2 + 5 radiant = 11 damage
      expect(foe1.hpCurrent).toBe(29);
      expect(attNormal.reactionUsed).toBe(true);

      const attSlowed = makeFighter("att-slow", [{ type: "slow", durationRounds: 2 }]);
      const foe2 = enemy("foe-2", 6, 5, { ac: 10, hpMax: 40, hpCurrent: 40 });
      const st2 = makeState([attSlowed, foe2]);
      performAttack(st2, "att-slow", "foe-2", "sword");
      // slow has noReactions -> rider must NOT fire (4+2 = 6 damage)
      expect(foe2.hpCurrent).toBe(34);
      expect(attSlowed.reactionUsed).toBe(false);

      const attParalyzed = makeFighter("att-para", [{ type: "paralyzed", durationRounds: 2 }]);
      const foe3 = enemy("foe-3", 6, 5, { ac: 10, hpMax: 40, hpCurrent: 40 });
      const st3 = makeState([attParalyzed, foe3]);
      const res: any = {
        hit: true,
        crit: false,
        damage: 6,
        damageParts: [{ amount: 6, type: "slashing" }],
        text: "hit",
      };
      classHooks.hitRiders(st3, attParalyzed, foe3, attParalyzed.attacks[0], res);
      expect(res.damage).toBe(6);
      expect(attParalyzed.reactionUsed).toBe(false);
    });
  });

  describe("5. chosenMentalAbility scoping prevents unrelated feats from overriding fallback", () => {
    it("ignores unrelated feats/traits mentioning Интеллект or Мудрость", () => {
      const ae = raceHero("Астральный эльф", null, "ae-1", 3, {
        mods: { INT: 4, WIS: 1, CHA: 0 },
        sheet: {
          featuresTraits: "Наблюдательный (Мудрость)\nСпасброски: Интеллект",
          traitsList: [{ id: "keen-mind", name: "Острый ум", description: "Интеллект +1, всегда знаете стороны света." }],
        },
      });
      // Fallback for Astral Elf is WIS (8 + 2 + 1 = 11), NOT INT (14)
      expect(bySrd(ae, "race/astral-elf/innate/sacred-flame").parameters?.saveDC).toBe(11);

      const fairy = raceHero("Фэйри", null, "fai-1", 3, {
        mods: { INT: 4, WIS: 3, CHA: 0 },
        sheet: {
          featuresTraits: "Наблюдательный (Мудрость)\nСпасброски: Интеллект",
          traitsList: [{ id: "observant", name: "Наблюдательный", description: "Повысьте Интеллект или Мудрость на 1." }],
        },
      });
      // Fallback for Fairy is CHA (8 + 2 + 0 = 10), NOT INT/WIS
      expect(bySrd(fairy, "race/fairy/innate/faerie-fire").parameters?.saveDC).toBe(10);
    });

    it("honors explicit racialVariants tokens and racial spellcasting traitsList/text", () => {
      const aeToken = raceHero("Астральный эльф", null, "ae-tok", 3, {
        racialVariants: ["int"],
        mods: { INT: 4, WIS: 1, CHA: 0 },
      });
      expect(bySrd(aeToken, "race/astral-elf/innate/sacred-flame").parameters?.saveDC).toBe(14);

      const fairyTrait = raceHero("Фэйри", null, "fai-tr", 3, {
        mods: { INT: 4, WIS: 3, CHA: 0 },
        sheet: {
          traitsList: [
            { id: "observant", name: "Наблюдательный", description: "Мудрость +1" },
            { id: "magiya-fey", name: "Магия фей", description: "Заклинательная характеристика: Интеллект" },
          ],
        },
      });
      expect(bySrd(fairyTrait, "race/fairy/innate/faerie-fire").parameters?.saveDC).toBe(14);

      const aeText = raceHero("Астральный эльф", null, "ae-txt", 3, {
        mods: { INT: 1, WIS: 1, CHA: 4 },
        sheet: {
          featuresTraits: "Наблюдательный (Интеллект)\nАстральное пламя — базовой характеристикой является Харизма",
        },
      });
      expect(bySrd(aeText, "race/astral-elf/innate/sacred-flame").parameters?.saveDC).toBe(14);
    });
  });
});
