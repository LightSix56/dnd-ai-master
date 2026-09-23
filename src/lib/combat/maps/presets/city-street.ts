import type { TacticalMapPreset, MapElement } from "../types";

export const cityStreetPreset: TacticalMapPreset = {
  id: "preset-city-street",
  name: "Городская улица",
  nameEn: "City Street",
  biome: "city_street",
  tags: ["city", "street", "houses", "alley", "urban", "wagon", "cobblestone"],
  gridWidth: 22,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/city.jpg",
  description: "Мощеная булыжником городская улица между двухэтажными домами. Перевернутая купеческая повозка и каменный колодец служат укрытиями.",
  elements: [
    // Фасад северных домов (сплошная стена на y: 0..2)
    {
      id: "house-north-1",
      type: "wall",
      x: 0,
      y: 0,
      width: 10,
      height: 3,
      properties: { label: "Фасад таверны" },
    },
    {
      id: "house-north-2",
      type: "wall",
      x: 12,
      y: 0,
      width: 10,
      height: 3,
      properties: { label: "Фасад лавки" },
    },
    // Фасад южных домов (сплошная стена на y: 13..15)
    {
      id: "house-south-1",
      type: "wall",
      x: 0,
      y: 13,
      width: 8,
      height: 3,
      properties: { label: "Жилой дом" },
    },
    {
      id: "house-south-2",
      type: "wall",
      x: 10,
      y: 13,
      width: 12,
      height: 3,
      properties: { label: "Складской фасад" },
    },
    // Перевернутая повозка (высокое укрытие +5 КД)
    {
      id: "overturned-wagon",
      type: "cover",
      x: 11,
      y: 7,
      width: 2,
      height: 2,
      properties: { coverBonus: 5, label: "Перевернутая повозка" },
    },
    // Каменный городской колодец (укрытие +2 КД)
    {
      id: "city-well",
      type: "cover",
      x: 6,
      y: 7,
      width: 2,
      height: 2,
      properties: { coverBonus: 2, label: "Каменный колодец" },
    },
    // Штабель деревянных ящиков (укрытие +2 КД)
    {
      id: "crate-stack-1",
      type: "cover",
      x: 14,
      y: 4,
      width: 2,
      height: 1,
      properties: { coverBonus: 2, label: "Штабель ящиков" },
    },
    {
      id: "crate-stack-2",
      type: "cover",
      x: 4,
      y: 11,
      width: 2,
      height: 1,
      properties: { coverBonus: 2, label: "Бочки с дегтем" },
    },
  ],
  spawnZones: [
    {
      name: "party",
      cells: [
        { x: 1, y: 7 },
        { x: 1, y: 8 },
        { x: 2, y: 7 },
        { x: 2, y: 8 },
        { x: 3, y: 7 },
        { x: 3, y: 8 },
      ],
    },
    {
      name: "enemy_frontline",
      cells: [
        { x: 9, y: 6 },
        { x: 9, y: 9 },
        { x: 10, y: 6 },
        { x: 10, y: 9 },
        { x: 13, y: 7 },
      ],
    },
    {
      name: "enemy_backline",
      cells: [
        { x: 15, y: 5 },
        { x: 16, y: 5 },
        { x: 15, y: 10 },
        { x: 16, y: 10 },
      ],
    },
    {
      name: "boss",
      cells: [
        { x: 19, y: 7 },
        { x: 19, y: 8 },
        { x: 20, y: 7 },
        { x: 20, y: 8 },
      ],
    },
  ],
};
