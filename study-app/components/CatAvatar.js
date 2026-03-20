import React, { useEffect, useMemo, useState } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import catPaths from './catSvgPaths.json';

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 300;
const DEFAULT_FUR_HEX = '#A8B4C0';

/**
 * Main fur layers (#a7a7a7 … #d4d4d4). Belly / light muzzle use `#dddddd` and stay untinted.
 */
const TINTABLE_GREYS = new Set([
  '#d4d4d4',
  '#cbcbcb',
  '#c2c2c2',
  '#b9b9b9',
  '#b0b0b0',
  '#a7a7a7',
]);

/** Thin face accents (eyes / small features in the asset) — contrast-aware, not full fur tint. */
const FACIAL_DETAIL_GREYS = new Set(['#959595', '#8c8c8c', '#7a7a7a', '#717171', '#686868']);

/** Darkest fill shapes (stripes, small accents) — pick up fur hue so light coats aren’t flat black/grey. */
const MARKING_GREYS = new Set(['#606060']);
/** Colors that must never be fur-tinted. */
const FIXED_COLORS = new Set(['#f4a0b0']);
const WHITE_NOSE_HEX = '#F4A0B0';
const WHITE_NOSE_PATH_D =
  'M 525 594 c -16 0 -26 10 -26 22 0 12 10 22 26 22 16 0 26 -10 26 -22 0 -12 -10 -22 -26 -22 z';

const AnimatedG = Animated.createAnimatedComponent(G);

function normalizeHex(hex) {
  if (typeof hex !== 'string') {
    return '';
  }
  let h = hex.trim().toLowerCase();
  if (h.startsWith('#')) {
    h = h.slice(1);
  }
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6) {
    return '';
  }
  return `#${h}`;
}

function hexToRgb(hex) {
  const n = normalizeHex(hex).replace('#', '');
  if (n.length !== 6) {
    return null;
  }
  const v = parseInt(n, 16);
  if (!Number.isFinite(v)) {
    return null;
  }
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function rgbToHex(r, g, b) {
  const to = (x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

function rgbToHsl(r, g, b) {
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

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  };
}

/**
 * Uses hue + saturation from `furHex`; lightness from grey layers, with special ranges for
 * near-black / near-white furs (plain H/S + grey L leaves mid-grey "black" and dingy "white").
 */
/** Approx min/max HSL L of the six tintable greys (#a7a7a7 … #d4d4d4). */
const GREY_BAND_L_MIN = 0.685;
const GREY_BAND_L_MAX = 0.835;
const NEUTRAL_FUR_S_MAX = 0.14;
const NEUTRAL_LIGHTNESS_GREY_WEIGHT = 0.5;

/** Fur this dark maps into charcoal range (keep above ~0.22 so navy furs stay chromatic). */
const DARK_FUR_L_THRESHOLD = 0.22;
/** Fur this light maps into a soft-white range. */
const LIGHT_FUR_L_THRESHOLD = 0.88;

function greyLayerT(hslOL) {
  const span = GREY_BAND_L_MAX - GREY_BAND_L_MIN;
  return clamp01((clamp01(hslOL) - GREY_BAND_L_MIN) / Math.max(0.001, span));
}

export function getTintedColor(originalHex, furHex) {
  const rgbO = hexToRgb(originalHex);
  const rgbF = hexToRgb(furHex);
  if (!rgbO || !rgbF) {
    return typeof originalHex === 'string' ? originalHex : '#888888';
  }
  const hslO = rgbToHsl(rgbO.r, rgbO.g, rgbO.b);
  const hslF = rgbToHsl(rgbF.r, rgbF.g, rgbF.b);
  const t = greyLayerT(hslO.l);
  let H = hslF.h;
  let S = hslF.s;
  let L = clamp01(hslO.l);

  if (hslF.l <= DARK_FUR_L_THRESHOLD) {
    // Charcoal → soft black: preserve stripe contrast but stay actually dark
    const floor = Math.max(0.035, hslF.l * 0.22);
    const ceil = Math.min(0.38, hslF.l + 0.26);
    L = floor + t * (ceil - floor);
  } else if (hslF.l >= LIGHT_FUR_L_THRESHOLD) {
    // Keep "white" coats cool/neutral and with stronger depth so they don't blend into beige UI backgrounds.
    const floor = Math.max(0.72, hslF.l - 0.2);
    const ceil = Math.min(0.97, hslF.l);
    L = floor + t * (ceil - floor);
    S = Math.min(0.03, hslF.s * 0.2);
  } else if (hslF.s < NEUTRAL_FUR_S_MAX) {
    L = clamp01(
      hslO.l * NEUTRAL_LIGHTNESS_GREY_WEIGHT + hslF.l * (1 - NEUTRAL_LIGHTNESS_GREY_WEIGHT),
    );
  }

  const { r, g, b } = hslToRgb(H, S, L);
  return rgbToHex(r, g, b);
}

/**
 * Eye-sized greys (#959595 … #717171): high contrast on dark fur, dark pupils on white fur.
 */
export function getFacialDetailColor(originalHex, furHex) {
  const rgbO = hexToRgb(originalHex);
  const rgbF = hexToRgb(furHex);
  if (!rgbO || !rgbF) {
    return typeof originalHex === 'string' ? originalHex : '#888888';
  }
  const hslO = rgbToHsl(rgbO.r, rgbO.g, rgbO.b);
  const hslF = rgbToHsl(rgbF.r, rgbF.g, rgbF.b);
  /** 0 = darkest detail (#717171), 1 = lightest (#959595) */
  const layer = clamp01((hslO.l - 0.42) / 0.22);

  if (hslF.l <= DARK_FUR_L_THRESHOLD) {
    const rgbF2 = hexToRgb(furHex);
    const hslF2 = rgbToHsl(rgbF2.r, rgbF2.g, rgbF2.b);
    const L = Math.min(hslF2.l + 0.12, 0.35);
    const { r, g, b } = hslToRgb(hslF2.h, hslF2.s * 0.5, L);
    return rgbToHex(r, g, b);
  }
  if (hslF.l >= LIGHT_FUR_L_THRESHOLD) {
    const L = 0.18 + (1 - layer) * 0.22;
    const s = 0;
    const { r, g, b } = hslToRgb(hslF.h, s, L);
    return rgbToHex(r, g, b);
  }
  const L = clamp01(hslO.l * 0.82 + hslF.l * 0.18);
  const s = Math.min(0.24, hslF.s * 0.38);
  const { r, g, b } = hslToRgb(hslF.h, s, L);
  return rgbToHex(r, g, b);
}

/**
 * Stripe / small dark fills: visible on white cats, still harmonized on mid/dark coats.
 */
export function getMarkingColor(originalHex, furHex) {
  const rgbO = hexToRgb(originalHex);
  const rgbF = hexToRgb(furHex);
  if (!rgbO || !rgbF) {
    return typeof originalHex === 'string' ? originalHex : '#888888';
  }
  const hslO = rgbToHsl(rgbO.r, rgbO.g, rgbO.b);
  const hslF = rgbToHsl(rgbF.r, rgbF.g, rgbF.b);
  const depth = clamp01((hslO.l - 0.12) / 0.35);

  if (hslF.l >= LIGHT_FUR_L_THRESHOLD) {
    const L = 0.22 + depth * 0.12;
    const s = 0;
    const { r, g, b } = hslToRgb(hslF.h, s, L);
    return rgbToHex(r, g, b);
  }
  if (hslF.l <= DARK_FUR_L_THRESHOLD) {
    const L = Math.min(0.26, hslF.l + 0.07 + depth * 0.06);
    const s = Math.min(0.32, hslF.s * 0.35 + 0.04);
    const { r, g, b } = hslToRgb(hslF.h, s, L);
    return rgbToHex(r, g, b);
  }
  const L = clamp01(hslO.l * 0.55 + hslF.l * 0.45);
  const s = Math.min(0.45, hslF.s * 0.48 + 0.06);
  const { r, g, b } = hslToRgb(hslF.h, s, L);
  return rgbToHex(r, g, b);
}

function resolvePathFill(originalFill, furHex) {
  const key = normalizeHex(originalFill);
  if (!key) {
    return originalFill;
  }
  if (FIXED_COLORS.has(key)) {
    return originalFill;
  }
  if (TINTABLE_GREYS.has(key)) {
    return getTintedColor(originalFill, furHex);
  }
  if (FACIAL_DETAIL_GREYS.has(key)) {
    return getFacialDetailColor(originalFill, furHex);
  }
  if (MARKING_GREYS.has(key)) {
    return getMarkingColor(originalFill, furHex);
  }
  return originalFill;
}

/**
 * Renders `assets/cat/Cat.svg` via react-native-svg (paths from `catSvgPaths.json`).
 * `#dddddd` (belly / light muzzle) is left as in the asset — not fur-tinted.
 *
 * @param {object} props
 * @param {number} [props.width=200]
 * @param {number} [props.height=300]
 * @param {string} [props.furColor] Base fur hex (tints layered grey paths)
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @param {string} [props.preserveAspectRatio] e.g. "xMidYMax meet" to letterbox in a short frame
 */
export default function CatAvatar({
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  furColor = DEFAULT_FUR_HEX,
  style,
  preserveAspectRatio,
}) {
  const furHex = normalizeHex(furColor) || DEFAULT_FUR_HEX;
  const [isBlinking, setIsBlinking] = useState(false);
  const breathAnim = useSharedValue(1);

  const eyeClosedFill = useMemo(() => getTintedColor('#b0b0b0', furHex), [furHex]);

  useEffect(() => {
    breathAnim.value = withRepeat(
      withSequence(
        withTiming(1.015, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [breathAnim]);

  useEffect(() => {
    let timeoutId;
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 3000;
      timeoutId = setTimeout(() => {
        setIsBlinking(true);
        timeoutId = setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 120);
      }, delay);
    };
    scheduleBlink();
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  const breathProps = useAnimatedProps(() => ({
    transform: [{ scaleY: breathAnim.value }],
    transformOrigin: '512 1480',
  }));

  const paths = useMemo(
    () =>
      catPaths.map((p, index) => ({
        key: `p${index}`,
        index,
        d: p.d,
        fillKey: normalizeHex(p.fill),
        fill: resolvePathFill(p.fill, furHex),
      })),
    [furHex],
  );

  return (
    <Animated.View style={style}>
      <Svg
        width={width}
        height={height}
        viewBox="0 0 1024 1536"
        preserveAspectRatio={preserveAspectRatio}
      >
        <AnimatedG transform="translate(-24.743494,-13.32342)" animatedProps={breathProps}>
          {paths.map((p) => {
            const idx = parseInt(p.key.replace('p', ''), 10);
            const isEye = idx >= 8 && idx <= 13;
            return (
              <Path
                key={p.key}
                fill={isEye && isBlinking ? eyeClosedFill : p.fill}
                d={p.d}
                stroke={p.fill}
                strokeWidth={p.fillKey === '#dddddd' ? 1.5 : 0.5}
              />
            );
          })}

          {normalizeHex(furHex) === normalizeHex('#E8E8E8') && (
            <Path d={WHITE_NOSE_PATH_D} fill={WHITE_NOSE_HEX} />
          )}
        </AnimatedG>
      </Svg>
    </Animated.View>
  );
}
