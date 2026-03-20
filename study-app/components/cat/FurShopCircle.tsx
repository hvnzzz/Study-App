import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const STROKE_DEFAULT = '#3A3025';
const STROKE_SELECTED = '#A8431A';

type Props = {
  fill: string;
  /** Outer box size (default 48). */
  size?: number;
  selected?: boolean;
};

/** 48px fur swatch: filled circle with design-system strokes; selected = thicker accent + scale. */
export function FurShopCircle({ fill, size = 48, selected = false }: Props) {
  const strokeWidth = selected ? 3 : 1.5;
  const pad = strokeWidth / 2 + 0.5;
  const vb = size;
  const cx = vb / 2;
  const cy = vb / 2;
  const r = Math.max(2, vb / 2 - pad);

  return (
    <View style={[styles.wrap, { width: size, height: size }, selected && styles.wrapSelected]}>
      <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill={fill}
          stroke={selected ? STROKE_SELECTED : STROKE_DEFAULT}
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapSelected: {
    transform: [{ scale: 1.08 }],
  },
});
