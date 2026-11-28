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
import { hasCondition } from "../rules";
import { ally, bySrd, enemy, makeState, raceHero } from "./helpers/race-harness";
import type { Combatant } from "../types";

function seqRandom(...vals: number[]) {
  let i = 0;
  vi.spyOn(Math, "random").mockImplementation(() => vals[Math.min(i++, vals.length - 1)]);
}

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
      expect(
        detectArmorType({
          inventory: [{ name: "Латы", equipped: true }],
        })
      ).toBe("heavy");
      expect(
        detectArmorType({
          inventory: [{ name: "Кольчужная рубаха", equipped: true, type: "armor" }],
        })
      ).toBe("medium");
      expect(
        detectArmorType({
          inventory: [{ name: "Ring Mail", equipped: true }],
        })
      ).toBe("heavy");
    });

    it("ignores heavy weapons, light weapons, and unslotted leather gear", () => {
      expect(
        detectArmorType({
          inventory: [{ name: "Тяжёлый арбалет", type: "Тяжёлое оружие" }],
        })
      ).toBeUndefined();
      expect(
        detectArmorType({
          inventory: [{ name: "Shortbow", category: "light weapon", equipped: true }],
        })
      ).toBeUndefined();
      expect(
        detectArmorType({
          inventory: [{ name: "Leather Gloves", equipped: true }],
        })
      ).toBeUndefined();
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

    it("recognizes Russian instrumental endings (Интеллектом/Харизмой) and English context keywords", () => {
      const instInt = raceHero("Фэйри", null, "fai-inst-int", 3, {
        mods: { INT: 4, WIS: 1, CHA: 0 },
        sheet: {
          featuresTraits: "Магия фей — заклинательная характеристика задаётся Интеллектом",
        },
      });
      expect(bySrd(instInt, "race/fairy/innate/faerie-fire").parameters?.saveDC).toBe(14);

      const instCha = raceHero("Астральный эльф", null, "ae-inst-cha", 3, {
        mods: { INT: 0, WIS: 1, CHA: 4 },
        sheet: {
          featuresTraits: "Астральное пламя — творится Харизмой",
        },
      });
      expect(bySrd(instCha, "race/astral-elf/innate/sacred-flame").parameters?.saveDC).toBe(14);

      const enTraits = raceHero("Фэйри", null, "fai-en", 3, {
        mods: { INT: 4, WIS: 3, CHA: 0 },
        sheet: {
          traitsList: [
            { id: "keen-mind", name: "Keen Mind", description: "Wisdom +1" },
            { id: "fairy-magic", name: "Fairy Magic", description: "Your spellcasting uses Intelligence" },
          ],
        },
      });
      expect(bySrd(enTraits, "race/fairy/innate/faerie-fire").parameters?.saveDC).toBe(14);

      const enAstral = raceHero("Астральный эльф", null, "ae-en", 3, {
        mods: { INT: 0, WIS: 1, CHA: 4 },
        sheet: {
          traitsList: [{ id: "astral-fire", name: "Astral Fire", description: "Charisma" }],
        },
      });
      expect(bySrd(enAstral, "race/astral-elf/innate/sacred-flame").parameters?.saveDC).toBe(14);
    });
  });

  describe("6. Final review fixes: innate spell saves/sleep, MPMM non-manual spells, hasNoReactions in PHB", () => {
    it("innate racial spells (type: ability with spellSlotLevel) trigger spellSaveAdvantage, magicMentalSaveAdvantage, and magical sleep immunity", () => {
      const satyr = raceHero("satyr-mpmm", null, "sat-1", 3, { saves: { WIS: { prof: false, mod: 0 } } });
      const gnome = raceHero("Гном", "Скальный гном", "gno-1", 3, { saves: { WIS: { prof: false, mod: 0 } } });
      const elf = raceHero("Эльф", "Высший эльф", "elf-1", 3);
      const astral = raceHero("astral-elf", null, "ast-1", 3);

      const caster = enemy("tiefling_caster", 6, 5, {
        abilities: [
          {
            id: "innate_charm",
            name: "Врождённое очарование",
            usesMax: 1,
            usesUsed: 0,
            refresh: "long",
            parameters: {
              name: "Врождённое очарование",
              type: "ability",
              spellSlotLevel: 1,
              actionCost: "action",
              targeting: "creature",
              range: { type: "ranged", value: 30 },
              saveType: "WIS",
              saveDC: 15,
              effects: [{ condition: "charmed", durationRounds: 10 }],
            },
          },
          {
            id: "innate_sleep",
            name: "Усыпление",
            usesMax: 1,
            usesUsed: 0,
            refresh: "long",
            parameters: {
              name: "Усыпление",
              type: "ability",
              spellSlotLevel: 1,
              actionCost: "action",
              targeting: "creature",
              range: { type: "ranged", value: 90 },
              effects: [{ condition: "unconscious", durationRounds: 10 }],
            },
          },
        ],
      });
      const st = makeState([caster, satyr, gnome, elf, astral]);

      // Satyr rolls 1 (0.0) then 19 (0.9) -> succeeds via spellSaveAdvantage!
      seqRandom(0.0, 0.9);
      const outSatyr = useAbility(st, "tiefling_caster", "innate_charm", { targetIds: ["sat-1"] });
      expect(outSatyr.targets[0]?.saved).toBe(true);
      expect(hasCondition(satyr, "charmed")).toBe(false);

      // Gnome rolls 1 (0.0) then 19 (0.9) -> succeeds via magicMentalSaveAdvantage!
      caster.actionUsed = false;
      caster.abilities[0].usesUsed = 0;
      seqRandom(0.0, 0.9);
      const outGnome = useAbility(st, "tiefling_caster", "innate_charm", { targetIds: ["gno-1"] });
      expect(outGnome.targets[0]?.saved).toBe(true);
      expect(hasCondition(gnome, "charmed")).toBe(false);

      // Innate Sleep spell triggers magical sleep immunity on Elf and Astral Elf
      caster.actionUsed = false;
      useAbility(st, "tiefling_caster", "innate_sleep", { targetIds: ["elf-1"] });
      expect(hasCondition(elf, "unconscious")).toBe(false);

      caster.actionUsed = false;
      caster.abilities[1].usesUsed = 0;
      useAbility(st, "tiefling_caster", "innate_sleep", { targetIds: ["ast-1"] });
      expect(hasCondition(astral, "unconscious")).toBe(false);
    });

    it("MPMM innate spells feather-fall, flame-blade, and water-walk resolve SRD spells instead of manual: true placeholders", () => {
      const air5 = raceHero("genasi-mpmm", "Дженази воздуха", "air-mpmm", 5);
      const ff = bySrd(air5, "race/genasi-mpmm/innate/feather-fall");
      expect(ff.parameters?.manual).not.toBe(true);
      expect(ff.parameters?.actionCost).toBe("reaction");
      expect(ff.parameters?.offTurn).toBe(true);

      const fire5 = raceHero("genasi-mpmm", "Дженази огня", "fire-mpmm", 5);
      const fb = bySrd(fire5, "race/genasi-mpmm/innate/flame-blade");
      expect(fb.parameters?.manual).not.toBe(true);

      const water5 = raceHero("genasi-mpmm", "Дженази воды", "water-mpmm", 5);
      const ww1 = bySrd(water5, "race/genasi-mpmm/innate/water-walk");
      expect(ww1.parameters?.manual).not.toBe(true);

      const triton5 = raceHero("triton-mpmm", null, "triton-mpmm", 5);
      const ww2 = bySrd(triton5, "race/triton-mpmm/innate/water-walk");
      expect(ww2.parameters?.manual).not.toBe(true);
    });

    it("slowed (hasNoReactions) Ravenite and Mark of Sentinel do not fire reaction traits", () => {
      const sureSword = [
        {
          id: "sword",
          name: "Меч",
          kind: "melee" as const,
          range: { normal: 5 },
          attackBonus: 20,
          damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
          actionCost: "action" as const,
        },
      ];

      const rav = raceHero("Драконорождённый", "Равенит", "rav-slow", 3, {
        x: 5,
        y: 5,
        ac: 5,
        hpMax: 40,
        hpCurrent: 40,
      });
      rav.conditions.push({ type: "slow", durationRounds: 2 });
      const foe = enemy("orc-rav", 6, 5, { ac: 10, hpMax: 30, hpCurrent: 30, attacks: sureSword });
      const stRav = makeState([foe, rav]);
      seqRandom(0.9, 0.5, 0.9, 0.5);
      performAttack(stRav, "orc-rav", "rav-slow", "sword");
      expect(rav.reactionUsed).toBe(false);
      expect(bySrd(rav, "race/ravenite/mstitelnoe-napadenie").usesUsed).toBe(0);
      expect(foe.hpCurrent).toBe(30);

      const guardian = raceHero("Человек", "Метка стража", "guard-slow", 3, {
        x: 5,
        y: 5,
        ac: 18,
        hpMax: 40,
        hpCurrent: 40,
      });
      guardian.conditions.push({ type: "slow", durationRounds: 2 });
      const friend = ally("wiz-slow", 6, 5, { ac: 5, hpMax: 20, hpCurrent: 20 });
      const orc2 = enemy("orc-guard", 7, 5, { attacks: sureSword });
      const stGuard = makeState([orc2, guardian, friend]);
      seqRandom(0.9, 0.5);
      performAttack(stGuard, "orc-guard", "wiz-slow", "sword");
      expect(guardian.x).toBe(5);
      expect(friend.x).toBe(6);
      expect(friend.hpCurrent).toBeLessThan(20);
      expect(guardian.hpCurrent).toBe(40);
      expect(guardian.reactionUsed).toBe(false);
      expect(bySrd(guardian, "race/mark-of-sentinel/bditelnyy-strazh").usesUsed).toBe(0);
    });
  });
});
