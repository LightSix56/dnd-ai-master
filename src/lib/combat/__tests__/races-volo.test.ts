import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyEffect,
  dealDamage,
  endTurn,
  performAttack,
  useAbility,
} from "../engine";
import { kitHandles } from "../class-kit";
import { modDamageImmunity, modResistance } from "../feature-mods";
import { DECLINE, ReactionPrompt, type ReactionContext } from "../reactions";
import { runWithReactions } from "../reaction-runtime";
import { RACES_2014, raceRuleKeys, raceRules } from "../races/race-defs";
import {
  computeAttackAdvantage,
  effectiveAC,
  effectiveSpeed,
  hasCondition,
  rollDeathSave,
  rollSave,
} from "../rules";
import { ally, bySrd, cond, enemy, makeState, raceHero } from "./helpers/race-harness";

import type { Combatant } from "../types";

const BATCH_2_RACE_IDS = [
  "aarakocra",
  "aasimar",
  "bugbear",
  "dhampir",
  "firbolg",
  "genasi",
  "gith",
  "goblin",
  "goliath",
  "hexblood",
  "hobgoblin",
  "kenku",
  "kobold",
  "lizardfolk",
  "orc",
  "reborn",
  "tabaxi",
  "triton",
  "yuan-ti-pureblood",
  "custom-lineage",
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

describe("Batch 2 Legacy Races (VGM / MTF / POA / TCE / VRGR)", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Aarakocra (Ааракокра)", () => {
    it("walk 25, fly 50, and Claws natural weapon 1d4 + STR slashing", () => {
      const a = raceHero("Ааракокра", null, "aar-1", 3, { mods: { STR: 2, DEX: 3 } });
      expect(a.raceId).toBe("aarakocra");
      expect(a.speed).toBe(25);
      expect(a.speeds?.fly).toBe(50);

      const claws = a.attacks.find((x) => x.id === "aarakocra_claws");
      expect(claws).toBeDefined();
      expect(claws!.name).toBe("Когти");
      expect(claws!.kind).toBe("melee");
      expect(claws!.range.normal).toBe(5);
      expect(claws!.attackBonus).toBe(2 + 2);
      expect(claws!.damage).toEqual([{ dice: "1d4", mod: 2, type: "slashing" }]);
    });
  });

  describe("2. Aasimar (Аасимар)", () => {
    it("Base: dv 60, radiant & necrotic resist, innate Light, Healing Hands heals level HP", () => {
      const a = raceHero("Аасимар", "Аасимар-защитник", "aas-1", 4, {
        x: 5,
        y: 5,
        hpMax: 30,
        hpCurrent: 15,
        mods: { CHA: 3 },
      });
      expect(a.darkvision).toBe(60);
      expect(modResistance(a, "radiant")).not.toBeNull();
      expect(modResistance(a, "necrotic")).not.toBeNull();
      expect(bySrd(a, "race/aasimar/innate/light").usesMax).toBe(0);

      const injured = ally("pal", 6, 5, { hpMax: 30, hpCurrent: 10 });
      const st = makeState([a, injured]);
      const hh = bySrd(a, "race/aasimar/istselyayushchie-ruki");
      expect(hh.usesMax).toBe(1);
      expect(hh.refresh).toBe("long");
      useAbility(st, "aas-1", hh.id, { targetIds: ["pal"] });
      expect(injured.hpCurrent).toBe(14);
      expect(hh.usesUsed).toBe(1);
    });

    it("Protector Aasimar lvl 3: Radiant Soul grants fly 30 + level radiant once/turn, restores fly on end", () => {
      const a = raceHero("Аасимар", "Аасимар-защитник", "aas-prot", 3, {
        x: 5,
        y: 5,
        mods: { STR: 3, CHA: 2 },
        attacks: SURE_SWORD,
      });
      const foe = enemy("orc", 6, 5, { ac: 10, hpMax: 60, hpCurrent: 60 });
      const st = makeState([a, foe]);

      const soul = bySrd(a, "race/protector-aasimar/siyayushchaya-dusha");
      useAbility(st, "aas-prot", soul.id);
      expect(hasCondition(a, "aasimar_radiant_soul")).toBe(true);
      expect(a.speeds?.fly).toBe(30);

      // First hit adds +3 radiant; second hit in same turn does NOT add again
      a.actionUsed = false;
      a.attacksPerAction = 2;
      seqRandom(0.5, 0.5); // d20=11, 1d8=5+3=8 + 3 radiant = 11
      const hit1 = performAttack(st, "aas-prot", "orc", "sword");
      expect(hit1.damage).toBe(11);

      seqRandom(0.5, 0.5);
      const hit2 = performAttack(st, "aas-prot", "orc", "sword");
      expect(hit2.damage).toBe(8);

      // Simulate stance expiry after 10 rounds -> fly speed cleaned up
      a.conditions = a.conditions.map((c) => (c.type === "aasimar_radiant_soul" ? { ...c, duration: 1 } : c));
      endTurn(st);
      expect(hasCondition(a, "aasimar_radiant_soul")).toBe(false);
      expect(a.speeds?.fly).toBeUndefined();
    });

    it("Scourge Aasimar lvl 3: Radiant Consumption deals ceil(level/2) radiant to self & foes in 10 ft + level radiant on hit", () => {
      const a = raceHero("Аасимар", "Аасимар-каратель", "aas-sc", 5, {
        x: 5,
        y: 5,
        hpMax: 40,
        hpCurrent: 40,
        attacks: SURE_SWORD,
      });
      const nearFoe = enemy("near", 6, 5, { hpMax: 40, hpCurrent: 40, ac: 10 });
      const farFoe = enemy("far", 12, 5, { hpMax: 40, hpCurrent: 40, ac: 10 });
      const st = makeState([a, nearFoe, farFoe]);

      useAbility(st, "aas-sc", bySrd(a, "race/scourge-aasimar/ispuskanie-siyaniya").id);
      expect(hasCondition(a, "aasimar_radiant_consumption")).toBe(true);

      a.actionUsed = false;
      seqRandom(0.5, 0.5); // 1d8=5+3=8 + 5 radiant = 13
      const hit = performAttack(st, "aas-sc", "near", "sword");
      expect(hit.damage).toBe(13);

      // End turn: ceil(5/2) = 3 radiant to all in 10 ft (a has radiant resistance -> floor(3/2)=1)
      endTurn(st);
      expect(nearFoe.hpCurrent).toBe(40 - 13 - 3);
      expect(farFoe.hpCurrent).toBe(40);
      expect(a.hpCurrent).toBe(39);
    });

    it("Fallen Aasimar lvl 3: Necrotic Shroud frightens foes in 10 ft on failed CHA save + adds level necrotic", () => {
      const a = raceHero("Аасимар", "Падший аасимар", "aas-fal", 4, {
        x: 5,
        y: 5,
        mods: { CHA: 3 },
        attacks: SURE_SWORD,
      });
      const foe = enemy("orc", 6, 5, { hpMax: 50, hpCurrent: 50, ac: 10, saves: { CHA: { prof: false, mod: -1 } } });
      const st = makeState([a, foe]);

      seqRandom(0.05); // foe fails CHA save
      useAbility(st, "aas-fal", bySrd(a, "race/fallen-aasimar/savan-smerti").id);
      expect(hasCondition(a, "aasimar_necrotic_shroud")).toBe(true);
      expect(hasCondition(foe, "frightened")).toBe(true);

      a.actionUsed = false;
      seqRandom(0.5, 0.5); // 8 + 4 necrotic = 12
      const hit = performAttack(st, "aas-fal", "orc", "sword");
      expect(hit.damage).toBe(12);
    });
  });

  describe("3. Bugbear (Багбир)", () => {
    it("Long-Limbed grants +5 melee reach; Surprise Attack adds 2d6 once/combat in round 1", () => {
      const b = raceHero("Багбир", null, "bug-1", 3, { x: 5, y: 5, attacks: SURE_SWORD });
      expect(b.darkvision).toBe(60);
      const foe = enemy("orc", 7, 5, { ac: 10, hpMax: 50, hpCurrent: 50 }); // 10 ft away!
      const st = makeState([b, foe]);

      // Normal 5 ft melee weapon hits at 10 ft because of Long-Limbed
      b.attacksPerAction = 2;
      seqRandom(0.5, 0.5, 0.5, 0.5); // 1d8=5+3=8 + 2d6(4+4=8) = 16
      const hit1 = performAttack(st, "bug-1", "orc", "sword");
      expect(hit1.hit).toBe(true);
      expect(hit1.damage).toBe(16);
      expect(hit1.text).toContain("Внезапное нападение");

      // Second attack in combat does NOT get Surprise Attack again
      seqRandom(0.5, 0.5);
      const hit2 = performAttack(st, "bug-1", "orc", "sword");
      expect(hit2.damage).toBe(8);
    });
  });

  describe("4. Dhampir (Дампир)", () => {
    it("walk 35, climb 35, dv 60, Spider Climb lvl 1, Vampire Bite 1d4+CON + empowerment heals on hit", () => {
      const d = raceHero("Дампир", null, "dh-1", 1, {
        x: 5,
        y: 5,
        hpMax: 30,
        hpCurrent: 20,
        mods: { CON: 3, STR: 0 },
      });
      expect(d.speed).toBe(35);
      expect(d.speeds?.climb).toBe(35);
      expect(d.darkvision).toBe(60);
      expect(bySrd(d, "race/dhampir/pauche-lazanie")).toBeDefined();

      const bite = d.attacks.find((a) => a.id === "dhampir_bite");
      expect(bite).toBeDefined();
      expect(bite!.attackBonus).toBe(3 + 2);
      expect(bite!.damage).toEqual([{ dice: "1d4", mod: 3, type: "piercing" }]);

      const emp = bySrd(d, "race/dhampir/ukus-vampira");
      expect(emp.usesMax).toBe(2);
      expect(emp.refresh).toBe("long");

      const foe = enemy("orc", 6, 5, { ac: 10, hpMax: 40, hpCurrent: 40 });
      const st = makeState([d, foe]);
      useAbility(st, "dh-1", emp.id);
      seqRandom(0.9, 0.5); // hit, 1d4=3+3=6 piercing -> heals 6 HP
      const atk = performAttack(st, "dh-1", "orc", bite!.id);
      expect(atk.hit).toBe(true);
      expect(atk.damage).toBe(6);
      expect(d.hpCurrent).toBe(26);
      expect(emp.usesUsed).toBe(1);
    });
  });

  describe("5. Firbolg (Фирболг)", () => {
    it("Firbolg Magic (1/short) + Hidden Step makes invisible until startTurn or attack", () => {
      const f = raceHero("Фирболг", null, "fb-1", 3, { mods: { WIS: 3 }, attacks: SURE_SWORD });
      const dm = bySrd(f, "race/firbolg/innate/detect-magic");
      const ds = bySrd(f, "race/firbolg/innate/disguise-self");
      expect(dm.refresh).toBe("short");
      expect(ds.refresh).toBe("short");

      const foe = enemy("orc", 6, 5, { ac: 10, hpMax: 40, hpCurrent: 40 });
      const st = makeState([f, foe]);
      const hs = bySrd(f, "race/firbolg/nezrimaya-postup");
      expect(hs.refresh).toBe("short");
      useAbility(st, "fb-1", hs.id);
      expect(hasCondition(f, "invisible")).toBe(true);

      // Persists across foe's turn, expires at start of Firbolg's next turn
      endTurn(st);
      expect(hasCondition(f, "invisible")).toBe(true);
      endTurn(st);
      expect(hasCondition(f, "invisible")).toBe(false);

      // Attacking breaks Hidden Step invisibility
      hs.usesUsed = 0;
      useAbility(st, "fb-1", hs.id);
      expect(hasCondition(f, "invisible")).toBe(true);
      performAttack(st, "fb-1", "orc", "sword");
      expect(hasCondition(f, "invisible")).toBe(false);
    });
  });

  describe("6. Genasi (Дженази)", () => {
    it("Air, Earth, Fire, Water Genasi expose exact speeds, resistances, dv, and innate spells", () => {
      const air = raceHero("Дженази", "Дженази воздуха", "g-air", 1, { mods: { CON: 2 } });
      expect(bySrd(air, "race/genasi/innate/levitate").usesMax).toBe(1);

      const earth = raceHero("Дженази", "Дженази земли", "g-earth", 1, { mods: { CON: 2 } });
      expect(bySrd(earth, "race/genasi/innate/pass-without-trace").usesMax).toBe(1);

      const fire = raceHero("Дженази", "Дженази огня", "g-fire", 3, { mods: { CON: 3 } });
      expect(fire.darkvision).toBe(60);
      expect(modResistance(fire, "fire")).not.toBeNull();
      expect(bySrd(fire, "race/genasi/innate/produce-flame").usesMax).toBe(0);
      expect(bySrd(fire, "race/genasi/innate/burning-hands").usesMax).toBe(1);

      const water = raceHero("Дженази", "Дженази воды", "g-water", 3, { mods: { CON: 2 } });
      expect(water.speeds?.swim).toBe(30);
      expect(modResistance(water, "acid")).not.toBeNull();
      expect(bySrd(water, "race/genasi/innate/create-or-destroy-water").usesMax).toBe(1);
    });
  });

  describe("7. Gith (Гит)", () => {
    it("Githzerai mental save adv + spells; Githyanki psionic spells", () => {
      const gz = raceHero("Гит", "Гитцераи", "gz-1", 5, { mods: { WIS: 3 } });
      expect(rollSave(gz, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);
      expect(rollSave(gz, "WIS", 15, { condition: "frightened" }).advantage).toBe(true);
      expect(bySrd(gz, "race/gith/innate/mage-hand").usesMax).toBe(0);
      expect(bySrd(gz, "race/gith/innate/shield").usesMax).toBe(1);
      expect(bySrd(gz, "race/gith/innate/detect-thoughts").usesMax).toBe(1);

      const gy = raceHero("Гит", "Гитъянки", "gy-1", 5, { mods: { INT: 2 } });
      expect(bySrd(gy, "race/gith/innate/mage-hand").usesMax).toBe(0);
      expect(bySrd(gy, "race/gith/innate/jump").usesMax).toBe(1);
      expect(bySrd(gy, "race/gith/innate/misty-step").usesMax).toBe(1);
    });
  });

  describe("8. Goblin (Гоблин)", () => {
    it("Small, dv 60, Fury of the Small (+level vs larger only), Nimble Escape Disengage & Hide; Dankwood has no duplicates", () => {
      const gob = raceHero("Гоблин", null, "gob-1", 4, { x: 5, y: 5, attacks: SURE_SWORD });
      expect(gob.size).toBe("small");
      expect(gob.darkvision).toBe(60);

      const smallFoe = enemy("imp", 6, 5, { size: "small", ac: 10, hpMax: 40, hpCurrent: 40 });
      const medFoe = enemy("orc", 5, 6, { size: "medium", ac: 10, hpMax: 40, hpCurrent: 40 });
      const st = makeState([gob, smallFoe, medFoe]);

      const fury = bySrd(gob, "race/goblin/razyarennaya-melkota");
      expect(fury.refresh).toBe("short");
      useAbility(st, "gob-1", fury.id);

      // Attack against small foe does NOT trigger or spend Fury of the Small
      gob.attacksPerAction = 2;
      seqRandom(0.5, 0.5);
      const hitSmall = performAttack(st, "gob-1", "imp", "sword");
      expect(hitSmall.damage).toBe(8);
      expect(fury.usesUsed).toBe(0);

      // Attack against medium foe adds +4 damage and spends Fury
      seqRandom(0.5, 0.5);
      const hitMed = performAttack(st, "gob-1", "orc", "sword");
      expect(hitMed.damage).toBe(12);
      expect(fury.usesUsed).toBe(1);

      // Nimble Escape: Disengage bonus action
      const dis = bySrd(gob, "race/goblin/nimble-disengage");
      useAbility(st, "gob-1", dis.id);
      expect(hasCondition(gob, "disengaging")).toBe(true);
      expect(gob.bonusActionUsed).toBe(true);

      // Dankwood Goblin has no duplicate Nimble Escape buttons
      const dank = raceHero("Гоблин", "Гоблины Данквуда", "gob-dw", 2);
      expect(dank.abilities.filter((a) => a.parameters?.srdKey === "race/goblin/nimble-disengage")).toHaveLength(1);
    });
  });

  describe("9. Goliath (Голиаф)", () => {
    it("Cold resist + Stone's Endurance reduces damage by 1d12+CON via reaction & ReactionPrompt", () => {
      const gol = raceHero("Голиаф", null, "gol-1", 3, {
        hpMax: 40,
        hpCurrent: 40,
        mods: { CON: 3 },
      });
      expect(modResistance(gol, "cold")).not.toBeNull();
      const se = bySrd(gol, "race/goliath/vynoslivost-kamnya");
      expect(se.usesMax).toBe(1);
      expect(se.refresh).toBe("short");
      expect(se.parameters?.offTurn).toBe(true);

      const st = makeState([gol]);
      // 1d12 (0.5 -> 7) + 3 CON = 10 reduction on 15 incoming damage -> takes 5
      seqRandom(0.5);
      dealDamage(st, "gol-1", 15, { damageType: "slashing" });
      expect(gol.hpCurrent).toBe(35);
      expect(gol.reactionUsed).toBe(true);
      expect(se.usesUsed).toBe(1);

      // ReactionPrompt path in runWithReactions
      const gol2 = raceHero("Голиаф", null, "gol-2", 3, { hpMax: 40, hpCurrent: 40, mods: { CON: 3 } });
      const st2 = makeState([gol2]);
      let caught: ReactionPrompt | null = null;
      const ctx: ReactionContext = { decisions: {}, seq: 0 };
      try {
        runWithReactions(ctx, 1, () => {
          dealDamage(st2, "gol-2", 15, { damageType: "slashing" });
        });
      } catch (e) {
        if (e instanceof ReactionPrompt) caught = e;
        else throw e;
      }
      expect(caught).not.toBeNull();
      expect(caught!.prompt.reactorId).toBe("gol-2");

      // Declining takes full 15 damage and keeps reaction + use
      const golDecline = raceHero("Голиаф", null, "gol-2", 3, { hpMax: 40, hpCurrent: 40, mods: { CON: 3 } });
      const stDecline = makeState([golDecline]);
      runWithReactions({ decisions: { [caught!.prompt.key]: DECLINE }, seq: 0 }, 1, () => {
        dealDamage(stDecline, "gol-2", 15, { damageType: "slashing" });
      });
      expect(golDecline.hpCurrent).toBe(25);
      expect(golDecline.reactionUsed).toBe(false);
      expect(bySrd(golDecline, "race/goliath/vynoslivost-kamnya").usesUsed).toBe(0);
    });
  });

  describe("10. Hexblood (Ведьмовская кровь)", () => {
    it("dv 60 and Hex Magic innate Disguise Self + Hex (CHA 1/long)", () => {
      const h = raceHero("Ведьмовская кровь", null, "hex-1", 3, { mods: { CHA: 3 } });
      expect(h.darkvision).toBe(60);
      expect(bySrd(h, "race/hexblood/innate/disguise-self").usesMax).toBe(1);
      expect(bySrd(h, "race/hexblood/innate/hex").usesMax).toBe(1);
    });
  });

  describe("11. Hobgoblin (Хобгоблин)", () => {
    it("dv 60 and Saving Face adds +min(5, alliesWithin30ft) to turn failed save into success", () => {
      const hob = raceHero("Хобгоблин", null, "hob-1", 3, {
        x: 5,
        y: 5,
        saves: { WIS: { prof: false, mod: 1 } },
      });
      expect(hob.darkvision).toBe(60);
      const sf = bySrd(hob, "race/hobgoblin/sokhranit-litso");
      expect(sf.usesMax).toBe(1);
      expect(sf.refresh).toBe("short");

      const a1 = ally("a1", 6, 5);
      const a2 = ally("a2", 7, 5);
      const a3 = ally("a3", 8, 5);
      const farAlly = ally("far", 20, 5);
      const mage = enemy("mage", 6, 6, {
        abilities: [
          {
            id: "hold",
            name: "Паралич",
            usesMax: 0,
            usesUsed: 0,
            refresh: "none",
            parameters: {
              name: "Паралич",
              type: "spell",
              actionCost: "action",
              targeting: "creature",
              range: { type: "ranged", value: 60 },
              saveType: "WIS",
              saveDC: 14,
              effects: [{ condition: "paralyzed", durationRounds: 1 }],
            },
          },
        ],
      });
      const st = makeState([mage, hob, a1, a2, a3, farAlly]);

      // d20 = 11 (0.5) + 1 WIS = 12 < 14 (fails by 2) -> 3 allies in 30 ft add +3 -> 15 >= 14 (SUCCESS!)
      seqRandom(0.5);
      const out = useAbility(st, "mage", "hold", { targetIds: ["hob-1"] });
      expect(out.targets[0]?.saved).toBe(true);
      expect(hasCondition(hob, "paralyzed")).toBe(false);
      expect(sf.usesUsed).toBe(1);
    });
  });

  describe("12. Kenku (Кенку)", () => {
    it("builds cleanly with walk 30 and no hotbar clutter", () => {
      const k = raceHero("Кенку", null, "ken-1", 5, { className: "" });
      expect(k.raceId).toBe("kenku");
      expect(k.speed).toBe(30);
      expect(k.abilities.filter((a) => !a.parameters?.passive)).toEqual([]);
    });
  });

  describe("13. Kobold (Кобольд)", () => {
    it("Small, dv 60, Pack Tactics gives advantage near conscious ally; Grovel/Cower/Beg gives allies advantage until end of next turn", () => {
      const kob = raceHero("Кобольд", null, "kob-1", 3, { x: 5, y: 5, attacks: SURE_SWORD });
      expect(kob.size).toBe("small");
      expect(kob.darkvision).toBe(60);

      const allyNear = ally("a1", 7, 5);
      const foe = enemy("orc", 6, 5, { ac: 10 });
      const st = makeState([kob, allyNear, foe]);

      // Pack Tactics: allyNear is 5 ft from foe
      const advWithAlly = computeAttackAdvantage(kob, foe, SURE_SWORD[0], {}, { allCombatants: st.combatants });
      expect(advWithAlly.advantage).toBe(true);

      // Without conscious ally within 5 ft -> no Pack Tactics advantage
      allyNear.hpCurrent = 0;
      const advWithoutAlly = computeAttackAdvantage(kob, foe, SURE_SWORD[0], {}, { allCombatants: st.combatants });
      expect(advWithoutAlly.advantage).toBe(false);

      // Grovel, Cower, and Beg: ally gets advantage, kobold does NOT; expires at end of kobold's next turn
      allyNear.hpCurrent = 20;
      allyNear.x = 12;
      const gcb = bySrd(kob, "race/kobold/sklonis-sezhsya-i-umolyay");
      expect(gcb.refresh).toBe("short");
      useAbility(st, "kob-1", gcb.id);
      expect(hasCondition(foe, "kobold_cower")).toBe(true);

      expect(computeAttackAdvantage(allyNear, foe, SURE_SWORD[0], {}, { allCombatants: st.combatants }).advantage).toBe(true);
      expect(computeAttackAdvantage(kob, foe, SURE_SWORD[0], {}, { allCombatants: st.combatants }).advantage).toBe(false);

      // End kobold turn 1 -> still active through ally & foe turns
      endTurn(st);
      expect(hasCondition(foe, "kobold_cower")).toBe(true);
      endTurn(st); // ally
      endTurn(st); // foe
      expect(hasCondition(foe, "kobold_cower")).toBe(true);
      // End kobold turn 2 -> expires
      endTurn(st);
      expect(hasCondition(foe, "kobold_cower")).toBe(false);
    });
  });

  describe("14. Lizardfolk (Людоящер)", () => {
    it("swim 30, Bite 1d6+STR, Natural Armor 13+DEX in effectiveAC, Hungry Jaws bonus bite grants temp HP", () => {
      const liz = raceHero("Людоящер", null, "liz-1", 3, {
        x: 5,
        y: 5,
        ac: 10,
        mods: { STR: 3, DEX: 3, CON: 2 },
      });
      expect(liz.speeds?.swim).toBe(30);
      expect(effectiveAC(liz)).toBe(16);

      const bite = liz.attacks.find((a) => a.id === "lizardfolk_bite");
      expect(bite).toBeDefined();
      expect(bite!.damage).toEqual([{ dice: "1d6", mod: 3, type: "piercing" }]);

      const foe = enemy("orc", 6, 5, { ac: 10, hpMax: 40, hpCurrent: 40 });
      const st = makeState([liz, foe]);
      const hj = bySrd(liz, "race/lizardfolk/golodnaya-past");
      expect(hj.refresh).toBe("short");
      seqRandom(0.9, 0.5);
      useAbility(st, "liz-1", hj.id, { targetIds: ["orc"] });
      expect(liz.bonusActionUsed).toBe(true);
      expect(liz.hpTemp).toBe(2);
      expect(foe.hpCurrent).toBeLessThan(40);
    });
  });

  describe("15. Orc (Орк)", () => {
    it("dv 60 and Aggressive bonus action moves toward enemy up to full speed; RLW/EGW have no duplicate Aggressive", () => {
      const orc = raceHero("Орк", null, "orc-1", 2, { x: 2, y: 5 });
      expect(orc.darkvision).toBe(60);
      const foe = enemy("elf", 10, 5);
      const st = makeState([orc, foe]);

      const agg = bySrd(orc, "race/orc/agressivnyy");
      useAbility(st, "orc-1", agg.id, { targetIds: ["elf"] });
      expect(orc.bonusActionUsed).toBe(true);
      expect(orc.x).toBeGreaterThan(2);
      expect(orc.movementUsed).toBe(0);

      const ebw = raceHero("Орк", "Orc (Eberron)", "orc-e", 2);
      expect(ebw.abilities.filter((a) => a.name.includes("Агрессивный"))).toHaveLength(1);
    });
  });

  describe("16. Reborn (Возрождённый)", () => {
    it("poison resist, poisoned save adv, magical sleep immune, death save adv, Past Life uses = profBonus", () => {
      const reb = raceHero("Возрождённый", null, "reb-1", 5);
      expect(modResistance(reb, "poison")).not.toBeNull();
      expect(rollSave(reb, "CON", 15, { condition: "poisoned" }).advantage).toBe(true);

      const st = makeState([reb]);
      applyEffect(st, "reb-1", { condition: "unconscious", durationRounds: 10, isMagicalSleep: true });
      expect(hasCondition(reb, "unconscious")).toBe(false);

      seqRandom(0.0, 0.8);
      const ds = rollDeathSave(reb);
      expect(ds.roll.natural).toBe(17);
      expect(ds.success).toBe(true);

      const know = bySrd(reb, "race/reborn/znaniya-iz-proshloy-zhizni");
      expect(know.usesMax).toBe(3);
      expect(know.refresh).toBe("long");
    });
  });

  describe("17. Tabaxi (Табакси)", () => {
    it("dv 60, climb 20, Claws 1d4+STR, Feline Agility doubles speed and recharges only when movementUsed === 0", () => {
      const tab = raceHero("Табакси", null, "tab-1", 3, { mods: { STR: 2 } });
      expect(tab.darkvision).toBe(60);
      expect(tab.speeds?.climb).toBe(20);
      expect(tab.attacks.find((a) => a.id === "tabaxi_claws")?.damage).toEqual([
        { dice: "1d4", mod: 2, type: "slashing" },
      ]);

      const st = makeState([tab]);
      const fa = bySrd(tab, "race/tabaxi/koshache-provorstvo");
      useAbility(st, "tab-1", fa.id);
      expect(hasCondition(tab, "feline_agility")).toBe(true);
      expect(effectiveSpeed(tab)).toBe(60);
      expect(fa.usesUsed).toBe(1);

      // Moved 30 ft on this turn -> endTurn does NOT recharge
      tab.movementUsed = 30;
      endTurn(st);
      expect(hasCondition(tab, "feline_agility")).toBe(false);
      expect(fa.usesUsed).toBe(1);

      // Next turn: move 0 ft -> endTurn recharges!
      endTurn(st);
      expect(fa.usesUsed).toBe(0);
    });
  });

  describe("18. Triton (Тритон)", () => {
    it("dv 60, swim 30, cold resist, Control Air and Water spells from lvl 1/3/5", () => {
      const t1 = raceHero("Тритон", null, "tr-1", 1, { mods: { CHA: 3 } });
      expect(t1.darkvision).toBe(60);
      expect(t1.speeds?.swim).toBe(30);
      expect(modResistance(t1, "cold")).not.toBeNull();
      expect(bySrd(t1, "race/triton/innate/fog-cloud").usesMax).toBe(1);

      const t5 = raceHero("Тритон", null, "tr-5", 5, { mods: { CHA: 3 } });
      expect(bySrd(t5, "race/triton/innate/gust-of-wind").usesMax).toBe(1);
      expect(bySrd(t5, "race/triton/innate/wall-of-water").usesMax).toBe(1);
    });
  });

  describe("19. Yuan-Ti Pureblood (Юань-ти)", () => {
    it("dv 60, Magic Resistance, Poison damage & poisoned condition immunity, innate spells from lvl 1", () => {
      const yt = raceHero("Юань-ти", null, "yt-1", 1, { hpMax: 30, hpCurrent: 30, mods: { CHA: 3 } });
      expect(yt.darkvision).toBe(60);
      expect(modDamageImmunity(yt, "poison")).not.toBeNull();
      expect(bySrd(yt, "race/yuan-ti-pureblood/innate/poison-spray").usesMax).toBe(0);
      expect(bySrd(yt, "race/yuan-ti-pureblood/innate/animal-friendship").usesMax).toBe(0);

      for (const ab of ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const) {
        expect(rollSave(yt, ab, 15, { isSpell: true }).advantage).toBe(true);
      }

      const st = makeState([yt]);
      dealDamage(st, "yt-1", 20, { damageType: "poison" });
      expect(yt.hpCurrent).toBe(30);
      applyEffect(st, "yt-1", { condition: "poisoned", durationRounds: 5 });
      expect(hasCondition(yt, "poisoned")).toBe(false);

      const yt3 = raceHero("Юань-ти", null, "yt-3", 3, { mods: { CHA: 3 } });
      expect(bySrd(yt3, "race/yuan-ti-pureblood/innate/suggestion").usesMax).toBe(1);
    });
  });

  describe("20. Custom Lineage (Своё происхождение)", () => {
    it("supports flexible size and darkvision-60 option via sheet/variants", () => {
      const clPlain = raceHero("Своё происхождение", null, "cl-0", 1, {
        sheet: { size: "Маленький", traitsList: [{ id: "skill-prof", name: "Владение навыком" }] },
      });
      expect(clPlain.size).toBe("small");
      expect(clPlain.darkvision).toBe(0);

      const clDv = raceHero("Своё происхождение", null, "cl-dv", 1, {
        sheet: { traitsList: [{ id: "darkvision-60", name: "Тёмное зрение" }] },
      });
      expect(clDv.size).toBe("medium");
      expect(clDv.darkvision).toBe(60);
    });
  });

  describe("Batch 2 Completeness & Build Integrity", () => {
    it("covers every single trait of all 20 Batch 2 races & subraces in races-2014.json", () => {
      for (const raceId of BATCH_2_RACE_IDS) {
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

    it("every non-manual active Batch 2 race ability has a handler in class-kit", () => {
      for (const raceId of BATCH_2_RACE_IDS) {
        for (const { key, rule } of raceRuleKeys(raceId)) {
          if (rule.kind !== "active" || rule.manual) continue;
          expect(kitHandles(key), `Missing kit handler for ${key}`).toBe(true);
        }
      }
    });

    it("builds every Batch 2 race and every subrace cleanly at levels 1 and 20", () => {
      for (const raceId of BATCH_2_RACE_IDS) {
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
