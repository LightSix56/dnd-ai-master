import type { TacticalMapPreset } from "../types";

// 9. Болотные топи (Swamp Bog)
export const swampBogPreset: TacticalMapPreset = {
  id: "preset-swamp-bog",
  name: "Болотные топи",
  nameEn: "Swamp Bog",
  biome: "swamp_bog",
  tags: ["swamp", "bog", "marsh", "mud", "water", "poison", "roots"],
  gridWidth: 22,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/swamp.jpg",
  description: "Зловонные топи с глубокой трясиной, гнилыми корягами и островками зыбкой суши.",
  elements: [
    // Глубокие лужи и трясина (вода)
    { id: "swamp-pool-1", type: "water", x: 8, y: 3, width: 4, height: 3, properties: { label: "Глубокая трясина" } },
    { id: "swamp-pool-2", type: "water", x: 14, y: 9, width: 5, height: 4, properties: { label: "Чёрная топь" } },
    // Зыбучая грязь (трудная местность)
    { id: "swamp-mud-1", type: "difficult", x: 4, y: 7, width: 6, height: 4, properties: { label: "Вязкая грязь" } },
    { id: "swamp-mud-2", type: "difficult", x: 12, y: 4, width: 5, height: 3, properties: { label: "Ил и корни" } },
    // Гнилые пни и коряги (укрытие +2 КД)
    { id: "swamp-log-1", type: "cover", x: 6, y: 4, width: 2, height: 1, properties: { coverBonus: 2, label: "Гнилое бревно" } },
    { id: "swamp-log-2", type: "cover", x: 15, y: 5, width: 2, height: 1, properties: { coverBonus: 2, label: "Трухлявый пень" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 1, y: 7 }, { x: 1, y: 8 }, { x: 2, y: 7 }, { x: 2, y: 8 }] },
    { name: "enemy_frontline", cells: [{ x: 10, y: 7 }, { x: 10, y: 8 }, { x: 11, y: 7 }] },
    { name: "enemy_backline", cells: [{ x: 17, y: 3 }, { x: 18, y: 3 }, { x: 17, y: 4 }] },
    { name: "boss", cells: [{ x: 19, y: 7 }, { x: 20, y: 7 }] },
  ],
};

// 10. Заснеженные вершины (Snowy Mountain Pass)
export const snowyMountainPreset: TacticalMapPreset = {
  id: "preset-snowy-mountain",
  name: "Заснеженные вершины",
  nameEn: "Snowy Mountain Pass",
  biome: "snowy_mountain",
  tags: ["snow", "mountain", "ice", "frost", "cliff", "tundra", "blizzard"],
  gridWidth: 22,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/snowy_mountain.jpg",
  description: "Опасный горный перевал с глубокими снежными сугробами, скользким льдом и обрывом в пропасть.",
  elements: [
    // Горный обрыв (препятствие)
    { id: "cliff-edge-1", type: "obstacle", x: 0, y: 0, width: 22, height: 2, properties: { label: "Ледяная пропасть" } },
    // Скользкий лед (трудная местность)
    { id: "ice-patch-1", type: "difficult", x: 8, y: 5, width: 6, height: 4, properties: { label: "Гладкий синий лёд" } },
    // Снежные сугробы (трудная местность)
    { id: "snow-drift-1", type: "difficult", x: 3, y: 8, width: 4, height: 3, properties: { label: "Глубокий снежный сугроб" } },
    // Скальные выступы (укрытие +2 КД)
    { id: "rock-crag-1", type: "cover", x: 7, y: 11, width: 2, height: 2, properties: { coverBonus: 2, label: "Скалистый валун" } },
    { id: "rock-crag-2", type: "cover", x: 16, y: 7, width: 2, height: 2, properties: { coverBonus: 2, label: "Обледенелая скала" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 2, y: 13 }, { x: 3, y: 13 }, { x: 2, y: 14 }] },
    { name: "enemy_frontline", cells: [{ x: 11, y: 10 }, { x: 12, y: 10 }, { x: 11, y: 11 }] },
    { name: "enemy_backline", cells: [{ x: 15, y: 4 }, { x: 16, y: 4 }] },
    { name: "boss", cells: [{ x: 19, y: 12 }, { x: 20, y: 12 }] },
  ],
};

// 11. Песчаные дюны (Desert Dunes)
export const desertDunesPreset: TacticalMapPreset = {
  id: "preset-desert-dunes",
  name: "Песчаные дюны",
  nameEn: "Desert Dunes",
  biome: "desert_dunes",
  tags: ["desert", "dunes", "sand", "pyramid", "ruins", "sun", "oasis"],
  gridWidth: 20,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/desert.jpg",
  description: "Раскаленные пески с барханами, осыпающимися руинами древнего обелиска и кактусами.",
  elements: [
    // Сыпучий песок дюн (трудная местность)
    { id: "dune-sand-1", type: "difficult", x: 7, y: 4, width: 6, height: 4, properties: { label: "Сыпучий бархан" } },
    // Разрушенный обелиск (укрытие +5 КД)
    { id: "ruined-obelisk", type: "cover", x: 10, y: 9, width: 2, height: 2, properties: { coverBonus: 5, label: "Обломок песчаникового обелиска" } },
    // Каменные блоки фундамента (укрытие +2 КД)
    { id: "sand-blocks-1", type: "cover", x: 5, y: 10, width: 2, height: 1, properties: { coverBonus: 2, label: "Каменные плиты" } },
    { id: "sand-blocks-2", type: "cover", x: 14, y: 5, width: 2, height: 1, properties: { coverBonus: 2, label: "Каменные плиты" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 1, y: 8 }] },
    { name: "enemy_frontline", cells: [{ x: 8, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 11 }] },
    { name: "enemy_backline", cells: [{ x: 15, y: 3 }, { x: 16, y: 3 }] },
    { name: "boss", cells: [{ x: 17, y: 8 }, { x: 18, y: 8 }] },
  ],
};

// 12. Грибной лес Подземья (Underdark Mushroom Forest)
export const underdarkMushroomsPreset: TacticalMapPreset = {
  id: "preset-underdark-mushrooms",
  name: "Грибной лес Подземья",
  nameEn: "Underdark Mushroom Forest",
  biome: "underdark_mushrooms",
  tags: ["underdark", "cave", "mushrooms", "fungi", "spores", "darkness", "abyss"],
  gridWidth: 22,
  gridHeight: 18,
  cellSizeFt: 5,
  backgroundUrl: "/maps/lava.jpg",
  description: "Фосфоресцирующие гигантские шляпки грибов и ядовитые споровые заросли в вечной тьме Подземья.",
  elements: [
    // Споровые заросли (трудная местность)
    { id: "spore-thicket-1", type: "difficult", x: 7, y: 5, width: 5, height: 4, properties: { label: "Ядовитые споровые грибы" } },
    // Гигантские грибные ножки-стволы (укрытие +2 КД)
    { id: "mushroom-stem-1", type: "cover", x: 4, y: 4, width: 2, height: 2, properties: { coverBonus: 2, label: "Ствол гигантского гриба" } },
    { id: "mushroom-stem-2", type: "cover", x: 14, y: 4, width: 2, height: 2, properties: { coverBonus: 2, label: "Ствол гигантского гриба" } },
    { id: "mushroom-stem-3", type: "cover", x: 10, y: 12, width: 2, height: 2, properties: { coverBonus: 2, label: "Ствол гигантского гриба" } },
    // Провал в бездну Подземья (препятствие)
    { id: "underdark-chasm", type: "obstacle", x: 18, y: 0, width: 4, height: 6, properties: { label: "Бездонная расселина" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 2, y: 14 }, { x: 3, y: 14 }, { x: 2, y: 15 }] },
    { name: "enemy_frontline", cells: [{ x: 8, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 10 }] },
    { name: "enemy_backline", cells: [{ x: 15, y: 7 }, { x: 16, y: 7 }] },
    { name: "boss", cells: [{ x: 18, y: 14 }, { x: 19, y: 14 }] },
  ],
};

// 13. Кладбище и склеп (Graveyard Crypt)
export const graveyardCryptPreset: TacticalMapPreset = {
  id: "preset-graveyard-crypt",
  name: "Кладбище и склеп",
  nameEn: "Graveyard Crypt",
  biome: "graveyard_crypt",
  tags: ["graveyard", "cemetery", "crypt", "tomb", "undead", "ghost", "fog"],
  gridWidth: 22,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/temple.jpg",
  description: "Заброшенный погост под саваном тумана. Покосившиеся надгробия и каменный мавзолей чернокнижника.",
  elements: [
    // Стены склепа / мавзолея на востоке
    { id: "crypt-wall-n", type: "wall", x: 16, y: 4, width: 5, height: 1, properties: { label: "Стена мавзолея" } },
    { id: "crypt-wall-s", type: "wall", x: 16, y: 10, width: 5, height: 1, properties: { label: "Стена мавзолея" } },
    { id: "crypt-wall-e", type: "wall", x: 20, y: 5, width: 1, height: 5, properties: { label: "Стена мавзолея" } },
    { id: "crypt-door", type: "door", x: 16, y: 7, width: 1, height: 1, properties: { isOpen: false, label: "Решетка мавзолея" } },
    // Каменные надгробия (укрытие +2 КД)
    ...[
      { x: 5, y: 3 }, { x: 8, y: 4 }, { x: 11, y: 3 },
      { x: 5, y: 9 }, { x: 9, y: 10 }, { x: 12, y: 11 },
    ].map((pos, idx) => ({
      id: `tombstone-${idx + 1}`,
      type: "cover" as const,
      x: pos.x,
      y: pos.y,
      width: 1,
      height: 1,
      properties: { coverBonus: 2 as const, label: "Каменное надгробие" },
    })),
    // Разрытые могилы (трудная местность)
    { id: "open-grave-1", type: "difficult", x: 7, y: 6, width: 2, height: 1, properties: { label: "Разрытая могила" } },
    { id: "open-grave-2", type: "difficult", x: 11, y: 7, width: 2, height: 1, properties: { label: "Разрытая могила" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 1, y: 8 }] },
    { name: "enemy_frontline", cells: [{ x: 9, y: 7 }, { x: 9, y: 8 }, { x: 10, y: 8 }] },
    { name: "enemy_backline", cells: [{ x: 13, y: 4 }, { x: 13, y: 11 }] },
    { name: "boss", cells: [{ x: 18, y: 7 }, { x: 19, y: 7 }] },
  ],
};

// 14. Мост над бездной (Bridge of the Chasm)
export const bridgeChasmPreset: TacticalMapPreset = {
  id: "preset-bridge-chasm",
  name: "Мост над бездной",
  nameEn: "Bridge of the Chasm",
  biome: "bridge_chasm",
  tags: ["bridge", "chasm", "abyss", "gorge", "canyon", "crossing", "narrow"],
  gridWidth: 24,
  gridHeight: 14,
  cellSizeFt: 5,
  backgroundUrl: "/maps/lava.jpg",
  description: "Узкий каменный мост шириной 15 футов над бездонной пропастью. Падение означает неминуемую гибель.",
  elements: [
    // Северная бездна (препятствие)
    { id: "chasm-north", type: "obstacle", x: 0, y: 0, width: 24, height: 4, properties: { label: "Бездонная пропасть" } },
    // Южная бездна (препятствие)
    { id: "chasm-south", type: "obstacle", x: 0, y: 9, width: 24, height: 5, properties: { label: "Бездонная пропасть" } },
    // Каменные парапеты моста (укрытие +2 КД)
    { id: "parapet-n-1", type: "cover", x: 8, y: 4, width: 3, height: 1, properties: { coverBonus: 2, label: "Каменный парапет" } },
    { id: "parapet-n-2", type: "cover", x: 14, y: 4, width: 3, height: 1, properties: { coverBonus: 2, label: "Каменный парапет" } },
    { id: "parapet-s-1", type: "cover", x: 8, y: 8, width: 3, height: 1, properties: { coverBonus: 2, label: "Каменный парапет" } },
    { id: "parapet-s-2", type: "cover", x: 14, y: 8, width: 3, height: 1, properties: { coverBonus: 2, label: "Каменный парапет" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 1, y: 6 }, { x: 2, y: 6 }, { x: 1, y: 7 }, { x: 2, y: 7 }] },
    { name: "enemy_frontline", cells: [{ x: 11, y: 6 }, { x: 12, y: 6 }, { x: 11, y: 7 }, { x: 12, y: 7 }] },
    { name: "enemy_backline", cells: [{ x: 17, y: 5 }, { x: 17, y: 7 }] },
    { name: "boss", cells: [{ x: 21, y: 6 }, { x: 22, y: 6 }] },
  ],
};

// 15. Заброшенная шахта (Abandoned Mine Tracks)
export const mineTracksPreset: TacticalMapPreset = {
  id: "preset-mine-tracks",
  name: "Заброшенная шахта",
  nameEn: "Abandoned Mine Tracks",
  biome: "mine_tracks",
  tags: ["mine", "tracks", "rails", "cart", "underground", "ore", "shaft"],
  gridWidth: 22,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/dungeon.png",
  description: "Заброшенные штольни с деревянными крепями, ржавыми рельсами и гружеными рудой вагонетками.",
  elements: [
    // Скальные стены штолен
    { id: "mine-wall-n", type: "wall", x: 0, y: 0, width: 22, height: 2, properties: { label: "Неотесанный камень" } },
    { id: "mine-wall-s", type: "wall", x: 0, y: 14, width: 22, height: 2, properties: { label: "Неотесанный камень" } },
    // Рельсовые пути (трудная местность)
    { id: "mine-rails", type: "difficult", x: 0, y: 7, width: 22, height: 2, properties: { label: "Ржавые рельсы со шпалами" } },
    // Вагонетки с рудой (укрытие +5 КД)
    { id: "mine-cart-1", type: "cover", x: 7, y: 7, width: 2, height: 2, properties: { coverBonus: 5, label: "Чугунная вагонетка с рудой" } },
    { id: "mine-cart-2", type: "cover", x: 14, y: 7, width: 2, height: 2, properties: { coverBonus: 5, label: "Чугунная вагонетка с рудой" } },
    // Деревянные крепи (укрытие +2 КД)
    { id: "timber-support-1", type: "cover", x: 5, y: 3, width: 1, height: 1, properties: { coverBonus: 2, label: "Деревянная опора" } },
    { id: "timber-support-2", type: "cover", x: 11, y: 3, width: 1, height: 1, properties: { coverBonus: 2, label: "Деревянная опора" } },
    { id: "timber-support-3", type: "cover", x: 17, y: 3, width: 1, height: 1, properties: { coverBonus: 2, label: "Деревянная опора" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 5 }] },
    { name: "enemy_frontline", cells: [{ x: 10, y: 5 }, { x: 11, y: 5 }, { x: 10, y: 10 }] },
    { name: "enemy_backline", cells: [{ x: 16, y: 4 }, { x: 17, y: 4 }] },
    { name: "boss", cells: [{ x: 19, y: 7 }, { x: 20, y: 7 }] },
  ],
};

// 16. Городская канализация (City Sewers)
export const sewersPreset: TacticalMapPreset = {
  id: "preset-sewers",
  name: "Городская канализация",
  nameEn: "City Sewers",
  biome: "sewers",
  tags: ["sewers", "filth", "sludge", "water", "pipes", "underground", "grates"],
  gridWidth: 20,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/dungeon.png",
  description: "Зловонные сточные каналы с ядовитой жижей и узкими мощеными дорожками вдоль стен.",
  elements: [
    // Сточный канал по центру (глубокая вода/жижа)
    { id: "sewer-sludge", type: "water", x: 0, y: 6, width: 20, height: 4, properties: { label: "Зловонные сточные воды" } },
    // Каменные пешеходные мостики через канал
    { id: "sewer-bridge-1", type: "difficult", x: 5, y: 6, width: 2, height: 4, properties: { label: "Каменный мостик" } },
    { id: "sewer-bridge-2", type: "difficult", x: 13, y: 6, width: 2, height: 4, properties: { label: "Каменный мостик" } },
    // Чугунные сливные трубы (укрытие +2 КД)
    { id: "sewer-pipe-1", type: "cover", x: 4, y: 2, width: 2, height: 1, properties: { coverBonus: 2, label: "Сливная труба" } },
    { id: "sewer-pipe-2", type: "cover", x: 14, y: 12, width: 2, height: 1, properties: { coverBonus: 2, label: "Сливная труба" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 4 }] },
    { name: "enemy_frontline", cells: [{ x: 8, y: 3 }, { x: 9, y: 3 }, { x: 8, y: 12 }] },
    { name: "enemy_backline", cells: [{ x: 15, y: 3 }, { x: 16, y: 3 }] },
    { name: "boss", cells: [{ x: 17, y: 12 }, { x: 18, y: 12 }] },
  ],
};

// 17. Башня архимага (Archmage Tower)
export const wizardTowerPreset: TacticalMapPreset = {
  id: "preset-wizard-tower",
  name: "Башня архимага",
  nameEn: "Archmage Tower",
  biome: "wizard_tower",
  tags: ["wizard", "tower", "magic", "library", "runes", "scrolls", "arcane"],
  gridWidth: 18,
  gridHeight: 18,
  cellSizeFt: 5,
  backgroundUrl: "/maps/temple.jpg",
  description: "Круглый зал библиотеки с высокими книжными стеллажами и руническим кругом телепортации в центре.",
  elements: [
    // Внешние стены башни
    { id: "tower-wall-n", type: "wall", x: 0, y: 0, width: 18, height: 1, properties: { label: "Зачарованная каменная кладка" } },
    { id: "tower-wall-s", type: "wall", x: 0, y: 17, width: 18, height: 1, properties: { label: "Зачарованная каменная кладка" } },
    { id: "tower-wall-w", type: "wall", x: 0, y: 1, width: 1, height: 16, properties: { label: "Зачарованная каменная кладка" } },
    { id: "tower-wall-e", type: "wall", x: 17, y: 1, width: 1, height: 16, properties: { label: "Зачарованная каменная кладка" } },
    // Книжные стеллажи (укрытие +2 КД)
    { id: "bookshelf-1", type: "cover", x: 3, y: 3, width: 4, height: 1, properties: { coverBonus: 2, label: "Шкаф с гримуарами" } },
    { id: "bookshelf-2", type: "cover", x: 11, y: 3, width: 4, height: 1, properties: { coverBonus: 2, label: "Шкаф с гримуарами" } },
    { id: "bookshelf-3", type: "cover", x: 3, y: 14, width: 4, height: 1, properties: { coverBonus: 2, label: "Шкаф с гримуарами" } },
    { id: "bookshelf-4", type: "cover", x: 11, y: 14, width: 4, height: 1, properties: { coverBonus: 2, label: "Шкаф с гримуарами" } },
    // Рунический круг возвышения
    { id: "rune-circle", type: "elevation", x: 7, y: 7, width: 4, height: 4, properties: { elevationFt: 3, label: "Рунический помост" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 8, y: 15 }, { x: 9, y: 15 }, { x: 8, y: 16 }] },
    { name: "enemy_frontline", cells: [{ x: 6, y: 9 }, { x: 11, y: 9 }, { x: 8, y: 12 }] },
    { name: "enemy_backline", cells: [{ x: 4, y: 5 }, { x: 13, y: 5 }] },
    { name: "boss", cells: [{ x: 8, y: 8 }, { x: 9, y: 8 }, { x: 8, y: 9 }] },
  ],
};

// 18. Крепостной двор замка (Castle Courtyard)
export const castleCourtyardPreset: TacticalMapPreset = {
  id: "preset-castle-courtyard",
  name: "Двор замка",
  nameEn: "Castle Courtyard",
  biome: "castle_courtyard",
  tags: ["castle", "courtyard", "fortress", "walls", "gate", "barracks"],
  gridWidth: 22,
  gridHeight: 18,
  cellSizeFt: 5,
  backgroundUrl: "/maps/city.jpg",
  description: "Замковый плац с зубчатыми стенами, опущенной железной герсой и тренировочными чучелами.",
  elements: [
    // Крепостная стена с герсой
    { id: "castle-wall-w", type: "wall", x: 0, y: 0, width: 1, height: 18, properties: { label: "Крепостная стена" } },
    { id: "castle-wall-e", type: "wall", x: 21, y: 0, width: 1, height: 18, properties: { label: "Крепостная стена" } },
    { id: "castle-wall-s", type: "wall", x: 1, y: 17, width: 20, height: 1, properties: { label: "Крепостная стена" } },
    { id: "castle-gate", type: "door", x: 10, y: 17, width: 2, height: 1, properties: { isOpen: true, label: "Кованая герса" } },
    // Тренировочные манекены и стойки с оружием (укрытие +2 КД)
    { id: "weapon-rack-1", type: "cover", x: 4, y: 5, width: 2, height: 1, properties: { coverBonus: 2, label: "Оружейная стойка" } },
    { id: "weapon-rack-2", type: "cover", x: 16, y: 5, width: 2, height: 1, properties: { coverBonus: 2, label: "Оружейная стойка" } },
    // Каменный помост караульной вышки
    { id: "guard-platform", type: "elevation", x: 8, y: 2, width: 6, height: 3, properties: { elevationFt: 8, label: "Караульный помост" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 10, y: 15 }, { x: 11, y: 15 }, { x: 9, y: 15 }] },
    { name: "enemy_frontline", cells: [{ x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 }] },
    { name: "enemy_backline", cells: [{ x: 5, y: 6 }, { x: 15, y: 6 }] },
    { name: "boss", cells: [{ x: 10, y: 3 }, { x: 11, y: 3 }] },
  ],
};

// 19. Лагерь разбойников (Bandit Camp)
export const banditCampPreset: TacticalMapPreset = {
  id: "preset-bandit-camp",
  name: "Лагерь разбойников",
  nameEn: "Bandit Camp",
  biome: "bandit_camp",
  tags: ["bandit", "camp", "tents", "palisade", "fire", "forest", "outlaws"],
  gridWidth: 22,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/forest.jpg",
  description: "Укрепленное разбойничье логово с бревенчатым частоколом, брезентовыми палатками и пылающим кострищем.",
  elements: [
    // Палатки (укрытие +2 КД)
    { id: "tent-1", type: "cover", x: 4, y: 3, width: 3, height: 2, properties: { coverBonus: 2, label: "Брезентовая палатка" } },
    { id: "tent-2", type: "cover", x: 15, y: 3, width: 3, height: 2, properties: { coverBonus: 2, label: "Брезентовая палатка" } },
    { id: "tent-3", type: "cover", x: 4, y: 11, width: 3, height: 2, properties: { coverBonus: 2, label: "Палатка атамана" } },
    // Пылающее кострище в центре (урон огнем)
    { id: "campfire", type: "lava", x: 10, y: 7, width: 2, height: 2, properties: { label: "Большой лагерный костер" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 1, y: 7 }, { x: 1, y: 8 }, { x: 2, y: 7 }] },
    { name: "enemy_frontline", cells: [{ x: 7, y: 7 }, { x: 8, y: 7 }, { x: 8, y: 8 }] },
    { name: "enemy_backline", cells: [{ x: 14, y: 5 }, { x: 15, y: 5 }] },
    { name: "boss", cells: [{ x: 18, y: 7 }, { x: 19, y: 7 }] },
  ],
};

// 20. Гнездо пауков (Spider Nest)
export const spiderNestPreset: TacticalMapPreset = {
  id: "preset-spider-nest",
  name: "Гнездо пауков",
  nameEn: "Spider Nest",
  biome: "spider_nest",
  tags: ["spider", "nest", "web", "cave", "eggs", "cocoons", "poison"],
  gridWidth: 20,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/dungeon.png",
  description: "Темный грот, плотно затянутый липкой белесой паутиной, с коконами несчастных жертв.",
  elements: [
    // Густая липкая паутина (трудная местность)
    { id: "web-patch-1", type: "difficult", x: 5, y: 4, width: 6, height: 4, properties: { label: "Липкая шелковая паутина" } },
    { id: "web-patch-2", type: "difficult", x: 11, y: 8, width: 6, height: 4, properties: { label: "Липкая шелковая паутина" } },
    // Коконы жертв (укрытие +2 КД)
    { id: "cocoon-1", type: "cover", x: 3, y: 3, width: 1, height: 1, properties: { coverBonus: 2, label: "Шелковый кокон жертвы" } },
    { id: "cocoon-2", type: "cover", x: 16, y: 3, width: 1, height: 1, properties: { coverBonus: 2, label: "Шелковый кокон жертвы" } },
    { id: "cocoon-3", type: "cover", x: 15, y: 13, width: 1, height: 1, properties: { coverBonus: 2, label: "Шелковый кокон жертвы" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 1, y: 8 }] },
    { name: "enemy_frontline", cells: [{ x: 9, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 8 }] },
    { name: "enemy_backline", cells: [{ x: 14, y: 4 }, { x: 15, y: 4 }] },
    { name: "boss", cells: [{ x: 17, y: 7 }, { x: 18, y: 7 }] },
  ],
};

// 21. Портовая пристань (Harbor Docks)
export const docksHarborPreset: TacticalMapPreset = {
  id: "preset-docks-harbor",
  name: "Портовая пристань",
  nameEn: "Harbor Docks",
  biome: "docks_harbor",
  tags: ["docks", "harbor", "port", "pier", "water", "cranes", "warehouse"],
  gridWidth: 22,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/ship.jpg",
  description: "Деревянный портовый пирс на сваях, окруженный морской водой, с рядами бочек и ящиков с грузом.",
  elements: [
    // Морская вода вокруг пирса
    { id: "harbor-water-n", type: "water", x: 0, y: 0, width: 22, height: 4, properties: { label: "Морская бухта" } },
    { id: "harbor-water-s", type: "water", x: 0, y: 12, width: 22, height: 4, properties: { label: "Морская бухта" } },
    // Штабеля грузов (укрытие +2 КД)
    { id: "cargo-pile-1", type: "cover", x: 6, y: 5, width: 2, height: 2, properties: { coverBonus: 2, label: "Бочки с ромом" } },
    { id: "cargo-pile-2", type: "cover", x: 14, y: 9, width: 2, height: 2, properties: { coverBonus: 2, label: "Ящики со специями" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 1, y: 8 }] },
    { name: "enemy_frontline", cells: [{ x: 9, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 8 }] },
    { name: "enemy_backline", cells: [{ x: 15, y: 6 }, { x: 16, y: 6 }] },
    { name: "boss", cells: [{ x: 19, y: 7 }, { x: 20, y: 7 }] },
  ],
};

// 22. Гробница фараона (Pharaoh Tomb)
export const tombPyramidPreset: TacticalMapPreset = {
  id: "preset-tomb-pyramid",
  name: "Гробница фараона",
  nameEn: "Pharaoh Tomb",
  biome: "tomb_pyramid",
  tags: ["tomb", "pyramid", "pharaoh", "sarcophagus", "traps", "crypt", "gold"],
  gridWidth: 20,
  gridHeight: 18,
  cellSizeFt: 5,
  backgroundUrl: "/maps/desert.jpg",
  description: "Погребальная камера древней пирамиды с массивным золотым саркофагом и плитами-ловушками.",
  elements: [
    // Стены усыпальницы
    { id: "tomb-wall-n", type: "wall", x: 0, y: 0, width: 20, height: 1, properties: { label: "Песчаниковые блоки" } },
    { id: "tomb-wall-s", type: "wall", x: 0, y: 17, width: 20, height: 1, properties: { label: "Песчаниковые блоки" } },
    { id: "tomb-wall-w", type: "wall", x: 0, y: 1, width: 1, height: 16, properties: { label: "Песчаниковые блоки" } },
    { id: "tomb-wall-e", type: "wall", x: 19, y: 1, width: 1, height: 16, properties: { label: "Песчаниковые блоки" } },
    // Саркофаг фараона (высокое укрытие +5 КД)
    { id: "pharaoh-sarcophagus", type: "cover", x: 9, y: 4, width: 2, height: 3, properties: { coverBonus: 5, label: "Золотой саркофаг" } },
    // Плиты с шипами (трудная местность)
    { id: "spike-plate-1", type: "difficult", x: 5, y: 8, width: 3, height: 2, properties: { label: "Плита со скрытыми шипами" } },
    { id: "spike-plate-2", type: "difficult", x: 12, y: 8, width: 3, height: 2, properties: { label: "Плита со скрытыми шипами" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 9, y: 15 }, { x: 10, y: 15 }, { x: 9, y: 16 }] },
    { name: "enemy_frontline", cells: [{ x: 9, y: 10 }, { x: 10, y: 10 }, { x: 8, y: 10 }] },
    { name: "enemy_backline", cells: [{ x: 4, y: 5 }, { x: 15, y: 5 }] },
    { name: "boss", cells: [{ x: 9, y: 2 }, { x: 10, y: 2 }] },
  ],
};

// 23. Плавильня и кузница (Foundry Forge)
export const foundryForgePreset: TacticalMapPreset = {
  id: "preset-foundry-forge",
  name: "Плавильня и кузница",
  nameEn: "Foundry Forge",
  biome: "foundry_forge",
  tags: ["foundry", "forge", "smithy", "molten", "metal", "anvil", "lava"],
  gridWidth: 20,
  gridHeight: 16,
  cellSizeFt: 5,
  backgroundUrl: "/maps/lava.jpg",
  description: "Грохочущая плавильня с чанами кипящей стали, раскаленными наковальнями и горнами.",
  elements: [
    // Чаны с расплавленным металлом (лавовый урон)
    { id: "molten-vat-1", type: "lava", x: 6, y: 3, width: 3, height: 2, properties: { label: "Чан с жидкой сталью" } },
    { id: "molten-vat-2", type: "lava", x: 11, y: 3, width: 3, height: 2, properties: { label: "Чан с жидкой сталью" } },
    // Массивные наковальни (укрытие +5 КД)
    { id: "anvil-1", type: "cover", x: 5, y: 8, width: 2, height: 1, properties: { coverBonus: 5, label: "Тяжелая наковальня" } },
    { id: "anvil-2", type: "cover", x: 13, y: 8, width: 2, height: 1, properties: { coverBonus: 5, label: "Тяжелая наковальня" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 9, y: 13 }, { x: 10, y: 13 }, { x: 9, y: 14 }] },
    { name: "enemy_frontline", cells: [{ x: 8, y: 9 }, { x: 9, y: 9 }, { x: 10, y: 9 }] },
    { name: "enemy_backline", cells: [{ x: 4, y: 5 }, { x: 15, y: 5 }] },
    { name: "boss", cells: [{ x: 9, y: 2 }, { x: 10, y: 2 }] },
  ],
};

// 24. Астральный разлом (Astral Rift)
export const astralRiftPreset: TacticalMapPreset = {
  id: "preset-astral-rift",
  name: "Астральный разлом",
  nameEn: "Astral Rift",
  biome: "astral_rift",
  tags: ["astral", "rift", "void", "space", "floating", "crystals", "portal"],
  gridWidth: 22,
  gridHeight: 18,
  cellSizeFt: 5,
  backgroundUrl: "/maps/temple.jpg",
  description: "Парящие в серебристой космической пустоте астральные островки, соединенные световыми мостами.",
  elements: [
    // Астральная пустота (препятствие / падение)
    { id: "void-chasm-1", type: "obstacle", x: 0, y: 0, width: 6, height: 6, properties: { label: "Астральная пустота" } },
    { id: "void-chasm-2", type: "obstacle", x: 16, y: 0, width: 6, height: 6, properties: { label: "Астральная пустота" } },
    { id: "void-chasm-3", type: "obstacle", x: 0, y: 12, width: 6, height: 6, properties: { label: "Астральная пустота" } },
    { id: "void-chasm-4", type: "obstacle", x: 16, y: 12, width: 6, height: 6, properties: { label: "Астральная пустота" } },
    // Астральные кристаллы (укрытие +2 КД)
    { id: "astral-crystal-1", type: "cover", x: 8, y: 5, width: 1, height: 1, properties: { coverBonus: 2, label: "Светящийся кристалл" } },
    { id: "astral-crystal-2", type: "cover", x: 13, y: 5, width: 1, height: 1, properties: { coverBonus: 2, label: "Светящийся кристалл" } },
    { id: "astral-crystal-3", type: "cover", x: 8, y: 12, width: 1, height: 1, properties: { coverBonus: 2, label: "Светящийся кристалл" } },
    { id: "astral-crystal-4", type: "cover", x: 13, y: 12, width: 1, height: 1, properties: { coverBonus: 2, label: "Светящийся кристалл" } },
    // Центральный астральный разлом
    { id: "astral-portal", type: "elevation", x: 9, y: 7, width: 4, height: 4, properties: { elevationFt: 5, label: "Око Астрала" } },
  ],
  spawnZones: [
    { name: "party", cells: [{ x: 10, y: 15 }, { x: 11, y: 15 }, { x: 10, y: 16 }] },
    { name: "enemy_frontline", cells: [{ x: 9, y: 11 }, { x: 10, y: 11 }, { x: 11, y: 11 }] },
    { name: "enemy_backline", cells: [{ x: 7, y: 8 }, { x: 14, y: 8 }] },
    { name: "boss", cells: [{ x: 10, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 9 }] },
  ],
};

export const CANONICAL_PRESETS_EXTENDED: TacticalMapPreset[] = [
  swampBogPreset,
  snowyMountainPreset,
  desertDunesPreset,
  underdarkMushroomsPreset,
  graveyardCryptPreset,
  bridgeChasmPreset,
  mineTracksPreset,
  sewersPreset,
  wizardTowerPreset,
  castleCourtyardPreset,
  banditCampPreset,
  spiderNestPreset,
  docksHarborPreset,
  tombPyramidPreset,
  foundryForgePreset,
  astralRiftPreset,
];
