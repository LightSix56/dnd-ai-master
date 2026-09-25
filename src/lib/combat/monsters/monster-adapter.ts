import type {
  Combatant,
  Attack,
  MonsterMultiattack,
  MonsterMultiattackOption,
  LegendaryState,
  LegendaryActionOption,
  RechargeAbility,
  MonsterCombatTrait,
  TacticalRole,
  AbilityKey,
  CombatantType,
  FacingDirection,
  DamageRoll,
} from "../types";
import type { MonsterDefinition, MonsterAction } from "./types";

export interface MonsterAdapterOptions {
  id?: string;
  characterId?: string | null;
  combatId?: string;
  type?: CombatantType;
  color?: string;
  x?: number;
  y?: number;
  facing?: FacingDirection;
  role?: TacticalRole;
  isAIControlled?: boolean;
}

export function crToProfBonus(cr: number): number {
  if (cr < 5) return 2;
  if (cr < 9) return 3;
  if (cr < 13) return 4;
  if (cr < 17) return 5;
  if (cr < 21) return 6;
  if (cr < 25) return 7;
  if (cr < 29) return 8;
  return 9;
}

export function formatCR(cr: number): string {
  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";
  return String(cr);
}

export const MONSTER_TYPE_RU: Record<string, string> = {
  aberration: "аберрация",
  beast: "зверь",
  celestial: "небожитель",
  construct: "конструкция",
  dragon: "дракон",
  elemental: "элементаль",
  fey: "фея",
  fiend: "исчадие",
  giant: "великан",
  humanoid: "гуманоид",
  monstrosity: "монстр",
  ooze: "слизь",
  plant: "растение",
  undead: "нежить",
};

function safeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function getAttackStem(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower.includes("коготь")) return "ког";
  if (lower.includes("копь")) return "коп";
  if (lower.includes("стрел")) return "стрел";
  const words = lower.split(/\s+/);
  const mainWord = words[words.length - 1];
  return mainWord.length > 4 ? mainWord.slice(0, 4) : mainWord.slice(0, 3);
}

function parseCountBeforeStem(text: string, stem: string): number {
  const idx = text.indexOf(stem);
  if (idx === -1) return 0;
  const before = text.slice(0, idx).trim();
  const words = before.split(/[\s,;:]+/);
  const candidateWords = words.slice(-3).reverse();
  for (const w of candidateWords) {
    const clean = w.toLowerCase();
    if (clean.startsWith("одн") || clean === "1" || clean === "one") return 1;
    if (clean.startsWith("дв") || clean === "2" || clean === "two") return 2;
    if (clean.startsWith("тр") || clean === "3" || clean === "three") return 3;
    if (clean.startsWith("чет") || clean === "4" || clean === "four") return 4;
  }
  return 1;
}

function parseMultiattack(
  multiActionDesc: string,
  attacks: Attack[]
): MonsterMultiattack | null {
  if (!multiActionDesc || attacks.length === 0) return null;
  const lower = multiActionDesc.toLowerCase();
  const options: MonsterMultiattackOption[] = [];

  for (const atk of attacks) {
    const stem = getAttackStem(atk.name);
    if (lower.includes(stem)) {
      const count = parseCountBeforeStem(lower, stem);
      if (count > 0) {
        options.push({ attackId: atk.id, count });
      }
    }
  }

  if (options.length === 0) {
    const firstMelee = attacks.find((a) => a.kind === "melee") || attacks[0];
    options.push({ attackId: firstMelee.id, count: 2 });
  }

  return {
    name: "Мультиатака",
    description: multiActionDesc,
    attacks: options,
  };
}

export function monsterDefinitionToCombatant(
  monster: MonsterDefinition,
  options: MonsterAdapterOptions = {}
): Combatant {
  const profBonus = crToProfBonus(monster.challengeRating);

  const abilityMods: Record<string, number> = {
    STR: Math.floor((monster.abilities.str - 10) / 2),
    DEX: Math.floor((monster.abilities.dex - 10) / 2),
    CON: Math.floor((monster.abilities.con - 10) / 2),
    INT: Math.floor((monster.abilities.int - 10) / 2),
    WIS: Math.floor((monster.abilities.wis - 10) / 2),
    CHA: Math.floor((monster.abilities.cha - 10) / 2),
  };

  const statKeys: Array<"str" | "dex" | "con" | "int" | "wis" | "cha"> = [
    "str",
    "dex",
    "con",
    "int",
    "wis",
    "cha",
  ];
  const saves: Record<string, { prof: boolean; mod: number }> = {};
  for (const key of statKeys) {
    const upper = key.toUpperCase();
    const baseMod = abilityMods[upper] ?? 0;
    if (monster.savingThrows && monster.savingThrows[key] !== undefined) {
      saves[upper] = { prof: true, mod: monster.savingThrows[key]! };
    } else {
      saves[upper] = { prof: false, mod: baseMod };
    }
  }

  // Parse attacks from actions
  const attacks: Attack[] = [];
  const rechargeAbilities: RechargeAbility[] = [];
  let multiActionDesc: string | null = null;

  for (const action of monster.actions || []) {
    const lowerName = action.name.toLowerCase();
    if (lowerName.includes("мультиатака") || lowerName.includes("multiattack")) {
      multiActionDesc = action.description;
      continue;
    }

    if (action.recharge === "5-6" || action.recharge === "6" || action.type === "breath") {
      rechargeAbilities.push({
        id: `recharge-${safeId(action.name)}`,
        name: action.name,
        recharge: action.recharge === "6" ? "6" : "5-6",
        isCharged: true,
        actionCost: "action",
        description: action.description,
      });
    }

    if (
      action.type === "melee_attack" ||
      action.type === "ranged_attack" ||
      (action.damage && action.damage.length > 0)
    ) {
      const isRanged = action.type === "ranged_attack";
      const normalRange =
        action.range?.normal ||
        action.reachFt ||
        (isRanged ? 60 : 5);
      const longRange = action.range?.long;

      const damageRolls: DamageRoll[] = (action.damage && action.damage.length > 0)
        ? action.damage.map((d) => ({
            dice: d.dice || "",
            mod: d.mod ?? 0,
            type: d.type || (isRanged ? "piercing" : "slashing"),
            save: action.save ? (action.save.halfOnSuccess ? "half" : "none") : undefined,
          }))
        : [
            {
              dice: "1d6",
              mod: abilityMods[isRanged ? "DEX" : "STR"] ?? 0,
              type: isRanged ? "piercing" : "bludgeoning",
            },
          ];

      attacks.push({
        id: `atk-${safeId(action.name)}`,
        name: action.name,
        attackBonus:
          action.attackBonus ??
          ((abilityMods[isRanged ? "DEX" : "STR"] ?? 0) + profBonus),
        damage: damageRolls,
        kind: isRanged ? "ranged" : "melee",
        range: {
          normal: normalRange,
          long: longRange,
        },
        actionCost: "action",
        description: action.description,
      });
    }
  }

  // Fallback basic attack if monster has no explicit attack actions
  if (attacks.length === 0) {
    const isRanged = options.role === "backline";
    attacks.push({
      id: `atk-${safeId(monster.name || "strike")}`,
      name: isRanged ? "Дальнобойный выстрел" : "Удар",
      attackBonus: profBonus + (abilityMods[isRanged ? "DEX" : "STR"] ?? 0),
      damage: [
        {
          dice: "1d6",
          mod: abilityMods[isRanged ? "DEX" : "STR"] ?? 0,
          type: isRanged ? "piercing" : "bludgeoning",
        },
      ],
      kind: isRanged ? "ranged" : "melee",
      range: { normal: isRanged ? 60 : 5 },
      actionCost: "action",
    });
  }

  // Parse Multiattack
  let multiattack: MonsterMultiattack | null = null;
  let attacksPerAction = 1;
  if (multiActionDesc) {
    multiattack = parseMultiattack(multiActionDesc, attacks);
    if (multiattack && multiattack.attacks.length > 0) {
      attacksPerAction = multiattack.attacks.reduce((sum, a) => sum + a.count, 0);
    }
  }

  // Traits
  const monsterTraits: MonsterCombatTrait[] = (monster.traits || []).map((t) => ({
    name: t.name,
    description: t.description,
  }));

  // Legendary actions and resistances
  let legendaryState: LegendaryState | null = null;
  if (monster.legendaryActions && monster.legendaryActions.options.length > 0) {
    const options: LegendaryActionOption[] = monster.legendaryActions.options.map(
      (opt, idx) => ({
        id: `leg-opt-${idx}-${safeId(opt.name)}`,
        name: opt.name,
        cost: opt.cost || 1,
        description: opt.description,
      })
    );

    // Look for Legendary Resistance in traits
    let lrMax = 0;
    for (const t of monster.traits || []) {
      const lower = t.name.toLowerCase();
      if (
        lower.includes("легендарное сопротивление") ||
        lower.includes("legendary resistance")
      ) {
        const match = t.name.match(/(\d+)\s*\/\s*(день|day)/i);
        lrMax = match ? parseInt(match[1], 10) : 3;
        break;
      }
    }

    legendaryState = {
      actionsPerRound: monster.legendaryActions.actionsPerRound || 3,
      remainingActions: monster.legendaryActions.actionsPerRound || 3,
      options,
      legendaryResistancesMax: lrMax,
      legendaryResistancesRemaining: lrMax,
    };
  }

  const speed =
    monster.speed.walk ||
    monster.speed.fly ||
    monster.speed.swim ||
    monster.speed.burrow ||
    monster.speed.climb ||
    30;

  const combatantId =
    options.id ||
    `monster-${monster.slug}-${Math.random().toString(36).slice(2, 8)}`;
  const combatantType = options.type || "enemy";

  return {
    id: combatantId,
    characterId: options.characterId || null,
    name: monster.name,
    type: combatantType,
    color: options.color || (combatantType === "player" ? "#3b82f6" : "#ef4444"),
    x: options.x ?? 0,
    y: options.y ?? 0,
    facing: options.facing || "S",
    hpCurrent: monster.hitPoints.average,
    hpMax: monster.hitPoints.average,
    hpTemp: 0,
    ac: monster.armorClass.value,
    speed,
    initiative: 10 + abilityMods.DEX,
    initiativeTiebreak: Math.floor(Math.random() * 100),
    dexMod: abilityMods.DEX,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: `${MONSTER_TYPE_RU[monster.type] || monster.type} • ПО ${formatCR(monster.challengeRating)}`,
    level: Math.max(1, Math.round(monster.challengeRating)),
    challengeRating: monster.challengeRating,
    size: monster.size,
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks,
    spells: {
      slots: (() => {
        const slotsObj: Record<number, { max: number; used: number }> = {};
        if (monster.spellcasting?.slots) {
          for (const [lvl, count] of Object.entries(monster.spellcasting.slots)) {
            slotsObj[Number(lvl)] = { max: count, used: 0 };
          }
        }
        return slotsObj;
      })(),
      known: Object.values(monster.spellcasting?.spellsByLevel || {}).flat(),
      prepared: Object.values(monster.spellcasting?.spellsByLevel || {}).flat(),
      spellSaveDC:
        monster.spellcasting?.spellSaveDC ||
        8 + profBonus + (abilityMods[monster.spellcasting?.ability || "INT"] ?? 0),
      spellAttackBonus:
        monster.spellcasting?.spellAttackBonus ||
        profBonus + (abilityMods[monster.spellcasting?.ability || "INT"] ?? 0),
    },
    abilities: [],
    concentration: null,
    wildShape: null,
    saves,
    abilityMods,
    profBonus,
    isAIControlled:
      options.isAIControlled !== undefined ? options.isAIControlled : true,
    damageResistances: monster.damageResistances || [],
    damageImmunities: monster.damageImmunities || [],
    damageVulnerabilities: monster.damageVulnerabilities || [],
    conditionImmunities: monster.conditionImmunities || [],
    multiattack,
    legendaryState,
    rechargeAbilities,
    monsterTraits,
    tacticalRole: options.role,
    suppressRegenerationUntilRound: 0,
  };
}
