export type AppSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  autoStartBreak: boolean;
  autoStartFocus: boolean;
  sessionEndNotification: boolean;
  breakEndNotification: boolean;
};

export const SETTINGS_STORAGE_KEY = 'settings';

export const CAUGHT_FISH_STORAGE_KEY = 'caughtFish';
export const CAT_COINS_STORAGE_KEY = 'cat_coins';
export const LEGACY_CAT_COINS_STORAGE_KEY = 'catCoins';
export const TOTAL_SESSIONS_STORAGE_KEY = 'totalSessionsCompleted';
export const PURCHASED_SHOP_ITEMS_STORAGE_KEY = 'purchasedShopItems';
export const EQUIPPED_COSMETIC_STORAGE_KEY = 'equippedCosmetic';
export const CAT_OWNED_ITEMS_STORAGE_KEY = 'cat_owned_items';
export const CAT_EQUIPPED_STORAGE_KEY = 'cat_equipped';
/** AsyncStorage flag: user completed first-launch cat color picker. */
export const CAT_COLOR_ONBOARDING_COMPLETE_KEY = 'cat_color_onboarding_complete';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  focusMinutes: 50,
  shortBreakMinutes: 10,
  longBreakMinutes: 30,
  longBreakInterval: 4,
  autoStartBreak: false,
  autoStartFocus: false,
  sessionEndNotification: true,
  breakEndNotification: true,
};

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.round(value);
  if (rounded < min) {
    return min;
  }
  if (rounded > max) {
    return max;
  }
  return rounded;
}

export function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    focusMinutes: clamp(value?.focusMinutes ?? DEFAULT_APP_SETTINGS.focusMinutes, 1, 180, DEFAULT_APP_SETTINGS.focusMinutes),
    shortBreakMinutes: clamp(
      value?.shortBreakMinutes ?? DEFAULT_APP_SETTINGS.shortBreakMinutes,
      1,
      120,
      DEFAULT_APP_SETTINGS.shortBreakMinutes,
    ),
    longBreakMinutes: clamp(
      value?.longBreakMinutes ?? DEFAULT_APP_SETTINGS.longBreakMinutes,
      1,
      180,
      DEFAULT_APP_SETTINGS.longBreakMinutes,
    ),
    longBreakInterval: clamp(
      value?.longBreakInterval ?? DEFAULT_APP_SETTINGS.longBreakInterval,
      1,
      12,
      DEFAULT_APP_SETTINGS.longBreakInterval,
    ),
    autoStartBreak: Boolean(value?.autoStartBreak ?? DEFAULT_APP_SETTINGS.autoStartBreak),
    autoStartFocus: Boolean(value?.autoStartFocus ?? DEFAULT_APP_SETTINGS.autoStartFocus),
    sessionEndNotification: Boolean(
      value?.sessionEndNotification ?? DEFAULT_APP_SETTINGS.sessionEndNotification,
    ),
    breakEndNotification: Boolean(value?.breakEndNotification ?? DEFAULT_APP_SETTINGS.breakEndNotification),
  };
}
