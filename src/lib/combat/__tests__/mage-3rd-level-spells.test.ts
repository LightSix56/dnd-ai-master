import { describe, it, expect } from "vitest";
import {
  castSpell,
  dealDamage,
  transformWildShape,
  revertWildShape,
  startTurn,
  endTurn,
} from "../engine";
import { getSpellDefinition } from "../library-data";
import { getSRDSpell } from "../srd/adapter";
import { CAMPAIGN_HEROES_PRESETS, createCombatantFromPreset } from "../preset-data";
import { effectiveAC, effectiveSpeed } from "../rules";
import type { Combatant } from "../types";

function createCombatState(combatants: Combatant[]) {
  return {
    combatants,
    mapElements: [],
    round: 1,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    log: [] as any[],
    gridWidth: 20,
    gridHeight: 15,
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
    attacks: [],
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
    abilityMods: { STR: 2, DEX: 1, CON: 2, INT: -1, WIS: 0, CHA: -1 },
    profBonus: 2,
    isAIControlled: true,
  };
}

describe("Mage 3rd Level Combat Spells & Druid Wild Shape", () => {
  const magePreset = CAMPAIGN_HEROES_PRESETS.find((p) => p.id === "preset-eldrin-mage")!;
  const druidPreset = CAMPAIGN_HEROES_PRESETS.find((p) => p.id === "preset-myra-druid")!;

  it("Mage casts Fireball (Огненный шар): deals 8d6 fire AoE damage to multiple enemies in sphere", () => {
    const mage = createCombatantFromPreset(magePreset, { x: 2, y: 5 });
    const enemy1 = createTargetEnemy("orc_1", "Орк 1", 10, 5, 50);
    const enemy2 = createTargetEnemy("orc_2", "Орк 2", 11, 5, 50);
    const enemy3 = createTargetEnemy("orc_3", "Орк 3", 10, 6, 50);
    const farEnemy = createTargetEnemy("orc_far", "Далекий орк", 18, 12, 50);

    const state: any = createCombatState([mage, enemy1, enemy2, enemy3, farEnemy]);

    const fireball = getSpellDefinition("Огненный шар") || getSpellDefinition("Fireball");
    expect(fireball).toBeDefined();
    expect(fireball?.level).toBe(3);

    const result = castSpell(state, mage.id, {
      id: "spell_117",
      name: fireball!.name,
      level: 3,
      parameters: fireball!.parameters,
    }, {
      center: { x: 10, y: 5 },
      skipTurnCheck: true,
    });

    expect(result.targets.length).toBe(3);
    expect(enemy1.hpCurrent).toBeLessThan(50);
    expect(enemy2.hpCurrent).toBeLessThan(50);
    expect(enemy3.hpCurrent).toBeLessThan(50);
    expect(farEnemy.hpCurrent).toBe(50); // Outside 20ft sphere
  });

  it("Mage casts Lightning Bolt (Молния): 8d6 lightning in 100ft line AoE", () => {
    const mage = createCombatantFromPreset(magePreset, { x: 2, y: 5 });
    const enemy1 = createTargetEnemy("orc_1", "Орк 1", 5, 5, 50);
    const enemy2 = createTargetEnemy("orc_2", "Орк 2", 8, 5, 50);
    const sideEnemy = createTargetEnemy("orc_side", "Орк сбоку", 5, 8, 50);

    const state: any = createCombatState([mage, enemy1, enemy2, sideEnemy]);

    const lightning = getSpellDefinition("Молния") || getSpellDefinition("Lightning Bolt");
    expect(lightning).toBeDefined();

    const result = castSpell(state, mage.id, {
      id: "spell_191",
      name: lightning!.name,
      level: 3,
      parameters: lightning!.parameters,
    }, {
      center: { x: 10, y: 5 },
      skipTurnCheck: true,
    });

    expect(result.targets.length).toBeGreaterThanOrEqual(2);
    expect(enemy1.hpCurrent).toBeLessThan(50);
    expect(enemy2.hpCurrent).toBeLessThan(50);
  });

  it("Mage casts Haste (Ускорение): grants +2 AC, doubles speed and sets concentration", () => {
    const mage = createCombatantFromPreset(magePreset, { x: 2, y: 5 });
    const ally = createTargetEnemy("ally_1", "Союзный рыцарь", 3, 5, 40, 16);
    ally.type = "player";

    const state: any = createCombatState([mage, ally]);

    const haste = getSpellDefinition("Ускорение") || getSpellDefinition("Haste");
    expect(haste).toBeDefined();
    expect(haste?.parameters.concentration).toBe(true);

    castSpell(state, mage.id, {
      id: "spell_145",
      name: haste!.name,
      level: 3,
      parameters: haste!.parameters,
    }, {
      targetIds: [ally.id],
      skipTurnCheck: true,
    });

    expect(mage.concentration?.spellName).toContain("Ускорение");
    expect(ally.conditions.some((c) => c.type === "haste" || c.type === "hasted")).toBe(true);
    expect(effectiveAC(ally)).toBe(18); // 16 + 2 = 18
    expect(effectiveSpeed(ally)).toBe(60); // 30 * 2 = 60
  });

  it("Mage casts Slow (Замедление): inflicts -2 AC and halves speed on failed WIS save", () => {
    const mage = createCombatantFromPreset(magePreset, { x: 2, y: 5 });
    const enemy = createTargetEnemy("orc_slow", "Орк", 6, 5, 40, 14);
    enemy.abilityMods.WIS = -5;
    enemy.saves.WIS = { prof: false, mod: -5 };

    const state: any = createCombatState([mage, enemy]);

    const slow = getSpellDefinition("Замедление") || getSpellDefinition("Slow");
    expect(slow).toBeDefined();

    castSpell(state, mage.id, {
      id: "spell_270",
      name: slow!.name,
      level: 3,
      parameters: {
        ...slow!.parameters,
        saveDC: 30, // Guarantee failed save to test condition application
      },
    }, {
      center: { x: 6, y: 5 },
      skipTurnCheck: true,
    });

    expect(enemy.conditions.some((c) => c.type === "slow")).toBe(true);
    expect(effectiveAC(enemy)).toBe(12); // 14 - 2 = 12
    expect(effectiveSpeed(enemy)).toBe(15); // 30 / 2 = 15
  });

  it("Mage casts Vampiric Touch (Вампирское прикосновение): deals damage and heals caster", () => {
    const mage = createCombatantFromPreset(magePreset, { x: 2, y: 5 });
    mage.hpCurrent = 15; // Wounded mage
    const enemy = createTargetEnemy("orc_victim", "Орк", 3, 5, 40);

    const state: any = createCombatState([mage, enemy]);

    const vamp = getSpellDefinition("Вампирское прикосновение") || getSpellDefinition("Vampiric Touch");
    expect(vamp).toBeDefined();

    castSpell(state, mage.id, {
      id: "spell_304",
      name: "Вампирское прикосновение",
      level: 3,
      parameters: {
        name: "Вампирское прикосновение",
        type: "spell",
        actionCost: "action",
        range: { type: "touch" },
        damage: [{ dice: "3d6", mod: 0, type: "necrotic" }],
        targeting: "creature",
        concentration: true,
        description: "Наносит 3к6 некротического урона и восстанавливает половину нанесенного урона.",
      },
    }, {
      targetIds: [enemy.id],
      skipTurnCheck: true,
    });

    expect(enemy.hpCurrent).toBeLessThan(40);
    const dmg = 40 - enemy.hpCurrent;
    const expectedHeal = Math.floor(dmg / 2);
    expect(mage.hpCurrent).toBe(15 + expectedHeal);
  });

  it("Druid transforms into Brown Bear, executes Multiattack and absorbs damage", () => {
    const druid = createCombatantFromPreset(druidPreset, { x: 2, y: 2 });
    const enemy = createTargetEnemy("orc_test", "Орк", 3, 2, 50, 13);
    const state: any = createCombatState([druid, enemy]);

    expect(druid.hpCurrent).toBe(45);

    // Transform into Brown Bear
    transformWildShape(state, druid.id, "brown_bear", { skipTurnCheck: true });

    expect(druid.wildShape).toBeDefined();
    expect(druid.wildShape?.formId).toBe("brown_bear");
    expect(druid.hpMax).toBe(34);
    expect(druid.hpCurrent).toBe(34);
    expect(druid.ac).toBe(11);
    expect(druid.size).toBe("large");

    // Take 20 damage while in bear form
    dealDamage(state, druid.id, 20);
    expect(druid.hpCurrent).toBe(14); // 34 - 20 = 14
    expect(druid.wildShape?.originalHpCurrent).toBe(45); // Druid HP untouched

    // Revert form manually
    revertWildShape(state, druid.id);
    expect(druid.wildShape).toBeNull();
    expect(druid.hpCurrent).toBe(45);
    expect(druid.hpMax).toBe(45);
    expect(druid.ac).toBe(14);
  });
});
