import { EngineError } from "../engine";
import type { Cell, MapElement } from "../types";
import type {
  UniversalVTT,
  TacticalMapPreset,
  BiomeType,
  SpawnZoneDefinition,
  UVTTPoint,
} from "./types";

interface ParseOptions {
  id: string;
  name: string;
  nameEn: string;
  biome: BiomeType;
  tags?: string[];
  description?: string;
  backgroundUrl?: string;
}

/**
 * Растеризация полилинии стен в дискретную сетку клеток (5x5 фт)
 */
function rasterizeLineSegment(
  p1: UVTTPoint,
  p2: UVTTPoint,
  width: number,
  height: number,
  targetSet: Set<string>
): void {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const steps = Math.max(1, Math.ceil(dist / 0.25));

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const gx = p1.x + (p2.x - p1.x) * t;
    const gy = p1.y + (p2.y - p1.y) * t;
    const cx = Math.floor(gx);
    const cy = Math.floor(gy);

    if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
      targetSet.add(`${cx},${cy}`);
    }
  }
}

/**
 * Автоматическое вычисление тактических зон спавна из свободных клеток
 */
function computeSpawnZones(
  width: number,
  height: number,
  blockedCells: Set<string>
): SpawnZoneDefinition[] {
  const passableCells: Cell[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!blockedCells.has(`${x},${y}`)) {
        passableCells.push({ x, y });
      }
    }
  }

  if (passableCells.length === 0) {
    return [
      { name: "party", cells: [{ x: 0, y: 0 }] },
      { name: "boss", cells: [{ x: Math.max(0, width - 1), y: Math.max(0, height - 1) }] },
    ];
  }

  // Сортировка по расстоянию от левого верхнего угла (входа)
  passableCells.sort((a, b) => a.x + a.y - (b.x + b.y));

  const total = passableCells.length;
  const partySlice = passableCells.slice(0, Math.min(8, Math.max(2, Math.floor(total * 0.15))));
  const bossSlice = passableCells.slice(Math.max(0, total - 4));
  const midStart = Math.floor(total * 0.35);
  const midEnd = Math.floor(total * 0.65);
  const frontlineSlice = passableCells.slice(midStart, Math.min(midStart + 8, midEnd));
  const backlineSlice = passableCells.slice(Math.max(midEnd, total - 12), Math.max(0, total - 4));

  return [
    { name: "party", cells: partySlice },
    { name: "enemy_frontline", cells: frontlineSlice.length > 0 ? frontlineSlice : bossSlice },
    { name: "enemy_backline", cells: backlineSlice.length > 0 ? backlineSlice : bossSlice },
    { name: "boss", cells: bossSlice },
  ];
}

/**
 * Парсер Universal VTT (.dd2vtt / .uvtt) в готовый TacticalMapPreset боевого движка
 */
export function parseUniversalVTT(
  input: string | UniversalVTT,
  options: ParseOptions
): TacticalMapPreset {
  let data: UniversalVTT;

  if (typeof input === "string") {
    try {
      data = JSON.parse(input) as UniversalVTT;
    } catch (e) {
      throw new EngineError(`Ошибка парсинга Universal VTT: невалидный JSON (${(e as Error).message})`);
    }
  } else {
    data = input;
  }

  if (
    !data ||
    typeof data !== "object" ||
    !data.resolution ||
    !data.resolution.map_size ||
    typeof data.resolution.map_size.x !== "number" ||
    typeof data.resolution.map_size.y !== "number" ||
    data.resolution.map_size.x <= 0 ||
    data.resolution.map_size.y <= 0
  ) {
    throw new EngineError(
      "Ошибка Universal VTT: отсутствуют или некорректны параметры resolution.map_size (x > 0, y > 0)"
    );
  }

  const width = Math.round(data.resolution.map_size.x);
  const height = Math.round(data.resolution.map_size.y);

  const wallCells = new Set<string>();
  const coverCells = new Set<string>();
  const blockedForSpawn = new Set<string>();

  // 1. Растеризация стен Line of Sight
  if (Array.isArray(data.line_of_sight)) {
    for (const poly of data.line_of_sight) {
      if (!Array.isArray(poly) || poly.length < 2) continue;
      for (let i = 0; i < poly.length - 1; i++) {
        rasterizeLineSegment(poly[i], poly[i + 1], width, height, wallCells);
      }
    }
  }

  // 2. Растеризация объектов укрытия Objects Line of Sight
  if (Array.isArray(data.objects_line_of_sight)) {
    for (const poly of data.objects_line_of_sight) {
      if (!Array.isArray(poly) || poly.length < 2) continue;
      for (let i = 0; i < poly.length - 1; i++) {
        rasterizeLineSegment(poly[i], poly[i + 1], width, height, coverCells);
      }
    }
  }

  // 3. Обработка порталов (дверей и окон)
  const doors: MapElement[] = [];
  const doorKeySet = new Set<string>();

  if (Array.isArray(data.portals)) {
    let portalIdx = 1;
    for (const portal of data.portals) {
      if (!portal.position) continue;
      const px = Math.floor(portal.position.x);
      const py = Math.floor(portal.position.y);

      if (px >= 0 && px < width && py >= 0 && py < height) {
        const key = `${px},${py}`;
        // Дверь замещает стену и укрытие в этой клетке
        wallCells.delete(key);
        coverCells.delete(key);
        doorKeySet.add(key);

        const isOpen = !portal.closed;
        doors.push({
          id: `door-${options.id}-${portalIdx++}`,
          type: "door",
          x: px,
          y: py,
          width: 1,
          height: 1,
          properties: {
            isOpen,
            label: isOpen ? "Дверь (открыта)" : "Дверь (закрыта)",
          },
        });

        if (!isOpen) {
          blockedForSpawn.add(key);
        }
      }
    }
  }

  // Формируем элементы карты
  const elements: MapElement[] = [...doors];
  let elemIdx = 1;

  for (const key of wallCells) {
    if (doorKeySet.has(key)) continue;
    const [x, y] = key.split(",").map(Number);
    elements.push({
      id: `wall-${options.id}-${elemIdx++}`,
      type: "wall",
      x,
      y,
      width: 1,
      height: 1,
      properties: { label: "Стена" },
    });
    blockedForSpawn.add(key);
  }

  for (const key of coverCells) {
    if (doorKeySet.has(key) || wallCells.has(key)) continue;
    const [x, y] = key.split(",").map(Number);
    elements.push({
      id: `cover-${options.id}-${elemIdx++}`,
      type: "cover",
      x,
      y,
      width: 1,
      height: 1,
      properties: { coverBonus: 2, label: "Укрытие" },
    });
    blockedForSpawn.add(key);
  }

  // Расчёт зон спавна
  const spawnZones = computeSpawnZones(width, height, blockedForSpawn);

  // Извлекаем фоновое изображение из данных .dd2vtt, если не передано явного URL
  let backgroundUrl = options.backgroundUrl;
  if (!backgroundUrl && data.image) {
    backgroundUrl = data.image.startsWith("data:")
      ? data.image
      : `data:image/png;base64,${data.image}`;
  }

  return {
    id: options.id,
    name: options.name,
    nameEn: options.nameEn,
    biome: options.biome,
    tags: options.tags || [options.biome],
    gridWidth: width,
    gridHeight: height,
    cellSizeFt: 5,
    backgroundUrl,
    description: options.description,
    elements,
    spawnZones,
  };
}
