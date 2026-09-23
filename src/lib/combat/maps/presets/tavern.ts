import type { TacticalMapPreset, MapElement } from "../types";

export const tavernPreset: TacticalMapPreset = {
  id: "preset-tavern",
  name: "Шумная таверна",
  nameEn: "Boisterous Tavern",
  biome: "tavern",
  tags: ["tavern", "inn", "bar", "tables", "fireplace", "wood", "city"],
  gridWidth: 18,
  gridHeight: 14,
  cellSizeFt: 5,
  backgroundUrl: "/maps/tavern.jpg",
  description: "Двухэтажная деревянная таверна с барной стойкой, массивными дубовыми столами и пылающим очагом.",
  elements: [
    // Внешние стены по периметру
    ...Array.from({ length: 18 }, (_, x) => ({
      id: `wall-n-${x}`,
      type: "wall" as const,
      x,
      y: 0,
      width: 1,
      height: 1,
      properties: { label: "Бревенчатая стена" },
    })),
    ...Array.from({ length: 14 }, (_, y) => y)
      .filter((y) => y !== 3) // Запасной выход на y=3
      .map((y) => ({
        id: `wall-w-${y}`,
        type: "wall" as const,
        x: 0,
        y,
        width: 1,
        height: 1,
        properties: { label: "Бревенчатая стена" },
      })),
    ...Array.from({ length: 14 }, (_, y) => ({
      id: `wall-e-${y}`,
      type: "wall" as const,
      x: 17,
      y,
      width: 1,
      height: 1,
      properties: { label: "Бревенчатая стена" },
    })),
    ...Array.from({ length: 18 }, (_, x) => x)
      .filter((x) => x !== 9) // Главная дверь на x=9
      .map((x) => ({
        id: `wall-s-${x}`,
        type: "wall" as const,
        x,
        y: 13,
        width: 1,
        height: 1,
        properties: { label: "Бревенчатая стена" },
      })),
    // Двери
    {
      id: "tavern-door-main",
      type: "door",
      x: 9,
      y: 13,
      width: 1,
      height: 1,
      properties: { isOpen: true, label: "Входная дверь" },
    },
    {
      id: "tavern-door-back",
      type: "door",
      x: 0,
      y: 3,
      width: 1,
      height: 1,
      properties: { isOpen: false, label: "Чёрный ход" },
    },
    // Барная стойка (высокое укрытие +5 КД)
    {
      id: "bar-counter-1",
      type: "cover",
      x: 12,
      y: 3,
      width: 4,
      height: 1,
      properties: { coverBonus: 5, label: "Барная стойка" },
    },
    {
      id: "bar-counter-2",
      type: "cover",
      x: 12,
      y: 4,
      width: 1,
      height: 2,
      properties: { coverBonus: 5, label: "Барная стойка" },
    },
    // Дубовые столы (низкое укрытие +2 КД)
    {
      id: "table-1",
      type: "cover",
      x: 4,
      y: 4,
      width: 2,
      height: 1,
      properties: { coverBonus: 2, label: "Дубовый стол" },
    },
    {
      id: "table-2",
      type: "cover",
      x: 4,
      y: 8,
      width: 2,
      height: 1,
      properties: { coverBonus: 2, label: "Дубовый стол" },
    },
    {
      id: "table-3",
      type: "cover",
      x: 9,
      y: 6,
      width: 2,
      height: 1,
      properties: { coverBonus: 2, label: "Большой стол" },
    },
    // Пылающий камин у западной стены (урон огнем/лавой)
    {
      id: "fireplace",
      type: "lava",
      x: 1,
      y: 7,
      width: 1,
      height: 2,
      properties: { label: "Пылающий камин" },
    },
  ],
  spawnZones: [
    {
      name: "party",
      cells: [
        { x: 8, y: 11 },
        { x: 9, y: 11 },
        { x: 10, y: 11 },
        { x: 8, y: 12 },
        { x: 9, y: 12 },
        { x: 10, y: 12 },
      ],
    },
    {
      name: "enemy_frontline",
      cells: [
        { x: 7, y: 7 },
        { x: 8, y: 7 },
        { x: 11, y: 7 },
        { x: 12, y: 7 },
        { x: 9, y: 8 },
      ],
    },
    {
      name: "enemy_backline",
      cells: [
        { x: 3, y: 4 },
        { x: 3, y: 8 },
        { x: 13, y: 2 },
        { x: 14, y: 2 },
      ],
    },
    {
      name: "boss",
      cells: [
        { x: 15, y: 2 },
        { x: 16, y: 2 },
      ],
    },
  ],
};
