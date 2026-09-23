import type { TacticalMapPreset, MapElement } from "../types";

export const shipBattlePreset: TacticalMapPreset = {
  id: "preset-ship-battle",
  name: "Морской абордаж",
  nameEn: "Ship Boarding Battle",
  biome: "ship_battle",
  tags: ["ship", "naval", "ocean", "sea", "planks", "boarding", "water"],
  gridWidth: 24,
  gridHeight: 18,
  cellSizeFt: 5,
  backgroundUrl: "/maps/ship.jpg",
  description: "Два парусных корабля сошлись борт к борту. Между ними бурлит морская бездна, соединенная абордажными трапами.",
  elements: [
    // Морская вода между кораблями (колонки 11 и 12, кроме трапов на y=5,6 и y=11,12)
    ...Array.from({ length: 18 }, (_, y) => y)
      .filter((y) => y !== 5 && y !== 6 && y !== 11 && y !== 12)
      .flatMap((y) => [
        {
          id: `water-gap-1-${y}`,
          type: "water" as const,
          x: 11,
          y,
          width: 1,
          height: 1,
          properties: { label: "Открытое море" },
        },
        {
          id: `water-gap-2-${y}`,
          type: "water" as const,
          x: 12,
          y,
          width: 1,
          height: 1,
          properties: { label: "Открытое море" },
        },
      ]),
    // Абордажные трапы (трудная местность)
    {
      id: "plank-north-1",
      type: "difficult",
      x: 11,
      y: 5,
      width: 2,
      height: 2,
      properties: { label: "Абордажный трап (север)" },
    },
    {
      id: "plank-south-1",
      type: "difficult",
      x: 11,
      y: 11,
      width: 2,
      height: 2,
      properties: { label: "Абордажный трап (юг)" },
    },
    // Бортовые фальшборты (укрытие +2 КД) корабля союзников
    ...[2, 3, 4, 7, 8, 9, 10, 13, 14, 15].map((y) => ({
      id: `railing-ally-${y}`,
      type: "cover" as const,
      x: 10,
      y,
      width: 1,
      height: 1,
      properties: { coverBonus: 2 as const, label: "Фальшборт" },
    })),
    // Бортовые фальшборты вражеского корабля
    ...[2, 3, 4, 7, 8, 9, 10, 13, 14, 15].map((y) => ({
      id: `railing-enemy-${y}`,
      type: "cover" as const,
      x: 13,
      y,
      width: 1,
      height: 1,
      properties: { coverBonus: 2 as const, label: "Фальшборт" },
    })),
    // Мачты (непроходимые препятствия)
    {
      id: "mast-ally",
      type: "obstacle",
      x: 5,
      y: 9,
      width: 1,
      height: 1,
      properties: { label: "Грот-мачта союзников" },
    },
    {
      id: "mast-enemy",
      type: "obstacle",
      x: 18,
      y: 9,
      width: 1,
      height: 1,
      properties: { label: "Грот-мачта врагов" },
    },
    // Палубные пушки (укрытие +5 КД)
    {
      id: "cannon-enemy-1",
      type: "cover",
      x: 16,
      y: 4,
      width: 1,
      height: 1,
      properties: { coverBonus: 5, label: "Бортовая пушка" },
    },
    {
      id: "cannon-enemy-2",
      type: "cover",
      x: 16,
      y: 13,
      width: 1,
      height: 1,
      properties: { coverBonus: 5, label: "Бортовая пушка" },
    },
  ],
  spawnZones: [
    {
      name: "party",
      cells: [
        { x: 3, y: 8 },
        { x: 3, y: 9 },
        { x: 4, y: 8 },
        { x: 4, y: 9 },
        { x: 2, y: 8 },
        { x: 2, y: 9 },
      ],
    },
    {
      name: "enemy_frontline",
      cells: [
        { x: 14, y: 5 },
        { x: 14, y: 6 },
        { x: 14, y: 11 },
        { x: 14, y: 12 },
        { x: 15, y: 8 },
        { x: 15, y: 9 },
      ],
    },
    {
      name: "enemy_backline",
      cells: [
        { x: 17, y: 4 },
        { x: 17, y: 13 },
        { x: 19, y: 4 },
        { x: 19, y: 13 },
      ],
    },
    {
      name: "boss",
      cells: [
        { x: 21, y: 8 },
        { x: 21, y: 9 },
        { x: 20, y: 8 },
      ],
    },
  ],
};
