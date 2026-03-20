export type ShopItem = {
  id: string;
  name: string;
  price: number;
  description: string;
};

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'straw-hat',
    name: 'Straw Hat',
    price: 80,
    description: 'A sunny straw hat for Miss Cat.',
  },
  {
    id: 'fancy-rod',
    name: 'Fancy Fishing Rod',
    price: 140,
    description: 'A polished rod with a soft wooden grip.',
  },
  {
    id: 'night-background',
    name: 'Nighttime Background',
    price: 220,
    description: 'A moonlit sky theme for cozy evening focus.',
  },
];
