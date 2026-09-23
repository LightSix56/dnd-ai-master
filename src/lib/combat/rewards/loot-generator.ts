import type {
  CombatCoins,
  CombatLoot,
  EnemyLootInput,
  GenerateCombatLootOptions,
  LootItem,
} from "./types";

export const CR_TO_XP: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "0.125": 25,
  "1/4": 50,
  "0.25": 50,
  "1/2": 100,
  "0.5": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
};

function rollDice(count: number, sides: number, rng: () => number): number {
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += Math.floor(rng() * sides) + 1;
  }
  return sum;
}

function parseEnemyCr(enemy: EnemyLootInput): number {
  const raw = enemy.challengeRating ?? enemy.cr ?? enemy.level ?? 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    if ((raw as string).includes("/")) {
      const parts = (raw as string).split("/");
      const num = Number(parts[0]);
      const den = Number(parts[1]);
      if (den !== 0) return num / den;
    }
    return Number(raw) || 0;
  }
  return 0;
}

function getXpForCr(cr: number): number {
  const key = String(cr);
  if (CR_TO_XP[key] !== undefined) return CR_TO_XP[key];
  if (cr === 0.125) return 25;
  if (cr === 0.25) return 50;
  if (cr === 0.5) return 100;
  const rounded = Math.round(cr);
  if (CR_TO_XP[String(rounded)] !== undefined) return CR_TO_XP[String(rounded)];
  return Math.max(10, Math.round(cr * 200));
}

const THEMATIC_MONSTER_DROPS: Record<string, LootItem[]> = {
  undead: [
    {
      id: "loot-undead-amulet",
      name: "Амулет могильного праха",
      type: "trinket",
      description: "Старинный медный амулет, хранящий холод могильного праха нежити.",
      valueGp: 15,
      rarity: "common",
    },
    {
      id: "loot-undead-bone-ring",
      name: "Костяной перстень с гравировкой",
      type: "trinket",
      description: "Перстень из полированной кости с вырезанными некротическими рунами.",
      valueGp: 10,
      rarity: "common",
    },
    {
      id: "loot-undead-skull",
      name: "Оскверненный череп",
      type: "material",
      description: "Череп поверженного умертвия, фонящий остатками темной энергии.",
      valueGp: 8,
      rarity: "common",
    },
  ],
  beast: [
    {
      id: "loot-beast-fang",
      name: "Острый клык хищника",
      type: "material",
      description: "Крепкий острый клык свирепого зверя, пригодный для алхимии и ремесла.",
      valueGp: 5,
      rarity: "common",
    },
    {
      id: "loot-beast-pelt",
      name: "Шкура дикого зверя",
      type: "material",
      description: "Густая теплая шкура поверженного хищника без следов глубоких пробоин.",
      valueGp: 12,
      rarity: "common",
    },
    {
      id: "loot-beast-claw",
      name: "Коготь лесного охотника",
      type: "material",
      description: "Кривой смертоносный коготь крупного хищника.",
      valueGp: 6,
      rarity: "common",
    },
  ],
  humanoid: [
    {
      id: "loot-hum-pouch",
      name: "Кошель наемника",
      type: "trinket",
      description: "Кожаный кошель с памятными безделушками и игральными жетонами.",
      valueGp: 10,
      rarity: "common",
    },
    {
      id: "loot-hum-dagger",
      name: "Заточенный кинжал разбойника",
      type: "equipment",
      description: "Удобный стальной кинжал с обмотанной кожей рукоятью.",
      valueGp: 15,
      rarity: "common",
    },
  ],
  monstrosity: [
    {
      id: "loot-monst-scale",
      name: "Чешуя чудовища",
      type: "material",
      description: "Прочная и гибкая пластина чешуи необычного чудовища.",
      valueGp: 25,
      rarity: "common",
    },
    {
      id: "loot-monst-gland",
      name: "Ядовитая железа монстра",
      type: "material",
      description: "Запечатанная железа, полная едкого ядовитого экстракта.",
      valueGp: 30,
      rarity: "uncommon",
    },
  ],
  dragon: [
    {
      id: "loot-drag-scale",
      name: "Драконья чешуйка",
      type: "material",
      description: "Мерцающая чешуйка дракона, отражающая пламя и магический жар.",
      valueGp: 100,
      rarity: "rare",
    },
    {
      id: "loot-drag-tooth",
      name: "Драконий зуб",
      type: "material",
      description: "Массивный зуб дракона, сохраняющий остаточное первородное тепло.",
      valueGp: 80,
      rarity: "uncommon",
    },
  ],
  aberration: [
    {
      id: "loot-aberr-tentacle",
      name: "Пульсирующее щупальце",
      type: "material",
      description: "Чужеродная плоть из Дальнего Предела, слабо пульсирующая во тьме.",
      valueGp: 45,
      rarity: "uncommon",
    },
  ],
  fiend: [
    {
      id: "loot-fiend-shard",
      name: "Серный осколок Бездны",
      type: "material",
      description: "Осколок адской породы, источающий жар и запах серы.",
      valueGp: 40,
      rarity: "uncommon",
    },
  ],
  elemental: [
    {
      id: "loot-elem-core",
      name: "Кристалл первородной стихии",
      type: "material",
      description: "Пульсирующий самоцвет, удерживающий силу стихийного вихря.",
      valueGp: 50,
      rarity: "uncommon",
    },
  ],
  fey: [
    {
      id: "loot-fey-dust",
      name: "Пыльца фей",
      type: "consumable",
      description: "Светящаяся золотистая пыльца, дарующая ощущение легкости и бодрости.",
      valueGp: 25,
      rarity: "common",
    },
  ],
  giant: [
    {
      id: "loot-giant-buckle",
      name: "Бронзовая пряжка великана",
      type: "trinket",
      description: "Массивная бронзовая пряжка с выбитым клановым узором.",
      valueGp: 35,
      rarity: "common",
    },
  ],
  construct: [
    {
      id: "loot-constr-gear",
      name: "Точная шестерня автоматона",
      type: "material",
      description: "Шестерня тончайшей работы из нетускнеющей латуни.",
      valueGp: 20,
      rarity: "common",
    },
  ],
  plant: [
    {
      id: "loot-plant-vine",
      name: "Лоза-душитель",
      type: "material",
      description: "Невероятно упругая растительная жила ядовитого терновника.",
      valueGp: 15,
      rarity: "common",
    },
  ],
};

const THEMATIC_BIOME_DROPS: Record<string, LootItem[]> = {
  swamp: [
    {
      id: "loot-swamp-herb",
      name: "Трава болотная (ведьмичник)",
      type: "material",
      description: "Терпкая лекарственная трава, растущая на кочках гиблых болот.",
      valueGp: 12,
      rarity: "common",
    },
    {
      id: "loot-swamp-moss",
      name: "Болотный мох-целитель",
      type: "material",
      description: "Густой зеленоватый болотный мох с сильными вяжущими свойствами.",
      valueGp: 8,
      rarity: "common",
    },
  ],
  forest: [
    {
      id: "loot-forest-bark",
      name: "Лесная кора древнего вяза",
      type: "material",
      description: "Твердая кора старого дерева, насыщенная целебными смолами.",
      valueGp: 5,
      rarity: "common",
    },
    {
      id: "loot-forest-berries",
      name: "Лесные ягоды вороники",
      type: "consumable",
      description: "Свежие терпкие лесные ягоды, восстанавливающие бодрость духа.",
      valueGp: 6,
      rarity: "common",
    },
  ],
  dungeon: [
    {
      id: "loot-dungeon-key",
      name: "Ржавый ключ от казематов",
      type: "trinket",
      description: "Тяжелый кованый ключ с клеймом древней подгорной стражи.",
      valueGp: 5,
      rarity: "common",
    },
    {
      id: "loot-dungeon-torch",
      name: "Огарок смоляного факела",
      type: "trinket",
      description: "Просмоленный огарок, сохранивший сухой фитиль.",
      valueGp: 2,
      rarity: "common",
    },
  ],
  cave: [
    {
      id: "loot-cave-stalactite",
      name: "Пещерный сталактит",
      type: "material",
      description: "Минеральный скол полупрозрачного кальцитового сталактита.",
      valueGp: 7,
      rarity: "common",
    },
    {
      id: "loot-cave-lichen",
      name: "Светящийся пещерный лишайник",
      type: "material",
      description: "Лишайник, мягко фосфоресцирующий в темноте подземелий.",
      valueGp: 10,
      rarity: "common",
    },
  ],
  mountain: [
    {
      id: "loot-mountain-quartz",
      name: "Горный хрусталь",
      type: "material",
      description: "Прозрачная грань кристалла горного кварца.",
      valueGp: 20,
      rarity: "common",
    },
  ],
  ruins: [
    {
      id: "loot-ruins-relic",
      name: "Древний черепок с фреской",
      type: "trinket",
      description: "Фрагмент старинной вазы с изображением ушедшей эпохи.",
      valueGp: 15,
      rarity: "common",
    },
  ],
};

const BOSS_POTION_ITEM: LootItem = {
  id: "loot-potion-healing",
  name: "Зелье лечения",
  type: "potion",
  description: "Флакон с мерцающей алой жидкостью. Восстанавливает 2d4+2 хитов.",
  valueGp: 50,
  rarity: "common",
};

const BOSS_SCROLL_ITEM: LootItem = {
  id: "loot-scroll-missile",
  name: "Свиток заклинания: Магическая стрела",
  type: "scroll",
  description: "Древний пергамент, содержащий чары 1-го круга 'Магическая стрела'.",
  valueGp: 75,
  rarity: "common",
};

/**
 * Generates combat loot and rewards based on defeated enemies according to DMG p. 136,
 * monster types, biome, and boss bonuses.
 */
export function generateCombatLoot(
  enemies: EnemyLootInput[],
  biome: string = "dungeon",
  partySize: number = 4,
  options?: GenerateCombatLootOptions
): CombatLoot {
  const rng = options?.rng ?? Math.random;
  const effectivePartySize = Math.max(1, partySize);

  if (!enemies || enemies.length === 0) {
    const zeroCoins: CombatCoins = {
      copper: 0,
      silver: 0,
      electrum: 0,
      gold: 0,
      platinum: 0,
      totalGoldValue: 0,
    };
    return {
      coins: zeroCoins,
      items: [],
      totalXp: 0,
      xpPerPlayer: 0,
      partyShare: { goldPerPlayer: 0, xpPerPlayer: 0 },
      summaryText: "Врагов нет. Добыча отсутствует.",
    };
  }

  let totalCp = 0;
  let totalSp = 0;
  let totalEp = 0;
  let totalGp = 0;
  let totalPp = 0;
  let totalXp = 0;

  const droppedItems: LootItem[] = [];
  const handledTypes = new Set<string>();
  let hasBoss = false;
  let hasHighCr = false;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    const cr = parseEnemyCr(enemy);
    const xp = getXpForCr(cr);
    totalXp += xp;

    const role = (enemy.role || "").toLowerCase();
    if (role === "boss") hasBoss = true;
    if (cr >= 1) hasHighCr = true;

    // DMG p. 136 Individual Treasure Calculations
    if (cr < 5) {
      // CR 0-4: Copper, Silver, Gold
      totalCp += rollDice(4, 6, rng) * 5;
      totalSp += rollDice(3, 6, rng) * 2;
      totalGp += rollDice(2, 6, rng);

      // Chance for platinum only on high rolls
      const ppRoll = rng();
      if (ppRoll >= 0.95) {
        totalPp += rollDice(1, 6, rng);
      }
    } else if (cr <= 10) {
      // CR 5-10: Higher scale with platinum
      totalCp += rollDice(4, 6, rng) * 50;
      totalSp += rollDice(4, 6, rng) * 20;
      totalEp += rollDice(2, 6, rng) * 5;
      totalGp += rollDice(4, 6, rng) * 10 + 40;

      const ppRoll = rng();
      if (ppRoll >= 0.5) {
        totalPp += rollDice(2, 6, rng) + 2;
      }
    } else {
      // CR 11+: High tier
      totalSp += rollDice(4, 6, rng) * 50;
      totalGp += rollDice(4, 6, rng) * 40;
      totalPp += rollDice(3, 6, rng) * 5;
    }

    // Creature type drop
    const rawType = (enemy.type || "").toLowerCase();
    let detectedType = rawType;
    if (!detectedType) {
      const lowerName = enemy.name.toLowerCase();
      if (lowerName.includes("зомби") || lowerName.includes("скелет") || lowerName.includes("мертв")) {
        detectedType = "undead";
      } else if (lowerName.includes("волк") || lowerName.includes("медведь") || lowerName.includes("гадюка")) {
        detectedType = "beast";
      } else if (lowerName.includes("гоблин") || lowerName.includes("орк") || lowerName.includes("разбойник")) {
        detectedType = "humanoid";
      }
    }

    if (detectedType && THEMATIC_MONSTER_DROPS[detectedType] && !handledTypes.has(detectedType)) {
      handledTypes.add(detectedType);
      const possibleItems = THEMATIC_MONSTER_DROPS[detectedType];
      const itemIndex = Math.floor(rng() * possibleItems.length);
      const chosen = possibleItems[itemIndex];
      droppedItems.push({
        ...chosen,
        id: `${chosen.id}-${i + 1}`,
      });
    }
  }

  // Biome-specific drops
  const normalizedBiome = (biome || "dungeon").toLowerCase();
  const biomeDrops = THEMATIC_BIOME_DROPS[normalizedBiome];
  if (biomeDrops && biomeDrops.length > 0) {
    const chosenBiomeItem = biomeDrops[Math.floor(rng() * biomeDrops.length)];
    droppedItems.push({
      ...chosenBiomeItem,
      id: `${chosenBiomeItem.id}-env`,
    });
  }

  // Boss / High CR Loot Bonus (Potion of Healing / Spell Scroll)
  if (hasBoss || hasHighCr) {
    const bossRoll = rng();
    if (hasBoss || bossRoll <= 0.8) {
      const itemVariant = rng();
      if (itemVariant <= 0.5 || hasBoss) {
        droppedItems.push({
          ...BOSS_POTION_ITEM,
          id: `loot-boss-potion-${Date.now()}`,
        });
      } else {
        droppedItems.push({
          ...BOSS_SCROLL_ITEM,
          id: `loot-boss-scroll-${Date.now()}`,
        });
      }
    }
  }

  // Calculate total gold value
  const totalGoldValue = Number(
    (
      totalPp * 10 +
      totalGp +
      totalEp * 0.5 +
      totalSp * 0.1 +
      totalCp * 0.01
    ).toFixed(2)
  );

  const coins: CombatCoins = {
    copper: totalCp,
    silver: totalSp,
    electrum: totalEp,
    gold: totalGp,
    platinum: totalPp,
    totalGoldValue,
  };

  const xpPerPlayer = Math.floor(totalXp / effectivePartySize);
  const goldPerPlayer = Number((totalGoldValue / effectivePartySize).toFixed(2));

  const coinParts: string[] = [];
  if (totalPp > 0) coinParts.push(`${totalPp} пм`);
  if (totalGp > 0) coinParts.push(`${totalGp} зм`);
  if (totalEp > 0) coinParts.push(`${totalEp} эм`);
  if (totalSp > 0) coinParts.push(`${totalSp} см`);
  if (totalCp > 0) coinParts.push(`${totalCp} мм`);

  const coinsSummary = coinParts.length > 0 ? coinParts.join(", ") : "0 монет";
  const itemsSummary = droppedItems.length > 0
    ? `${droppedItems.length} трофеев: ${droppedItems.map((d) => d.name).join(", ")}`
    : "нет предметов";

  const summaryText = `⚔️ Победа! Найдено монет: ${coinsSummary} (ценность: ${totalGoldValue} зм). Опыт: ${totalXp} XP (по ${xpPerPlayer} XP на героя). Трофеи: ${itemsSummary}.`;

  return {
    coins,
    items: droppedItems,
    totalXp,
    xpPerPlayer,
    partyShare: {
      goldPerPlayer,
      xpPerPlayer,
    },
    summaryText,
  };
}
