import type { Attack, Combatant, CreatureSize } from "../types";
import type { MonsterDefinition, MonsterManifestEntry } from "./types";
import {
  loadDefaultManifest,
  loadMonsterDefinition,
} from "../encounters/encounter-generator";
import { monsterDefinitionToCombatant } from "./monster-adapter";
import { ATTACK_LIBRARY } from "../library-data";

export interface EnemyInputLike {
  name: string;
  monsterSlug?: string;
  hpMax?: number;
  ac?: number;
  speed?: number;
  dexMod?: number;
  strMod?: number;
  conMod?: number;
  intMod?: number;
  wisMod?: number;
  chaMod?: number;
  size?: CreatureSize;
  color?: string;
  position?: { x: number; y: number };
  attacks?: Array<{
    name: string;
    kind?: "melee" | "ranged" | "spell";
    attackBonus?: number;
    damageDice: string;
    damageType?: string;
    rangeNormal?: number;
    rangeLong?: number;
  }>;
}

export interface ResolveMonsterOptions {
  manifest?: MonsterManifestEntry[];
  monstersDir?: string;
}

export interface ResolvedMonsterResult {
  combatantData: Partial<Combatant>;
  xp: number;
  matched: boolean;
  manifestEntry?: MonsterManifestEntry;
  monsterDefinition?: MonsterDefinition;
}

/**
 * Common Russian and English stems/synonyms mapping to canonical SRD / Bestiary monster slugs.
 */
const CANONICAL_ALIASES: Record<string, string> = {
  // Guards / Soldiers
  страж: "442-guard",
  стражник: "442-guard",
  стражники: "442-guard",
  стража: "442-guard",
  охранник: "442-guard",
  охранники: "442-guard",
  караульный: "442-guard",
  караульные: "442-guard",
  гвардеец: "442-guard",
  гвардейцы: "442-guard",
  guard: "442-guard",
  guards: "442-guard",

  // Bandits / Rogues
  бандит: "437-bandit",
  бандиты: "437-bandit",
  разбойник: "437-bandit",
  разбойники: "437-bandit",
  грабитель: "437-bandit",
  грабители: "437-bandit",
  bandit: "437-bandit",
  bandits: "437-bandit",

  // Goblinoids
  гоблин: "4-goblin",
  гоблины: "4-goblin",
  goblin: "4-goblin",
  goblins: "4-goblin",
  хобгоблин: "27-hobgoblin",
  хобгоблины: "27-hobgoblin",
  hobgoblin: "27-hobgoblin",
  багбир: "34-bugbear",
  багбиры: "34-bugbear",
  bugbear: "34-bugbear",
  кобольд: "7-kobold",
  кобольды: "7-kobold",
  kobold: "7-kobold",

  // Orcs
  орк: "20-orc",
  орки: "20-orc",
  orc: "20-orc",
  orcs: "20-orc",

  // Undead
  скелет: "18-skeleton",
  скелеты: "18-skeleton",
  skeleton: "18-skeleton",
  skeletons: "18-skeleton",
  зомби: "29-zombie",
  zombie: "29-zombie",
  zombies: "29-zombie",
  упырь: "28-ghoul",
  гуль: "28-ghoul",
  ghoul: "28-ghoul",
  вурдалак: "30-ghast",
  ghast: "30-ghast",

  // Beasts
  волк: "148-wolf",
  волки: "148-wolf",
  wolf: "148-wolf",
  wolves: "148-wolf",
  лютоволк: "155-dire-wolf",
  лютоволки: "155-dire-wolf",
  "дикий волк": "155-dire-wolf",
  "dire wolf": "155-dire-wolf",
  паук: "142-giant-spider",
  "пещерный паук": "142-giant-spider",
  "гигантский паук": "142-giant-spider",
  "giant spider": "142-giant-spider",

  // Cultists & Magic Users
  культист: "434-cultist",
  культисты: "434-cultist",
  cultist: "434-cultist",
  фанатик: "435-cult-fanatic",
  "фанатик культа": "435-cult-fanatic",
  "cult fanatic": "435-cult-fanatic",
  маг: "439-mage",
  волшебник: "439-mage",
  mage: "439-mage",
  жрец: "436-priest",
  священник: "436-priest",
  priest: "436-priest",
  убийца: "431-assassin",
  ассасин: "431-assassin",
  assassin: "431-assassin",
  шпион: "440-spy",
  шпионы: "440-spy",
  spy: "440-spy",
  рыцарь: "438-knight",
  рыцари: "438-knight",
  knight: "438-knight",
  ветеран: "443-veteran",
  ветераны: "443-veteran",
  veteran: "443-veteran",
  берсерк: "430-berserker",
  berserker: "430-berserker",
  обыватель: "441-commoner",
  горожанин: "441-commoner",
  крестьянин: "441-commoner",
  commoner: "441-commoner",
  дворянин: "444-noble",
  знать: "444-noble",
  noble: "444-noble",
  гладиатор: "445-gladiator",
  gladiator: "445-gladiator",

  // Monsters
  тролль: "16-troll",
  troll: "16-troll",
  огр: "2-ogre",
  ogre: "2-ogre",
};

/**
 * Normalizes input name/query by stripping numbers, hashes, and punctuation.
 */
function cleanQuery(query: string): string {
  let q = query.trim().toLowerCase();
  // Strip trailing instance identifiers like " 1", " #2", "-3", " A", " B"
  q = q.replace(/[\s\-_#]+(?:\d+|[a-zа-я])$/i, "").trim();
  // Strip parentheses content like "(лучник)", "(воин)"
  q = q.replace(/\s*\([^)]*\)/g, "").trim();
  return q;
}

/**
 * Searches the Bestiary manifest for a monster by slug, exact name, or alias.
 */
export function findMonsterInManifest(
  rawQuery: string,
  manifest?: MonsterManifestEntry[]
): MonsterManifestEntry | null {
  if (!rawQuery) return null;
  const list = manifest || loadDefaultManifest();
  if (!list || list.length === 0) return null;

  const originalTrimmed = rawQuery.trim().toLowerCase();
  const q = cleanQuery(rawQuery);

  // 1. Direct slug match on full input or cleaned input
  let match = list.find(
    (m) =>
      m.slug.toLowerCase() === originalTrimmed ||
      m.slug.toLowerCase() === q ||
      m.id === originalTrimmed ||
      m.id === q
  );
  if (match) return match;

  // 2. Canonical alias match (e.g. "стражник" -> "442-guard")
  if (CANONICAL_ALIASES[q]) {
    const slug = CANONICAL_ALIASES[q];
    match = list.find((m) => m.slug === slug);
    if (match) return match;
  }
  if (CANONICAL_ALIASES[originalTrimmed]) {
    const slug = CANONICAL_ALIASES[originalTrimmed];
    match = list.find((m) => m.slug === slug);
    if (match) return match;
  }

  // 3. Exact Russian or English name match
  match = list.find(
    (m) =>
      m.name.toLowerCase() === originalTrimmed ||
      m.name.toLowerCase() === q ||
      m.nameEn.toLowerCase() === originalTrimmed ||
      m.nameEn.toLowerCase() === q
  );
  if (match) return match;

  // 4. Hyphenated compound role names (e.g. "гоблин-лучник", "орк-воин")
  if (q.includes("-")) {
    const parts = q.split("-").map((p) => p.trim());
    for (const part of parts) {
      if (CANONICAL_ALIASES[part]) {
        const slug = CANONICAL_ALIASES[part];
        match = list.find((m) => m.slug === slug);
        if (match) return match;
      }
      match = list.find(
        (m) =>
          m.name.toLowerCase() === part ||
          m.nameEn.toLowerCase() === part ||
          m.slug.toLowerCase() === part
      );
      if (match) return match;
    }
  }

  // 4b. Common two-word adjective prefixes (e.g. "городской страж", "элитный стражник")
  const words = q.split(/\s+/);
  if (words.length === 2) {
    const commonAdjectives = new Set([
      "городской", "элитный", "простой", "обычный", "дикий", "свирепый",
      "старый", "пьяный", "гвардейский", "королевский", "городская",
      "city", "elite", "wild", "royal", "drunk"
    ]);
    const [first, second] = words;
    const targetWord = commonAdjectives.has(first) ? second : (commonAdjectives.has(second) ? first : null);
    if (targetWord && CANONICAL_ALIASES[targetWord]) {
      const slug = CANONICAL_ALIASES[targetWord];
      match = list.find((m) => m.slug === slug);
      if (match) return match;
    }
  }

  // 5. Word boundary / prefix match for single-word or short query of length >= 4
  if (q.length >= 4 && words.length <= 2) {
    const candidates = list.filter((m) => {
      const ru = m.name.toLowerCase();
      const en = m.nameEn.toLowerCase();
      return (
        ru === q ||
        en === q ||
        ru.startsWith(q + " ") ||
        en.startsWith(q + " ") ||
        ru.endsWith(" " + q) ||
        en.endsWith(" " + q)
      );
    });

    if (candidates.length > 0) {
      // Sort candidates:
      // Priority 1: Official Monster Manual / System source
      // Priority 2: Non-named monsters (standard creatures over unique NPC bosses)
      // Priority 3: Lowest CR
      candidates.sort((a, b) => {
        const aIsMM = a.source === "Monster Manual" ? -1 : 1;
        const bIsMM = b.source === "Monster Manual" ? -1 : 1;
        if (aIsMM !== bIsMM) return aIsMM - bIsMM;

        const aNamed = a.isNamed ? 1 : -1;
        const bNamed = b.isNamed ? 1 : -1;
        if (aNamed !== bNamed) return aNamed - bNamed;

        return a.challengeRating - b.challengeRating;
      });

      return candidates[0];
    }
  }

  return null;
}

/**
 * Checks if the enemy input attacks are just generic/hallucinated placeholders
 * (e.g. single "Скимитар" or "Удар") that should be replaced with authentic Bestiary attacks.
 */
function isPlaceholderAttackList(
  attacks?: Array<{ name: string; damageDice: string }>
): boolean {
  if (!attacks || attacks.length === 0) return true;
  if (attacks.length === 1) {
    const name = attacks[0].name.toLowerCase().trim();
    if (name === "скимитар" || name === "удар" || name === "атака" || name === "scimitar" || name === "strike") {
      return true;
    }
  }
  return false;
}

/**
 * Resolves a manual or AI-passed enemy input against the Bestiary,
 * returning full authentic D&D 5e combatant stats, attacks, actions, and XP.
 */
export function resolveMonsterCombatant(
  enemy: EnemyInputLike,
  options?: ResolveMonsterOptions
): ResolvedMonsterResult {
  const manifest = options?.manifest || loadDefaultManifest(options?.monstersDir);
  const manifestEntry = findMonsterInManifest(enemy.monsterSlug || enemy.name, manifest);

  if (manifestEntry) {
    const monsterDef = loadMonsterDefinition(
      manifestEntry.slug,
      manifestEntry,
      options?.monstersDir
    );

    const baseCombatant = monsterDefinitionToCombatant(monsterDef, {
      name: enemy.name || monsterDef.name,
      isAIControlled: true,
      type: "enemy",
    });

    // Check if attacks should use the authentic Bestiary attacks or custom caller attacks
    let attacks: Attack[] = baseCombatant.attacks;
    if (enemy.attacks && enemy.attacks.length > 0 && !isPlaceholderAttackList(enemy.attacks)) {
      // Caller explicitly specified meaningful custom attacks
      attacks = enemy.attacks.map((a, i) => {
        const match = a.damageDice.match(/^(\d*d\d+)(?:([+-])(\d+))?$/i);
        const dice = match ? match[1] : a.damageDice || "1d6";
        const mod =
          match && match[3]
            ? (match[2] === "-" ? -1 : 1) * parseInt(match[3], 10)
            : baseCombatant.abilityMods?.STR ?? 0;
        const kind =
          a.kind || (a.rangeNormal && a.rangeNormal > 10 ? "ranged" : "melee");

        return {
          id: `atk_e_${i}_${Math.random().toString(36).slice(2, 6)}`,
          name: a.name || "Удар",
          attackBonus: a.attackBonus ?? ((baseCombatant.abilityMods?.STR ?? 1) + (baseCombatant.profBonus ?? 2)),
          damage: [{ dice, mod, type: a.damageType || "slashing" }],
          kind,
          range: { normal: a.rangeNormal || (kind === "ranged" ? 60 : 5), long: a.rangeLong },
          actionCost: "action",
        };
      });
    }

    const hpMax = enemy.hpMax && enemy.hpMax > 0 ? enemy.hpMax : baseCombatant.hpMax;
    const ac = enemy.ac && enemy.ac > 0 ? enemy.ac : baseCombatant.ac;
    const speed = enemy.speed && enemy.speed > 0 ? enemy.speed : baseCombatant.speed;
    const color = enemy.color || baseCombatant.color || "#ef4444";
    const size = enemy.size || baseCombatant.size || "medium";
    const dexMod = enemy.dexMod !== undefined ? enemy.dexMod : baseCombatant.dexMod;

    const combatantData: Partial<Combatant> = {
      ...baseCombatant,
      name: enemy.name || baseCombatant.name,
      hpMax,
      hpCurrent: hpMax,
      hpTemp: 0,
      ac,
      speed,
      color,
      size,
      dexMod,
      attacks,
      hotbar: attacks.map((a) => ({ id: a.id, type: "attack", name: a.name })),
    };

    return {
      combatantData,
      xp: manifestEntry.xp || Math.max(10, hpMax * 5),
      matched: true,
      manifestEntry,
      monsterDefinition: monsterDef,
    };
  }

  // --- Fallback for custom unrecognized monsters ---
  const dexMod = enemy.dexMod ?? 0;
  const strMod = enemy.strMod ?? 1;
  const conMod = enemy.conMod ?? 1;
  const intMod = enemy.intMod ?? -1;
  const wisMod = enemy.wisMod ?? 0;
  const chaMod = enemy.chaMod ?? -1;

  let attacks: Attack[] = [];
  if (enemy.attacks && enemy.attacks.length > 0) {
    attacks = enemy.attacks.map((a, i) => {
      const match = a.damageDice.match(/^(\d*d\d+)(?:([+-])(\d+))?$/i);
      const dice = match ? match[1] : a.damageDice || "1d6";
      const mod =
        match && match[3]
          ? (match[2] === "-" ? -1 : 1) * parseInt(match[3], 10)
          : strMod;
      const kind =
        a.kind || (a.rangeNormal && a.rangeNormal > 10 ? "ranged" : "melee");

      return {
        id: `atk_e_${i}_${Math.random().toString(36).slice(2, 6)}`,
        name: a.name || "Удар",
        attackBonus: a.attackBonus ?? (strMod + 2),
        damage: [{ dice, mod, type: a.damageType || "slashing" }],
        kind,
        range: { normal: a.rangeNormal || (kind === "ranged" ? 60 : 5), long: a.rangeLong },
        actionCost: "action",
      };
    });
  } else {
    const libAtk = ATTACK_LIBRARY.find((a) => a.name === "Скимитар") || ATTACK_LIBRARY[0];
    attacks = [
      {
        id: `atk_e_${Math.random().toString(36).slice(2, 6)}`,
        name: libAtk?.name || "Удар когтями",
        attackBonus: strMod + 2,
        damage: [{ dice: "1d6", mod: strMod, type: "slashing" }],
        kind: "melee",
        range: { normal: 5 },
        actionCost: "action",
      },
    ];
  }

  const hpMax = enemy.hpMax || 20;
  const ac = enemy.ac || 12;

  const combatantData: Partial<Combatant> = {
    name: enemy.name || "Враг",
    type: "enemy",
    color: enemy.color || "#ef4444",
    hpMax,
    hpCurrent: hpMax,
    hpTemp: 0,
    ac,
    speed: enemy.speed || 30,
    dexMod,
    initiative: 0,
    initiativeTiebreak: Math.floor(Math.random() * 1_000_000),
    className: "враг",
    level: 1,
    size: enemy.size || "medium",
    attacks,
    hotbar: attacks.map((a) => ({ id: a.id, type: "attack", name: a.name })),
    spells: { slots: {}, known: [], prepared: [], spellSaveDC: 10, spellAttackBonus: 2 },
    abilities: [],
    abilityMods: { STR: strMod, DEX: dexMod, CON: conMod, INT: intMod, WIS: wisMod, CHA: chaMod },
    saves: {
      STR: { prof: false, mod: strMod },
      DEX: { prof: false, mod: dexMod },
      CON: { prof: false, mod: conMod },
      INT: { prof: false, mod: intMod },
      WIS: { prof: false, mod: wisMod },
      CHA: { prof: false, mod: chaMod },
    },
    profBonus: 2,
    isAIControlled: true,
  };

  return {
    combatantData,
    xp: hpMax * 5,
    matched: false,
  };
}
