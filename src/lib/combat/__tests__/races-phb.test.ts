import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rollD20 } from "@/lib/dnd/dice";
import {
  applyEffect,
  dealDamage,
  endTurn,
  performAttack,
  useAbility,
} from "../engine";
import { kitHandles } from "../class-kit";
import { modResistance } from "../feature-mods";
import { DECLINE, ReactionPrompt, type ReactionContext } from "../reactions";
import { runWithReactions } from "../reaction-runtime";
import { RACES_2014, raceRuleKeys, raceRules } from "../races/race-defs";
import { hasCondition, rollDeathSave, rollSave } from "../rules";
import { ally, bySrd, cond, enemy, hasLog, makeState, raceHero } from "./helpers/race-harness";

import type { Combatant } from "../types";

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

const PHB_RACE_IDS = [
  "human",
  "dwarf",
  "elf",
  "halfling",
  "dragonborn",
  "gnome",
  "half-elf",
  "half-orc",
  "tiefling",
] as const;

function seqRandom(...values: number[]) {
  let idx = 0;
  return vi.spyOn(Math, "random").mockImplementation(() => {
    const v = values[idx] ?? values[values.length - 1] ?? 0.5;
    idx += 1;
    return v;
  });
}

describe("PHB 2014 Races & Subraces (core-phb)", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Human (Человек)", () => {
    it("Standard & Variant Human build cleanly without hotbar clutter", () => {
      const std = raceHero("Человек", "Стандартный человек", "h-std", 1, { className: "" });
      const varH = raceHero("Человек", "Человек (Вариантный)", "h-var", 5, { className: "" });
      expect(std.raceId).toBe("human");
      expect(std.speed).toBe(30);
      expect(std.abilities.filter((a) => !a.parameters?.passive)).toEqual([]);
      expect(varH.subraceId).toBe("variant-human");
      expect(varH.abilities.filter((a) => !a.parameters?.passive)).toEqual([]);
    });

    it("Mark of Passage: walk 35 ft + innate Misty Step (1/long)", () => {
      const h = raceHero("Человек", "Метка прохода", "h-pass", 3, { mods: { DEX: 3 } });
      expect(h.speed).toBe(35);
      const misty = bySrd(h, "race/human/innate/misty-step");
      expect(misty.usesMax).toBe(1);
      expect(misty.refresh).toBe("long");
    });

    it("Mark of Making: innate Mending (lvl 1) and Magic Weapon (lvl 3, 1/long)", () => {
      const h1 = raceHero("Человек", "Метка создания", "h-mak1", 1, { mods: { INT: 3 } });
      expect(h1.abilities.some((a) => a.parameters?.srdKey === "race/human/innate/mending")).toBe(true);
      expect(h1.abilities.some((a) => a.parameters?.srdKey === "race/human/innate/magic-weapon")).toBe(false);

      const h3 = raceHero("Человек", "Метка создания", "h-mak3", 3, { mods: { INT: 3 } });
      const mw = bySrd(h3, "race/human/innate/magic-weapon");
      expect(mw.usesMax).toBe(1);
      expect(mw.refresh).toBe("long");
    });

    it("Mark of Finding & Mark of Handling expose their innate spells", () => {
      const finding = raceHero("Человек", "Метка поиска", "h-find", 3, { mods: { WIS: 2 } });
      expect(finding.darkvision).toBe(60);
      expect(bySrd(finding, "race/human/innate/hunters-mark").usesMax).toBe(1);
      expect(bySrd(finding, "race/human/innate/locate-object").usesMax).toBe(1);

      const handling = raceHero("Человек", "Метка ухода", "h-hand", 1, { mods: { WIS: 2 } });
      expect(bySrd(handling, "race/human/innate/animal-friendship").usesMax).toBe(1);
      expect(bySrd(handling, "race/human/innate/speak-with-animals").usesMax).toBe(1);
    });

    it("Mark of Sentinel: innate Shield + Vigilant Guardian swaps places and redirects attack (auto & ReactionPrompt)", () => {
      const guardian = raceHero("Человек", "Метка стража", "guard", 3, {
        x: 5,
        y: 5,
        ac: 18,
        hpMax: 40,
        hpCurrent: 40,
        mods: { WIS: 2 },
      });
      expect(bySrd(guardian, "race/human/innate/shield").usesMax).toBe(1);
      const vg = bySrd(guardian, "race/mark-of-sentinel/bditelnyy-strazh");
      expect(vg.parameters?.offTurn).toBe(true);
      expect(vg.usesMax).toBe(1);

      const friend = ally("wiz", 6, 5, { ac: 11, hpMax: 20, hpCurrent: 20 });
      const orc = enemy("orc", 7, 5, {
        attacks: [
          {
            id: "club",
            name: "Дубина",
            kind: "melee",
            range: { normal: 5 },
            attackBonus: 6,
            damage: [{ dice: "1d8", mod: 3, type: "bludgeoning" }],
            actionCost: "action",
          },
        ],
      });
      const state = makeState([orc, guardian, friend]);

      // Attack hits friend (0.9 -> d20 19), guardian intercepts, swaps to (6,5) and takes the hit
      seqRandom(0.9, 0.5);
      performAttack(state, "orc", "wiz", "club");
      expect(guardian.x).toBe(6);
      expect(friend.x).toBe(5);
      expect(friend.hpCurrent).toBe(20);
      expect(guardian.hpCurrent).toBeLessThan(40);
      expect(guardian.reactionUsed).toBe(true);
      expect(vg.usesUsed).toBe(1);

      // With ReactionPrompt in runWithReactions: prompts player first, then accepts when decided
      const guard2 = raceHero("Человек", "Метка стража", "guard2", 3, {
        x: 5,
        y: 5,
        ac: 18,
        hpMax: 40,
        hpCurrent: 40,
      });
      const friend2 = ally("wiz2", 6, 5, { ac: 5, hpMax: 20, hpCurrent: 20 });
      const orc2 = enemy("orc2", 7, 5, { attacks: SURE_SWORD });
      const state2 = makeState([orc2, guard2, friend2]);

      let caughtPrompt: ReactionPrompt | null = null;
      const ctxAsk: ReactionContext = { decisions: {}, seq: 0 };
      try {
        runWithReactions(ctxAsk, 1, () => {
          performAttack(state2, "orc2", "wiz2", "sword");
        });
      } catch (e) {
        if (e instanceof ReactionPrompt) caughtPrompt = e;
        else throw e;
      }
      expect(caughtPrompt).not.toBeNull();
      expect(caughtPrompt!.prompt.reactorId).toBe("guard2");

      // Declining leaves friend2 to take the hit and keeps guard2's reaction intact
      const stateDecline = makeState([
        enemy("orc2", 7, 5, { attacks: SURE_SWORD }),
        raceHero("Человек", "Метка стража", "guard2", 3, { x: 5, y: 5, hpMax: 40, hpCurrent: 40 }),
        ally("wiz2", 6, 5, { ac: 5, hpMax: 20, hpCurrent: 20 }),
      ]);
      runWithReactions({ decisions: { [caughtPrompt!.prompt.key]: DECLINE }, seq: 0 }, 1, () => {
        performAttack(stateDecline, "orc2", "wiz2", "sword");
      });
      expect(stateDecline.require("guard2").hpCurrent).toBe(40);
      expect(stateDecline.require("guard2").reactionUsed).toBe(false);
    });
  });

  describe("2. Dwarf (Дварф)", () => {
    it("Base Dwarf: walk 25, darkvision 60, poison resistance & Save Ends poisoned advantage in endTurn", () => {
      const d = raceHero("Дварф", "Горный дварф", "dw-1", 4, { hpMax: 30, hpCurrent: 30 });
      expect(d.raceId).toBe("dwarf");
      expect(d.speed).toBe(25);
      expect(d.darkvision).toBe(60);
      expect(modResistance(d, "poison")).not.toBeNull();

      const state = makeState([d]);
      dealDamage(state, "dw-1", 10, { damageType: "poison" });
      expect(d.hpCurrent).toBe(25);

      applyEffect(state, "dw-1", { condition: "poisoned", saveType: "CON", saveDC: 15, durationRounds: 3 });
      // endTurn calls rollSave with condition: "poisoned" -> advantage picks 19 over 1
      seqRandom(0.0, 0.9);
      endTurn(state);
      expect(hasCondition(d, "poisoned")).toBe(false);
    });

    it("Hill Dwarf: Dwarven Toughness featureValue === level", () => {
      const hill = raceHero("Дварф", "Холмовой дварф", "dw-hill", 7);
      const toughness = bySrd(hill, "race/hill-dwarf/dvarfiyskaya-vyderzhka");
      expect(toughness.parameters?.featureValue).toBe(7);
    });

    it("Duergar: darkvision 120, charmed/paralyzed/poisoned save adv, Enlarge lvl 3 & Invisibility lvl 5", () => {
      const du = raceHero("Дварф", "Дуэргар", "dw-du", 5, { mods: { INT: 2 } });
      expect(du.darkvision).toBe(120);
      expect(rollSave(du, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);
      expect(rollSave(du, "CON", 15, { condition: "paralyzed" }).advantage).toBe(true);
      expect(rollSave(du, "CON", 15, { condition: "poisoned" }).advantage).toBe(true);
      expect(bySrd(du, "race/dwarf/innate/enlarge-reduce").usesMax).toBe(1);
      expect(bySrd(du, "race/dwarf/innate/invisibility").usesMax).toBe(1);

      const du2 = raceHero("Дварф", "Дуэргар", "dw-du2", 2);
      expect(du2.abilities.some((a) => a.parameters?.srdKey === "race/dwarf/innate/enlarge-reduce")).toBe(false);
    });

    it("Mark of Warding: Mage Armor lvl 1 & Arcane Lock lvl 3", () => {
      const w = raceHero("Дварф", "Метка опеки", "dw-ward", 3, { mods: { INT: 2 } });
      expect(bySrd(w, "race/dwarf/innate/mage-armor").usesMax).toBe(1);
      expect(bySrd(w, "race/dwarf/innate/arcane-lock").usesMax).toBe(1);
    });
  });

  describe("3. Elf (Эльф)", () => {
    it("Fey Ancestry grants charmed save advantage & blocks magical sleep, allows normal unconscious", () => {
      const e = raceHero("Эльф", "Высший эльф", "elf-hi", 3, { mods: { INT: 3 } });
      expect(e.darkvision).toBe(60);
      expect(rollSave(e, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);
      expect(bySrd(e, "race/elf/innate/ray-of-frost").usesMax).toBe(0);

      const mage = enemy("mage", 6, 5);
      const state = makeState([mage, e]);
      applyEffect(state, "elf-hi", { condition: "unconscious", durationRounds: 10, isMagicalSleep: true }, "mage");
      expect(hasCondition(e, "unconscious")).toBe(false);
      applyEffect(state, "elf-hi", { condition: "unconscious", durationRounds: 1 }, "mage");
      expect(hasCondition(e, "unconscious")).toBe(true);
    });

    it("Wood Elf walk 35, Sea Elf swim 30, Drow dv 120 + spells, Pallid Elf spells, Mark of Shadow spells", () => {
      const wood = raceHero("Эльф", "Лесной эльф", "e-wood", 1);
      expect(wood.speed).toBe(35);

      const sea = raceHero("Эльф", "Морской эльф", "e-sea", 1);
      expect(sea.speeds?.swim).toBe(30);

      const drow = raceHero("Эльф", "Тёмный эльф (дроу)", "e-drow", 5, { mods: { CHA: 3 } });
      expect(drow.darkvision).toBe(120);
      expect(bySrd(drow, "race/elf/innate/dancing-lights").usesMax).toBe(0);
      expect(bySrd(drow, "race/elf/innate/faerie-fire").usesMax).toBe(1);
      expect(bySrd(drow, "race/elf/innate/darkness").usesMax).toBe(1);

      const pallid = raceHero("Эльф", "Бледный эльф", "e-pal", 5, { mods: { WIS: 2 } });
      expect(bySrd(pallid, "race/elf/innate/light").usesMax).toBe(0);
      expect(bySrd(pallid, "race/elf/innate/sleep").usesMax).toBe(1);
      expect(bySrd(pallid, "race/elf/innate/invisibility").usesMax).toBe(1);

      const shadow = raceHero("Эльф", "Метка тени", "e-shad", 5, { mods: { CHA: 2 } });
      expect(bySrd(shadow, "race/elf/innate/minor-illusion").usesMax).toBe(0);
      expect(bySrd(shadow, "race/elf/innate/invisibility").usesMax).toBe(1);
      expect(bySrd(shadow, "race/elf/innate/pass-without-trace").usesMax).toBe(1);
    });

    it("Shadar-kai: necrotic resist, teleport at lvl 1, all-damage resist for 1 round from lvl 3", () => {
      const sk1 = raceHero("Эльф", "Шадар-кай", "sk1", 1, { x: 2, y: 2 });
      expect(modResistance(sk1, "necrotic")).not.toBeNull();
      const step1 = bySrd(sk1, "race/shadar-kai/blagoslovenie-korolevy-voronov");
      const st1 = makeState([sk1]);
      useAbility(st1, "sk1", step1.id, { center: { x: 6, y: 2 } });
      expect(sk1.x).toBe(6);
      expect(hasCondition(sk1, "raven_queen_blessing")).toBe(false);

      const sk3 = raceHero("Эльф", "Шадар-кай", "sk3", 3, { x: 2, y: 2, hpMax: 30, hpCurrent: 30 });
      const foe = enemy("orc", 7, 2);
      const st3 = makeState([sk3, foe]);
      const step3 = bySrd(sk3, "race/shadar-kai/blagoslovenie-korolevy-voronov");
      useAbility(st3, "sk3", step3.id, { center: { x: 6, y: 2 } });
      expect(sk3.x).toBe(6);
      expect(hasCondition(sk3, "raven_queen_blessing")).toBe(true);

      // End Shadar-kai's turn -> resistance persists through enemy turn until start of Shadar-kai's next turn
      endTurn(st3);
      dealDamage(st3, "sk3", 10, { damageType: "slashing" });
      expect(sk3.hpCurrent).toBe(25);

      endTurn(st3); // foe turn ends -> sk3 turn starts -> blessing expires
      expect(hasCondition(sk3, "raven_queen_blessing")).toBe(false);
    });

    it("Eladrin: Fey Step 1/short + lvl 3 seasonal riders (Autumn, Winter, Spring, Summer)", () => {
      // Autumn: up to 2 enemies within 10 ft of arrival save WIS or charmed
      const autumn = raceHero("Эльф", "Эладрин", "el-aut", 3, { x: 1, y: 1, mods: { CHA: 3 }, racialVariants: ["osen"] });
      const f1 = enemy("f1", 6, 1, { saves: { WIS: { prof: false, mod: -1 } } });
      const f2 = enemy("f2", 7, 2, { saves: { WIS: { prof: false, mod: -1 } } });
      const stAut = makeState([autumn, f1, f2]);
      seqRandom(0.05, 0.05);
      const stepAut = bySrd(autumn, "race/eladrin/feyskiy-shag");
      expect(stepAut.refresh).toBe("short");
      useAbility(stAut, "el-aut", stepAut.id, { center: { x: 5, y: 1 } });
      expect(autumn.x).toBe(5);
      expect(hasCondition(f1, "charmed")).toBe(true);
      expect(hasCondition(f2, "charmed")).toBe(true);

      // Winter: 1 enemy within 5 ft of origin saves WIS or frightened
      const winter = raceHero("Эльф", "Эладрин", "el-win", 3, { x: 2, y: 2, mods: { CHA: 3 }, racialVariants: ["zima"] });
      const fw = enemy("fw", 3, 2, { saves: { WIS: { prof: false, mod: -1 } } });
      const stWin = makeState([winter, fw]);
      seqRandom(0.05);
      useAbility(stWin, "el-win", bySrd(winter, "race/eladrin/feyskiy-shag").id, { center: { x: 7, y: 2 } });
      expect(winter.x).toBe(7);
      expect(hasCondition(fw, "frightened")).toBe(true);

      // Spring: teleport willing ally within 5 ft instead of self
      const spring = raceHero("Эльф", "Эладрин", "el-spr", 3, { x: 2, y: 2, racialVariants: ["vesna"] });
      const pal = ally("pal", 3, 2);
      const stSpr = makeState([spring, pal]);
      useAbility(stSpr, "el-spr", bySrd(spring, "race/eladrin/feyskiy-shag").id, {
        targetIds: ["pal"],
        center: { x: 7, y: 2 },
      });
      expect(spring.x).toBe(2);
      expect(pal.x).toBe(7);

      // Summer: enemies within 5 ft of arrival take max(1, CHA) fire damage
      const summer = raceHero("Эльф", "Эладрин", "el-sum", 3, { x: 1, y: 1, mods: { CHA: 3 }, racialVariants: ["leto"] });
      const fs = enemy("fs", 7, 1, { hpMax: 20, hpCurrent: 20 });
      const stSum = makeState([summer, fs]);
      useAbility(stSum, "el-sum", bySrd(summer, "race/eladrin/feyskiy-shag").id, { center: { x: 6, y: 1 } });
      expect(fs.hpCurrent).toBe(17);
    });
  });

  describe("4. Halfling (Полурослик)", () => {
    it("Lucky rerolls 1 on d20 (attack, save, rollDeathSave); Brave gives frightened save adv including endTurn", () => {
      const h = raceHero("Полурослик", "Легконогий", "hf-1", 3);
      expect(h.size).toBe("small");
      expect(h.speed).toBe(25);

      // rollD20 & rollDeathSave reroll 1 once
      seqRandom(0.0, 0.7);
      const ds = rollDeathSave(h);
      expect(ds.roll.natural).toBe(15);
      expect(ds.success).toBe(true);

      // Save reroll 1
      seqRandom(0.0, 0.8);
      const sv = rollSave(h, "DEX", 15);
      expect(sv.roll.natural).toBe(17);
      expect(sv.success).toBe(true);

      // Attack reroll 1
      const foe = enemy("orc", 6, 5, { ac: 14 });
      const state = makeState([h, foe]);
      seqRandom(0.0, 0.6, 0.5);
      const atk = performAttack(state, "hf-1", "orc", h.attacks[0].id);
      expect(atk.hit).toBe(true);

      // Brave frightened advantage in endTurn
      applyEffect(state, "hf-1", { condition: "frightened", saveType: "WIS", saveDC: 15, durationRounds: 2 });
      seqRandom(0.0, 0.9);
      endTurn(state);
      expect(hasCondition(h, "frightened")).toBe(false);
    });

    it("Stout, Lotusden, Mark of Healing, Mark of Hospitality", () => {
      const stout = raceHero("Полурослик", "Коренастый", "hf-st", 1);
      expect(modResistance(stout, "poison")).not.toBeNull();
      expect(rollSave(stout, "CON", 15, { condition: "poisoned" }).advantage).toBe(true);

      const lotus = raceHero("Полурослик", "Лотосденский полурослик", "hf-lot", 5, { mods: { WIS: 2 } });
      expect(bySrd(lotus, "race/halfling/innate/druidcraft").usesMax).toBe(0);
      expect(bySrd(lotus, "race/halfling/innate/entangle").usesMax).toBe(1);
      expect(bySrd(lotus, "race/halfling/innate/spike-growth").usesMax).toBe(1);

      const healH = raceHero("Полурослик", "Метка исцеления", "hf-heal", 3, { mods: { WIS: 3 } });
      expect(bySrd(healH, "race/halfling/innate/cure-wounds").usesMax).toBe(1);
      expect(bySrd(healH, "race/halfling/innate/lesser-restoration").usesMax).toBe(1);

      const hosp = raceHero("Полурослик", "Метка гостеприимства", "hf-hosp", 3);
      expect(bySrd(hosp, "race/halfling/innate/aid").usesMax).toBe(1);
    });
  });

  describe("5. Dragonborn (Драконорождённый)", () => {
    it("PHB Dragonborn: ancestry resistance + Breath Weapon 2d6 (lvl 1) -> 3d6 (lvl 6) cone/line half-on-save", () => {
      const db1 = raceHero("Драконорождённый", null, "db1", 1, {
        x: 2,
        y: 2,
        mods: { CON: 2 },
        racialVariants: ["draconic-red"],
        hpMax: 30,
        hpCurrent: 30,
      });
      expect(db1.damageResistances).toContain("fire");
      expect(modResistance(db1, "fire")).not.toBeNull();

      const bw1 = bySrd(db1, "race/dragonborn/oruzhie-dykhaniya");
      expect(bw1.usesMax).toBe(1);
      expect(bw1.refresh).toBe("short");
      expect(bw1.parameters?.saveDC).toBe(12);
      expect(bw1.parameters?.description).toContain("2d6");

      const fFail = enemy("f-fail", 3, 2, { hpMax: 30, hpCurrent: 30, saves: { DEX: { prof: false, mod: -2 } } });
      const fPass = enemy("f-pass", 4, 2, { hpMax: 30, hpCurrent: 30, saves: { DEX: { prof: false, mod: 10 } } });
      const st = makeState([db1, fFail, fPass]);
      // Roll breath damage 2d6 (0.5, 0.5 -> 4+4=8), fFail rolls low (0.05), fPass rolls high (0.9)
      seqRandom(0.5, 0.5, 0.05, 0.9);
      useAbility(st, "db1", bw1.id, { center: { x: 4, y: 2 } });
      expect(fFail.hpCurrent).toBe(22);
      expect(fPass.hpCurrent).toBe(26);

      // Level 6 scales to 3d6; blue dragon uses 30-ft line DEX
      const db6 = raceHero("Драконорождённый", null, "db6", 6, {
        mods: { CON: 2 },
        racialVariants: ["draconic-blue"],
      });
      expect(modResistance(db6, "lightning")).not.toBeNull();
      expect(bySrd(db6, "race/dragonborn/oruzhie-dykhaniya").parameters?.description).toContain("3d6");
    });

    it("Ravenite: darkvision 60 & Vengeful Assault reaction attack (auto & ReactionPrompt)", () => {
      const rav = raceHero("Драконорождённый", "Равенит", "rav1", 3, {
        x: 5,
        y: 5,
        hpMax: 40,
        hpCurrent: 40,
      });
      expect(rav.darkvision).toBe(60);
      const va = bySrd(rav, "race/ravenite/mstitelnoe-napadenie");
      expect(va.parameters?.offTurn).toBe(true);
      expect(va.refresh).toBe("short");

      const foe = enemy("orc", 6, 5, { ac: 12, hpMax: 30, hpCurrent: 30 });
      const st = makeState([foe, rav]);
      // Orc hits rav (0.9 -> 19), orc damage (0.5), then rav reaction attack hits orc (0.9 -> 19), rav damage (0.5)
      seqRandom(0.9, 0.5, 0.9, 0.5);
      performAttack(st, "orc", "rav1", "sword");
      expect(rav.reactionUsed).toBe(true);
      expect(va.usesUsed).toBe(1);
      expect(foe.hpCurrent).toBeLessThan(30);

      // ReactionPrompt path via runWithReactions
      const rav2 = raceHero("Драконорождённый", "Равенит", "rav2", 3, { x: 5, y: 5, ac: 5, hpMax: 40, hpCurrent: 40 });
      const foe2 = enemy("orc2", 6, 5, { ac: 12, hpMax: 30, hpCurrent: 30, attacks: SURE_SWORD });
      const st2 = makeState([foe2, rav2]);
      let prompt: ReactionPrompt | null = null;
      try {
        runWithReactions({ decisions: {}, seq: 0 }, 1, () => {
          performAttack(st2, "orc2", "rav2", "sword");
        });
      } catch (e) {
        if (e instanceof ReactionPrompt) prompt = e;
        else throw e;
      }
      expect(prompt).not.toBeNull();
      expect(prompt!.prompt.reactorId).toBe("rav2");

      // Accepting prompt executes reaction attack (use seed 1 where attacker hits)
      const rav3 = raceHero("Драконорождённый", "Равенит", "rav3", 3, { x: 5, y: 5, ac: 5, hpMax: 40, hpCurrent: 40 });
      const foe3 = enemy("orc3", 6, 5, { ac: 12, hpMax: 30, hpCurrent: 30, attacks: SURE_SWORD });
      const st3 = makeState([foe3, rav3]);
      let prompt3: ReactionPrompt | null = null;
      try {
        runWithReactions({ decisions: {}, seq: 0 }, 1, () => {
          performAttack(st3, "orc3", "rav3", "sword");
        });
      } catch (e) {
        if (e instanceof ReactionPrompt) prompt3 = e;
      }
      expect(prompt3).not.toBeNull();
      const rav3Accept = raceHero("Драконорождённый", "Равенит", "rav3", 3, { x: 5, y: 5, ac: 5, hpMax: 40, hpCurrent: 40 });
      const foe3Accept = enemy("orc3", 6, 5, { ac: 12, hpMax: 30, hpCurrent: 30, attacks: SURE_SWORD });
      const st3Accept = makeState([foe3Accept, rav3Accept]);
      runWithReactions(
        { decisions: { [prompt3!.prompt.key]: prompt3!.prompt.options[0].id }, seq: 0 },
        1,
        () => {
          performAttack(st3Accept, "orc3", "rav3", "sword");
        }
      );
      expect(rav3Accept.reactionUsed).toBe(true);
    });

    it("Chromatic, Metallic, Gem Dragonborn (FTD): no duplicate breath, profBonus/long, lvl 5 features", () => {
      // Chromatic: line breath + lvl 5 Chromatic Warding immunity
      const chrom = raceHero("Драконорождённый", "Цветные драконорождённые", "ch5", 5, {
        racialVariants: ["chromatic-red"],
        hpMax: 40,
        hpCurrent: 40,
      });
      expect(chrom.abilities.filter((a) => a.name.includes("Оружие дыхания"))).toHaveLength(1);
      expect(bySrd(chrom, "race/chromatic-dragonborn/oruzhie-dykhaniya").usesMax).toBe(3);
      const ward = bySrd(chrom, "race/chromatic-dragonborn/zashchita-tsvetnogo-drakona");
      const stC = makeState([chrom]);
      useAbility(stC, "ch5", ward.id);
      expect(hasCondition(chrom, "chromatic_warding")).toBe(true);
      dealDamage(stC, "ch5", 20, { damageType: "fire" });
      expect(chrom.hpCurrent).toBe(40); // immune!

      // Metallic: Enervating & Repulsion breath share 1/long pool
      const met = raceHero("Драконорождённый", "Металлические драконорождённые", "mt5", 5, {
        x: 2,
        y: 2,
        mods: { CON: 3 },
        racialVariants: ["metallic-gold"],
      });
      const fMet = enemy("f-met", 3, 2, { saves: { CON: { prof: false, mod: -2 }, STR: { prof: false, mod: -2 } } });
      const stM = makeState([met, fMet]);
      seqRandom(0.05);
      useAbility(stM, "mt5", bySrd(met, "race/metallic-dragonborn/metallic-repulsion").id, {
        center: { x: 4, y: 2 },
      });
      expect(fMet.x).toBe(7); // pushed 20 ft (4 cells)
      expect(hasCondition(fMet, "prone")).toBe(true);
      // Enervating cannot be used now because shared pool is spent
      met.actionUsed = false;
      expect(() =>
        useAbility(stM, "mt5", bySrd(met, "race/metallic-dragonborn/metallic-enervating").id, {
          center: { x: 4, y: 2 },
        })
      ).toThrow();

      // Gem: psychic resist + lvl 5 Gem Flight grants speeds.fly = walk
      const gem = raceHero("Драконорождённый", "Самоцветные драконорождённые", "gm5", 5, {
        racialVariants: ["gem-emerald"],
      });
      expect(modResistance(gem, "psychic")).not.toBeNull();
      const stG = makeState([gem]);
      useAbility(stG, "gm5", bySrd(gem, "race/gem-dragonborn/polet-samotsvetnogo-drakona").id);
      expect(hasCondition(gem, "gem_flight")).toBe(true);
      expect(gem.speeds?.fly).toBe(30);
    });
  });

  describe("6. Gnome (Гном)", () => {
    it("Gnome Cunning grants INT/WIS/CHA magic save adv; Forest Minor Illusion, Deep dv 120", () => {
      const fg = raceHero("Гном", "Лесной гном", "gn-f", 1, { mods: { INT: 3 } });
      expect(fg.size).toBe("small");
      expect(fg.speed).toBe(25);
      expect(fg.darkvision).toBe(60);
      expect(bySrd(fg, "race/gnome/innate/minor-illusion").usesMax).toBe(0);

      for (const ab of ["INT", "WIS", "CHA"] as const) {
        expect(rollSave(fg, ab, 15, { isSpell: true }).advantage).toBe(true);
        expect(rollSave(fg, ab, 15, { isMagical: true }).advantage).toBe(true);
      }
      expect(rollSave(fg, "DEX", 15, { isSpell: true }).advantage).toBe(false);
      expect(rollSave(fg, "WIS", 15, { isSpell: false, isMagical: false }).advantage).toBe(false);

      const dg = raceHero("Гном", "Глубинный гном", "gn-d", 1);
      expect(dg.darkvision).toBe(120);

      const sc = raceHero("Гном", "Метка письма", "gn-s", 5);
      expect(bySrd(sc, "race/gnome/innate/silence").usesMax).toBe(1);
    });
  });

  describe("7. Half-Elf (Полуэльф)", () => {
    it("Fey Ancestry + Faerun swim/Drow magic + Mark of Storm lightning resist & Gust of Wind + Mark of Detection", () => {
      const he = raceHero("Полуэльф", "Полуэльф Фаэруна", "he-f", 5, { mods: { CHA: 2 } });
      expect(he.darkvision).toBe(60);
      expect(he.speeds?.swim).toBe(30);
      expect(rollSave(he, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);
      expect(bySrd(he, "race/half-elf/innate/faerie-fire").usesMax).toBe(1);
      expect(bySrd(he, "race/half-elf/innate/darkness").usesMax).toBe(1);

      const storm = raceHero("Полуэльф", "Метка бури", "he-st", 3);
      expect(modResistance(storm, "lightning")).not.toBeNull();
      expect(bySrd(storm, "race/half-elf/innate/gust-of-wind").usesMax).toBe(1);

      const det = raceHero("Полуэльф", "Метка обнаружения", "he-det", 5);
      expect(bySrd(det, "race/half-elf/innate/detect-magic").usesMax).toBe(1);
      expect(bySrd(det, "race/half-elf/innate/see-invisibility").usesMax).toBe(1);
    });
  });

  describe("8. Half-Orc (Полуорк)", () => {
    it("Relentless Endurance drops to 1 HP once/long unless instant death; Savage Attacks adds 1 die on melee crit", () => {
      const ho = raceHero("Полуорк", null, "ho-1", 4, { hpMax: 20, hpCurrent: 12 });
      expect(ho.darkvision).toBe(60);
      const st = makeState([ho]);

      // 15 damage from 12 HP -> 0 HP, Relentless Endurance -> 1 HP
      dealDamage(st, "ho-1", 15, { damageType: "slashing" });
      expect(ho.hpCurrent).toBe(1);
      const re = bySrd(ho, "race/half-orc/nepokolebimaya-stoykost");
      expect(re.usesUsed).toBe(1);

      // Second drop without long rest -> drops to 0 HP
      dealDamage(st, "ho-1", 5, { damageType: "slashing" });
      expect(ho.hpCurrent).toBe(0);

      // Instant death check (amount - hpBefore >= hpMax) bypasses Relentless Endurance
      const hoInst = raceHero("Полуорк", null, "ho-inst", 4, { hpMax: 20, hpCurrent: 10 });
      const stInst = makeState([hoInst]);
      dealDamage(stInst, "ho-inst", 30, { damageType: "slashing" });
      expect(hoInst.hpCurrent).toBe(0);
      expect(bySrd(hoInst, "race/half-orc/nepokolebimaya-stoykost").usesUsed).toBe(0);

      // Savage Attacks: melee crit adds 1 extra weapon die (1d8)
      const hoAtk = raceHero("Полуорк", null, "ho-atk", 4, {
        x: 5,
        y: 5,
        mods: { STR: 3 },
        attacks: [
          {
            id: "greataxe",
            name: "Секира",
            kind: "melee",
            range: { normal: 5 },
            attackBonus: 5,
            damage: [{ dice: "1d12", mod: 3, type: "slashing" }],
            actionCost: "action",
          },
          {
            id: "bow",
            name: "Длинный лук",
            kind: "ranged",
            range: { normal: 150, long: 600 },
            attackBonus: 5,
            damage: [{ dice: "1d8", mod: 2, type: "piercing" }],
            actionCost: "action",
          },
        ],
      });
      const dummy = enemy("dummy", 6, 5, { hpMax: 100, hpCurrent: 100, ac: 10 });
      const stAtk = makeState([hoAtk, dummy]);
      // Melee crit: nat 20 (0.95), crit 2d12 (0.5 -> 7 each = 14 + 3 = 17), Savage Attacks 1d12 (0.5 -> 7) => 24
      seqRandom(0.95, 0.5, 0.5, 0.5);
      const meleeCrit = performAttack(stAtk, "ho-atk", "dummy", "greataxe");
      expect(meleeCrit.crit).toBe(true);
      expect(meleeCrit.damage).toBe(24);
      expect(meleeCrit.text).toContain("Свирепые атаки");

      // Ranged crit does NOT trigger Savage Attacks
      hoAtk.actionUsed = false;
      hoAtk.attacksMadeThisAction = 0;
      dummy.x = 10;
      seqRandom(0.95, 0.5, 0.5);
      const rangedCrit = performAttack(stAtk, "ho-atk", "dummy", "bow");
      expect(rangedCrit.crit).toBe(true);
      expect(rangedCrit.text).not.toContain("Свирепые атаки");
    });
  });

  describe("9. Tiefling (Тифлинг)", () => {
    it("Base & Asmodeus: fire resist + Thaumaturgy/Hellish Rebuke/Darkness without duplication", () => {
      for (const sub of [null, "Асмодей"] as const) {
        const t = raceHero("Тифлинг", sub, `t-${sub ?? "base"}`, 5, { mods: { CHA: 3 } });
        expect(modResistance(t, "fire")).not.toBeNull();
        expect(t.abilities.filter((a) => a.parameters?.srdKey === "race/tiefling/innate/thaumaturgy")).toHaveLength(1);
        expect(t.abilities.filter((a) => a.parameters?.srdKey === "race/tiefling/innate/hellish-rebuke")).toHaveLength(1);
        expect(t.abilities.filter((a) => a.parameters?.srdKey === "race/tiefling/innate/darkness")).toHaveLength(1);
        expect(bySrd(t, "race/tiefling/innate/hellish-rebuke").parameters?.offTurn).toBe(true);
      }
    });

    it("MTF bloodlines replace Infernal Legacy with exact 1/3/5 spells", () => {
      const lev = raceHero("Тифлинг", "Левистус", "t-lev", 5, { mods: { CHA: 3 } });
      expect(bySrd(lev, "race/tiefling/innate/ray-of-frost").usesMax).toBe(0);
      expect(bySrd(lev, "race/tiefling/innate/armor-of-agathys").usesMax).toBe(1);
      expect(bySrd(lev, "race/tiefling/innate/darkness").usesMax).toBe(1);
      expect(lev.abilities.some((a) => a.parameters?.srdKey === "race/tiefling/innate/hellish-rebuke")).toBe(false);

      const zar = raceHero("Тифлинг", "Зариэль", "t-zar", 5, { mods: { CHA: 3 } });
      expect(bySrd(zar, "race/tiefling/innate/thaumaturgy").usesMax).toBe(0);
      expect(bySrd(zar, "race/tiefling/innate/searing-smite").usesMax).toBe(1);
      expect(bySrd(zar, "race/tiefling/innate/branding-smite").usesMax).toBe(1);

      const mam = raceHero("Тифлинг", "Маммон", "t-mam", 5);
      expect(bySrd(mam, "race/tiefling/innate/floating-disk").usesMax).toBe(1);
      expect(bySrd(mam, "race/tiefling/innate/arcane-lock").usesMax).toBe(1);

      const fierna = raceHero("Тифлинг", "Фьёрна", "t-fie", 5);
      const friends = bySrd(fierna, "race/tiefling/innate/friends");
      expect(friends.name).toBe("Дружба");
      expect(friends.parameters?.spellSlotLevel).toBeNull();
      expect(bySrd(fierna, "race/tiefling/innate/charm-person").usesMax).toBe(1);
      expect(bySrd(fierna, "race/tiefling/innate/suggestion").usesMax).toBe(1);
    });

    it("Winged Tiefling & Tiefling Faerun: fly 30 + Burning Hands lvl 3", () => {
      const winged = raceHero("Тифлинг", "Крылатый тифлинг (SCAG)", "t-wing", 5);
      expect(winged.speeds?.fly).toBe(30);
      expect(winged.abilities.some((a) => a.parameters?.srdKey?.includes("/innate/"))).toBe(false);

      const faerun = raceHero("Тифлинг", "Тифлинг Фаэруна", "t-fae", 3);
      expect(faerun.speeds?.fly).toBe(30);
      expect(bySrd(faerun, "race/tiefling/innate/burning-hands").usesMax).toBe(1);
    });
  });

  describe("PHB Completeness & Build Integrity", () => {
    it("covers every single trait of all 9 PHB races & their subraces in races-2014.json", () => {
      for (const raceId of PHB_RACE_IDS) {
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

    it("every non-manual active PHB race ability has a handler in class-kit", () => {
      for (const raceId of PHB_RACE_IDS) {
        for (const { key, rule } of raceRuleKeys(raceId)) {
          if (rule.kind !== "active" || rule.manual) continue;
          expect(kitHandles(key), `Missing kit handler for ${key}`).toBe(true);
        }
      }
    });

    it("builds every PHB race and every subrace cleanly at levels 1 and 20", () => {
      for (const raceId of PHB_RACE_IDS) {
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

  // Ensure rollD20 helper import stays exercised cleanly
  it("supports direct rollD20 rerollOnes smoke check", () => {
    seqRandom(0.0, 0.5);
    expect(rollD20(0, "normal", false, { rerollOnes: true }).natural).toBe(11);
    expect(hasLog).toBeTypeOf("function");
  });
});
