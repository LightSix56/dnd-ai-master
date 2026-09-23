import type { TacticalMapPreset, MapElement } from "../types";

export const forestAmbushPreset: TacticalMapPreset = {
  id: "preset-forest-ambush",
  name: "Лесная засада",
  nameEn: "Forest Ambush",
  biome: "forest_ambush",
  tags: ["forest", "trees", "bushes", "trail", "road", "wilderness", "nature"],
  gridWidth: 22,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/forest.jpg",
  description: "Грунтовый тракт петляет среди векового леса. Густые колючие заросли и массивные дубы скрывают стрелков.",
  elements: [
    // Заросли колючего кустарника к северу от дороги (трудная местность)
    {
      id: "bushes-north",
      type: "difficult",
      x: 3,
      y: 4,
      width: 6,
      height: 2,
      properties: { label: "Густой колючий терновник" },
    },
    // Заросли кустарника к югу от дороги
    {
      id: "bushes-south",
      type: "difficult",
      x: 10,
      y: 11,
      width: 7,
      height: 2,
      properties: { label: "Густой колючий терновник" },
    },
    // Вековые дубы (препятствия и укрытие +2 КД)
    ...[
      { x: 5, y: 2 },
      { x: 12, y: 2 },
      { x: 18, y: 2 },
      { x: 4, y: 13 },
      { x: 12, y: 13 },
      { x: 19, y: 13 },
    ].map((pos, idx) => ({
      id: `tree-${idx + 1}`,
      type: "cover" as const,
      x: pos.x,
      y: pos.y,
      width: 2,
      height: 2,
      properties: { coverBonus: 2 as const, label: "Вековой дуб" },
    })),
    // Поваленный ствол поперек тракта (укрытие +5 КД)
    {
      id: "fallen-log",
      type: "cover",
      x: 13,
      y: 7,
      width: 1,
      height: 3,
      properties: { coverBonus: 5, label: "Поваленный ствол дуба" },
    },
    // Скалистый уступ на северо-востоке (возвышение +2 к атаке)
    {
      id: "rocky-ledge",
      type: "elevation",
      x: 16,
      y: 1,
      width: 5,
      height: 4,
      properties: { elevationFt: 10, label: "Скалистый уступ" },
    },
  ],
  spawnZones: [
    {
      name: "party",
      cells: [
        { x: 2, y: 7 },
        { x: 2, y: 8 },
        { x: 3, y: 7 },
        { x: 3, y: 8 },
        { x: 4, y: 7 },
        { x: 4, y: 8 },
      ],
    },
    {
      name: "enemy_frontline",
      cells: [
        { x: 14, y: 7 },
        { x: 14, y: 8 },
        { x: 14, y: 9 },
        { x: 15, y: 7 },
        { x: 15, y: 8 },
      ],
    },
    {
      name: "enemy_backline",
      cells: [
        { x: 10, y: 3 },
        { x: 11, y: 3 },
        { x: 13, y: 3 },
        { x: 14, y: 3 },
      ],
    },
    {
      name: "boss",
      cells: [
        { x: 18, y: 2 },
        { x: 19, y: 2 },
      ],
    },
    {
      name: "ambush_flank",
      cells: [
        { x: 5, y: 11 },
        { x: 6, y: 11 },
        { x: 7, y: 11 },
      ],
    },
  ],
};
