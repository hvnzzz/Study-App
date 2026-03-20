import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CAT_COLOR_ONBOARDING_COMPLETE_KEY,
  CAT_COINS_STORAGE_KEY,
  CAT_EQUIPPED_STORAGE_KEY,
  CAT_OWNED_ITEMS_STORAGE_KEY,
  LEGACY_CAT_COINS_STORAGE_KEY,
} from '@/constants/appSettings';

export type CatEquipState = {
  fur: string | null;
};

export const DEFAULT_CAT_EQUIP: CatEquipState = {
  fur: 'fur-grey',
};

const LEGACY_FUR_ID_MAP: Record<string, string> = {
  'fur-default': 'fur-grey',
  'fur-tuxedo': 'fur-siamese',
  'fur-black': 'fur-siamese',
};

function migrateFurId(id: string): string {
  return LEGACY_FUR_ID_MAP[id] ?? id;
}

export async function getCatCoins(): Promise<number> {
  const [primary, legacy] = await AsyncStorage.multiGet([
    CAT_COINS_STORAGE_KEY,
    LEGACY_CAT_COINS_STORAGE_KEY,
  ]);
  const rawPrimary = primary[1];
  const rawLegacy = legacy[1];
  const parsedPrimary = Number(rawPrimary ?? 'NaN');
  if (Number.isFinite(parsedPrimary)) {
    return Math.max(0, Math.floor(parsedPrimary));
  }
  const parsedLegacy = Number(rawLegacy ?? '0');
  const migrated = Number.isFinite(parsedLegacy) ? Math.max(0, Math.floor(parsedLegacy)) : 0;
  await AsyncStorage.setItem(CAT_COINS_STORAGE_KEY, String(migrated));
  return migrated;
}

export async function setCatCoins(value: number): Promise<void> {
  const safe = Math.max(0, Math.floor(value));
  await AsyncStorage.multiSet([
    [CAT_COINS_STORAGE_KEY, String(safe)],
    [LEGACY_CAT_COINS_STORAGE_KEY, String(safe)],
  ]);
}

export async function addCatCoins(amount: number): Promise<number> {
  const current = await getCatCoins();
  const next = Math.max(0, current + Math.floor(amount));
  await setCatCoins(next);
  return next;
}

function migrateOwnedItemIds(items: string[]): string[] {
  return Array.from(
    new Set(
      items.map((id) => {
        if (id === 'fur-default') {
          return 'fur-grey';
        }
        if (id === 'fur-tuxedo') {
          return 'fur-siamese';
        }
        if (id === 'fur-black') {
          return 'fur-siamese';
        }
        return id;
      }),
    ),
  );
}

export async function getOwnedItems(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(CAT_OWNED_ITEMS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    const migrated = migrateOwnedItemIds(list);
    const unchanged =
      migrated.length === list.length && migrated.every((id, index) => id === list[index]);
    if (!unchanged) {
      await setOwnedItems(migrated);
    }
    return migrated;
  } catch {
    return [];
  }
}

export async function setOwnedItems(items: string[]): Promise<void> {
  const unique = Array.from(new Set(items));
  await AsyncStorage.setItem(CAT_OWNED_ITEMS_STORAGE_KEY, JSON.stringify(unique));
}

export async function getEquippedState(): Promise<CatEquipState> {
  const raw = await AsyncStorage.getItem(CAT_EQUIPPED_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_CAT_EQUIP;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CatEquipState>;
    const furRaw = typeof parsed.fur === 'string' ? parsed.fur : 'fur-grey';
    return {
      fur: migrateFurId(furRaw),
    };
  } catch {
    return DEFAULT_CAT_EQUIP;
  }
}

export async function setEquippedState(next: CatEquipState): Promise<void> {
  await AsyncStorage.setItem(CAT_EQUIPPED_STORAGE_KEY, JSON.stringify(next));
}

export async function getCatColorOnboardingComplete(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(CAT_COLOR_ONBOARDING_COMPLETE_KEY);
  if (raw === '1') {
    return true;
  }
  const equippedRaw = await AsyncStorage.getItem(CAT_EQUIPPED_STORAGE_KEY);
  if (equippedRaw) {
    await AsyncStorage.setItem(CAT_COLOR_ONBOARDING_COMPLETE_KEY, '1');
    return true;
  }
  return false;
}

export async function setCatColorOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(CAT_COLOR_ONBOARDING_COMPLETE_KEY, '1');
}
