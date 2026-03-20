import AsyncStorage from '@react-native-async-storage/async-storage';

import { CAUGHT_FISH_STORAGE_KEY, CAT_COINS_STORAGE_KEY } from '@/constants/appSettings';

export type FishRarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary';

export type FishDefinition = {
  species: string;
  rarity: FishRarity;
  reward: number;
  chance: number;
  emoji: string;
};

export type CaughtFishRecord = {
  species: string;
  timestamp: string;
  rarity: FishRarity;
};

export const FISH_TABLE: FishDefinition[] = [
  { species: 'Mudskipper', rarity: 'Common', reward: 5, chance: 40, emoji: '🐟' },
  { species: 'Carp', rarity: 'Common', reward: 8, chance: 25, emoji: '🐠' },
  { species: 'Catfish', rarity: 'Uncommon', reward: 15, chance: 15, emoji: '🐡' },
  { species: 'Koi', rarity: 'Rare', reward: 30, chance: 10, emoji: '🧡' },
  { species: 'Axolotl', rarity: 'Rare', reward: 40, chance: 7, emoji: '💗' },
  { species: 'Golden Koi', rarity: 'Legendary', reward: 100, chance: 3, emoji: '✨' },
];

export function pickFishByWeight(): FishDefinition {
  let roll = Math.random() * 100;
  for (const fish of FISH_TABLE) {
    roll -= fish.chance;
    if (roll <= 0) {
      return fish;
    }
  }
  return FISH_TABLE[FISH_TABLE.length - 1];
}

export function rarityColor(rarity: FishRarity): string {
  if (rarity === 'Legendary') {
    return '#B85C2A';
  }
  if (rarity === 'Rare') {
    return '#C47840';
  }
  return '#5A7A55';
}

export async function persistCatch(fish: FishDefinition): Promise<void> {
  const caughtRaw = await AsyncStorage.getItem(CAUGHT_FISH_STORAGE_KEY);
  const parsedCaught = caughtRaw ? (JSON.parse(caughtRaw) as CaughtFishRecord[]) : [];
  const nextRecord: CaughtFishRecord = {
    species: fish.species,
    rarity: fish.rarity,
    timestamp: new Date().toISOString(),
  };
  const nextCaught = [...parsedCaught, nextRecord];

  const coinsRaw = await AsyncStorage.getItem(CAT_COINS_STORAGE_KEY);
  const parsedCoins = Number(coinsRaw ?? '0');
  const baseCoins = Number.isFinite(parsedCoins) ? parsedCoins : 0;
  const nextCoins = baseCoins + fish.reward;

  await AsyncStorage.multiSet([
    [CAUGHT_FISH_STORAGE_KEY, JSON.stringify(nextCaught)],
    [CAT_COINS_STORAGE_KEY, String(nextCoins)],
  ]);
}
