import { CAT_FUR_SWATCHES } from '@/constants/catFurSwatches';

export type CatShopItem = {
  id: string;
  name: string;
  price: number;
  furHex?: string;
  /** True for items the user starts with (e.g. Default) before storage hydrates. */
  defaultOwned?: boolean;
};

export const CAT_SHOP_ITEMS: CatShopItem[] = CAT_FUR_SWATCHES.map((s) => ({
  id: s.id,
  name: s.name,
  price: s.price,
  furHex: s.baseHex,
  defaultOwned: s.owned,
}));

export function getCatShopItem(itemId: string): CatShopItem | undefined {
  return CAT_SHOP_ITEMS.find((item) => item.id === itemId);
}
