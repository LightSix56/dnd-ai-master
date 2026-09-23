import type { Cell, Combatant } from "../types";
import type { TacticalMapPreset, SpawnZoneType, SpawnZoneDefinition } from "./types";

export type TacticalRole = "vanguard" | "backline" | "boss" | "flanker" | "leader";

export interface SpawnDirectorOptions {
  roleOverrides?: Record<string, TacticalRole>;
  randomizeWithinZone?: boolean;
}

/**
 * Автоматическая генерация тактических зон спавна по умолчанию, если они не заданы в пресете
 */
export function createDefaultSpawnZones(gridWidth: number, gridHeight: number): SpawnZoneDefinition[] {
  const midY = Math.floor(gridHeight / 2);
  const partyCells: Cell[] = [];
  const partyXEnd = Math.max(2, Math.min(4, Math.floor(gridWidth * 0.25)));
  for (let x = 1; x <= partyXEnd; x++) {
    for (let y = Math.max(1, midY - 2); y <= Math.min(gridHeight - 2, midY + 2); y++) {
      partyCells.push({ x, y });
    }
  }

  const enemyFrontX = Math.max(partyXEnd + 2, Math.min(gridWidth - 5, Math.floor(gridWidth * 0.65)));
  const enemyFrontCells: Cell[] = [];
  for (let x = enemyFrontX; x <= Math.min(enemyFrontX + 2, gridWidth - 2); x++) {
    for (let y = Math.max(1, midY - 2); y <= Math.min(gridHeight - 2, midY + 2); y++) {
      enemyFrontCells.push({ x, y });
    }
  }

  const enemyBackX = Math.min(enemyFrontX + 2, gridWidth - 3);
  const enemyBackCells: Cell[] = [];
  for (let x = enemyBackX; x <= Math.min(gridWidth - 2, enemyBackX + 2); x++) {
    for (let y = Math.max(1, midY - 3); y <= Math.min(gridHeight - 2, midY + 3); y++) {
      enemyBackCells.push({ x, y });
    }
  }

  return [
    { name: "party", cells: partyCells },
    { name: "enemy_frontline", cells: enemyFrontCells },
    { name: "enemy_backline", cells: enemyBackCells },
    { name: "boss", cells: enemyBackCells },
  ];
}


const BOSS_KEYWORDS = [
  "босс",
  "главарь",
  "лидер",
  "капитан",
  "архимаг",
  "верховный",
  "король",
  "вождь",
  "boss",
  "leader",
  "captain",
  "warlord",
  "dragon",
  "дракон",
  "лич",
  "lich",
];

const BACKLINE_CLASSES = [
  "wizard",
  "sorcerer",
  "warlock",
  "cleric",
  "druid",
  "bard",
  "ranger",
  "archer",
  "маг",
  "колдун",
  "чародей",
  "жрец",
  "лучник",
  "следопыт",
];

/**
 * Определение тактической роли участника боя по характеристикам и навыкам
 */
export function inferCombatantRole(combatant: Combatant): TacticalRole {
  const nameLower = combatant.name.toLowerCase();
  const classLower = (combatant.className || "").toLowerCase();

  // 1. Проверка на босса
  for (const kw of BOSS_KEYWORDS) {
    if (nameLower.includes(kw) || classLower.includes(kw)) {
      return "boss";
    }
  }
  if (combatant.hpMax >= 75) {
    return "boss";
  }

  // 2. Проверка на заклинателя или стрелка
  for (const bc of BACKLINE_CLASSES) {
    if (classLower.includes(bc) || nameLower.includes(bc)) {
      return "backline";
    }
  }

  // Проверка слотов заклинаний
  if (combatant.spells?.slots) {
    const hasSpellSlots = Object.values(combatant.spells.slots).some(
      (s) => s && (s.max > 0 || s.used > 0)
    );
    if (hasSpellSlots) return "backline";
  }

  // Проверка дальнобойных атак
  if (Array.isArray(combatant.attacks)) {
    const hasRanged = combatant.attacks.some((a) => {
      const aName = (a.name || "").toLowerCase();
      return (
        (a.range && a.range.normal > 5) ||
        aName.includes("лук") ||
        aName.includes("арбалет") ||
        aName.includes("bow") ||
        aName.includes("crossbow") ||
        aName.includes("луч") ||
        aName.includes("bolt")
      );
    });
    if (hasRanged) return "backline";
  }

  // 3. По умолчанию — рукопашный авангард
  return "vanguard";
}

/**
 * Поиск ближайшей свободной и проходимой клетки методом BFS
 */
function findClosestPassableCell(
  origin: Cell,
  width: number,
  height: number,
  isBlocked: (x: number, y: number) => boolean,
  isOccupied: (x: number, y: number) => boolean
): Cell {
  const queue: Cell[] = [origin];
  const visited = new Set<string>([`${origin.x},${origin.y}`]);
  let perimeterFallback: Cell | null = null;

  const DIRS = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!isBlocked(current.x, current.y) && !isOccupied(current.x, current.y)) {
      const isPerimeter =
        current.x === 0 || current.x === width - 1 || current.y === 0 || current.y === height - 1;
      if (!isPerimeter || width <= 2 || height <= 2) {
        return current;
      }
      if (!perimeterFallback) {
        perimeterFallback = current;
      }
    }

    for (const d of DIRS) {
      const nx = current.x + d.x;
      const ny = current.y + d.y;
      const key = `${nx},${ny}`;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(key)) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  // Фолбэк на периметровую клетку или исходную точку
  return perimeterFallback || origin;
}

/**
 * Назначение тактических позиций спавна бойцам с учётом их ролей и топологии карты
 */
export function assignTacticalSpawns(
  preset: TacticalMapPreset,
  combatants: Combatant[],
  options?: SpawnDirectorOptions
): Combatant[] {
  const blockedSet = new Set<string>();

  for (const elem of preset.elements) {
    if (elem.type === "wall" || elem.type === "obstacle") {
      for (let dx = 0; dx < elem.width; dx++) {
        for (let dy = 0; dy < elem.height; dy++) {
          blockedSet.add(`${elem.x + dx},${elem.y + dy}`);
        }
      }
    } else if (elem.type === "door" && elem.properties.isOpen === false) {
      for (let dx = 0; dx < elem.width; dx++) {
        for (let dy = 0; dy < elem.height; dy++) {
          blockedSet.add(`${elem.x + dx},${elem.y + dy}`);
        }
      }
    }
  }

  const isBlocked = (x: number, y: number) =>
    blockedSet.has(`${x},${y}`) || x < 0 || x >= preset.gridWidth || y < 0 || y >= preset.gridHeight;

  const occupiedSet = new Set<string>();
  const isOccupied = (x: number, y: number) => occupiedSet.has(`${x},${y}`);

  const rawSpawnZones =
    preset.spawnZones && preset.spawnZones.length > 0
      ? preset.spawnZones
      : createDefaultSpawnZones(preset.gridWidth, preset.gridHeight);

  // Карты зон
  const zoneMap = new Map<SpawnZoneType, Cell[]>();
  for (const zone of rawSpawnZones) {
    // Копируем клетки зоны, отфильтровав заблокированные
    const validCells = zone.cells.filter((c) => !isBlocked(c.x, c.y));
    zoneMap.set(zone.name, [...validCells]);
  }

  // Разделяем участников на группу игроков и врагов
  const players: Combatant[] = [];
  const enemies: Combatant[] = [];

  for (const c of combatants) {
    if (c.type === "player" || c.type === "companion") {
      players.push(c);
    } else {
      enemies.push(c);
    }
  }

  const result: Combatant[] = [];

  // 1. Размещение отряда игроков в зоне 'party'
  const partyPool = zoneMap.get("party") || [];
  for (const p of players) {
    let chosenCell: Cell | null = null;

    while (partyPool.length > 0) {
      const candidate = partyPool.shift()!;
      if (!isOccupied(candidate.x, candidate.y) && !isBlocked(candidate.x, candidate.y)) {
        chosenCell = candidate;
        break;
      }
    }

    if (!chosenCell) {
      const fallbackOrigin = rawSpawnZones.find((z) => z.name === "party")?.cells[0] || {
        x: Math.max(1, Math.min(2, Math.floor(preset.gridWidth * 0.2))),
        y: Math.max(1, Math.min(preset.gridHeight - 2, Math.floor(preset.gridHeight / 2))),
      };
      chosenCell = findClosestPassableCell(fallbackOrigin, preset.gridWidth, preset.gridHeight, isBlocked, isOccupied);
    }

    occupiedSet.add(`${chosenCell.x},${chosenCell.y}`);
    result.push({
      ...p,
      x: chosenCell.x,
      y: chosenCell.y,
    });
  }

  // 2. Размещение врагов по ролям
  for (const e of enemies) {
    const role: TacticalRole = options?.roleOverrides?.[e.id] || inferCombatantRole(e);

    // Подбор приоритетной зоны
    let targetZoneNames: SpawnZoneType[];
    if (role === "boss" || role === "leader") {
      targetZoneNames = ["boss", "enemy_backline", "enemy_frontline"];
    } else if (role === "flanker") {
      targetZoneNames = ["ambush_flank", "enemy_backline", "enemy_frontline"];
    } else if (role === "backline") {
      targetZoneNames = ["enemy_backline", "enemy_frontline", "boss"];
    } else {
      targetZoneNames = ["enemy_frontline", "boss", "enemy_backline"];
    }

    let chosenCell: Cell | null = null;

    for (const zName of targetZoneNames) {
      const pool = zoneMap.get(zName);
      if (pool && pool.length > 0) {
        while (pool.length > 0) {
          const candidate = pool.shift()!;
          if (!isOccupied(candidate.x, candidate.y) && !isBlocked(candidate.x, candidate.y)) {
            chosenCell = candidate;
            break;
          }
        }
      }
      if (chosenCell) break;
    }

    if (!chosenCell) {
      // Ищем ближайшую свободную клетку от центра первой зоны из списка
      const primaryZone = rawSpawnZones.find((z) => z.name === targetZoneNames[0]);
      const fallbackOrigin = primaryZone?.cells[0] || {
        x: Math.max(1, Math.min(preset.gridWidth - 4, Math.floor(preset.gridWidth * 0.7))),
        y: Math.max(1, Math.min(preset.gridHeight - 2, Math.floor(preset.gridHeight / 2))),
      };
      chosenCell = findClosestPassableCell(fallbackOrigin, preset.gridWidth, preset.gridHeight, isBlocked, isOccupied);
    }

    occupiedSet.add(`${chosenCell.x},${chosenCell.y}`);
    result.push({
      ...e,
      x: chosenCell.x,
      y: chosenCell.y,
    });
  }

  return result;
}
