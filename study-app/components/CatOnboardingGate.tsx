import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  animateCatPickerOpen,
  CatColorPickerSheet,
  createCatPickerSlideAnim,
} from '@/components/CatColorPickerSheet';
import {
  getCatColorOnboardingComplete,
  getEquippedState,
  getOwnedItems,
  setCatColorOnboardingComplete,
  setEquippedState,
  setOwnedItems,
} from '@/lib/catStorage';

type Props = {
  children: ReactNode;
};

export function CatOnboardingGate({ children }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const slideAnim = useRef(createCatPickerSlideAnim()).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await getCatColorOnboardingComplete();
      if (cancelled) {
        return;
      }
      setShowPicker(!done);
      setHydrated(true);
      if (!done) {
        requestAnimationFrame(() => animateCatPickerOpen(slideAnim));
      }
    })().catch(() => {
      if (!cancelled) {
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slideAnim]);

  const handleConfirm = async (furId: string) => {
    const [owned, equip] = await Promise.all([getOwnedItems(), getEquippedState()]);
    const nextOwned = Array.from(new Set([...owned, furId]));
    await setOwnedItems(nextOwned);
    await setEquippedState({ ...equip, fur: furId });
    await setCatColorOnboardingComplete();
    setShowPicker(false);
  };

  if (!hydrated) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#A8431A" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {children}
      <CatColorPickerSheet visible={showPicker} slideAnim={slideAnim} onConfirm={handleConfirm} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE5D4',
  },
});
