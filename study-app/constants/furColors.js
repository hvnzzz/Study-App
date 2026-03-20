/**
 * Fur catalog: base tint colors for {@link CatAvatar} + shop.
 * @typedef {{ id: string, name: string, baseHex: string, price: number, owned: boolean }} FurColorOption
 */

/** @type {FurColorOption[]} */
export const FUR_COLORS = [
  { id: 'fur-grey', name: 'Default', baseHex: '#A8B4C0', price: 0, owned: true },
  /** Warmer, more saturated than app bg (#EDE5D4) so the cat doesn’t disappear. */
  { id: 'fur-cream', name: 'Cream', baseHex: '#C49A62', price: 20, owned: false },
  /** Bright ginger tabby (warmer than cinnamon). */
  { id: 'fur-orange-tabby', name: 'Orange Tabby', baseHex: '#E07A3D', price: 30, owned: false },
  /** Cool gray base so Siamese reads gray/black instead of warm tan. */
  { id: 'fur-siamese', name: 'Siamese', baseHex: '#7E8795', price: 40, owned: false },
  /** True white base; renderer keeps coat neutral/cool to avoid beige blend. */
  { id: 'fur-white', name: 'White', baseHex: '#FFFFFF', price: 25, owned: false },
  { id: 'fur-calico', name: 'Calico', baseHex: '#D4A574', price: 50, owned: false },
  { id: 'fur-lavender', name: 'Lavender', baseHex: '#B8A8C8', price: 60, owned: false },
  /** Distinct deep blue (more saturated) so it does not read like default grey-blue. */
  { id: 'fur-midnight-blue', name: 'Midnight Blue', baseHex: '#1A2F86', price: 70, owned: false },
  /** Russet cinnamon — redder/darker than orange tabby. */
  { id: 'fur-cinnamon', name: 'Cinnamon', baseHex: '#9A4E32', price: 35, owned: false },
  { id: 'fur-sage', name: 'Sage', baseHex: '#8AA888', price: 35, owned: false },
];
