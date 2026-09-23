export interface CombatCoins {
  copper: number;
  silver: number;
  electrum: number;
  gold: number;
  platinum: number;
  totalGoldValue: number;
}

export type LootItemType =
  | "consumable"
  | "material"
  | "trinket"
  | "equipment"
  | "scroll"
  | "potion";

export type LootItemRarity = "common" | "uncommon" | "rare";

export interface LootItem {
  id: string;
  name: string;
  type: LootItemType;
  description: string;
  valueGp: number;
  rarity?: LootItemRarity;
}

export interface CombatPartyShare {
  goldPerPlayer: number;
  xpPerPlayer: number;
}

export interface CombatLoot {
  coins: CombatCoins;
  items: LootItem[];
  totalXp: number;
  xpPerPlayer: number;
  partyShare: CombatPartyShare;
  summaryText: string;
}

export interface EnemyLootInput {
  name: string;
  challengeRating?: number;
  cr?: number;
  level?: number;
  type?: string;
  role?: string;
}

export interface GenerateCombatLootOptions {
  /** Optional custom RNG function returning [0, 1) for deterministic testing */
  rng?: () => number;
}
