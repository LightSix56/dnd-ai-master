import { describe, it, expect } from "vitest";
import {
  getAllSRDSpells,
  getAllCombatSpells,
  getSRDSpell,
  searchSRDSpells,
  getAllSRDMonsters,
  getSRDMonster,
  searchSRDMonsters,
  getAllSRDWeapons,
  getSRDWeapon,
  searchSRDWeapons,
} from "../srd/adapter";
import {
  SPELL_LIBRARY,
  ATTACK_LIBRARY,
  ABILITY_LIBRARY,
  getSpellDefinition,
  getAttackDefinition,
  getAbilityDefinition,
} from "../library-data";
import { DEFAULT_PRESETS, createCombatantFromPreset } from "../preset-data";

describe("D&D 5e SRD 5.1 Official Compendium", () => {
  describe("Spells (319 spells, 0-9 circle)", () => {
    it("Loads all 319 official SRD 5.1 spells across circles 0 to 9", () => {
      const spells = getAllSRDSpells();
      expect(spells.length).toBe(319);
      expect(getAllCombatSpells().length).toBeGreaterThanOrEqual(500);
      expect(SPELL_LIBRARY.length).toBeGreaterThanOrEqual(500);

      // Verify circles 0 to 9 exist
      for (let lvl = 0; lvl <= 9; lvl++) {
        const atLevel = spells.filter((s) => s.level === lvl);
        expect(atLevel.length).toBeGreaterThan(0);
      }
    });

    it("Finds spells by Russian and English names", () => {
      const fireballRu = getSRDSpell("Огненный шар");
      const fireballEn = getSRDSpell("Fireball");
      expect(fireballRu).toBeDefined();
      expect(fireballEn).toBeDefined();
      expect(fireballRu?.id).toBe(fireballEn?.id);
      expect(fireballRu?.level).toBe(3);
      expect(fireballRu?.school).toBe("Evocation");
      expect(fireballRu?.parameters.aoe?.shape).toBe("sphere");
      expect(fireballRu?.parameters.aoe?.size).toBe(20);

      // Shillelagh / Дубинка
      const shillelagh = getSpellDefinition("Дубинка");
      expect(shillelagh).toBeDefined();
      expect(shillelagh?.level).toBe(0);
      expect(shillelagh?.parameters.selfEffects?.[0].condition).toBe("shillelagh");
    });

    it("Filters spells by level, school and class", () => {
      const cantrips = searchSRDSpells("", { level: 0 });
      expect(cantrips.length).toBeGreaterThan(20);

      const evocationSpells = searchSRDSpells("", { school: "Evocation" });
      expect(evocationSpells.length).toBeGreaterThan(40);

      const wizardSpells = searchSRDSpells("", { className: "Wizard" });
      expect(wizardSpells.length).toBeGreaterThan(150);
    });

    it("Provides non-SRD expanded combat spells with accurate parameters", () => {
      // 1. Booming Blade / Громовой клинок
      const bbEn = getSRDSpell("Booming Blade");
      const bbRu = getSRDSpell("Громовой клинок");
      expect(bbEn).toBeDefined();
      expect(bbRu).toBeDefined();
      expect(bbEn?.name).toBe("Громовой клинок");
      expect(bbEn?.level).toBe(0);
      expect(bbEn?.school).toBe("Evocation");
      expect(bbEn?.parameters.actionCost).toBe("action");
      expect(bbEn?.parameters.range?.type).toBe("self");
      expect(bbEn?.parameters.range?.value).toBe(5);
      expect(bbEn?.parameters.damage?.[0]?.dice).toBe("1d8");
      expect(bbEn?.parameters.damage?.[0]?.type).toBe("thunder");

      const bbDef = getSpellDefinition("Booming Blade");
      expect(bbDef).toBeDefined();
      expect(bbDef?.name).toBe("Громовой клинок");

      // 2. Toll the Dead / Погребальный звон
      const tollEn = getSRDSpell("Toll the Dead");
      const tollRu = getSRDSpell("Погребальный звон");
      expect(tollEn).toBeDefined();
      expect(tollRu).toBeDefined();
      expect(tollEn?.level).toBe(0);
      expect(tollEn?.school).toBe("Necromancy");
      expect(tollEn?.parameters.actionCost).toBe("action");
      expect(tollEn?.parameters.range?.type).toBe("ranged");
      expect(tollEn?.parameters.range?.value).toBe(60);
      expect(tollEn?.parameters.damage?.[0]?.dice).toBe("1d12");
      expect(tollEn?.parameters.damage?.[0]?.type).toBe("necrotic");

      // 3. Absorb Elements / Поглощение стихий
      const absorbEn = getSRDSpell("Absorb Elements");
      const absorbRu = getSRDSpell("Поглощение стихий");
      expect(absorbEn).toBeDefined();
      expect(absorbRu).toBeDefined();
      expect(absorbEn?.level).toBe(1);
      expect(absorbEn?.school).toBe("Abjuration");
      expect(absorbEn?.parameters.actionCost).toBe("reaction");
      expect(absorbEn?.parameters.range?.type).toBe("self");
      expect(absorbEn?.parameters.damage?.[0]?.dice).toBe("1d6");
      expect(absorbEn?.parameters.damage?.[0]?.type).toBe("variable");

      // 4. Ice Knife / Ледяной кинжал
      const iceEn = getSRDSpell("Ice Knife");
      const iceRu = getSRDSpell("Ледяной кинжал");
      expect(iceEn).toBeDefined();
      expect(iceRu).toBeDefined();
      expect(iceEn?.level).toBe(1);
      expect(iceEn?.school).toBe("Conjuration");
      expect(iceEn?.parameters.actionCost).toBe("action");
      expect(iceEn?.parameters.range?.type).toBe("ranged");
      expect(iceEn?.parameters.range?.value).toBe(60);
      expect(iceEn?.parameters.damage).toHaveLength(2);
      expect(iceEn?.parameters.damage?.[0]?.dice).toBe("1d10");
      expect(iceEn?.parameters.damage?.[0]?.type).toBe("piercing");
      expect(iceEn?.parameters.damage?.[1]?.dice).toBe("2d6");
      expect(iceEn?.parameters.damage?.[1]?.type).toBe("cold");

      // 5. Synaptic Static / Синаптический разряд
      const synEn = getSRDSpell("Synaptic Static");
      const synRu = getSRDSpell("Синаптический разряд");
      expect(synEn).toBeDefined();
      expect(synRu).toBeDefined();
      expect(synEn?.level).toBe(5);
      expect(synEn?.school).toBe("Enchantment");
      expect(synEn?.parameters.actionCost).toBe("action");
      expect(synEn?.parameters.range?.type).toBe("ranged");
      expect(synEn?.parameters.range?.value).toBe(120);
      expect(synEn?.parameters.damage?.[0]?.dice).toBe("8d6");
      expect(synEn?.parameters.damage?.[0]?.type).toBe("psychic");
      expect(synEn?.parameters.damage?.[0]?.save).toBe("half");
    });
  });

  describe("Monsters & Bestiary (325+ official monsters, CR 0 - 30)", () => {
    it("Loads all official monsters and registers them in DEFAULT_PRESETS", () => {
      const monsters = getAllSRDMonsters();
      expect(monsters.length).toBeGreaterThanOrEqual(320);
      expect(DEFAULT_PRESETS.length).toBeGreaterThan(325);
    });

    it("Finds monsters by Russian and English names with accurate statblocks", () => {
      // Goblin
      const goblin = getSRDMonster("Гоблин") || getSRDMonster("Goblin");
      expect(goblin).toBeDefined();
      expect(goblin?.hpMax).toBe(7);
      expect(goblin?.ac).toBe(15);
      expect(goblin?.cr).toBe("0.25");
      expect(goblin?.attacks.length).toBeGreaterThan(0);

      // Ancient Red Dragon
      const dragon = getSRDMonster("Древний красный дракон") || getSRDMonster("Ancient Red Dragon");
      expect(dragon).toBeDefined();
      expect(dragon?.hpMax).toBe(546);
      expect(dragon?.ac).toBe(22);
      expect(dragon?.cr).toBe("24");
      expect(dragon?.size).toBe("gargantuan");
    });

    it("Converts SRD monster presets into playable Combatant instances", () => {
      const goblinPreset = getSRDMonster("Goblin");
      expect(goblinPreset).toBeDefined();

      const combatant = createCombatantFromPreset(goblinPreset!, { x: 5, y: 5 });
      expect(combatant.name).toContain("Гоблин");
      expect(combatant.x).toBe(5);
      expect(combatant.y).toBe(5);
      expect(combatant.hpCurrent).toBe(7);
      expect(combatant.hpMax).toBe(7);
      expect(combatant.isAIControlled).toBe(true);
      expect(combatant.attacks.length).toBeGreaterThan(0);
    });

    it("Filters monsters by CR, type and size", () => {
      const cr1 = searchSRDMonsters("", { cr: "1" });
      expect(cr1.length).toBeGreaterThan(10);

      const dragons = searchSRDMonsters("", { type: "dragon" });
      expect(dragons.length).toBeGreaterThan(20);
    });
  });

  describe("Weapons & Equipment (SRD 5.1)", () => {
    it("Loads all official weapons with accurate properties", () => {
      const weapons = getAllSRDWeapons();
      expect(weapons.length).toBeGreaterThanOrEqual(35);

      const rapier = getSRDWeapon("Рапира") || getSRDWeapon("Rapier");
      expect(rapier).toBeDefined();
      expect(rapier?.finesse).toBe(true);
      expect(rapier?.damage[0].dice).toBe("1d8");
      expect(rapier?.damage[0].type).toBe("piercing");

      const longsword = getAttackDefinition("Длинный меч");
      expect(longsword).toBeDefined();
      expect(longsword?.damage[0].dice).toBe("1d8");
    });
  });

  describe("Class Abilities & Aliases", () => {
    it("Resolves core class abilities", () => {
      const rage = getAbilityDefinition("rage");
      expect(rage).toBeDefined();
      expect(rage?.name).toBe("Ярость");

      const sneak = getAbilityDefinition("sneak_attack");
      expect(sneak).toBeDefined();
      expect(sneak?.name).toBe("Скрытая атака");

      const surge = getAbilityDefinition("action_surge");
      expect(surge).toBeDefined();
      expect(surge?.name).toBe("Порыв к действию");
    });
  });
});
