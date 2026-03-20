import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import CatAvatar from '@/components/CatAvatar';
import type { CatMood } from '@/components/cat/catMood';
import { getCatShopItem } from '@/constants/catShopItems';
import { catColorPaletteFromBase } from '@/lib/catColors';
import type { CatEquipState } from '@/lib/catStorage';

function furBaseHex(equip: CatEquipState): string {
  const id = equip.fur ?? 'fur-grey';
  const item = getCatShopItem(id);
  return item?.furHex ?? '#A8B4C0';
}

type CatAvatarStageProps = {
  equip: CatEquipState;
  mood?: CatMood;
};

export function CatAvatarStage({ equip, mood = 'neutral' }: CatAvatarStageProps) {
  const colors = catColorPaletteFromBase(furBaseHex(equip));
  const catScale = useSharedValue(1);
  const zOpacity = useSharedValue(0);
  const zTranslate = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const heartTranslate = useSharedValue(0);

  useEffect(() => {
    if (mood !== 'sleepy') {
      cancelAnimation(zOpacity);
      zOpacity.value = 0;
      return;
    }
    const run = () => {
      zOpacity.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 400 }),
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 400 }),
      );
      zTranslate.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(-10, { duration: 1600, easing: Easing.out(Easing.quad) }),
      );
    };
    run();
    const id = setInterval(run, 4000);
    return () => clearInterval(id);
  }, [mood, zOpacity, zTranslate]);

  const zStyle = useAnimatedStyle(() => ({
    opacity: zOpacity.value,
    transform: [{ translateY: zTranslate.value }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ translateY: heartTranslate.value }],
  }));

  const catPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: catScale.value }],
  }));

  const triggerHeart = useCallback(() => {
    heartOpacity.value = 0;
    heartTranslate.value = 0;
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 480 }),
    );
    heartTranslate.value = withTiming(-30, { duration: 600, easing: Easing.out(Easing.quad) });
  }, [heartOpacity, heartTranslate]);

  const onTapCat = () => {
    catScale.value = withSequence(
      withTiming(1.05, { duration: 90 }),
      withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
    );
    triggerHeart();
  };

  return (
    <View style={styles.zone}>
      <Pressable onPress={onTapCat} style={styles.catPress}>
        <View style={styles.catStack}>
          {mood === 'sleepy' ? (
            <Animated.View style={[styles.sleepyZWrap, zStyle]} pointerEvents="none">
              <Text style={[styles.sleepyZText, { color: colors.shadow }]}>Z</Text>
            </Animated.View>
          ) : null}

          <CatAvatar
            width={200}
            height={220}
            furColor={furBaseHex(equip)}
            preserveAspectRatio="xMidYMax meet"
            style={catPressStyle}
          />

          <Animated.View style={[styles.heartWrap, heartStyle]} pointerEvents="none">
            <Svg width={28} height={24} viewBox="0 0 28 24">
              <Path
                d="M14 21 C14 21 4 14 4 8 C4 5 6 3 9 3 C11.5 3 13 4.5 14 6 C15 4.5 16.5 3 19 3 C22 3 24 5 24 8 C24 14 14 21 14 21 Z"
                fill={colors.nose}
              />
            </Svg>
          </Animated.View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    marginTop: 24,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catPress: {
    width: 220,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catStack: {
    width: 200,
    height: 220,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sleepyZWrap: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    zIndex: 4,
  },
  sleepyZText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 22,
    color: '#8A7A65',
  },
  heartWrap: {
    position: 'absolute',
    top: 36,
    alignSelf: 'center',
    zIndex: 5,
  },
});
