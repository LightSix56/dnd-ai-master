import { describe, it, expect } from "vitest";
import {
  castSpell,
  dealDamage,
  moveCombatant,
  performAttack,
} from "../engine";
import { getSpellDefinition, cantripDiceMultiplier } from "../library-data";
import { getSRDSpell } from "../srd/adapter";
import type { Combatant, Cell } from "../types";

function createCombatState(combatants: Combatant[]) {
  return {
    combatants,
    mapElements: [],
    round: 1,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    log: [] as any[],
    gridWidth: 30,
    gridHeight: 30,
    dirtyIds: new Set<string>(),
    isCombatDirty: false,
    require(id: string) {
      const c = this.combatants.find((x: any) => x.id === id);
      if (!c) throw new Error("Not found: " + id);
      return c;
    },
    get(id: string) {
      return this.combatants.find((x: any) => x.id === id);
    },
    mark(id: string) {
      this.dirtyIds.add(id);
    },
    markCombat() {
      this.isCombatDirty = true;
    },
    addLog(text: string, kind: string, actor: string) {
      this.log.push({ round: this.round, text, kind, actor });
    },
    current() {
      return this.combatants[this.currentTurnIndex] || this.combatants[0];
    },
  };
}

function createCaster(id: string, name: string, x: number, y: number, level: number = 5): Combatant {
  return {
    id,
    name,
    type: "player",
    color: "#8b5cf6",
    x,
    y,
    facing: "E",
    hpCurrent: 35,
    hpMax: 35,
    hpTemp: 0,
    ac: 15,
    speed: 30,
    initiative: 15,
    initiativeTiebreak: 15,
    dexMod: 2,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "Колдун / Клирик",
    level,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: [
      {
        id: "caster_sword",
        name: "Длинный меч",
        kind: "melee",
        range: { normal: 5 },
        attackBonus: 5,
        damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
        actionCost: "action",
      },
    ],
    spells: {
      slots: {
        1: { max: 4, used: 0 },
        2: { max: 3, used: 0 },
        3: { max: 3, used: 0 },
        4: { max: 2, used: 0 },
        5: { max: 2, used: 0 },
      },
      known: [],
      spellcastingAbility: "CHA",
      spellSaveDC: 15,
      spellAttackBonus: 7,
    },
    abilities: [],
    concentration: null,
    saves: {
      STR: { prof: true, mod: 3 },
      DEX: { prof: false, mod: 2 },
      CON: { prof: true, mod: 4 },
      INT: { prof: false, mod: 0 },
      WIS: { prof: false, mod: 1 },
      CHA: { prof: true, mod: 5 },
    },
    abilityMods: { STR: 3, DEX: 2, CON: 2, INT: 0, WIS: 1, CHA: 4 },
    profBonus: 3,
    isAIControlled: false,
  };
}

function createTargetEnemy(id: string, name: string, x: number, y: number, hp: number = 40, ac: number = 13): Combatant {
  return {
    id,
    name,
    type: "enemy",
    color: "#ef4444",
    x,
    y,
    facing: "W",
    hpCurrent: hp,
    hpMax: hp,
    hpTemp: 0,
    ac,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 1,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "Орк-воин",
    level: 3,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: [
      {
        id: "orc_axe",
        name: "Секира",
        kind: "melee",
        range: { normal: 5 },
        attackBonus: 5,
        damage: [{ dice: "1d12", mod: 3, type: "slashing" }],
        actionCost: "action",
      },
    ],
    spells: { slots: {}, known: [] },
    abilities: [],
    concentration: null,
    saves: {
      STR: { prof: true, mod: 4 },
      DEX: { prof: false, mod: 1 },
      CON: { prof: true, mod: 4 },
      INT: { prof: false, mod: -1 },
      WIS: { prof: false, mod: 0 },
      CHA: { prof: false, mod: -1 },
    },
    abilityMods: { STR: 3, DEX: 1, CON: 2, INT: -1, WIS: 0, CHA: -1 },
    profBonus: 2,
    isAIControlled: true,
  };
}

describe("Expanded Combat Spells Test Suite", () => {
  // 1. Toll the Dead ("Погребальный звон")
  describe("Toll the Dead (Погребальный звон)", () => {
    it("deals 1d8 necrotic if target is at full HP, and 1d12 necrotic if target is injured (< max HP)", () => {
      const caster = createCaster("caster", "Клерик", 2, 2, 1);
      const enemyFull = createTargetEnemy("enemy_full", "Здоровый орк", 4, 2, 30);
      const enemyInjured = createTargetEnemy("enemy_inj", "Раненый орк", 4, 3, 30);
      enemyInjured.hpCurrent = 20; // injured: 20/30

      // Guarantee failed saves: high DC
      caster.spells.spellSaveDC = 30;

      const state: any = createCombatState([caster, enemyFull, enemyInjured]);
      const toll = getSpellDefinition("Погребальный звон") || getSpellDefinition("Toll the Dead");
      expect(toll).toBeDefined();

      // Cast at full HP enemy
      castSpell(state, caster.id, {
        id: "toll_1",
        name: toll!.name,
        level: 0,
        parameters: toll!.parameters,
      }, { targetIds: [enemyFull.id] });

      const fullDamageTaken = 30 - enemyFull.hpCurrent;
      expect(fullDamageTaken).toBeGreaterThanOrEqual(1);
      expect(fullDamageTaken).toBeLessThanOrEqual(8); // 1d8 max

      // Reset action for second cast in test
      caster.actionUsed = false;

      // Cast at injured enemy
      castSpell(state, caster.id, {
        id: "toll_2",
        name: toll!.name,
        level: 0,
        parameters: toll!.parameters,
      }, { targetIds: [enemyInjured.id] });

      const injDamageTaken = 20 - enemyInjured.hpCurrent;
      expect(injDamageTaken).toBeGreaterThanOrEqual(1);
      expect(injDamageTaken).toBeLessThanOrEqual(12); // 1d12 max
    });

    it("scales to 2d12 at level 5 for injured targets", () => {
      const casterLvl5 = createCaster("caster5", "Клерик 5", 2, 2, 5);
      const enemyInjured = createTargetEnemy("enemy_inj5", "Раненый орк", 4, 2, 50);
      enemyInjured.hpCurrent = 30; // 30/50
      casterLvl5.spells.spellSaveDC = 30;

      const state: any = createCombatState([casterLvl5, enemyInjured]);
      const toll = getSpellDefinition("Погребальный звон") || getSpellDefinition("Toll the Dead");

      castSpell(state, casterLvl5.id, {
        id: "toll_5",
        name: toll!.name,
        level: 0,
        parameters: toll!.parameters,
      }, { targetIds: [enemyInjured.id] });

      const damageTaken = 30 - enemyInjured.hpCurrent;
      expect(damageTaken).toBeGreaterThanOrEqual(2);
      expect(damageTaken).toBeLessThanOrEqual(24); // 2d12 max is 24
    });
  });

  // 2. Booming Blade ("Громовой клинок")
  describe("Booming Blade (Громовой клинок)", () => {
    it("melee attack hit applies booming_resonance, and when target moves via moveCombatant, deals thunder damage and removes condition", () => {
      const caster = createCaster("caster", "Магический воин", 2, 2, 5);
      const enemy = createTargetEnemy("enemy", "Орк", 3, 2, 40, 5); // Low AC to guarantee hit

      const state: any = createCombatState([caster, enemy]);
      const spell = getSpellDefinition("Громовой клинок") || getSpellDefinition("Booming Blade");
      expect(spell).toBeDefined();

      // Cast Booming Blade at enemy (retry if natural 1 auto-misses)
      let attempts = 0;
      while (enemy.hpCurrent === 40 && attempts < 5) {
        caster.actionUsed = false;
        castSpell(state, caster.id, {
          id: "booming_blade",
          name: spell!.name,
          level: 0,
          parameters: spell!.parameters,
        }, { targetIds: [enemy.id] });
        attempts++;
      }

      // Enemy took weapon damage + 1d8 bonus thunder at lvl 5
      expect(enemy.hpCurrent).toBeLessThan(40);
      // Booming resonance applied
      const cond = enemy.conditions.find((c: any) => c.type === "booming_resonance");
      expect(cond).toBeDefined();
      expect(cond?.value).toBe(5);

      const hpBeforeMove = enemy.hpCurrent;

      // Enemy moves 1 cell
      state.currentTurnIndex = 1; // enemy turn
      moveCombatant(state, enemy.id, { x: 4, y: 2 });

      // Enemy took secondary thunder damage from movement (2d8 at lvl 5)
      expect(enemy.hpCurrent).toBeLessThan(hpBeforeMove);
      // Condition removed
      expect(enemy.conditions.some((c: any) => c.type === "booming_resonance")).toBe(false);
      // Log contains booming thunder
      expect(state.log.some((l: any) => l.text.includes("Громового клинка") || l.text.includes("резонанс"))).toBe(true);
    });
  });

  // 3. Green-Flame Blade ("Клинок зелёного пламени")
  describe("Green-Flame Blade (Клинок зелёного пламени)", () => {
    it("melee attack damages primary target and splashes fire damage to adjacent enemy within 5 ft", () => {
      const caster = createCaster("caster", "Магический воин", 2, 2, 1);
      const primaryEnemy = createTargetEnemy("enemy1", "Первый орк", 3, 2, 40, 5);
      const adjacentEnemy = createTargetEnemy("enemy2", "Второй орк", 3, 3, 40, 15); // within 5 ft of enemy1

      const state: any = createCombatState([caster, primaryEnemy, adjacentEnemy]);
      const spell = getSpellDefinition("Клинок зелёного пламени") || getSpellDefinition("Green-flame Blade");
      expect(spell).toBeDefined();

      let attempts = 0;
      while (primaryEnemy.hpCurrent === 40 && attempts < 5) {
        caster.actionUsed = false;
        castSpell(state, caster.id, {
          id: "gfb",
          name: spell!.name,
          level: 0,
          parameters: spell!.parameters,
        }, { targetIds: [primaryEnemy.id] });
        attempts++;
      }

      // Primary took weapon damage
      expect(primaryEnemy.hpCurrent).toBeLessThan(40);
      // Secondary took splash fire damage = spellcasting modifier (CHA mod = 4)
      expect(adjacentEnemy.hpCurrent).toBe(40 - caster.abilityMods.CHA);
      expect(state.log.some((l: any) => l.text.includes("Зелёное пламя") || l.text.includes("пламени"))).toBe(true);
    });
  });

  // 4. Armor of Agathys ("Доспех Агатиса")
  describe("Armor of Agathys (Доспех Агатиса)", () => {
    it("grants 5 temp HP per slot level, deals 5 cold damage per slot level to a melee attacker, condition expires when temp HP reaches 0", () => {
      const caster = createCaster("caster", "Колдун", 2, 2, 3);
      const attacker = createTargetEnemy("attacker", "Нападающий орк", 3, 2, 40);

      const state: any = createCombatState([caster, attacker]);
      const spell = getSpellDefinition("Доспех Агатиса") || getSpellDefinition("Armor of Agathys");
      expect(spell).toBeDefined();

      // Cast at 2nd level -> 10 temp HP and condition value 10
      castSpell(state, caster.id, {
        id: "agathys",
        name: spell!.name,
        level: 1,
        parameters: spell!.parameters,
      }, { slotLevel: 2 });

      expect(caster.hpTemp).toBe(10);
      expect(caster.conditions.some((c: any) => c.type === "armor_of_agathys")).toBe(true);

      // Enemy attacks caster with melee attack
      // Deal 6 damage (less than 10 temp HP)
      dealDamage(state, caster.id, 6, { isAttack: true, attackerId: attacker.id });

      // Attacker should receive 10 cold damage retaliation
      expect(attacker.hpCurrent).toBe(40 - 10);
      expect(caster.hpTemp).toBe(4);
      // Condition still active
      expect(caster.conditions.some((c: any) => c.type === "armor_of_agathys")).toBe(true);

      // Enemy attacks again dealing 8 damage (depleting remaining 4 temp HP)
      dealDamage(state, caster.id, 8, { isAttack: true, attackerId: attacker.id });

      // Attacker took another 10 cold damage
      expect(attacker.hpCurrent).toBe(40 - 20);
      expect(caster.hpTemp).toBe(0);
      // Condition expires
      expect(caster.conditions.some((c: any) => c.type === "armor_of_agathys")).toBe(false);
    });
  });

  // 5. Vortex Warp ("Вихрь искривления")
  describe("Vortex Warp (Вихрь искривления)", () => {
    it("teleports target creature to designated empty cell within 90 ft on failed CON save or ally", () => {
      const caster = createCaster("caster", "Волшебник", 2, 2, 3);
      const enemy = createTargetEnemy("enemy", "Орк", 5, 5, 40);
      enemy.saves.CON = { prof: false, mod: -5 }; // guarantee failed CON save
      caster.spells.spellSaveDC = 30;

      const state: any = createCombatState([caster, enemy]);
      const spell = getSpellDefinition("Вихрь искривления") || getSpellDefinition("Vortex Warp");
      expect(spell).toBeDefined();

      const targetCell: Cell = { x: 10, y: 10 };

      castSpell(state, caster.id, {
        id: "vortex_warp",
        name: spell!.name,
        level: 2,
        parameters: spell!.parameters,
      }, { targetIds: [enemy.id], center: targetCell });

      // Enemy should be moved to targetCell
      expect(enemy.x).toBe(10);
      expect(enemy.y).toBe(10);
    });
  });

  // 6. Absorb Elements ("Поглощение стихий")
  describe("Absorb Elements (Поглощение стихий)", () => {
    it("grants resistance to chosen element and adds absorb_elements effect scaling extra damage on next melee attack", () => {
      const caster = createCaster("caster", "Следопыт", 2, 2, 3);
      const enemy = createTargetEnemy("enemy", "Орк", 3, 2, 40, 5);

      const state: any = createCombatState([caster, enemy]);
      const spell = getSpellDefinition("Поглощение стихий") || getSpellDefinition("Absorb Elements");
      expect(spell).toBeDefined();

      castSpell(state, caster.id, {
        id: "absorb_elements",
        name: spell!.name,
        level: 1,
        parameters: spell!.parameters,
      }, { slotLevel: 2 });

      // Resistance granted
      expect(caster.damageResistances).toContain("fire");
      // Condition added with value 2 (slotLevel)
      const cond = caster.conditions.find((c: any) => c.type === "absorb_elements");
      expect(cond).toBeDefined();
      expect(cond?.value).toBe(2);

      // Perform melee attack: should consume absorb_elements and deal extra 2d6 damage
      performAttack(state, caster.id, enemy.id, caster.attacks[0].id, {
        manualAdvantage: true,
        skipTurnCheck: true,
      });

      expect(caster.conditions.some((c: any) => c.type === "absorb_elements")).toBe(false);
      expect(enemy.hpCurrent).toBeLessThan(40);
    });
  });

  // 7. Ice Knife ("Ледяной кинжал")
  describe("Ice Knife (Ледяной кинжал)", () => {
    it("ranged spell attack against target + 2d6 cold damage to creatures in 5 ft radius on failed DEX save", () => {
      const caster = createCaster("caster", "Волшебник", 2, 2, 3);
      const primaryEnemy = createTargetEnemy("enemy1", "Орк 1", 5, 2, 40, 5); // low AC
      const adjacentEnemy = createTargetEnemy("enemy2", "Орк 2", 5, 3, 40);
      primaryEnemy.saves.DEX = { prof: false, mod: -5 };
      adjacentEnemy.saves.DEX = { prof: false, mod: -5 };
      caster.spells.spellSaveDC = 30;

      const state: any = createCombatState([caster, primaryEnemy, adjacentEnemy]);
      const spell = getSpellDefinition("Ледяной кинжал") || getSpellDefinition("Ice Knife");
      expect(spell).toBeDefined();

      castSpell(state, caster.id, {
        id: "ice_knife",
        name: spell!.name,
        level: 1,
        parameters: spell!.parameters,
      }, { targetIds: [primaryEnemy.id] });

      // Primary took piercing attack damage AND cold explosion damage
      expect(primaryEnemy.hpCurrent).toBeLessThan(40);
      // Adjacent enemy took cold explosion damage
      expect(adjacentEnemy.hpCurrent).toBeLessThan(40);
    });
  });

  // 8. Thunder Step ("Громовой шаг")
  describe("Thunder Step (Громовой шаг)", () => {
    it("teleports caster up to 90 ft and deals 3d10 thunder damage to creatures within 10 ft of departed space", () => {
      const caster = createCaster("caster", "Колдун", 2, 2, 5);
      const enemyNear = createTargetEnemy("enemy_near", "Близкий орк", 3, 2, 50); // within 10 ft of (2,2)
      const enemyFar = createTargetEnemy("enemy_far", "Далекий орк", 15, 15, 50); // far away
      enemyNear.saves.CON = { prof: false, mod: -5 };
      caster.spells.spellSaveDC = 30;

      const state: any = createCombatState([caster, enemyNear, enemyFar]);
      const spell = getSpellDefinition("Громовой шаг") || getSpellDefinition("Thunder Step");
      expect(spell).toBeDefined();

      const destCell: Cell = { x: 10, y: 10 };
      castSpell(state, caster.id, {
        id: "thunder_step",
        name: spell!.name,
        level: 3,
        parameters: spell!.parameters,
      }, { center: destCell });

      // Caster teleported to (10, 10)
      expect(caster.x).toBe(10);
      expect(caster.y).toBe(10);

      // Enemy near departed space (2,2) took 3d10 thunder damage
      expect(enemyNear.hpCurrent).toBeLessThan(50);
      // Enemy far took 0 damage
      expect(enemyFar.hpCurrent).toBe(50);
    });
  });

  // 9. Synaptic Static ("Синаптический разряд")
  describe("Synaptic Static (Синаптический разряд)", () => {
    it("deals 8d6 psychic in 20 ft sphere on INT save half", () => {
      const caster = createCaster("caster", "Волшебник", 2, 2, 9);
      const enemy1 = createTargetEnemy("enemy1", "Орк 1", 10, 10, 60);
      const enemy2 = createTargetEnemy("enemy2", "Орк 2", 11, 10, 60);
      const farEnemy = createTargetEnemy("enemy_far", "Далекий орк", 25, 25, 60);

      enemy1.saves.INT = { prof: false, mod: -5 }; // guaranteed fail
      enemy2.saves.INT = { prof: true, mod: 20 }; // guaranteed save
      caster.spells.spellSaveDC = 15;

      const state: any = createCombatState([caster, enemy1, enemy2, farEnemy]);
      const spell = getSpellDefinition("Синаптический разряд") || getSpellDefinition("Synaptic Static");
      expect(spell).toBeDefined();

      castSpell(state, caster.id, {
        id: "synaptic_static",
        name: spell!.name,
        level: 5,
        parameters: spell!.parameters,
      }, { center: { x: 10, y: 10 } });

      // enemy1 took psychic damage on failed save
      expect(enemy1.hpCurrent).toBeLessThan(60);
      // enemy2 saved, so took half damage
      expect(enemy2.hpCurrent).toBeLessThan(60);
      // farEnemy untouched
      expect(farEnemy.hpCurrent).toBe(60);
    });
  });

  // 10. Cantrip scaling across expanded cantrips
  describe("Cantrip scaling at levels 1, 5, 11, 17", () => {
    it("scales dice correctly for expanded cantrips based on character level", () => {
      expect(cantripDiceMultiplier(1)).toBe(1);
      expect(cantripDiceMultiplier(4)).toBe(1);
      expect(cantripDiceMultiplier(5)).toBe(2);
      expect(cantripDiceMultiplier(10)).toBe(2);
      expect(cantripDiceMultiplier(11)).toBe(3);
      expect(cantripDiceMultiplier(16)).toBe(3);
      expect(cantripDiceMultiplier(17)).toBe(4);
      expect(cantripDiceMultiplier(20)).toBe(4);
    });
  });
});
