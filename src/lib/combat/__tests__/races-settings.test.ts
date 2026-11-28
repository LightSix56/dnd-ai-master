import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyEffect,
  castSpell,
  dealDamage,
  endTurn,
  moveCombatant,
  performAttack,
  useAbility,
} from "../engine";
import { kitHandles } from "../class-kit";
import { modDamageImmunity, modResistance } from "../feature-mods";
import { rollInitiativeFor } from "../initiative";
import { DECLINE, ReactionPrompt, askReaction, type ReactionContext } from "../reactions";
import { runWithReactions } from "../reaction-runtime";
import { RACES_2014, raceRuleKeys, raceRules } from "../races/race-defs";
import {
  computeAttackAdvantage,
  effectiveAC,
  effectiveSpeed,
  hasCondition,
  rollSave,
} from "../rules";
import { hydrateCombatant, packMonsterData } from "../serialize";
import { ally, bySrd, cond, enemy, makeState, raceHero } from "./helpers/race-harness";

import type { Combatant } from "../types";

const BATCH_3_RACE_IDS = [
  "autognome",
  "astral-elf",
  "vedalken",
  "verdan",
  "simic-hybrid",
  "giff",
  "grung",
  "harengon",
  "kalashtar",
  "kender",
  "centaur",
  "warforged",
  "leonin",
  "locathah",
  "loxodon",
  "minotaur",
  "plasmoid",
  "satyr",
  "owlin",
  "tortle",
  "thri-kreen",
  "fairy",
  "hadozee",
  "changeling",
  "shifter",
] as const;

const SURE_SWORD: Combatant["attacks"] = [
  {
    id: "sword",
    name: "Меч",
    kind: "melee",
    range: { normal: 5 },
    attackBonus: 20,
    damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
    actionCost: "action",
  },
];

function seqRandom(...values: number[]) {
  let idx = 0;
  return vi.spyOn(Math, "random").mockImplementation(() => {
    const v = values[idx] ?? values[values.length - 1] ?? 0.5;
    idx += 1;
    return v;
  });
}

describe("Batch 3 Legacy Settings & Adventure Races (25 races)", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Autognome (Автогном)", () => {
    it("Small, Armored Casing 13+DEX, poison resist, paralyzed/poisoned save adv, Built for Success profBonus/long", () => {
      const ag = raceHero("Автогном", null, "ag-1", 5, {
        ac: 10,
        mods: { DEX: 3 },
      });
      expect(ag.raceId).toBe("autognome");
      expect(ag.size).toBe("small");
      expect(ag.speed).toBe(30);
      expect(effectiveAC(ag)).toBe(16);
      expect(modResistance(ag, "poison")).not.toBeNull();
      expect(rollSave(ag, "CON", 15, { condition: "poisoned" }).advantage).toBe(true);
      expect(rollSave(ag, "CON", 15, { condition: "paralyzed" }).advantage).toBe(true);

      const st = makeState([ag]);
      // Autognome Sentry's Rest does NOT grant sleep immunity in 2014 rules
      applyEffect(st, "ag-1", { condition: "unconscious", durationRounds: 5, isMagicalSleep: true });
      expect(hasCondition(ag, "unconscious")).toBe(true);
      ag.conditions = [];

      const bfs = bySrd(ag, "race/autognome/sozdan-dlya-uspekha");
      expect(bfs.usesMax).toBe(3);
      expect(bfs.refresh).toBe("long");
      expect(bfs.parameters?.manual).toBe(true);
      useAbility(st, "ag-1", bfs.id);
      expect(bfs.usesUsed).toBe(1);
    });
  });

  describe("2. Astral Elf (Астральный эльф)", () => {
    it("dv 60, charmed save adv, sleep immune, Astral Fire cantrip & INT/WIS/CHA choice, Starlight Step bonus 30ft teleport", () => {
      const ae = raceHero("Астральный эльф", null, "ae-1", 5, {
        x: 2,
        y: 5,
        mods: { INT: 1, WIS: 3, CHA: 0 },
      });
      expect(ae.darkvision).toBe(60);
      expect(rollSave(ae, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);
      const sf = bySrd(ae, "race/astral-elf/innate/sacred-flame");
      expect(sf.usesMax).toBe(0);
      expect(sf.parameters?.saveDC).toBe(8 + 3 + 3);

      const st = makeState([ae]);
      applyEffect(st, "ae-1", { condition: "sleep", durationRounds: 3 });
      expect(hasCondition(ae, "sleep")).toBe(false);

      const step = bySrd(ae, "race/astral-elf/zvezdnyy-shag");
      expect(step.usesMax).toBe(3);
      expect(step.refresh).toBe("long");
      useAbility(st, "ae-1", step.id, { center: { x: 8, y: 5 } });
      expect(ae.x).toBe(8);
      expect(ae.y).toBe(5);
      expect(ae.bonusActionUsed).toBe(true);
      expect(step.usesUsed).toBe(1);

      const aeInt = raceHero("Астральный эльф", null, "ae-i", 1, {
        racialVariants: ["light", "int"],
        mods: { INT: 4, WIS: 1 },
      });
      expect(bySrd(aeInt, "race/astral-elf/innate/light").usesMax).toBe(0);
      expect(bySrd(aeInt, "race/astral-elf/innate/light").parameters?.saveDC).toBe(8 + 2 + 4);
    });
  });

  describe("3. Vedalken (Ведалкен)", () => {
    it("Vedalken Dispassion grants advantage on INT/WIS/CHA saves", () => {
      const v = raceHero("Ведалкен", null, "ved-1", 1);
      for (const ab of ["INT", "WIS", "CHA"] as const) {
        expect(rollSave(v, ab, 15).advantage).toBe(true);
      }
      for (const ab of ["STR", "DEX", "CON"] as const) {
        expect(rollSave(v, ab, 15).advantage).toBe(false);
      }
    });
  });

  describe("4. Verdan (Вердан)", () => {
    it("Small, Telepathic Insight grants advantage on WIS/CHA saves", () => {
      const vd = raceHero("Вердан", null, "ver-1", 1);
      expect(vd.size).toBe("small");
      expect(rollSave(vd, "WIS", 15).advantage).toBe(true);
      expect(rollSave(vd, "CHA", 15).advantage).toBe(true);
      expect(rollSave(vd, "INT", 15).advantage).toBe(false);
    });
  });

  describe("5. Simic Hybrid (Гибрид Симиков)", () => {
    it("dv 60, L1 & L5 options: Grappling Appendages 1d6+STR, Carapace +1 AC (unless heavy armor), Acid Spit 2d10->3d10->4d10", () => {
      const l1 = raceHero("Гибрид Симиков", null, "sim-1", 1, {
        racialVariants: ["manta-glide", "grappling-appendages", "carapace", "acid-spit"],
        mods: { STR: 3, CON: 2 },
        ac: 14,
      });
      expect(l1.darkvision).toBe(60);
      expect(bySrd(l1, "race/simic-hybrid/manta-glide")).toBeDefined();
      // L5 options are gated behind level >= 5
      expect(l1.attacks.some((a) => a.id === "simic_grappling_appendages")).toBe(false);
      expect(effectiveAC(l1)).toBe(14);

      const l5 = raceHero("Гибрид Симиков", null, "sim-5", 5, {
        x: 5,
        y: 5,
        racialVariants: ["grappling-appendages", "carapace", "acid-spit"],
        mods: { STR: 3, CON: 2 },
        ac: 14,
      });
      expect(effectiveAC(l5)).toBe(15);
      const app = l5.attacks.find((a) => a.id === "simic_grappling_appendages");
      expect(app).toBeDefined();
      expect(app!.damage).toEqual([{ dice: "1d6", mod: 3, type: "bludgeoning" }]);

      // Heavy armor disables Carapace +1 AC and survives monsterData pack/hydrate roundtrip
      const l5Heavy = raceHero("Гибрид Симиков", null, "sim-heavy", 5, {
        racialVariants: ["carapace"],
        ac: 18,
        sheet: { equippedSlots: { armor: { name: "Латы", category: "heavy" } } },
      });
      expect(l5Heavy.armorType).toBe("heavy");
      expect(effectiveAC(l5Heavy)).toBe(18);
      const packed = packMonsterData(l5Heavy);
      const hydrated = hydrateCombatant({
        id: l5Heavy.id,
        name: l5Heavy.name,
        type: l5Heavy.type,
        color: "#000",
        x: 0,
        y: 0,
        hpCurrent: 40,
        hpMax: 40,
        ac: 18,
        speed: 30,
        abilities: JSON.stringify(l5Heavy.abilities),
        monsterData: packed,
      });
      expect(hydrated.armorType).toBe("heavy");
      expect(effectiveAC(hydrated)).toBe(18);

      const foe = enemy("orc", 8, 5, { hpMax: 60, hpCurrent: 60, saves: { DEX: { prof: false, mod: 0 } } });
      const st = makeState([l5, foe]);
      const spit = bySrd(l5, "race/simic-hybrid/acid-spit");
      expect(spit.usesMax).toBe(2);
      expect(spit.refresh).toBe("long");
      // DC = 8 + 3 (prof) + 2 (CON) = 13; foe rolls 5 (fails), 2d10 (0.5 -> 6+6 = 12)
      seqRandom(0.2, 0.5, 0.5);
      const out = useAbility(st, "sim-5", spit.id, { targetIds: ["orc"] });
      expect(out.targets[0]?.saved).toBe(false);
      expect(foe.hpCurrent).toBe(48);

      // Level 11 scales Acid Spit to 3d10, Level 17 to 4d10
      const l11 = raceHero("Гибрид Симиков", null, "sim-11", 11, {
        x: 5,
        y: 5,
        racialVariants: ["acid-spit"],
        mods: { CON: 3 },
      });
      const foe11 = enemy("orc11", 8, 5, { hpMax: 80, hpCurrent: 80, saves: { DEX: { prof: false, mod: 0 } } });
      const st11 = makeState([l11, foe11]);
      seqRandom(0.1, 0.5, 0.5, 0.5);
      useAbility(st11, "sim-11", bySrd(l11, "race/simic-hybrid/acid-spit").id, { targetIds: ["orc11"] });
      expect(foe11.hpCurrent).toBe(62);

      const l17 = raceHero("Гибрид Симиков", null, "sim-17", 17, {
        x: 5,
        y: 5,
        racialVariants: ["acid-spit"],
        mods: { CON: 3 },
      });
      const foe17 = enemy("orc17", 8, 5, { hpMax: 80, hpCurrent: 80, saves: { DEX: { prof: false, mod: 0 } } });
      const st17 = makeState([l17, foe17]);
      seqRandom(0.1, 0.5, 0.5, 0.5, 0.5);
      useAbility(st17, "sim-17", bySrd(l17, "race/simic-hybrid/acid-spit").id, { targetIds: ["orc17"] });
      expect(foe17.hpCurrent).toBe(56);
    });
  });

  describe("6. Giff (Гифф)", () => {
    it("swim 30, Hippo Build STR save adv, Astral Spark adds +profBonus force once/turn profBonus/long", () => {
      const giff = raceHero("Гифф", null, "giff-1", 5, {
        x: 5,
        y: 5,
        attacks: SURE_SWORD,
      });
      expect(giff.speeds?.swim).toBe(30);
      expect(rollSave(giff, "STR", 15).advantage).toBe(true);

      const foe = enemy("orc", 6, 5, { ac: 10, hpMax: 60, hpCurrent: 60 });
      const st = makeState([giff, foe]);
      const spark = bySrd(giff, "race/giff/astralnaya-iskra");
      expect(spark.usesMax).toBe(3);
      expect(spark.refresh).toBe("long");

      giff.attacksPerAction = 2;
      useAbility(st, "giff-1", spark.id);
      seqRandom(0.5, 0.5);
      const h1 = performAttack(st, "giff-1", "orc", "sword");
      expect(h1.damage).toBe(11);
      expect(spark.usesUsed).toBe(1);

      useAbility(st, "giff-1", spark.id);
      seqRandom(0.5, 0.5);
      const h2 = performAttack(st, "giff-1", "orc", "sword");
      expect(h2.damage).toBe(8);
      expect(spark.usesUsed).toBe(1);
    });
  });

  describe("7. Grung (Грунг)", () => {
    it("Small, walk 25, climb 25, poison damage & poisoned condition immunity, Poisonous Skin CON DC 12 for 1 min with Save Ends", () => {
      const gr = raceHero("Грунг", null, "gr-1", 1, { x: 5, y: 5, hpMax: 30, hpCurrent: 30 });
      expect(gr.size).toBe("small");
      expect(gr.speed).toBe(25);
      expect(gr.speeds?.climb).toBe(25);
      expect(modDamageImmunity(gr, "poison")).not.toBeNull();

      const foe = enemy("orc", 6, 5, {
        hpMax: 30,
        hpCurrent: 30,
        saves: { CON: { prof: false, mod: 0 } },
        attacks: SURE_SWORD,
      });
      const st = makeState([foe, gr]);
      dealDamage(st, "gr-1", 12, { damageType: "poison" });
      expect(gr.hpCurrent).toBe(30);
      applyEffect(st, "gr-1", { condition: "poisoned", durationRounds: 5 });
      expect(hasCondition(gr, "poisoned")).toBe(false);

      // Melee attack against Grung triggers Poisonous Skin CON DC 12 (duration 10, saveEnds CON DC 12)
      seqRandom(0.9, 0.5, 0.1);
      performAttack(st, "orc", "gr-1", "sword");
      const poisoned = cond(foe, "poisoned");
      expect(poisoned).toBeDefined();
      expect(poisoned!.duration).toBe(10);
      expect(poisoned!.saveType).toBe("CON");
      expect(poisoned!.saveDC).toBe(12);

      // End orc turn with failed CON save -> stays poisoned; next orc turn with successful CON save -> cleared
      seqRandom(0.1);
      endTurn(st);
      expect(hasCondition(foe, "poisoned")).toBe(true);
      endTurn(st); // grung
      seqRandom(0.9);
      endTurn(st); // orc Save Ends succeeds
      expect(hasCondition(foe, "poisoned")).toBe(false);
    });
  });

  describe("8. Harengon (Зайцегон)", () => {
    it("Hare-Trigger adds profBonus to initiative, Lucky Footwork rescues failed DEX save (+ReactionPrompt accept/decline), Rabbit Hop jumps 5*profBonus without OA", () => {
      const h = raceHero("Зайцегон", null, "har-1", 5, {
        x: 5,
        y: 5,
        mods: { DEX: 2 },
        saves: { DEX: { prof: false, mod: 2 } },
      });
      h.dexMod = 2;
      seqRandom(0.5);
      expect(rollInitiativeFor(h)).toBe(16);

      const mage = enemy("mage", 8, 5, {
        abilities: [
          {
            id: "fire_blast",
            name: "Вспышка",
            usesMax: 0,
            usesUsed: 0,
            refresh: "none",
            parameters: {
              name: "Вспышка",
              type: "spell",
              actionCost: "action",
              targeting: "creature",
              range: { type: "ranged", value: 60 },
              saveType: "DEX",
              saveDC: 15,
              damage: [{ dice: "2d6", mod: 0, type: "fire", save: "half" }],
            },
          },
        ],
      });
      const st = makeState([mage, h]);
      seqRandom(0.5, 0.5, 0.5, 0.5);
      const res = useAbility(st, "mage", "fire_blast", { targetIds: ["har-1"] });
      expect(res.targets[0]?.saved).toBe(true);
      expect(h.reactionUsed).toBe(true);

      // ReactionPrompt path in runWithReactions (seed=1 rolls 13; +1 mod = 14 < 15, any 1d4 >= 1 rescues to 15+)
      mage.actionUsed = false;
      const h2 = raceHero("Зайцегон", null, "har-2", 5, {
        x: 5,
        y: 5,
        saves: { DEX: { prof: false, mod: 1 } },
      });
      const st2 = makeState([mage, h2]);
      let caught: ReactionPrompt | null = null;
      const ctx: ReactionContext = { decisions: {}, seq: 0 };
      try {
        runWithReactions(ctx, 1, () => {
          useAbility(st2, "mage", "fire_blast", { targetIds: ["har-2"] });
        });
      } catch (e) {
        if (e instanceof ReactionPrompt) caught = e;
        else throw e;
      }
      expect(caught).not.toBeNull();
      expect(caught!.prompt.reactorId).toBe("har-2");

      // Accepting Lucky Footwork via ReactionPrompt adds 1d4 and turns 14 -> 15+ (success)
      mage.actionUsed = false;
      const hAccept = raceHero("Зайцегон", null, "har-2", 5, {
        x: 5,
        y: 5,
        saves: { DEX: { prof: false, mod: 1 } },
      });
      const stAccept = makeState([mage, hAccept]);
      const acceptOut = runWithReactions(
        { decisions: { [caught!.prompt.key]: caught!.prompt.options[0].id }, seq: 0 },
        1,
        () => useAbility(stAccept, "mage", "fire_blast", { targetIds: ["har-2"] })
      );
      expect(acceptOut.targets[0]?.saved).toBe(true);
      expect(hAccept.reactionUsed).toBe(true);

      // Declining Lucky Footwork leaves reaction unused and keeps failed save
      mage.actionUsed = false;
      const hDecline = raceHero("Зайцегон", null, "har-2", 5, {
        x: 5,
        y: 5,
        saves: { DEX: { prof: false, mod: 1 } },
      });
      const stDecline = makeState([mage, hDecline]);
      const declineOut = runWithReactions({ decisions: { [caught!.prompt.key]: DECLINE }, seq: 0 }, 1, () =>
        useAbility(stDecline, "mage", "fire_blast", { targetIds: ["har-2"] })
      );
      expect(declineOut.targets[0]?.saved).toBe(false);
      expect(hDecline.reactionUsed).toBe(false);

      // Rabbit Hop: level 5 -> profBonus 3 -> max 15 ft (3 cells) without provoking OA from adjacent foe
      const sentinel = enemy("guard", 5, 6, { attacks: SURE_SWORD });
      const stHop = makeState([h, sentinel]);
      h.bonusActionUsed = false;
      const hop = bySrd(h, "race/harengon/krolichiy-pryzhok");
      expect(hop.usesMax).toBe(3);
      useAbility(stHop, "har-1", hop.id, { center: { x: 8, y: 5 } });
      expect(h.x).toBe(8);
      expect(sentinel.reactionUsed).toBe(false);
      expect(hop.usesUsed).toBe(1);
    });
  });

  describe("9. Kalashtar (Калаштар)", () => {
    it("WIS save adv, psychic resistance (and NOT immune to magical sleep per 2014 JSON)", () => {
      const kal = raceHero("Калаштар", null, "kal-1", 1, { hpMax: 30, hpCurrent: 30 });
      expect(rollSave(kal, "WIS", 15).advantage).toBe(true);
      expect(modResistance(kal, "psychic")).not.toBeNull();
      const st = makeState([kal]);
      dealDamage(st, "kal-1", 10, { damageType: "psychic" });
      expect(kal.hpCurrent).toBe(25);
      applyEffect(st, "kal-1", { condition: "unconscious", durationRounds: 5, isMagicalSleep: true });
      expect(hasCondition(kal, "unconscious")).toBe(true);
    });
  });

  describe("10. Kender (Кендер)", () => {
    it("Small, Fearless (adv vs frightened + 1/long auto-success on cast & endTurn Save Ends), Taunt ignores deafened and clears on Kender drop", () => {
      const ken = raceHero("Кендер", null, "ken-1", 3, {
        x: 5,
        y: 5,
        hpMax: 20,
        hpCurrent: 20,
        mods: { CHA: 3 },
        saves: { WIS: { prof: false, mod: -2 } },
      });
      expect(ken.size).toBe("small");
      expect(rollSave(ken, "WIS", 15, { condition: "frightened" }).advantage).toBe(true);

      const ally1 = ally("ally", 7, 5, { ac: 15 });
      const deafFoe = enemy("deaf", 5, 6, { conditions: [{ type: "deafened" }] });
      const mage = enemy("mage", 6, 5, {
        saves: { WIS: { prof: false, mod: 0 } },
        attacks: SURE_SWORD,
        abilities: [
          {
            id: "fear_hex",
            name: "Ужас",
            usesMax: 0,
            usesUsed: 0,
            refresh: "none",
            parameters: {
              name: "Ужас",
              type: "spell",
              actionCost: "action",
              targeting: "creature",
              range: { type: "ranged", value: 60 },
              saveType: "WIS",
              saveDC: 20,
              effects: [{ condition: "frightened", durationRounds: 3 }],
            },
          },
        ],
      });
      const st = makeState([ken, ally1, mage, deafFoe]);

      const taunt = bySrd(ken, "race/kender/nasmeshka");
      expect(taunt.usesMax).toBe(2);
      // Deafened target cannot hear Taunt
      expect(() => useAbility(st, "ken-1", taunt.id, { targetIds: ["deaf"] })).toThrow();

      // Taunt: bonus action, WIS DC = 8 + 2 + 3 = 13; mage fails (0.1 -> 3)
      seqRandom(0.1);
      useAbility(st, "ken-1", taunt.id, { targetIds: ["mage"] });
      expect(hasCondition(mage, "kender_taunted")).toBe(true);
      expect(computeAttackAdvantage(mage, ally1, SURE_SWORD[0], {}, { allCombatants: st.combatants }).disadvantage).toBe(true);
      expect(computeAttackAdvantage(mage, ken, SURE_SWORD[0], {}, { allCombatants: st.combatants }).disadvantage).toBe(false);

      // End kender turn -> still taunted during ally, mage, deafFoe turns
      endTurn(st);
      expect(hasCondition(mage, "kender_taunted")).toBe(true);
      endTurn(st); // ally
      endTurn(st); // mage
      endTurn(st); // deafFoe -> start of Kender's next turn clears kender_taunted
      expect(hasCondition(mage, "kender_taunted")).toBe(false);

      // Taunt clears immediately if Kender drops to 0 HP
      ken.bonusActionUsed = false;
      seqRandom(0.1);
      useAbility(st, "ken-1", taunt.id, { targetIds: ["mage"] });
      expect(hasCondition(mage, "kender_taunted")).toBe(true);
      dealDamage(st, "ken-1", 50);
      expect(hasCondition(mage, "kender_taunted")).toBe(false);

      // Revive Kender & verify Fearless turns failed frightened save (DC 20) into success on endTurn Save Ends
      ken.hpCurrent = 20;
      const fearless = bySrd(ken, "race/kender/besstrashie");
      expect(fearless.usesMax).toBe(1);
      expect(fearless.refresh).toBe("long");
      applyEffect(st, "ken-1", { condition: "frightened", durationRounds: 3, saveType: "WIS", saveDC: 20 }, "mage");
      seqRandom(0.1, 0.1);
      endTurn(st); // Kender endTurn Save Ends fails DC 20 -> Fearless rescues!
      expect(hasCondition(ken, "frightened")).toBe(false);
      expect(fearless.usesUsed).toBe(1);
    });
  });

  describe("11. Centaur (Кентавр)", () => {
    it("walk 40, Hooves 1d4+STR, Charge requires >=30 ft movement + melee hit before bonus hooves", () => {
      const cen = raceHero("Кентавр", null, "cen-1", 3, {
        x: 0,
        y: 5,
        mods: { STR: 3 },
        attacks: SURE_SWORD,
      });
      expect(cen.speed).toBe(40);
      const hooves = cen.attacks.find((a) => a.id === "centaur_hooves");
      expect(hooves).toBeDefined();
      expect(hooves!.damage).toEqual([{ dice: "1d4", mod: 3, type: "bludgeoning" }]);

      const foe = enemy("orc", 7, 5, { ac: 10, hpMax: 50, hpCurrent: 50 });
      const st = makeState([cen, foe]);
      const charge = bySrd(cen, "race/centaur/razbeg");

      // Negative guard: moving only 10 ft is not enough for Charge
      moveCombatant(st, "cen-1", { x: 2, y: 5 });
      expect(() => useAbility(st, "cen-1", charge.id, { targetIds: ["orc"] })).toThrow();

      // Move remaining 20 ft (total 30 ft) then hit with melee weapon -> unlocks Charge bonus hooves
      moveCombatant(st, "cen-1", { x: 6, y: 5 });
      expect(cen.movementUsed).toBe(30);
      seqRandom(0.9, 0.5);
      performAttack(st, "cen-1", "orc", "sword");

      const hpAfterSword = foe.hpCurrent;
      seqRandom(0.9, 0.5);
      useAbility(st, "cen-1", charge.id, { targetIds: ["orc"] });
      expect(cen.bonusActionUsed).toBe(true);
      expect(foe.hpCurrent).toBeLessThan(hpAfterSword);
    });
  });

  describe("12. Warforged (Кованый)", () => {
    it("+1 AC Integrated Protection, poison resist, poisoned save adv, sleep immune", () => {
      const wf = raceHero("Кованый", null, "wf-1", 1, { ac: 16 });
      expect(effectiveAC(wf)).toBe(17);
      expect(modResistance(wf, "poison")).not.toBeNull();
      expect(rollSave(wf, "CON", 15, { condition: "poisoned" }).advantage).toBe(true);
      const st = makeState([wf]);
      applyEffect(st, "wf-1", { condition: "unconscious", durationRounds: 5, isMagicalSleep: true });
      expect(hasCondition(wf, "unconscious")).toBe(false);
    });
  });

  describe("13. Leonin (Леонин)", () => {
    it("walk 35, dv 60, Claws 1d4+STR, Daunting Roar bonus 10ft WIS save DC 8+CON+prof frightens until end of next turn (1/short)", () => {
      const leo = raceHero("Леонин", null, "leo-1", 3, {
        x: 5,
        y: 5,
        mods: { STR: 2, CON: 3 },
      });
      expect(leo.speed).toBe(35);
      expect(leo.darkvision).toBe(60);
      expect(leo.attacks.find((a) => a.id === "leonin_claws")?.damage).toEqual([
        { dice: "1d4", mod: 2, type: "slashing" },
      ]);

      const foe = enemy("orc", 6, 5, { saves: { WIS: { prof: false, mod: 0 } } });
      const st = makeState([leo, foe]);
      const roar = bySrd(leo, "race/leonin/ustrashayushchiy-rev");
      expect(roar.usesMax).toBe(1);
      expect(roar.refresh).toBe("short");
      expect(roar.parameters?.saveDC).toBe(13);

      seqRandom(0.1);
      useAbility(st, "leo-1", roar.id);
      expect(leo.bonusActionUsed).toBe(true);
      expect(hasCondition(foe, "frightened")).toBe(true);

      endTurn(st);
      expect(hasCondition(foe, "frightened")).toBe(true);
      endTurn(st); // orc turn
      expect(hasCondition(foe, "frightened")).toBe(true);
      endTurn(st); // Leonin turn 2 ends
      expect(hasCondition(foe, "frightened")).toBe(false);
    });
  });

  describe("14. Locathah (Локата)", () => {
    it("swim 30, Natural Armor 12+DEX, Leviathan Will adv vs charmed/frightened/paralyzed/poisoned/stunned/sleep", () => {
      const loc = raceHero("Локата", null, "loc-1", 1, { ac: 10, mods: { DEX: 3 } });
      expect(loc.speeds?.swim).toBe(30);
      expect(effectiveAC(loc)).toBe(15);
      for (const condType of ["charmed", "frightened", "paralyzed", "poisoned", "stunned", "sleep"]) {
        expect(rollSave(loc, "WIS", 15, { condition: condType }).advantage).toBe(true);
      }
      const st = makeState([loc]);
      applyEffect(st, "loc-1", { condition: "unconscious", durationRounds: 5, isMagicalSleep: true });
      expect(hasCondition(loc, "unconscious")).toBe(true);
    });
  });

  describe("15. Loxodon (Локсодон)", () => {
    it("Natural Armor 12+CON and Loxodon Serenity adv vs charmed/frightened", () => {
      const lox = raceHero("Локсодон", null, "lox-1", 1, { ac: 10, mods: { CON: 4 } });
      expect(effectiveAC(lox)).toBe(16);
      expect(rollSave(lox, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);
      expect(rollSave(lox, "WIS", 15, { condition: "frightened" }).advantage).toBe(true);
    });
  });

  describe("16. Minotaur (Минотавр)", () => {
    it("Horns 1d6+STR piercing, Goring Rush after Dash+20ft, Hammering Horns pushes 10ft & rejects >1 size larger", () => {
      const mino = raceHero("Минотавр", null, "mino-1", 3, {
        x: 1,
        y: 5,
        mods: { STR: 3 },
        attacks: SURE_SWORD,
      });
      const horns = mino.attacks.find((a) => a.id === "minotaur_horns");
      expect(horns).toBeDefined();
      expect(horns!.damage).toEqual([{ dice: "1d6", mod: 3, type: "piercing" }]);

      const foe = enemy("orc", 7, 5, { ac: 10, hpMax: 60, hpCurrent: 60, saves: { STR: { prof: false, mod: 0 } } });
      const hugeFoe = enemy("giant", 6, 6, { size: "huge", ac: 10, hpMax: 80, hpCurrent: 80 });
      const st = makeState([mino, foe, hugeFoe]);

      applyEffect(st, "mino-1", { condition: "dashing", durationRounds: 1 }, "mino-1");
      moveCombatant(st, "mino-1", { x: 6, y: 5 });
      seqRandom(0.9, 0.5);
      useAbility(st, "mino-1", bySrd(mino, "race/minotaur/pronzayushchiy-natisk").id, { targetIds: ["orc"] });
      expect(mino.bonusActionUsed).toBe(true);
      expect(foe.hpCurrent).toBeLessThan(60);

      // Hammering Horns rejects huge target (>1 size larger than medium)
      endTurn(st);
      endTurn(st);
      endTurn(st);
      seqRandom(0.9, 0.5);
      performAttack(st, "mino-1", "orc", "sword");
      const hh = bySrd(mino, "race/minotaur/sokrushitelnye-roga");
      expect(() => useAbility(st, "mino-1", hh.id, { targetIds: ["giant"] })).toThrow();

      seqRandom(0.1);
      useAbility(st, "mino-1", hh.id, { targetIds: ["orc"] });
      expect(mino.bonusActionUsed).toBe(true);
      expect(foe.x).toBe(9);
    });
  });

  describe("17. Plasmoid (Плазмоид)", () => {
    it("dv 60, Amorphous adv vs grappled, acid & poison resist + poisoned save adv", () => {
      const pl = raceHero("Плазмоид", null, "pl-1", 1, { hpMax: 30, hpCurrent: 30 });
      expect(pl.darkvision).toBe(60);
      expect(modResistance(pl, "acid")).not.toBeNull();
      expect(modResistance(pl, "poison")).not.toBeNull();
      expect(rollSave(pl, "STR", 15, { condition: "grappled" }).advantage).toBe(true);
      expect(rollSave(pl, "CON", 15, { condition: "poisoned" }).advantage).toBe(true);
    });
  });

  describe("18. Satyr (Сатир)", () => {
    it("walk 35, Ram 1d4+STR bludgeoning, Magic Resistance spell save adv on all abilities", () => {
      const sat = raceHero("Сатир", null, "sat-1", 1, { mods: { STR: 2 } });
      expect(sat.speed).toBe(35);
      expect(sat.attacks.find((a) => a.id === "satyr_ram")?.damage).toEqual([
        { dice: "1d4", mod: 2, type: "bludgeoning" },
      ]);
      for (const ab of ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const) {
        expect(rollSave(sat, ab, 15, { isSpell: true }).advantage).toBe(true);
      }
      expect(rollSave(sat, "DEX", 15, { isSpell: false }).advantage).toBe(false);
    });
  });

  describe("19. Owlin (Совлин)", () => {
    it("dv 120, fly 30, flexible size", () => {
      const ow = raceHero("Совлин", null, "ow-1", 1, { sheet: { size: "Маленький" } });
      expect(ow.darkvision).toBe(120);
      expect(ow.speeds?.fly).toBe(30);
      expect(ow.size).toBe("small");
    });
  });

  describe("20. Tortle (Тортл)", () => {
    it("Claws 1d4+STR, Natural Armor 17, Shell Defense enforces AC 21, STR/CON adv, DEX disadv, prone, noReactions, blocks attacks/spells, bonus exit", () => {
      const tor = raceHero("Тортл", null, "tor-1", 3, {
        x: 5,
        y: 5,
        ac: 10,
        mods: { STR: 3 },
        attacks: SURE_SWORD,
      });
      expect(tor.attacks.find((a) => a.id === "tortle_claws")?.damage).toEqual([
        { dice: "1d4", mod: 3, type: "slashing" },
      ]);
      expect(effectiveAC(tor)).toBe(17);

      const foe = enemy("orc", 6, 5, { ac: 10, hpMax: 40, hpCurrent: 40, attacks: SURE_SWORD });
      const bowAttack: Combatant["attacks"][number] = {
        id: "bow",
        name: "Лук",
        kind: "ranged",
        range: { normal: 80 },
        attackBonus: 5,
        damage: [{ dice: "1d8", mod: 2, type: "piercing" }],
        actionCost: "action",
      };
      const st = makeState([tor, foe]);
      const shell = bySrd(tor, "race/tortle/pantsirnaya-zashchita");
      useAbility(st, "tor-1", shell.id);
      expect(hasCondition(tor, "tortle_shell")).toBe(true);
      expect(tor.actionUsed).toBe(true);
      expect(effectiveAC(tor)).toBe(21);
      expect(effectiveSpeed(tor)).toBe(0);
      expect(rollSave(tor, "STR", 15).advantage).toBe(true);
      expect(rollSave(tor, "CON", 15).advantage).toBe(true);
      expect(rollSave(tor, "DEX", 15).advantage).toBe(false);
      // DEX save disadvantage: 0.9 (19) and 0.1 (3) -> takes 3
      seqRandom(0.9, 0.1);
      expect(rollSave(tor, "DEX", 15).roll.natural).toBe(3);

      // Prone-like attack modifiers & attackDisadvantage
      expect(computeAttackAdvantage(foe, tor, SURE_SWORD[0]).advantage).toBe(true);
      expect(computeAttackAdvantage(foe, tor, bowAttack).disadvantage).toBe(true);
      expect(computeAttackAdvantage(tor, foe, SURE_SWORD[0]).disadvantage).toBe(true);

      // noReactions blocks askReaction and opportunity attacks
      expect(askReaction(tor, { title: "t", text: "t", options: [{ id: "oa", label: "oa" }] })).toBeNull();
      // Offensive attacks & spells are blocked while inside shell
      expect(() => performAttack(st, "tor-1", "orc", "sword", { skipCost: true })).toThrow();
      expect(() => castSpell(st, "tor-1", "Огненная стрела", { targetIds: ["orc"] })).toThrow();

      // Exit with bonus action even while actionUsed is true
      useAbility(st, "tor-1", shell.id);
      expect(hasCondition(tor, "tortle_shell")).toBe(false);
      expect(tor.bonusActionUsed).toBe(true);
      expect(effectiveAC(tor)).toBe(17);
      expect(effectiveSpeed(tor)).toBe(30);
    });
  });

  describe("21. Thri-kreen (Три-крин)", () => {
    it("dv 60, Chameleon Carapace 13+DEX (and NOT immune to magical sleep per 2014 JSON)", () => {
      const tk = raceHero("Три-крин", null, "tk-1", 1, { ac: 10, mods: { DEX: 4 } });
      expect(tk.darkvision).toBe(60);
      expect(effectiveAC(tk)).toBe(17);
      const st = makeState([tk]);
      applyEffect(st, "tk-1", { condition: "unconscious", durationRounds: 5, isMagicalSleep: true });
      expect(hasCondition(tk, "unconscious")).toBe(true);
    });
  });

  describe("22. Fairy (Фэйри)", () => {
    it("Small, fly 30, Fairy Magic grants Druidcraft L1, Faerie Fire L3, Enlarge/Reduce L5 with INT/WIS/CHA choice", () => {
      const f1 = raceHero("Фэйри", null, "fai-1", 1);
      expect(f1.size).toBe("small");
      expect(f1.speeds?.fly).toBe(30);
      expect(bySrd(f1, "race/fairy/innate/druidcraft").usesMax).toBe(0);

      const f5 = raceHero("Фэйри", null, "fai-5", 5, {
        racialVariants: ["wis"],
        mods: { WIS: 4, CHA: 1 },
      });
      const ff = bySrd(f5, "race/fairy/innate/faerie-fire");
      expect(ff.usesMax).toBe(1);
      expect(ff.parameters?.saveDC).toBe(8 + 3 + 4);
      expect(bySrd(f5, "race/fairy/innate/enlarge-reduce").usesMax).toBe(1);
    });
  });

  describe("23. Hadozee (Хадози)", () => {
    it("climb 30, Hadozee Dodge reduces damage by 1d6+profBonus via reaction and ReactionPrompt (accept & decline)", () => {
      const had = raceHero("Хадози", null, "had-1", 5, { hpMax: 40, hpCurrent: 40 });
      expect(had.speeds?.climb).toBe(30);
      const dodge = bySrd(had, "race/hadozee/vertkost-khadozi");
      expect(dodge.usesMax).toBe(3);
      expect(dodge.refresh).toBe("long");
      expect(dodge.parameters?.offTurn).toBe(true);

      const st = makeState([had]);
      seqRandom(0.5);
      dealDamage(st, "had-1", 15, { damageType: "slashing" });
      expect(had.hpCurrent).toBe(32);
      expect(had.reactionUsed).toBe(true);
      expect(dodge.usesUsed).toBe(1);

      // ReactionPrompt path in runWithReactions
      const had2 = raceHero("Хадози", null, "had-2", 5, { hpMax: 40, hpCurrent: 40 });
      const st2 = makeState([had2]);
      let caught: ReactionPrompt | null = null;
      try {
        runWithReactions({ decisions: {}, seq: 0 }, 1, () => {
          dealDamage(st2, "had-2", 15, { damageType: "slashing" });
        });
      } catch (e) {
        if (e instanceof ReactionPrompt) caught = e;
        else throw e;
      }
      expect(caught).not.toBeNull();
      expect(caught!.prompt.reactorId).toBe("had-2");

      // Accepting reduces damage and consumes 1 reaction & 1 use
      const hadAccept = raceHero("Хадози", null, "had-2", 5, { hpMax: 40, hpCurrent: 40 });
      const stAccept = makeState([hadAccept]);
      runWithReactions({ decisions: { [caught!.prompt.key]: caught!.prompt.options[0].id }, seq: 0 }, 1, () => {
        dealDamage(stAccept, "had-2", 15, { damageType: "slashing" });
      });
      expect(hadAccept.hpCurrent).toBeGreaterThan(25);
      expect(hadAccept.reactionUsed).toBe(true);
      expect(bySrd(hadAccept, "race/hadozee/vertkost-khadozi").usesUsed).toBe(1);

      // Declining takes full 15 damage and keeps reaction + use
      const hadDecline = raceHero("Хадози", null, "had-2", 5, { hpMax: 40, hpCurrent: 40 });
      const stDecline = makeState([hadDecline]);
      runWithReactions({ decisions: { [caught!.prompt.key]: DECLINE }, seq: 0 }, 1, () => {
        dealDamage(stDecline, "had-2", 15, { damageType: "slashing" });
      });
      expect(hadDecline.hpCurrent).toBe(25);
      expect(hadDecline.reactionUsed).toBe(false);
      expect(bySrd(hadDecline, "race/hadozee/vertkost-khadozi").usesUsed).toBe(0);
    });
  });

  describe("24. Changeling (Чейнджлинг)", () => {
    it("builds cleanly with walk 30 and no hotbar clutter", () => {
      const ch = raceHero("Чейнджлинг", null, "ch-1", 3, { className: "" });
      expect(ch.raceId).toBe("changeling");
      expect(ch.speed).toBe(30);
      expect(ch.abilities.filter((a) => !a.parameters?.passive)).toEqual([]);
    });
  });

  describe("25. Shifter (Шифтер) + 4 Subraces", () => {
    it("Beasthide: +level+CON+1d6 temp HP and +1 AC while shifted", () => {
      const sh = raceHero("Шифтер", "Зверошкуры", "sh-bh", 4, {
        ac: 14,
        mods: { CON: 2 },
      });
      expect(sh.darkvision).toBe(60);
      const st = makeState([sh]);
      seqRandom(0.5);
      useAbility(st, "sh-bh", bySrd(sh, "race/shifter/smena-formy").id);
      expect(hasCondition(sh, "shifter_shifted")).toBe(true);
      expect(sh.hpTemp).toBe(10);
      expect(effectiveAC(sh)).toBe(15);
    });

    it("Longtooth: bonus bite 1d6+STR piercing while shifted", () => {
      const sh = raceHero("Шифтер", "Длиннозубы", "sh-lt", 3, {
        x: 5,
        y: 5,
        mods: { STR: 3, CON: 1 },
      });
      const foe = enemy("orc", 6, 5, { ac: 10, hpMax: 40, hpCurrent: 40 });
      const st = makeState([sh, foe]);
      const bite = bySrd(sh, "race/longtooth/osobennosti-smeny-formy");
      expect(() => useAbility(st, "sh-lt", bite.id, { targetIds: ["orc"] })).toThrow();

      useAbility(st, "sh-lt", bySrd(sh, "race/shifter/smena-formy").id);
      sh.bonusActionUsed = false;
      seqRandom(0.9, 0.5);
      useAbility(st, "sh-lt", bite.id, { targetIds: ["orc"] });
      expect(foe.hpCurrent).toBe(33);
    });

    it("Swiftstride: +10 speed while shifted + reaction move 10 ft without OA (+ReactionPrompt accept/decline)", () => {
      const sh = raceHero("Шифтер", "Быстроноги", "sh-sw", 3, {
        x: 5,
        y: 5,
        mods: { CON: 2 },
      });
      const foe = enemy("orc", 6, 5, { attacks: SURE_SWORD });
      const watcher = ally("watcher", 0, 0);
      const st = makeState([sh, foe, watcher]);
      useAbility(st, "sh-sw", bySrd(sh, "race/shifter/smena-formy").id);
      expect(effectiveSpeed(sh)).toBe(40);

      endTurn(st); // shifter -> orc turn
      endTurn(st); // orc ends turn within 5 ft -> Swiftstride moves shifter 10 ft away without OA
      expect(sh.reactionUsed).toBe(true);
      expect(Math.abs(sh.x - foe.x)).toBeGreaterThanOrEqual(2);
      expect(foe.reactionUsed).toBe(false);

      // ReactionPrompt path in runWithReactions
      const sh2 = raceHero("Шифтер", "Быстроноги", "sh-sw2", 3, { x: 5, y: 5 });
      const foe2 = enemy("orc2", 6, 5, { attacks: SURE_SWORD });
      const watcher2 = ally("watcher2", 0, 0);
      const st2 = makeState([foe2, watcher2, sh2]);
      applyEffect(st2, "sh-sw2", { condition: "shifter_shifted", durationRounds: 10 }, "sh-sw2");
      let caught: ReactionPrompt | null = null;
      try {
        runWithReactions({ decisions: {}, seq: 0 }, 1, () => {
          endTurn(st2);
        });
      } catch (e) {
        if (e instanceof ReactionPrompt) caught = e;
        else throw e;
      }
      expect(caught).not.toBeNull();
      expect(caught!.prompt.reactorId).toBe("sh-sw2");

      // Accepting moves shifter 10 ft away and spends reaction
      const shAcc = raceHero("Шифтер", "Быстроноги", "sh-sw2", 3, { x: 5, y: 5 });
      const foeAcc = enemy("orc2", 6, 5, { attacks: SURE_SWORD });
      const watcherAcc = ally("watcher2", 0, 0);
      const stAcc = makeState([foeAcc, watcherAcc, shAcc]);
      applyEffect(stAcc, "sh-sw2", { condition: "shifter_shifted", durationRounds: 10 }, "sh-sw2");
      runWithReactions({ decisions: { [caught!.prompt.key]: caught!.prompt.options[0].id }, seq: 0 }, 1, () => {
        endTurn(stAcc);
      });
      expect(shAcc.reactionUsed).toBe(true);
      expect(Math.abs(shAcc.x - foeAcc.x)).toBeGreaterThanOrEqual(2);
    });

    it("Wildhunt: prevents attackers within 30 ft from having advantage while shifted & conscious", () => {
      const sh = raceHero("Шифтер", "Дикие охотники", "sh-wh", 3, { x: 5, y: 5 });
      const nearFoe = enemy("orc-near", 7, 5, { conditions: [{ type: "vow_of_enmity" }] });
      const farFoe = enemy("orc-far", 15, 5, { conditions: [{ type: "vow_of_enmity" }] });
      const st = makeState([sh, nearFoe, farFoe]);

      expect(
        computeAttackAdvantage(nearFoe, sh, SURE_SWORD[0], { advantage: true }, { distanceFt: 10, allCombatants: st.combatants }).advantage
      ).toBe(true);

      useAbility(st, "sh-wh", bySrd(sh, "race/shifter/smena-formy").id);
      expect(
        computeAttackAdvantage(nearFoe, sh, SURE_SWORD[0], { advantage: true }, { distanceFt: 10, allCombatants: st.combatants }).advantage
      ).toBe(false);
      expect(
        computeAttackAdvantage(farFoe, sh, SURE_SWORD[0], { advantage: true }, { distanceFt: 50, allCombatants: st.combatants }).advantage
      ).toBe(true);

      applyEffect(st, "sh-wh", { condition: "incapacitated", durationRounds: 1 });
      expect(
        computeAttackAdvantage(nearFoe, sh, SURE_SWORD[0], { advantage: true }, { distanceFt: 10, allCombatants: st.combatants }).advantage
      ).toBe(true);
    });
  });

  describe("Batch 3 Completeness & Build Integrity", () => {
    it("covers every single trait of all 25 Batch 3 races & subraces in races-2014.json", () => {
      for (const raceId of BATCH_3_RACE_IDS) {
        const data = RACES_2014.find((r) => r.id === raceId)!;
        const rules = raceRules(raceId);
        expect(rules, `Missing defineRace("${raceId}")`).toBeDefined();

        for (const t of data.traits) {
          expect(rules!.traits[t.id], `${raceId} missing trait rule: ${t.id}`).toBeDefined();
        }
        for (const sub of data.subraces) {
          const subRules = rules!.subraces?.[sub.id];
          expect(subRules, `${raceId} missing subrace rules: ${sub.id}`).toBeDefined();
          for (const t of sub.traits) {
            expect(subRules!.traits[t.id], `${raceId}/${sub.id} missing trait rule: ${t.id}`).toBeDefined();
          }
        }
      }
    });

    it("every non-manual active Batch 3 race ability has a handler in class-kit", () => {
      for (const raceId of BATCH_3_RACE_IDS) {
        for (const { key, rule } of raceRuleKeys(raceId)) {
          if (rule.kind !== "active" || rule.manual) continue;
          expect(kitHandles(key), `Missing kit handler for ${key}`).toBe(true);
        }
      }
    });

    it("builds every Batch 3 race and every subrace cleanly at levels 1 and 20", () => {
      for (const raceId of BATCH_3_RACE_IDS) {
        const data = RACES_2014.find((r) => r.id === raceId)!;
        expect(() => raceHero(data.name, null, `b1_${raceId}`, 1)).not.toThrow();
        expect(() => raceHero(data.name, null, `b20_${raceId}`, 20)).not.toThrow();
        for (const sub of data.subraces) {
          expect(() => raceHero(data.name, sub.name, `s1_${raceId}_${sub.id}`, 1), `${raceId}/${sub.id} L1`).not.toThrow();
          expect(() => raceHero(data.name, sub.name, `s20_${raceId}_${sub.id}`, 20), `${raceId}/${sub.id} L20`).not.toThrow();
        }
      }
    });
  });
});
