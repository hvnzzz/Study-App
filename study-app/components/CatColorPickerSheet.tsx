import { useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { CAT_FUR_SWATCHES } from '@/constants/catFurSwatches';
import { DesignSystem } from '@/constants/designSystem';

const TITLE_COLOR = '#A0522D';
const SUBTITLE_COLOR = '#8A7A65';
const SWATCH_STROKE = '#3A3025';
const SWATCH_STROKE_SELECTED = '#A8431A';

type Props = {
  visible: boolean;
  slideAnim: Animated.Value;
  onConfirm: (furId: string) => void;
};

export function CatColorPickerSheet({ visible, slideAnim, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!visible) {
    return null;
  }

  const handleChoose = () => {
    if (selectedId) {
      onConfirm(selectedId);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.backdrop} />
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: 24 + insets.bottom,
            transform: [{ translateY: slideAnim }],
          },
        ]}>
        <Text style={styles.title}>Choose your cat</Text>
        <Text style={styles.subtitle}>You can change this anytime in the shop</Text>

        <View style={styles.grid}>
          {[0, 5].map((start) => (
            <View key={start} style={styles.swatchRow}>
              {CAT_FUR_SWATCHES.slice(start, start + 5).map((swatch) => {
                const selected = swatch.id === selectedId;
                return (
                  <Pressable
                    key={swatch.id}
                    onPress={() => setSelectedId(swatch.id)}
                    style={styles.swatchCell}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}>
                    <View style={[styles.swatchScale, selected && styles.swatchScaleSelected]}>
                      <Svg width={48} height={48} viewBox="0 0 48 48">
                        <Circle
                          cx={24}
                          cy={24}
                          r={22}
                          fill={swatch.baseHex}
                          stroke={selected ? SWATCH_STROKE_SELECTED : SWATCH_STROKE}
                          strokeWidth={selected ? 3 : 1.5}
                        />
                      </Svg>
                    </View>
                    <Text style={styles.swatchLabel}>{swatch.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <Pressable
          onPress={handleChoose}
          disabled={!selectedId}
          style={[styles.chooseBtn, !selectedId && styles.chooseBtnDisabled]}
          accessibilityState={{ disabled: !selectedId }}>
          <Text style={styles.chooseBtnText}>Choose</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Call once when gate opens to slide sheet up. */
export function createCatPickerSlideAnim(): Animated.Value {
  return new Animated.Value(520);
}

export function animateCatPickerOpen(anim: Animated.Value): void {
  Animated.timing(anim, {
    toValue: 0,
    duration: 420,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }).start();
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(58, 48, 37, 0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#EDE5D4',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '88%',
  },
  title: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 22,
    color: TITLE_COLOR,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 15,
    color: SUBTITLE_COLOR,
    textAlign: 'center',
  },
  grid: {
    marginTop: 20,
    gap: 16,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  swatchCell: {
    width: '19%',
    alignItems: 'center',
  },
  swatchScale: {
    transform: [{ scale: 1 }],
  },
  swatchScaleSelected: {
    transform: [{ scale: 1.1 }],
  },
  swatchLabel: {
    marginTop: 6,
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 11,
    color: SUBTITLE_COLOR,
    textAlign: 'center',
  },
  chooseBtn: {
    marginTop: 24,
    minWidth: 180,
    height: 56,
    borderRadius: 50,
    backgroundColor: DesignSystem.colors.interactive.ctaFill,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    ...DesignSystem.shadows.ctaButton,
  },
  chooseBtnDisabled: {
    opacity: 0.45,
  },
  chooseBtnText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 18,
    color: DesignSystem.colors.text.cta,
  },
});
