// Общая обвязка для боевых тестов подклассов Воина: бойцы и состояние боя без БД.
// Math.random в тестах зафиксирован на 0.5: d20 = 11, к6 = 4, к8 = 5, к10 = 6, к12 = 7.

import { extractAbilitiesFromCharacter } from "../../character-adapter";
import type { CombatAbility, Combatant } from "../../types";

export interface HeroOptions {
  sheet?: Record<string, any>;
  x?: number;
  y?: number;
  mods?: Partial<Record<string, number>>;
  attackBonus?: number;
}

export function hero(id: string, subclass: string, level: number, o: HeroOptions = {}): Combatant {
  const mods = { STR: 3, DEX: 1, CON: 2, INT: 1, WIS: 0, CHA: 2, ...o.mods };
  const c: any = {
    id,
    name: id,
    type: "player",
    className: "Воин",
    level,
    hpCurrent: 40,
    hpMax: 40,
    hpTemp: 0,
    ac: 15,
    speed: 30,
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    x: o.x ?? 5,
    y: o.y ?? 5,
    facing: "E",
    size: "medium",
    conditions: [],
    abilityMods: mods,
    profBonus: 3,
    saves: {},
    attacks: [
      {
        id: "sword",
        name: "Длинный меч",
        kind: "melee",
        range: { normal: 5 },
        attackBonus: o.attackBonus ?? 7,
        damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
        actionCost: "action",
      },
      {
        id: "bow",
        name: "Длинный лук",
        kind: "ranged",
        range: { normal: 150, long: 600 },
        attackBonus: o.attackBonus ?? 7,
        damage: [{ dice: "1d8", mod: 1, type: "piercing" }],
        actionCost: "action",
      },
    ],
    abilities: [],
    spells: { slots: {}, known: [] },
    hotbar: [],
    concentration: null,
  };
  c.abilities = extractAbilitiesFromCharacter({ id, class: "Воин", subclass, ...(o.sheet ?? {}) }, level, 3, c.abilityMods);
  return c;
}

export function enemy(id: string, x: number, y: number, extra: Partial<Combatant> = {}): Combatant {
  const base = hero(id, "", 1, { x, y });
  return {
    ...base,
    type: "enemy",
    abilities: [],
    ac: 10,
    hpCurrent: 200,
    hpMax: 200,
    abilityMods: { STR: -5, DEX: -5, CON: -5, INT: 0, WIS: -5, CHA: 0 },
    ...extra,
  } as Combatant;
}

export function ally(id: string, x: number, y: number, extra: Partial<Combatant> = {}): Combatant {
  return { ...hero(id, "", 1, { x, y }), abilities: [], ...extra } as Combatant;
}

export function makeState(combatants: Combatant[]) {
  return {
    combatants,
    mapElements: [],
    gridWidth: 30,
    gridHeight: 30,
    round: 1,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    log: [] as any[],
    dirtyIds: new Set<string>(),
    isCombatDirty: false,
    require(id: string) {
      const c = this.combatants.find((x: Combatant) => x.id === id);
      if (!c) throw new Error("Not found: " + id);
      return c;
    },
    get(id: string) {
      return this.combatants.find((x: Combatant) => x.id === id);
    },
    current() {
      return this.combatants[this.currentTurnIndex];
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
  } as any;
}

export const bySrd = (c: Combatant, key: string): CombatAbility => {
  const a = c.abilities.find((x) => x.parameters?.srdKey === key);
  if (!a) throw new Error(`${c.name}: нет умения ${key}`);
  return a;
};

export const hasLog = (state: any, text: string) => state.log.some((l: any) => String(l.text).includes(text));
