import type { TacticalMapPreset, MapElement } from "../types";

export const dungeonPrisonPreset: TacticalMapPreset = {
  id: "preset-dungeon-prison",
  name: "Тюремный каземат",
  nameEn: "Dungeon Prison",
  biome: "dungeon_prison",
  tags: ["dungeon", "prison", "cells", "iron", "stone", "crypt", "torture"],
  gridWidth: 20,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/dungeon.png",
  description: "Мрачный подземный каземат с рядами камер за железными решетками, постом надзирателя и массивными дубовыми дверями.",
  elements: [
    // Внешние каменные стены
    ...Array.from({ length: 20 }, (_, x) => ({
      id: `dungeon-wall-n-${x}`,
      type: "wall" as const,
      x,
      y: 0,
      width: 1,
      height: 1,
      properties: { label: "Каменная кладка" },
    })),
    ...Array.from({ length: 20 }, (_, x) => ({
      id: `dungeon-wall-s-${x}`,
      type: "wall" as const,
      x,
      y: 15,
      width: 1,
      height: 1,
      properties: { label: "Каменная кладка" },
    })),
    ...Array.from({ length: 16 }, (_, y) => y)
      .filter((y) => y !== 1 && y !== 2) // Входной коридор на западе (y: 1..2)
      .map((y) => ({
        id: `dungeon-wall-w-${y}`,
        type: "wall" as const,
        x: 0,
        y,
        width: 1,
        height: 1,
        properties: { label: "Каменная кладка" },
      })),
    ...Array.from({ length: 16 }, (_, y) => ({
      id: `dungeon-wall-e-${y}`,
      type: "wall" as const,
      x: 19,
      y,
      width: 1,
      height: 1,
      properties: { label: "Каменная кладка" },
    })),
    // Тюремные перегородки и камеры
    ...[4, 8, 12].flatMap((cellY) => [
      // Стена камеры
      {
        id: `cell-divider-${cellY}`,
        type: "wall" as const,
        x: 6,
        y: cellY,
        width: 4,
        height: 1,
        properties: { label: "Каменная перегородка" },
      },
      // Дверь камеры
      {
        id: `cell-door-${cellY}`,
        type: "door" as const,
        x: 10,
        y: cellY,
        width: 1,
        height: 1,
        properties: { isOpen: false, label: "Тюремная решетка" },
      },
    ]),
    // Стол надзирателя (укрытие +5 КД)
    {
      id: "warden-desk",
      type: "cover",
      x: 15,
      y: 11,
      width: 2,
      height: 1,
      properties: { coverBonus: 5, label: "Стол главного надзирателя" },
    },
    // Пыточный станок / дыба (укрытие +2 КД)
    {
      id: "torture-rack",
      type: "cover",
      x: 14,
      y: 3,
      width: 2,
      height: 2,
      properties: { coverBonus: 2, label: "Дыба" },
    },
  ],
  spawnZones: [
    {
      name: "party",
      cells: [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ],
    },
    {
      name: "enemy_frontline",
      cells: [
        { x: 7, y: 6 },
        { x: 8, y: 6 },
        { x: 9, y: 6 },
        { x: 12, y: 6 },
        { x: 13, y: 6 },
      ],
    },
    {
      name: "enemy_backline",
      cells: [
        { x: 14, y: 2 },
        { x: 15, y: 2 },
        { x: 13, y: 9 },
        { x: 14, y: 9 },
      ],
    },
    {
      name: "boss",
      cells: [
        { x: 16, y: 13 },
        { x: 17, y: 13 },
        { x: 16, y: 14 },
      ],
    },
  ],
};
