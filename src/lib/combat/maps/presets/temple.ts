import type { TacticalMapPreset, MapElement } from "../types";

export const templePreset: TacticalMapPreset = {
  id: "preset-temple",
  name: "Древний храм",
  nameEn: "Ancient Temple",
  biome: "temple",
  tags: ["temple", "ruins", "sacred", "columns", "altar", "sanctuary", "stone"],
  gridWidth: 20,
  gridHeight: 26,
  cellSizeFt: 5,
  backgroundUrl: "/maps/temple.jpg",
  description: "Величественный каменный зал древнего святилища. Ряды мраморных колонн ведут к ступенчатому алтарю.",
  elements: [
    // Внешние каменные стены по периметру
    ...Array.from({ length: 20 }, (_, x) => ({
      id: `wall-north-${x}`,
      type: "wall" as const,
      x,
      y: 0,
      width: 1,
      height: 1,
      properties: { label: "Стена святилища" },
    })),
    ...Array.from({ length: 26 }, (_, y) => ({
      id: `wall-west-${y}`,
      type: "wall" as const,
      x: 0,
      y,
      width: 1,
      height: 1,
      properties: { label: "Стена святилища" },
    })),
    ...Array.from({ length: 26 }, (_, y) => ({
      id: `wall-east-${y}`,
      type: "wall" as const,
      x: 19,
      y,
      width: 1,
      height: 1,
      properties: { label: "Стена святилища" },
    })),
    // Южная стена с воротами по центру (x=9,10)
    ...Array.from({ length: 20 }, (_, x) => x)
      .filter((x) => x !== 9 && x !== 10)
      .map((x) => ({
        id: `wall-south-${x}`,
        type: "wall" as const,
        x,
        y: 25,
        width: 1,
        height: 1,
        properties: { label: "Стена святилища" },
      })),
    // Главные храмовые двери
    {
      id: "temple-door-main",
      type: "door",
      x: 9,
      y: 25,
      width: 2,
      height: 1,
      properties: { isOpen: true, label: "Врата храма" },
    },
    // Колоннады (западный и восточный ряды колонн, укрытие +2 КД)
    ...[6, 10, 14, 18].flatMap((y) => [
      {
        id: `column-west-${y}`,
        type: "cover" as const,
        x: 5,
        y,
        width: 1,
        height: 1,
        properties: { coverBonus: 2 as const, label: "Мраморная колонна" },
      },
      {
        id: `column-east-${y}`,
        type: "cover" as const,
        x: 14,
        y,
        width: 1,
        height: 1,
        properties: { coverBonus: 2 as const, label: "Мраморная колонна" },
      },
    ]),
    // Алтарное возвышение (y: 2..4, x: 7..12)
    {
      id: "altar-elevation",
      type: "elevation",
      x: 7,
      y: 2,
      width: 6,
      height: 3,
      properties: { elevationFt: 5, label: "Алтарный помост" },
    },
    // Священный монолитный алтарь (укрытие +5 КД)
    {
      id: "altar-stone",
      type: "cover",
      x: 9,
      y: 2,
      width: 2,
      height: 1,
      properties: { coverBonus: 5, label: "Жертвенный алтарь" },
    },
    // Жаровни со священным огнем по бокам алтаря (лавовый/огненный урон)
    {
      id: "brazier-west",
      type: "lava",
      x: 6,
      y: 3,
      width: 1,
      height: 1,
      properties: { label: "Священная жаровня" },
    },
    {
      id: "brazier-east",
      type: "lava",
      x: 13,
      y: 3,
      width: 1,
      height: 1,
      properties: { label: "Священная жаровня" },
    },
  ],
  spawnZones: [
    {
      name: "party",
      cells: [
        { x: 9, y: 23 },
        { x: 10, y: 23 },
        { x: 8, y: 23 },
        { x: 11, y: 23 },
        { x: 9, y: 24 },
        { x: 10, y: 24 },
      ],
    },
    {
      name: "enemy_frontline",
      cells: [
        { x: 8, y: 13 },
        { x: 9, y: 13 },
        { x: 10, y: 13 },
        { x: 11, y: 13 },
        { x: 9, y: 14 },
        { x: 10, y: 14 },
      ],
    },
    {
      name: "enemy_backline",
      cells: [
        { x: 4, y: 10 },
        { x: 4, y: 14 },
        { x: 15, y: 10 },
        { x: 15, y: 14 },
      ],
    },
    {
      name: "boss",
      cells: [
        { x: 9, y: 4 },
        { x: 10, y: 4 },
        { x: 8, y: 4 },
        { x: 11, y: 4 },
      ],
    },
  ],
};
