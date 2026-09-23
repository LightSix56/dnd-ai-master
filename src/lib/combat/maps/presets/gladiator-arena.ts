import type { TacticalMapPreset, MapElement } from "../types";

export const gladiatorArenaPreset: TacticalMapPreset = {
  id: "preset-gladiator-arena",
  name: "Гладиаторская арена",
  nameEn: "Gladiator Arena",
  biome: "gladiator_arena",
  tags: ["arena", "gladiator", "colosseum", "sand", "pit", "cage"],
  gridWidth: 20,
  gridHeight: 20,
  cellSizeFt: 5,
  backgroundUrl: "/maps/arena.jpg",
  description: "Круглый песчаный амфитеатр с возвышающимся центральным помостом, рвом с кольями и железными решетками загонов.",
  elements: [
    // Внешние каменные стены амфитеатра
    ...Array.from({ length: 20 }, (_, x) => x)
      .filter((x) => x !== 9 && x !== 10)
      .map((x) => ({
        id: `arena-wall-n-${x}`,
        type: "wall" as const,
        x,
        y: 0,
        width: 1,
        height: 1,
        properties: { label: "Стена амфитеатра" },
      })),
    ...Array.from({ length: 20 }, (_, x) => x)
      .filter((x) => x !== 9 && x !== 10)
      .map((x) => ({
        id: `arena-wall-s-${x}`,
        type: "wall" as const,
        x,
        y: 19,
        width: 1,
        height: 1,
        properties: { label: "Стена амфитеатра" },
      })),
    ...Array.from({ length: 20 }, (_, y) => ({
      id: `arena-wall-w-${y}`,
      type: "wall" as const,
      x: 0,
      y,
      width: 1,
      height: 1,
      properties: { label: "Стена амфитеатра" },
    })),
    ...Array.from({ length: 20 }, (_, y) => ({
      id: `arena-wall-e-${y}`,
      type: "wall" as const,
      x: 19,
      y,
      width: 1,
      height: 1,
      properties: { label: "Стена амфитеатра" },
    })),
    // Железные ворота гладиаторов (юг) и зверей (север)
    {
      id: "gate-gladiators",
      type: "door",
      x: 9,
      y: 19,
      width: 2,
      height: 1,
      properties: { isOpen: true, label: "Врата гладиаторов" },
    },
    {
      id: "gate-beasts",
      type: "door",
      x: 9,
      y: 0,
      width: 2,
      height: 1,
      properties: { isOpen: false, label: "Решетка загона зверей" },
    },
    // Центральный каменный помост (возвышение)
    {
      id: "central-platform",
      type: "elevation",
      x: 8,
      y: 8,
      width: 4,
      height: 4,
      properties: { elevationFt: 5, label: "Центральный помост" },
    },
    // Ров с кольями вокруг помоста (трудная местность)
    ...[7, 12].flatMap((x) =>
      Array.from({ length: 6 }, (_, idx) => 7 + idx).map((y) => ({
        id: `spike-trench-${x}-${y}`,
        type: "difficult" as const,
        x,
        y,
        width: 1,
        height: 1,
        properties: { label: "Ров с острыми кольями" },
      }))
    ),
    // Колонны арены (укрытие +2 КД)
    ...[
      { x: 4, y: 5 },
      { x: 15, y: 5 },
      { x: 4, y: 14 },
      { x: 15, y: 14 },
    ].map((pos, idx) => ({
      id: `arena-pillar-${idx + 1}`,
      type: "cover" as const,
      x: pos.x,
      y: pos.y,
      width: 1,
      height: 1,
      properties: { coverBonus: 2 as const, label: "Каменная колонна" },
    })),
  ],
  spawnZones: [
    {
      name: "party",
      cells: [
        { x: 9, y: 17 },
        { x: 10, y: 17 },
        { x: 8, y: 17 },
        { x: 11, y: 17 },
        { x: 9, y: 18 },
        { x: 10, y: 18 },
      ],
    },
    {
      name: "enemy_frontline",
      cells: [
        { x: 9, y: 13 },
        { x: 10, y: 13 },
        { x: 6, y: 10 },
        { x: 13, y: 10 },
        { x: 8, y: 14 },
        { x: 11, y: 14 },
      ],
    },
    {
      name: "enemy_backline",
      cells: [
        { x: 4, y: 6 },
        { x: 15, y: 6 },
        { x: 3, y: 14 },
        { x: 16, y: 14 },
      ],
    },
    {
      name: "boss",
      cells: [
        { x: 9, y: 9 },
        { x: 10, y: 9 },
        { x: 9, y: 10 },
        { x: 10, y: 10 },
      ],
    },
  ],
};
