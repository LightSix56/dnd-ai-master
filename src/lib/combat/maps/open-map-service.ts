import type { MapElement, SpawnZoneDefinition, BiomeType } from "./types";

export interface OpenBattlemap {
  id: string;
  name: string;
  nameEn: string;
  biome: BiomeType;
  tags: string[];
  description: string;
  gridWidth: number;
  gridHeight: number;
  cellSizeFt?: number;
  imageUrl: string;
  thumbnailUrl?: string;
  author: string;
  license: string;
  sourceUrl?: string;
  elements?: MapElement[];
  spawnZones?: SpawnZoneDefinition[];
}

export interface OpenMapSearchQuery {
  query?: string;
  tags?: string[];
  category?: string;
  page?: number;
  limit?: number;
}

export const OPEN_BATTLEMAP_CATALOG: OpenBattlemap[] = [
  {
    id: "open-crypt-ancients",
    name: "Древняя каменная крипта",
    nameEn: "Ancient Stone Crypt",
    biome: "dungeon_prison",
    tags: ["crypt", "dungeon", "undead", "stone", "sarcophagus", "ruins", "underdark"],
    description: "Мрачная подземная усыпальница с каменными саркофагами, осыпающимися плитами и полуразрушенными колоннами.",
    gridWidth: 20,
    gridHeight: 15,
    cellSizeFt: 5,
    imageUrl: "/maps/dungeon.png",
    author: "Open Community VTT",
    license: "CC-BY 4.0",
    elements: [
      { id: "w-c1", type: "wall", x: 0, y: 0, width: 20, height: 1, properties: { label: "Стена" } },
      { id: "c-c1", type: "cover", x: 6, y: 5, width: 2, height: 1, properties: { coverType: "half", label: "Саркофаг" } },
      { id: "c-c2", type: "cover", x: 12, y: 5, width: 2, height: 1, properties: { coverType: "half", label: "Саркофаг" } },
    ],
    spawnZones: [
      {
        name: "party",
        cells: [
          { x: 3, y: 6 },
          { x: 3, y: 7 },
          { x: 3, y: 8 },
          { x: 4, y: 6 },
          { x: 4, y: 7 },
          { x: 4, y: 8 },
        ],
      },
      {
        name: "enemy_frontline",
        cells: [
          { x: 11, y: 6 },
          { x: 11, y: 7 },
          { x: 11, y: 8 },
          { x: 12, y: 7 },
          { x: 13, y: 7 },
        ],
      },
      {
        name: "enemy_backline",
        cells: [
          { x: 14, y: 5 },
          { x: 14, y: 6 },
          { x: 14, y: 8 },
          { x: 14, y: 9 },
        ],
      },
      {
        name: "boss",
        cells: [
          { x: 14, y: 7 },
          { x: 15, y: 7 },
        ],
      },
    ],
  },
  {
    id: "open-forest-ambush",
    name: "Лесной тракт и засада",
    nameEn: "Forest Road & Ambush",
    biome: "forest_ambush",
    tags: ["forest", "trees", "road", "ambush", "nature", "boulders", "wild"],
    description: "Извилистая грунтовая дорога сквозь вековой смешанный лес. Валуны и плотные кустарники служат естественными укрытиями.",
    gridWidth: 22,
    gridHeight: 16,
    cellSizeFt: 5,
    imageUrl: "/maps/forest.jpg",
    author: "Open VTT Project",
    license: "CC0",
    elements: [
      { id: "cov-f1", type: "cover", x: 4, y: 3, width: 2, height: 2, properties: { coverType: "three-quarters", label: "Замшелый валун" } },
      { id: "cov-f2", type: "cover", x: 16, y: 11, width: 2, height: 2, properties: { coverType: "half", label: "Густой кустарник" } },
    ],
  },
  {
    id: "open-ancient-temple",
    name: "Храм забытого божества",
    nameEn: "Temple of the Forgotten One",
    biome: "temple",
    tags: ["temple", "altar", "holy", "ruins", "columns", "magic", "sanctuary"],
    description: "Монументальный каменный неф храма с высокими резными колоннами и ступенчатым возвышением перед светящимся алтарем.",
    gridWidth: 20,
    gridHeight: 26,
    cellSizeFt: 5,
    imageUrl: "/maps/temple.jpg",
    author: "Cartography Guild Open",
    license: "CC-BY-SA",
    elements: [
      { id: "t-altar", type: "cover", x: 9, y: 4, width: 2, height: 2, properties: { coverType: "three-quarters", label: "Рунический алтарь" } },
    ],
  },
  {
    id: "open-tavern-brawl",
    name: "Шумная таверна «Змеиный клык»",
    nameEn: "Serpent Fang Tavern",
    biome: "tavern",
    tags: ["tavern", "inn", "city", "urban", "brawl", "tables", "fireplace", "social"],
    description: "Просторный главный зал двухэтажной средневековой таверны с длинной стойкой, очагом, бочками и дубовыми столами.",
    gridWidth: 18,
    gridHeight: 14,
    cellSizeFt: 5,
    imageUrl: "/maps/tavern.jpg",
    author: "Open Battlemaps Archive",
    license: "CC-BY 4.0",
    elements: [
      { id: "t-bar", type: "cover", x: 12, y: 2, width: 4, height: 1, properties: { coverType: "half", label: "Дубовая барная стойка" } },
    ],
  },
  {
    id: "open-ship-boarding",
    name: "Абордаж в открытом море",
    nameEn: "High Seas Boarding Action",
    biome: "ship_battle",
    tags: ["ship", "naval", "ocean", "sea", "pirates", "boarding", "water", "planks"],
    description: "Два парусных галеона, сцепившихся бортами над кипящей океанской волной. Абордажные мостки соединяют палубы.",
    gridWidth: 24,
    gridHeight: 18,
    cellSizeFt: 5,
    imageUrl: "/maps/ship.jpg",
    author: "OpenRPG Cartography",
    license: "CC0",
    elements: [
      { id: "w-sea", type: "water", x: 11, y: 0, width: 2, height: 18, properties: { difficultTerrain: true, label: "Бурлящая пучина" } },
    ],
  },
  {
    id: "open-volcanic-chasm",
    name: "Разлом пылающей магмы",
    nameEn: "Volcanic Magma Chasm",
    biome: "lava_cave",
    tags: ["lava", "volcano", "cave", "fire", "elemental", "chasm", "hazard"],
    description: "Пещера под спящим вулканом, рассечённая рекой кипящей лавы. Базальтовые островки служат ненадежными мостами.",
    gridWidth: 20,
    gridHeight: 15,
    cellSizeFt: 5,
    imageUrl: "/maps/lava.jpg",
    author: "Battlemap Commons",
    license: "CC-BY 3.0",
    elements: [
      { id: "l-stream", type: "lava", x: 8, y: 0, width: 4, height: 15, properties: { difficultTerrain: true, label: "Поток раскаленной лавы" } },
    ],
  },
  {
    id: "open-gladiator-arena",
    name: "Колизей песков и крови",
    nameEn: "Colosseum of Sand & Blood",
    biome: "gladiator_arena",
    tags: ["arena", "colosseum", "sand", "boss", "combat", "pit", "spectators"],
    description: "Круглая песчаная арена со следами битв, окружённая высокими гранитными стенами и массивными решётками зверинца.",
    gridWidth: 22,
    gridHeight: 22,
    cellSizeFt: 5,
    imageUrl: "/maps/arena.jpg",
    author: "Open VTT Project",
    license: "CC0",
    elements: [
      { id: "ar-gate", type: "door", x: 10, y: 0, width: 2, height: 1, properties: { label: "Решётка зверинца" } },
    ],
  },
  {
    id: "open-swamp-ruins",
    name: "Затопленные руины Чернотопи",
    nameEn: "Sunken Ruins of Black Marsh",
    biome: "swamp_bog",
    tags: ["swamp", "marsh", "water", "ruins", "decay", "fog", "hags", "monsters"],
    description: "Гиблая топь с поросшими мхом каменными ступенями, илистыми заводями и скрюченными корнями древних кипарисов.",
    gridWidth: 20,
    gridHeight: 16,
    cellSizeFt: 5,
    imageUrl: "/maps/swamp.jpg",
    author: "CartographyAssets Open",
    license: "CC-BY 4.0",
    elements: [
      { id: "sw-deep", type: "water", x: 4, y: 4, width: 6, height: 5, properties: { difficultTerrain: true, label: "Гнилостная трясина" } },
    ],
  },
  {
    id: "open-city-square",
    name: "Рыночная площадь Док-Уорда",
    nameEn: "Dock Ward Market Square",
    biome: "city_street",
    tags: ["city", "urban", "street", "market", "carts", "wells", "guards", "crossroads"],
    description: "Мощёный перекрёсток торгового квартала с телегами торговцев, навесами лавок и каменным колодцем в центре.",
    gridWidth: 20,
    gridHeight: 18,
    cellSizeFt: 5,
    imageUrl: "/maps/city.jpg",
    author: "OpenRPG Cartography",
    license: "CC0",
    elements: [
      { id: "ct-well", type: "cover", x: 9, y: 8, width: 2, height: 2, properties: { coverType: "three-quarters", label: "Городской колодец" } },
      { id: "ct-cart", type: "cover", x: 4, y: 12, width: 3, height: 2, properties: { coverType: "half", label: "Торговая телега" } },
    ],
  },
  {
    id: "open-snow-pass",
    name: "Ледяной перевал Драконьего пика",
    nameEn: "Dragon Peak Icy Pass",
    biome: "snowy_mountain",
    tags: ["mountain", "snow", "ice", "chasm", "cliff", "bridge", "cold", "giants"],
    description: "Заснеженный карниз на головокружительной высоте. Сквозной ветер взметает снежную пыль над бездонной пропастью.",
    gridWidth: 24,
    gridHeight: 16,
    cellSizeFt: 5,
    imageUrl: "/maps/snowy_mountain.jpg",
    author: "Battlemap Commons",
    license: "CC-BY 4.0",
    elements: [
      { id: "sn-chasm", type: "difficult", x: 0, y: 12, width: 24, height: 4, properties: { label: "Ледяная пропасть" } },
    ],
  },
  {
    id: "open-desert-tomb",
    name: "Занесённая песками гробница",
    nameEn: "Dune-Buried Pharaoh Tomb",
    biome: "desert_dunes",
    tags: ["desert", "sand", "tomb", "pyramid", "ruins", "dunes", "mummy", "heat"],
    description: "Песчаное море с торчащими из барханов верхушками древних обелисков и пробитым входом в подземный некрополь.",
    gridWidth: 22,
    gridHeight: 18,
    cellSizeFt: 5,
    imageUrl: "/maps/desert.jpg",
    author: "Open Community VTT",
    license: "CC0",
    elements: [
      { id: "ds-obelisk", type: "cover", x: 10, y: 7, width: 2, height: 2, properties: { coverType: "three-quarters", label: "Разбитый обелиск" } },
    ],
  },
  {
    id: "open-stone-bridge",
    name: "Арочный мост через горную реку",
    nameEn: "Arched Bridge over Rushing River",
    biome: "bridge_chasm",
    tags: ["bridge", "river", "mountain", "crossing", "water", "choke_point", "stone"],
    description: "Узкий древний мост через стремительную горную реку. Идеальная тактическая точка для обороны и засад.",
    gridWidth: 20,
    gridHeight: 14,
    cellSizeFt: 5,
    imageUrl: "/maps/snowy_mountain.jpg",
    author: "OpenRPG Cartography",
    license: "CC-BY 4.0",
    elements: [
      { id: "br-river", type: "water", x: 0, y: 0, width: 20, height: 4, properties: { difficultTerrain: true, label: "Бурный горный поток" } },
      { id: "br-parapet", type: "cover", x: 5, y: 4, width: 10, height: 1, properties: { coverType: "half", label: "Каменный парапет" } },
    ],
  },
  {
    id: "open-underground-catacombs",
    name: "Катакомбы плачущих теней",
    nameEn: "Catacombs of Weeping Shadows",
    biome: "dungeon_prison",
    tags: ["catacombs", "dungeon", "crypt", "bones", "undead", "skull", "darkness"],
    description: "Многоярусные лабиринты катакомб, стены которых выложены тысячами костей и черепов павших воинов.",
    gridWidth: 20,
    gridHeight: 20,
    cellSizeFt: 5,
    imageUrl: "/maps/dungeon.png",
    author: "Open VTT Project",
    license: "CC0",
    elements: [
      { id: "cat-pillar", type: "cover", x: 6, y: 6, width: 2, height: 2, properties: { coverType: "three-quarters", label: "Костяная колонна" } },
    ],
  },
  {
    id: "open-deep-forest-clearing",
    name: "Друидская поляна у водопада",
    nameEn: "Druid Waterfall Clearing",
    biome: "forest_ambush",
    tags: ["forest", "waterfall", "river", "druid", "magic", "clearing", "camp"],
    description: "Скрытая лесная поляна у ревущего водопада с менгирами и древним костровищем посреди диких трав.",
    gridWidth: 22,
    gridHeight: 18,
    cellSizeFt: 5,
    imageUrl: "/maps/forest.jpg",
    author: "Battlemap Commons",
    license: "CC-BY 3.0",
    elements: [
      { id: "df-menhir", type: "cover", x: 11, y: 8, width: 2, height: 2, properties: { coverType: "three-quarters", label: "Друидский менгир" } },
    ],
  },
  {
    id: "open-castle-throne-room",
    name: "Тронный зал Падшей крепости",
    nameEn: "Fallen Fortress Throne Room",
    biome: "castle_courtyard",
    tags: ["castle", "throne", "palace", "ruins", "boss", "columns", "banners"],
    description: "Величественный каменный зал с широкой ковровой дорожкой, высокими окнами и троном на гранитном пьедестале.",
    gridWidth: 24,
    gridHeight: 20,
    cellSizeFt: 5,
    imageUrl: "/maps/temple.jpg",
    author: "Cartography Guild Open",
    license: "CC-BY-SA",
    elements: [
      { id: "tr-throne", type: "cover", x: 11, y: 3, width: 2, height: 2, properties: { coverType: "three-quarters", label: "Трон правителя" } },
    ],
  },
];

export const POPULAR_MAP_TAGS: Array<{ tag: string; labelRu: string; count: number }> = [
  { tag: "dungeon", labelRu: "Подземелье", count: 8 },
  { tag: "forest", labelRu: "Лес", count: 7 },
  { tag: "crypt", labelRu: "Крипта / Гробница", count: 5 },
  { tag: "tavern", labelRu: "Таверна", count: 4 },
  { tag: "temple", labelRu: "Храм / Алтарь", count: 6 },
  { tag: "cave", labelRu: "Пещеры", count: 5 },
  { tag: "water", labelRu: "Вода / Река", count: 6 },
  { tag: "ship", labelRu: "Корабль / Море", count: 3 },
  { tag: "bridge", labelRu: "Мост / Переправа", count: 3 },
  { tag: "ruins", labelRu: "Руины", count: 7 },
  { tag: "arena", labelRu: "Арена / Колизей", count: 3 },
  { tag: "lava", labelRu: "Лава / Вулкан", count: 3 },
  { tag: "snow", labelRu: "Снег / Горы", count: 4 },
  { tag: "city", labelRu: "Город / Улицы", count: 4 },
  { tag: "castle", labelRu: "Замок / Цитадель", count: 4 },
];

export function getPopularTags() {
  return POPULAR_MAP_TAGS;
}

export function searchOpenMaps(options: OpenMapSearchQuery = {}): OpenBattlemap[] {
  const { query, tags, category } = options;

  return OPEN_BATTLEMAP_CATALOG.filter((map) => {
    // 1. Категория
    if (category && category !== "all") {
      const b = (map.biome || "").toLowerCase();
      if (category === "dungeon_cave") {
        const match = b.includes("cave") || b.includes("dungeon") || b.includes("underdark") || map.tags.includes("crypt") || map.tags.includes("catacombs");
        if (!match) return false;
      } else if (category === "forest_swamp") {
        const match = b.includes("forest") || b.includes("swamp") || map.tags.includes("trees") || map.tags.includes("marsh");
        if (!match) return false;
      } else if (category === "mountain_snow") {
        const match = b.includes("mountain") || b.includes("snow") || b.includes("desert") || map.tags.includes("cliff");
        if (!match) return false;
      } else if (category === "urban_buildings") {
        const match = b.includes("city") || b.includes("urban") || b.includes("tavern") || b.includes("temple") || b.includes("arena");
        if (!match) return false;
      } else if (category === "water_lava") {
        const match = b.includes("ship") || b.includes("lava") || b.includes("coastal") || map.tags.includes("water");
        if (!match) return false;
      }
    }

    // 2. Теги (если указаны)
    if (tags && tags.length > 0) {
      const hasAnyTag = tags.some((t) => map.tags.includes(t.toLowerCase()));
      if (!hasAnyTag) return false;
    }

    // 3. Текстовый поиск
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      const matchName = map.name.toLowerCase().includes(q) || map.nameEn.toLowerCase().includes(q);
      const matchDesc = map.description.toLowerCase().includes(q);
      const matchTags = map.tags.some((t) => t.toLowerCase().includes(q));
      const matchBiome = map.biome.toLowerCase().includes(q);

      if (!matchName && !matchDesc && !matchTags && !matchBiome) {
        return false;
      }
    }

    return true;
  });
}

export function getOpenMapById(id: string): OpenBattlemap | undefined {
  return OPEN_BATTLEMAP_CATALOG.find((m) => m.id === id);
}

/**
 * Подбирает наиболее подходящую боевую карту по тексту описания сцены мастера
 */
export function resolveBattlemapForNarrative(narrativeText: string): OpenBattlemap {
  const text = (narrativeText || "").toLowerCase();

  const scored = OPEN_BATTLEMAP_CATALOG.map((m) => {
    let score = 0;
    if (text.includes(m.name.toLowerCase())) score += 10;
    for (const tag of m.tags) {
      if (text.includes(tag)) score += 3;
    }
    if (text.includes("крипт") && m.tags.includes("crypt")) score += 8;
    if (text.includes("пещер") && m.tags.includes("cave")) score += 8;
    if (text.includes("лес") && m.tags.includes("forest")) score += 8;
    if (text.includes("таверн") && m.tags.includes("tavern")) score += 8;
    if (text.includes("храм") && m.tags.includes("temple")) score += 8;
    if (text.includes("корабл") && m.tags.includes("ship")) score += 8;
    if (text.includes("мост") && m.tags.includes("bridge")) score += 8;
    if (text.includes("болот") && m.tags.includes("swamp")) score += 8;
    if (text.includes("лав") && m.tags.includes("lava")) score += 8;
    if (text.includes("арен") && m.tags.includes("arena")) score += 8;
    return { map: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].map : OPEN_BATTLEMAP_CATALOG[0];
}
