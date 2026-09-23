// D&D 5e SRD 5.1 Official Compendium Adapter
import type { ActionParameters, AttackKind, ActionCost, DamageRoll, CharacterPreset } from "../types";
import type { AttackDefinition, SpellDefinition, AbilityDefinition } from "../library-data";

import spellsData from "./data/spells.json";
import expandedSpellsData from "../data/expanded-combat-spells.json";
import monstersData from "./data/monsters.json";
import weaponsData from "./data/equipment.json";

export interface SRDSpell {
  id: string;
  name: string;
  nameEn: string;
  level: number;
  school: string;
  classes: string[];
  components: string[];
  material?: string;
  ritual: boolean;
  duration: string;
  concentration: boolean;
  castingTime: string;
  rangeRaw?: string;
  parameters: ActionParameters;
}

export interface SRDWeapon {
  id: string;
  name: string;
  nameEn: string;
  kind: AttackKind;
  attackBonus: number;
  damage: DamageRoll[];
  rangeNormal: number;
  rangeLong?: number;
  finesse: boolean;
  versatile: boolean;
  actionCost: ActionCost;
  category: string;
  cost?: string;
  weight?: number;
  description: string;
}

// In-memory caches for O(1) lookups
const spellsList: SRDSpell[] = spellsData as unknown as SRDSpell[];
const expandedList: SRDSpell[] = expandedSpellsData as unknown as SRDSpell[];
const allCombatSpellsList: SRDSpell[] = [...spellsList, ...expandedList];
const monstersList: CharacterPreset[] = monstersData as unknown as CharacterPreset[];
const weaponsList: SRDWeapon[] = weaponsData as unknown as SRDWeapon[];

const spellsByName = new Map<string, SRDSpell>();
const spellsByNameEn = new Map<string, SRDSpell>();
for (const s of allCombatSpellsList) {
  spellsByName.set(s.name.toLowerCase(), s);
  spellsByNameEn.set(s.nameEn.toLowerCase(), s);
  spellsByName.set(s.id.toLowerCase(), s);
}

const monstersByName = new Map<string, CharacterPreset>();
const monstersByNameEn = new Map<string, CharacterPreset>();
for (const m of monstersList) {
  monstersByName.set(m.name.toLowerCase(), m);
  if ((m as any).nameRu) monstersByName.set((m as any).nameRu.toLowerCase(), m);
  if ((m as any).nameEn) monstersByNameEn.set((m as any).nameEn.toLowerCase(), m);
  monstersByName.set(m.id.toLowerCase(), m);
}

const weaponsByName = new Map<string, SRDWeapon>();
const weaponsByNameEn = new Map<string, SRDWeapon>();
for (const w of weaponsList) {
  weaponsByName.set(w.name.toLowerCase(), w);
  weaponsByNameEn.set(w.nameEn.toLowerCase(), w);
  weaponsByName.set(w.id.toLowerCase(), w);
}

// ============ SPELLS API ============

export function getAllSRDSpells(): SRDSpell[] {
  return spellsList;
}

export function getAllCombatSpells(): SRDSpell[] {
  return allCombatSpellsList;
}

export const getAllSpells = getAllCombatSpells;
export const getSpell = getSRDSpell;
export const searchSpells = searchSRDSpells;

export function getSRDSpell(nameOrQuery: string): SRDSpell | undefined {
  if (!nameOrQuery) return undefined;
  const q = nameOrQuery.trim().toLowerCase();
  return (
    spellsByName.get(q) ||
    spellsByNameEn.get(q) ||
    allCombatSpellsList.find(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.id.toLowerCase() === q
    )
  );
}

export function searchSRDSpells(
  query: string,
  filters?: { level?: number; school?: string; className?: string }
): SRDSpell[] {
  const q = query ? query.trim().toLowerCase() : "";
  return allCombatSpellsList.filter((s) => {
    if (filters?.level !== undefined && s.level !== filters.level) return false;
    if (filters?.school && s.school.toLowerCase() !== filters.school.toLowerCase()) return false;
    if (
      filters?.className &&
      !s.classes.some((c) => c.toLowerCase().includes(filters.className!.toLowerCase()))
    )
      return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.nameEn.toLowerCase().includes(q) ||
      s.school.toLowerCase().includes(q)
    );
  });
}

export function srdSpellToSpellDefinition(s: SRDSpell): SpellDefinition {
  return {
    name: s.name,
    level: s.level,
    school: s.school,
    parameters: s.parameters,
  };
}

// ============ MONSTERS / BESTIARY API ============

export function getAllSRDMonsters(): CharacterPreset[] {
  return monstersList;
}

export function getSRDMonster(nameOrQuery: string): CharacterPreset | undefined {
  if (!nameOrQuery) return undefined;
  const q = nameOrQuery.trim().toLowerCase();
  return (
    monstersByName.get(q) ||
    monstersByNameEn.get(q) ||
    monstersList.find(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m as any).nameRu?.toLowerCase().includes(q) ||
        (m as any).nameEn?.toLowerCase().includes(q) ||
        m.id.toLowerCase() === q
    )
  );
}

export function searchSRDMonsters(
  query: string,
  filters?: { cr?: string; type?: string; size?: string }
): CharacterPreset[] {
  const q = query ? query.trim().toLowerCase() : "";
  return monstersList.filter((m) => {
    if (filters?.cr && m.cr !== filters.cr) return false;
    if (filters?.type && !m.className.toLowerCase().includes(filters.type.toLowerCase())) return false;
    if (filters?.size && m.size !== filters.size) return false;
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      (m as any).nameRu?.toLowerCase().includes(q) ||
      (m as any).nameEn?.toLowerCase().includes(q) ||
      m.className.toLowerCase().includes(q)
    );
  });
}

// ============ WEAPONS & EQUIPMENT API ============

export function getAllSRDWeapons(): SRDWeapon[] {
  return weaponsList;
}

export function getSRDWeapon(nameOrQuery: string): SRDWeapon | undefined {
  if (!nameOrQuery) return undefined;
  const q = nameOrQuery.trim().toLowerCase();
  return (
    weaponsByName.get(q) ||
    weaponsByNameEn.get(q) ||
    weaponsList.find(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.nameEn.toLowerCase().includes(q) ||
        w.id.toLowerCase() === q
    )
  );
}

export function searchSRDWeapons(query: string, category?: string): SRDWeapon[] {
  const q = query ? query.trim().toLowerCase() : "";
  return weaponsList.filter((w) => {
    if (category && !w.category.toLowerCase().includes(category.toLowerCase())) return false;
    if (!q) return true;
    return (
      w.name.toLowerCase().includes(q) ||
      w.nameEn.toLowerCase().includes(q) ||
      w.category.toLowerCase().includes(q)
    );
  });
}

export function srdWeaponToAttackDefinition(w: SRDWeapon): AttackDefinition {
  return {
    name: w.name,
    kind: w.kind,
    attackBonus: w.attackBonus,
    damage: w.damage,
    rangeNormal: w.rangeNormal,
    rangeLong: w.rangeLong,
    finesse: w.finesse,
    actionCost: w.actionCost,
    description: w.description,
  };
}
