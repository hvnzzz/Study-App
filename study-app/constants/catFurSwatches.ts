import { FUR_COLORS } from './furColors';

export type CatFurSwatch = {
  id: string;
  name: string;
  baseHex: string;
  price: number;
  owned: boolean;
};

/** Re-export of `FUR_COLORS` for TypeScript consumers + onboarding picker. */
export const CAT_FUR_SWATCHES: CatFurSwatch[] = FUR_COLORS;

export function catFurSwatchById(id: string): CatFurSwatch | undefined {
  return CAT_FUR_SWATCHES.find((s) => s.id === id);
}
