import type { TacticalMapPreset, MapElement } from "../types";

export const lavaCavePreset: TacticalMapPreset = {
  id: "preset-lava-cave",
  name: "Лавовая пещера",
  nameEn: "Lava Cavern",
  biome: "lava_cave",
  tags: ["cave", "lava", "volcano", "underground", "magma", "fire", "rocks"],
  gridWidth: 22,
  gridHeight: 18,
  cellSizeFt: 5,
  backgroundUrl: "/maps/lava.jpg",
  description: "Подземная каверна, рассеченная надвое бурлящей рекой магмы. Единственный путь ведет через узкий базальтовый мост.",
  elements: [
    // Внешние скальные стены каверны
    ...Array.from({ length: 22 }, (_, x) => ({
      id: `cave-wall-n-${x}`,
      type: "wall" as const,
      x,
      y: 0,
      width: 1,
      height: 1,
      properties: { label: "Базальтовая скала" },
    })),
    ...Array.from({ length: 22 }, (_, x) => ({
      id: `cave-wall-s-${x}`,
      type: "wall" as const,
      x,
      y: 17,
      width: 1,
      height: 1,
      properties: { label: "Базальтовая скала" },
    })),
    ...Array.from({ length: 18 }, (_, y) => y)
      .filter((y) => y < 7 || y > 11) // Вход в пещеру на западе (y: 7..11)
      .map((y) => ({
        id: `cave-wall-w-${y}`,
        type: "wall" as const,
        x: 0,
        y,
        width: 1,
        height: 1,
        properties: { label: "Базальтовая скала" },
      })),
    ...Array.from({ length: 18 }, (_, y) => ({
      id: `cave-wall-e-${y}`,
      type: "wall" as const,
      x: 21,
      y,
      width: 1,
      height: 1,
      properties: { label: "Базальтовая скала" },
    })),
    // Бурлящая река магмы (x: 10, 11), кроме моста на y=8,9
    ...Array.from({ length: 18 }, (_, y) => y)
      .filter((y) => y !== 8 && y !== 9)
      .flatMap((y) => [
        {
          id: `lava-stream-1-${y}`,
          type: "lava" as const,
          x: 10,
          y,
          width: 1,
          height: 1,
          properties: { label: "Кипящая магма" },
        },
        {
          id: `lava-stream-2-${y}`,
          type: "lava" as const,
          x: 11,
          y,
          width: 1,
          height: 1,
          properties: { label: "Кипящая магма" },
        },
      ]),
    // Базальтовый мост (трудная местность)
    {
      id: "basalt-bridge",
      type: "difficult",
      x: 10,
      y: 8,
      width: 2,
      height: 2,
      properties: { label: "Узкий базальтовый мост" },
    },
    // Сталагмиты (укрытие +2 КД)
    ...[
      { x: 5, y: 4 },
      { x: 6, y: 13 },
      { x: 15, y: 4 },
      { x: 16, y: 13 },
    ].map((pos, idx) => ({
      id: `stalagmite-${idx + 1}`,
      type: "cover" as const,
      x: pos.x,
      y: pos.y,
      width: 1,
      height: 1,
      properties: { coverBonus: 2 as const, label: "Каменный сталагмит" },
    })),
    // Возвышение вулканического трона на востоке
    {
      id: "volcano-throne",
      type: "elevation",
      x: 18,
      y: 7,
      width: 3,
      height: 4,
      properties: { elevationFt: 10, label: "Вулканический помост" },
    },
  ],
  spawnZones: [
    {
      name: "party",
      cells: [
        { x: 2, y: 8 },
        { x: 2, y: 9 },
        { x: 3, y: 8 },
        { x: 3, y: 9 },
        { x: 4, y: 8 },
        { x: 4, y: 9 },
      ],
    },
    {
      name: "enemy_frontline",
      cells: [
        { x: 13, y: 8 },
        { x: 13, y: 9 },
        { x: 14, y: 7 },
        { x: 14, y: 10 },
        { x: 14, y: 8 },
        { x: 14, y: 9 },
      ],
    },
    {
      name: "enemy_backline",
      cells: [
        { x: 16, y: 3 },
        { x: 17, y: 3 },
        { x: 16, y: 14 },
        { x: 17, y: 14 },
      ],
    },
    {
      name: "boss",
      cells: [
        { x: 19, y: 8 },
        { x: 19, y: 9 },
        { x: 20, y: 8 },
        { x: 20, y: 9 },
      ],
    },
  ],
};
