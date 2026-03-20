/** Cat 4-color palette from a single base fur hex (no external color libs). */

export type CatColorPalette = {
  body: string;
  shadow: string;
  belly: string;
  nose: string;
};

const BELLY = '#FAFAF5';
const NOSE = '#F9A8B8';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace('#', '');
  if (h.length !== 6) {
    return null;
  }
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) {
    return null;
  }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      default:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => v.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Darken by reducing HSL lightness by `amount` (e.g. 0.15 = 15% less lightness). */
export function darkenLightness(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return '#3A3025';
  }
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const next = hslToRgb(h, s, clamp01(l - amount));
  return rgbToHex(next.r, next.g, next.b);
}

export function catColorPaletteFromBase(baseHex: string): CatColorPalette {
  return {
    body: baseHex,
    shadow: darkenLightness(baseHex, 0.15),
    belly: BELLY,
    nose: NOSE,
  };
}
