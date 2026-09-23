// Преобразование записей БД (JSON в строках) в типы движка и обратно.
// Единственное место, где происходит парсинг — раньше он был размазан по компонентам.

import type {
  Attack,
  AttackKind,
  Combat,
  Combatant,
  CombatPotion,
  CombatAbility,
  Condition,
  CreatureSize,
  LogEntry,
  MapElement,
  SpellData,
} from "./types";

export function safeParse<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

const DEFAULT_SPELLS: SpellData = {
  slots: {},
  known: [],
  prepared: [],
  spellcastingAbility: "",
  spellSaveDC: 0,
  spellAttackBonus: 0,
};

/** Дополняет атаку недостающими полями — старые записи в БД их не имеют */
export function normalizeAttack(raw: Record<string, unknown>, index = 0): Attack {
  const legacyRange = raw.range as
    | { type?: string; value?: number; longRange?: number; normal?: number; long?: number }
    | undefined;

  let kind: AttackKind = (raw.kind as AttackKind) ?? "melee";
  if (!raw.kind && legacyRange?.type) {
    kind = legacyRange.type === "ranged" ? "ranged" : "melee";
  }

  const normal =
    legacyRange?.normal ?? legacyRange?.value ?? (kind === "melee" ? 5 : 60);
  const long = legacyRange?.long ?? legacyRange?.longRange;

  return {
    id: (raw.id as string) || `atk_${index}`,
    name: (raw.name as string) || `Атака ${index + 1}`,
    attackBonus: Number(raw.attackBonus ?? 0),
    damage: Array.isArray(raw.damage)
      ? (raw.damage as Attack["damage"]).map((d) => ({
          dice: d.dice ?? "",
          mod: Number(d.mod ?? 0),
          type: d.type ?? "slashing",
          save: d.save,
          noCrit: d.noCrit,
          temp: d.temp,
        }))
      : [],
    kind,
    range: { normal, long },
    actionCost: (raw.actionCost as Attack["actionCost"]) ?? "action",
    description: raw.description as string | undefined,
    finesse: raw.finesse as boolean | undefined,
    thrown: raw.thrown as boolean | undefined,
    versatile: raw.versatile as string | undefined,
    usesSpellAttack: raw.usesSpellAttack as boolean | undefined,
  };
}

export function normalizeSpells(raw: unknown): SpellData {
  const parsed = safeParse<Partial<SpellData>>(raw, {});
  return {
    slots: parsed.slots ?? {},
    known: Array.isArray(parsed.known) ? parsed.known : [],
    prepared: Array.isArray(parsed.prepared) ? parsed.prepared : [],
    spellcastingAbility: parsed.spellcastingAbility ?? "",
    spellSaveDC: parsed.spellSaveDC ?? 0,
    spellAttackBonus: parsed.spellAttackBonus ?? 0,
  };
}

/** Запись Combatant из БД → типизированный объект движка */
export function hydrateCombatant(row: Record<string, any>): Combatant {
  const rawAttacks = safeParse<Record<string, unknown>[]>(row.attacks, []);

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color,
    x: row.x,
    y: row.y,
    facing: (row.facing || (row.type === "enemy" ? "W" : "E")) as any,
    hpCurrent: row.hpCurrent,
    hpMax: row.hpMax,
    hpTemp: row.hpTemp ?? 0,
    ac: row.ac,
    speed: row.speed,
    initiative: row.initiative ?? 0,
    initiativeTiebreak: row.initiativeTiebreak ?? 0,
    dexMod: row.dexMod ?? 0,
    conditions: safeParse<Condition[]>(row.conditions, []),
    isHidden: !!row.isHidden,
    hasActed: !!row.hasActed,
    className: row.className ?? "",
    level: row.level ?? 1,
    size: (row.size ?? "medium") as CreatureSize,
    movementUsed: row.movementUsed ?? 0,
    actionUsed: !!row.actionUsed,
    bonusActionUsed: !!row.bonusActionUsed,
    reactionUsed: !!row.reactionUsed,
    attacksPerAction: row.attacksPerAction ?? 1,
    attacksMadeThisAction: row.attacksMadeThisAction ?? 0,
    extraActions: row.extraActions ?? 0,
    hotbar: safeParse(row.hotbar, []),
    attacks: rawAttacks.map((a, i) => normalizeAttack(a, i)),
    spells: normalizeSpells(row.spells),
    abilities: safeParse<CombatAbility[]>(row.abilities, []),
    concentration: row.concentration ? safeParse(row.concentration, null) : null,
    wildShape: row.wildShape ? safeParse(row.wildShape, null) : null,
    saves: safeParse(row.saves, {}),
    abilityMods: safeParse(row.abilityMods, {}),
    profBonus: row.profBonus ?? 2,
    isAIControlled: !!row.isAIControlled,
    potions: safeParse<CombatPotion[]>(row.potions, []),
  };
}

/** Обратное преобразование: объект движка → поля для записи в БД */
export function dehydrateCombatant(c: Combatant): Record<string, unknown> {
  return {
    name: c.name,
    type: c.type,
    color: c.color,
    x: c.x,
    y: c.y,
    facing: c.facing || (c.type === "enemy" ? "W" : "E"),
    hpCurrent: c.hpCurrent,
    hpMax: c.hpMax,
    hpTemp: c.hpTemp,
    ac: c.ac,
    speed: c.speed,
    initiative: Number.isFinite(c.initiative) ? Math.round(c.initiative) : 0,
    initiativeTiebreak: Number.isFinite(c.initiativeTiebreak) ? Math.round(c.initiativeTiebreak) : 0,
    dexMod: Number.isFinite(c.dexMod) ? Math.round(c.dexMod) : 0,
    conditions: JSON.stringify(c.conditions),
    isHidden: c.isHidden,
    hasActed: c.hasActed,
    className: c.className,
    level: c.level,
    size: c.size,
    movementUsed: c.movementUsed,
    actionUsed: c.actionUsed,
    bonusActionUsed: c.bonusActionUsed,
    reactionUsed: c.reactionUsed,
    attacksPerAction: c.attacksPerAction,
    attacksMadeThisAction: c.attacksMadeThisAction,
    extraActions: c.extraActions,
    hotbar: JSON.stringify(c.hotbar),
    attacks: JSON.stringify(c.attacks),
    spells: JSON.stringify(c.spells),
    abilities: JSON.stringify(c.abilities),
    concentration: c.concentration ? JSON.stringify(c.concentration) : null,
    wildShape: c.wildShape ? JSON.stringify(c.wildShape) : null,
    saves: JSON.stringify(c.saves),
    abilityMods: JSON.stringify(c.abilityMods),
    profBonus: c.profBonus,
    isAIControlled: c.isAIControlled,
    potions: JSON.stringify(c.potions ?? []),
  };
}

export function hydrateMapElement(row: Record<string, any>): MapElement {
  return {
    id: row.id,
    type: row.type,
    x: row.x,
    y: row.y,
    width: row.width ?? 1,
    height: row.height ?? 1,
    properties: safeParse(row.properties, {}),
  };
}

/** Запись Combat со включёнными связями → объект движка */
export function hydrateCombat(row: Record<string, any>): Combat {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    round: row.round,
    currentTurnIndex: row.currentTurnIndex,
    turnOrder: safeParse<string[]>(row.turnOrder, []),
    gridWidth: row.gridWidth,
    gridHeight: row.gridHeight,
    cellSize: row.cellSize,
    backgroundUrl: row.backgroundUrl || undefined,
    log: safeParse<LogEntry[]>(row.log, []),
    combatants: (row.combatants ?? []).map(hydrateCombatant),
    mapElements: (row.mapElements ?? []).map(hydrateMapElement),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}
