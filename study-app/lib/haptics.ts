import * as Haptics from 'expo-haptics';

export async function triggerTaskCheckHaptic(): Promise<void> {
  await Haptics.selectionAsync();
}

export async function triggerTimerStartHaptic(): Promise<void> {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export async function triggerCastLineHaptic(): Promise<void> {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
