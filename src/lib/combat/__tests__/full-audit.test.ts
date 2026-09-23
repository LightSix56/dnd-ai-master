import { describe, it, expect } from "vitest";
import { castSpell, useAbility, performAttack } from "../engine";
import { SPELL_LIBRARY, ABILITY_LIBRARY, ATTACK_LIBRARY } from "../library-data";
import { BEAST_FORMS } from "../beast-forms";
import type { Combatant, Cell, Attack, CombatAbility } from "../types";

function createAuditCombatant(id: string, name: string, x: number, y: number, type: "player" | "enemy" = "enemy", level = 5): Combatant {
  return {
    id,
    name,
    type,
    color: type === "player" ? "#8b5cf6" : "#ef4444",
    x,
    y,
    facing: type === "player" ? "E" : "W",
    hpCurrent: 100,
    hpMax: 100,
    hpTemp: 0,
    ac: 14,
    speed: 30,
    initiative: 12,
    initiativeTiebreak: 12,
    dexMod: 2,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: type === "player" ? "Волшебник / Жрец" : "Воин",
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
        id: `${id}_staff`,
        name: "Боевой посох",
        kind: "melee",
        range: { normal: 5 },
        attackBonus: 6,
        damage: [{ dice: "1d6", mod: 2, type: "bludgeoning" }],
        actionCost: "action",
      },
    ],
    spells: {
      slots: {
        1: { max: 4, used: 0 },
        2: { max: 3, used: 0 },
        3: { max: 3, used: 0 },
        4: { max: 3, used: 0 },
        5: { max: 2, used: 0 },
        6: { max: 1, used: 0 },
        7: { max: 1, used: 0 },
        8: { max: 1, used: 0 },
        9: { max: 1, used: 0 },
      },
      known: [],
      spellcastingAbility: "INT",
      spellSaveDC: 17,
      spellAttackBonus: 9,
    },
    abilities: [],
    concentration: null,
    saves: {
      STR: { prof: true, mod: 3 },
      DEX: { prof: false, mod: 2 },
      CON: { prof: true, mod: 4 },
      INT: { prof: true, mod: 5 },
      WIS: { prof: true, mod: 4 },
      CHA: { prof: false, mod: 2 },
    },
    abilityMods: { STR: 2, DEX: 2, CON: 3, INT: 5, WIS: 4, CHA: 2 },
    profBonus: 4,
    isAIControlled: false,
  };
}

function createAuditState() {
  const caster = createAuditCombatant("caster", "Аудитор", 5, 5, "player", 11);
  const targetMelee = createAuditCombatant("target_melee", "Манекен (5 фт)", 5, 6, "enemy", 5);
  const target10ft = createAuditCombatant("target_10ft", "Манекен (10 фт)", 5, 7, "enemy", 5);
  const targetRanged = createAuditCombatant("target_ranged", "Манекен (30 фт)", 5, 11, "enemy", 5);
  const targetDistant = createAuditCombatant("target_distant", "Манекен (60 фт)", 5, 17, "enemy", 5);
  const ally = createAuditCombatant("ally", "Союзник", 4, 5, "player", 5);

  const combatants = [caster, targetMelee, target10ft, targetRanged, targetDistant, ally];

  const state: any = {
    combatants,
    mapElements: [],
    round: 1,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    log: [] as any[],
    gridWidth: 40,
    gridHeight: 40,
    dirtyIds: new Set<string>(),
    isCombatDirty: false,
    require(id: string) {
      const c = this.combatants.find((x: any) => x.id === id);
      if (!c) throw new Error("Combatant not found: " + id);
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

  return { state, caster, targetMelee, target10ft, targetRanged, targetDistant, ally };
}

describe("Combat Engine Full Audit & Stress Suite", () => {
  it("executes every spell in SPELL_LIBRARY (502 combat spells) without unhandled exceptions or NaN values", () => {
    expect(SPELL_LIBRARY.length).toBeGreaterThanOrEqual(500);

    for (const spell of SPELL_LIBRARY) {
      const { state, caster, targetMelee, target10ft, targetRanged, targetDistant } = createAuditState();
      const params = spell.parameters;
      const range = params.range ?? { type: "self" };

      let targetIds: string[] = [];
      let center: Cell | null = null;

      if (range.type === "self") {
        targetIds = [caster.id];
        center = { x: caster.x, y: caster.y };
      } else if (range.type === "touch") {
        targetIds = [targetMelee.id];
        center = { x: targetMelee.x, y: targetMelee.y };
      } else {
        const maxVal = range.value ?? 30;
        if (maxVal <= 5) {
          targetIds = [targetMelee.id];
          center = { x: targetMelee.x, y: targetMelee.y };
        } else if (maxVal <= 10) {
          targetIds = [target10ft.id];
          center = { x: target10ft.x, y: target10ft.y };
        } else if (maxVal <= 30) {
          targetIds = [targetRanged.id];
          center = { x: targetRanged.x, y: targetRanged.y };
        } else {
          targetIds = [targetDistant.id];
          center = { x: targetDistant.x, y: targetDistant.y };
        }
      }

      if ((params as any).area?.shape) center = { x: 5, y: 6 };
      const spellLower = (spell.name || "").toLowerCase();
      if (spellLower.includes("шаг") || spellLower.includes("телепорт") || spellLower.includes("warp") || spellLower.includes("step")) {
        center = { x: 6, y: 5 };
      }

      const result = castSpell(
        state,
        caster.id,
        {
          id: spell.name,
          name: spell.name,
          level: spell.level,
          parameters: spell.parameters,
        },
        {
          targetIds,
          center,
          slotLevel: spell.level === 0 ? 0 : spell.level,
          skipTurnCheck: true,
        }
      );

      expect(result).toBeDefined();
      expect(typeof result.text).toBe("string");
      expect(result.text).not.toContain("NaN");
      expect(result.text).not.toContain("[object Object]");

      for (const t of result.targets) {
        expect(typeof t.amount).toBe("number");
        expect(isNaN(t.amount)).toBe(false);
        expect(t.amount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("upcasts every leveled spell to 9th level slots without runtime errors or corruption", () => {
    const leveled = SPELL_LIBRARY.filter((s) => s.level >= 1 && s.level <= 8);
    expect(leveled.length).toBeGreaterThan(400);

    for (const spell of leveled) {
      const { state, caster, targetMelee, target10ft, targetRanged, targetDistant } = createAuditState();
      const params = spell.parameters;
      const range = params.range ?? { type: "self" };

      let targetIds: string[] = [];
      let center: Cell | null = null;
      if (range.type === "self") {
        targetIds = [caster.id];
        center = { x: caster.x, y: caster.y };
      } else if (range.type === "touch") {
        targetIds = [targetMelee.id];
        center = { x: targetMelee.x, y: targetMelee.y };
      } else {
        const maxVal = range.value ?? 30;
        if (maxVal <= 5) {
          targetIds = [targetMelee.id];
          center = { x: targetMelee.x, y: targetMelee.y };
        } else if (maxVal <= 10) {
          targetIds = [target10ft.id];
          center = { x: target10ft.x, y: target10ft.y };
        } else if (maxVal <= 30) {
          targetIds = [targetRanged.id];
          center = { x: targetRanged.x, y: targetRanged.y };
        } else {
          targetIds = [targetDistant.id];
          center = { x: targetDistant.x, y: targetDistant.y };
        }
      }
      if ((params as any).area?.shape) center = { x: 5, y: 6 };
      const spellLower = (spell.name || "").toLowerCase();
      if (spellLower.includes("шаг") || spellLower.includes("телепорт") || spellLower.includes("warp") || spellLower.includes("step")) {
        center = { x: 6, y: 5 };
      }

      const result = castSpell(
        state,
        caster.id,
        {
          id: spell.name,
          name: spell.name,
          level: spell.level,
          parameters: spell.parameters,
        },
        {
          targetIds,
          center,
          slotLevel: 9,
          skipTurnCheck: true,
        }
      );

      expect(result).toBeDefined();
      expect(result.text).not.toContain("NaN");
    }
  });

  it("scales all cantrips across character tiers (lvl 1, 5, 11, 17) cleanly", () => {
    const cantrips = SPELL_LIBRARY.filter((s) => s.level === 0);
    expect(cantrips.length).toBeGreaterThanOrEqual(40);

    for (const cantrip of cantrips) {
      for (const lvl of [1, 5, 11, 17]) {
        const { state, caster, targetMelee, target10ft, targetRanged, targetDistant } = createAuditState();
        caster.level = lvl;
        const params = cantrip.parameters;
        const range = params.range ?? { type: "self" };

        let targetIds: string[] = [];
        let center: Cell | null = null;
        if (range.type === "self") {
          targetIds = [caster.id];
          center = { x: caster.x, y: caster.y };
        } else if (range.type === "touch") {
          targetIds = [targetMelee.id];
          center = { x: targetMelee.x, y: targetMelee.y };
        } else {
          const maxVal = range.value ?? 30;
          if (maxVal <= 5) {
            targetIds = [targetMelee.id];
            center = { x: targetMelee.x, y: targetMelee.y };
          } else if (maxVal <= 10) {
            targetIds = [target10ft.id];
            center = { x: target10ft.x, y: target10ft.y };
          } else if (maxVal <= 30) {
            targetIds = [targetRanged.id];
            center = { x: targetRanged.x, y: targetRanged.y };
          } else {
            targetIds = [targetDistant.id];
            center = { x: targetDistant.x, y: targetDistant.y };
          }
        }
        if ((params as any).area?.shape) center = { x: 5, y: 6 };

        const res = castSpell(
          state,
          caster.id,
          {
            id: cantrip.name,
            name: cantrip.name,
            level: 0,
            parameters: cantrip.parameters,
          },
          {
            targetIds,
            center,
            slotLevel: 0,
            skipTurnCheck: true,
          }
        );

        expect(res).toBeDefined();
        expect(res.text).not.toContain("NaN");
      }
    }
  });

  it("executes all weapon and natural beast attacks cleanly", () => {
    for (let i = 0; i < ATTACK_LIBRARY.length; i++) {
      const atkDef = ATTACK_LIBRARY[i];
      const { state, caster, targetMelee, target10ft, targetRanged, targetDistant } = createAuditState();

      const attackId = `atk_${i}`;
      const normRange = atkDef.rangeNormal ?? 5;
      const target = normRange <= 5 ? targetMelee : normRange <= 10 ? target10ft : normRange <= 30 ? targetRanged : targetDistant;

      const attack: Attack = {
        id: attackId,
        name: atkDef.name,
        kind: atkDef.kind,
        range: { normal: atkDef.rangeNormal, long: atkDef.rangeLong },
        attackBonus: atkDef.attackBonus + 5,
        damage: atkDef.damage,
        finesse: atkDef.finesse,
        actionCost: atkDef.actionCost ?? "action",
      };

      caster.attacks = [attack];

      const res = performAttack(state, caster.id, target.id, attackId, {
        skipTurnCheck: true,
        manualAdvantage: true,
      });

      expect(res).toBeDefined();
      expect(typeof res.damage).toBe("number");
      expect(isNaN(res.damage)).toBe(false);
      expect(res.damage).toBeGreaterThanOrEqual(0);
      expect(res.text).not.toContain("NaN");
    }

    // Beast forms
    for (const form of BEAST_FORMS) {
      for (const atk of form.attacks) {
        const { state, caster, targetMelee } = createAuditState();
        caster.attacks = [atk];
        const res = performAttack(state, caster.id, targetMelee.id, atk.id, {
          skipTurnCheck: true,
          manualAdvantage: true,
        });
        expect(res).toBeDefined();
        expect(typeof res.damage).toBe("number");
        expect(isNaN(res.damage)).toBe(false);
      }
    }
  });

  it("executes all class abilities in ABILITY_LIBRARY cleanly", () => {
    for (let i = 0; i < ABILITY_LIBRARY.length; i++) {
      const abDef = ABILITY_LIBRARY[i];
      const { state, caster, targetMelee } = createAuditState();

      const abId = `ability_${i}`;
      const ability: CombatAbility = {
        id: abId,
        name: abDef.name,
        usesMax: 3,
        usesUsed: 0,
        refresh: "short",
        parameters: abDef.parameters,
      };

      caster.abilities = [ability];
      const rangeType = abDef.parameters.range?.type;
      const targetIds = rangeType === "self" ? [caster.id] : [targetMelee.id];
      const center = rangeType === "self" ? { x: caster.x, y: caster.y } : { x: targetMelee.x, y: targetMelee.y };

      const res = useAbility(state, caster.id, abId, {
        targetIds,
        center,
        skipTurnCheck: true,
      });

      expect(res).toBeDefined();
      expect(typeof res.text).toBe("string");
      expect(res.text).not.toContain("NaN");
    }
  });
});
