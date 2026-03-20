export type FishRarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary' | 'Mythic';

export type FishCatalogItem = {
  id: string;
  name: string;
  rarity: FishRarity;
  flavorText: string;
  image: number;
};

export type RarityWeight = {
  rarity: FishRarity;
  chance: number;
};

export const fishCatalog: FishCatalogItem[];
export const rarityWeights: RarityWeight[];
