import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { DesignSystem } from '@/constants/designSystem';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  EQUIPPED_COSMETIC_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  TOTAL_SESSIONS_STORAGE_KEY,
  normalizeSettings,
} from '@/constants/appSettings';
import { triggerTimerStartHaptic } from '@/lib/haptics';
import { scheduleLocalNotification } from '@/lib/notifications';
import { addCatCoins } from '@/lib/catStorage';

type SessionType = 'focus' | 'break';
type BreakType = 'short' | 'long';

function formatTime(totalSeconds: number): string {
  const safe = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (safe % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function FocusScreen() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [session, setSession] = useState<SessionType>('focus');
  const [breakType, setBreakType] = useState<BreakType>('short');
  const [remainingSeconds, setRemainingSeconds] = useState(
    DEFAULT_APP_SETTINGS.focusMinutes * 60,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [awaitingTransitionTo, setAwaitingTransitionTo] = useState<SessionType | null>(null);
  const [pendingBreakType, setPendingBreakType] = useState<BreakType>('short');
  const [completedFocusSessions, setCompletedFocusSessions] = useState(0);
  const [equippedCosmetic, setEquippedCosmetic] = useState<string | null>(null);

  const focusDurationSeconds = settings.focusMinutes * 60;
  const shortBreakDurationSeconds = settings.shortBreakMinutes * 60;
  const longBreakDurationSeconds = settings.longBreakMinutes * 60;

  const timerText = useMemo(() => formatTime(remainingSeconds), [remainingSeconds]);
  const sessionLabel =
    session === 'focus' ? 'Work Session' : breakType === 'long' ? 'Long Break' : 'Short Break';

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    return `Good ${period}, Miss Cat.`;
  }, []);

  const catAvatar = equippedCosmetic === 'straw-hat' ? '👒😺' : '😺';

  const loadSettings = useCallback(async () => {
    try {
      const [settingsRaw, equippedRaw] = await AsyncStorage.multiGet([
        SETTINGS_STORAGE_KEY,
        EQUIPPED_COSMETIC_STORAGE_KEY,
      ]);

      const raw = settingsRaw[1];
      const equippedValue = equippedRaw[1];
      setEquippedCosmetic(equippedValue ?? null);

      if (!raw) {
        setSettings(DEFAULT_APP_SETTINGS);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      const normalized = normalizeSettings(parsed);
      setSettings(normalized);

      if (!isRunning && !awaitingTransitionTo) {
        const oldDuration =
          session === 'focus'
            ? focusDurationSeconds
            : breakType === 'long'
              ? longBreakDurationSeconds
              : shortBreakDurationSeconds;
        const newDuration =
          session === 'focus'
            ? normalized.focusMinutes * 60
            : breakType === 'long'
              ? normalized.longBreakMinutes * 60
              : normalized.shortBreakMinutes * 60;

        setRemainingSeconds((current) => (current === oldDuration ? newDuration : current));
      }
    } catch (error) {
      console.warn('Failed to load settings', error);
    }
  }, [
    awaitingTransitionTo,
    breakType,
    focusDurationSeconds,
    isRunning,
    longBreakDurationSeconds,
    session,
    shortBreakDurationSeconds,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings]),
  );

  const incrementTotalSessions = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(TOTAL_SESSIONS_STORAGE_KEY);
      const parsed = Number(raw ?? '0');
      const currentTotal = Number.isFinite(parsed) ? parsed : 0;
      await AsyncStorage.setItem(TOTAL_SESSIONS_STORAGE_KEY, String(currentTotal + 1));
    } catch (error) {
      console.warn('Failed to update total sessions count', error);
    }
  }, []);

  const awardFocusCoins = useCallback(async () => {
    const duration = settings.focusMinutes;
    const reward = duration <= 25 ? 10 : duration <= 50 ? 20 : 35;
    try {
      await addCatCoins(reward);
    } catch (error) {
      console.warn('Failed to award cat coins', error);
    }
  }, [settings.focusMinutes]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timerId = setInterval(() => {
      setRemainingSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || remainingSeconds > 0) {
      return;
    }

    async function handleSessionTransition() {
      setIsRunning(false);

      if (session === 'focus') {
        const nextCompletedCount = completedFocusSessions + 1;
        const shouldUseLongBreak = nextCompletedCount % settings.longBreakInterval === 0;
        const nextBreakType: BreakType = shouldUseLongBreak ? 'long' : 'short';
        const nextBreakDuration =
          nextBreakType === 'long' ? longBreakDurationSeconds : shortBreakDurationSeconds;

        setCompletedFocusSessions(nextCompletedCount);
        incrementTotalSessions();
        awardFocusCoins();
        setPendingBreakType(nextBreakType);

        if (settings.sessionEndNotification) {
          await scheduleLocalNotification({
            title: 'Pomodoro',
            body: 'Focus session complete! Time for a break 🎣',
          }).catch(() => {
            // Ignore failures to avoid interrupting timer transitions.
          });
        }

        if (settings.autoStartBreak) {
          setBreakType(nextBreakType);
          setSession('break');
          setRemainingSeconds(nextBreakDuration);
          setAwaitingTransitionTo(null);
          setIsRunning(true);
          return;
        }

        setAwaitingTransitionTo('break');
        return;
      }

      if (settings.breakEndNotification) {
        await scheduleLocalNotification({
          title: 'Pomodoro',
          body: 'Break over — back to work! 🐱',
        }).catch(() => {
          // Ignore failures to avoid interrupting timer transitions.
        });
      }

      if (settings.autoStartFocus) {
        setSession('focus');
        setRemainingSeconds(focusDurationSeconds);
        setAwaitingTransitionTo(null);
        setIsRunning(true);
        return;
      }

      setAwaitingTransitionTo('focus');
      Alert.alert('Break finished', 'Time to get back to your focus session.');
    }

    handleSessionTransition();
  }, [
    completedFocusSessions,
    awardFocusCoins,
    focusDurationSeconds,
    isRunning,
    longBreakDurationSeconds,
    remainingSeconds,
    session,
    settings.autoStartBreak,
    settings.autoStartFocus,
    settings.breakEndNotification,
    incrementTotalSessions,
    settings.longBreakInterval,
    settings.sessionEndNotification,
    shortBreakDurationSeconds,
  ]);

  useEffect(() => {
    const shouldAttemptWebWakeLock =
      Platform.OS !== 'web' ||
      (typeof navigator !== 'undefined' &&
        'wakeLock' in navigator &&
        typeof navigator.wakeLock?.request === 'function');

    if (!shouldAttemptWebWakeLock) {
      return;
    }

    if (isRunning) {
      activateKeepAwakeAsync().catch(() => {
        // Some browsers and contexts still block wake lock requests.
      });
      return;
    }

    deactivateKeepAwake();
  }, [isRunning]);

  const toggleTimer = () => {
    if (isRunning) {
      setIsRunning(false);
      return;
    }

    if (remainingSeconds === 0 && awaitingTransitionTo) {
      const nextSession = awaitingTransitionTo;
      setSession(nextSession);
      if (nextSession === 'focus') {
        setRemainingSeconds(focusDurationSeconds);
      } else {
        setBreakType(pendingBreakType);
        setRemainingSeconds(
          pendingBreakType === 'long' ? longBreakDurationSeconds : shortBreakDurationSeconds,
        );
      }
      setAwaitingTransitionTo(null);
      triggerTimerStartHaptic().catch(() => {
        // Ignore haptics failures.
      });
      setIsRunning(true);
      return;
    }

    triggerTimerStartHaptic().catch(() => {
      // Ignore haptics failures.
    });
    setIsRunning(true);
  };

  const buttonLabel = isRunning
    ? 'Pause'
    : remainingSeconds === 0 && awaitingTransitionTo === 'break'
      ? pendingBreakType === 'long'
        ? 'Start Long Break'
        : 'Start Break'
      : remainingSeconds === 0 && awaitingTransitionTo === 'focus'
        ? 'Start Focus'
        : 'Start';

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.catAvatar}>{catAvatar}</Text>
      <View style={styles.timerShell}>
        <View style={[styles.outerShadowLayer, styles.outerShadowLight]} />
        <View style={[styles.outerShadowLayer, styles.outerShadowDark]} />

        <View style={styles.outerRing}>
          <LinearGradient
            colors={['#D8CBAF', '#E8DCC8', '#DDCFB5']}
            locations={[0, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.innerDisc}>
            <Text style={styles.timerDigits}>{timerText}</Text>
            <Text style={styles.sessionLabel}>{sessionLabel}</Text>
          </LinearGradient>
        </View>
      </View>

      <Pressable onPress={toggleTimer} style={styles.startButton}>
        <Text style={styles.startButtonText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignSystem.colors.backgrounds.pageFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  greeting: {
    position: 'absolute',
    top: 28,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 18,
    color: DesignSystem.colors.text.primary,
  },
  catAvatar: {
    marginBottom: 12,
    fontSize: 34,
  },
  timerShell: {
    width: 280,
    height: 280,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerShadowLayer: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: DesignSystem.colors.backgrounds.pageFill,
  },
  outerShadowLight: {
    shadowColor: '#FAFAF5',
    shadowOffset: { width: -8, height: -8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 2,
  },
  outerShadowDark: {
    shadowColor: '#C8BA9A',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  outerRing: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: DesignSystem.colors.backgrounds.pageFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDisc: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 6px 6px 16px 0px #C4B898, inset -6px -6px 16px 0px #EDE5D4',
  },
  timerDigits: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 60,
    color: DesignSystem.colors.text.timerDigits,
    lineHeight: 64,
    letterSpacing: 1.4,
  },
  sessionLabel: {
    marginTop: 8,
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 16,
    color: DesignSystem.colors.text.sessionLabel,
  },
  startButton: {
    minWidth: 180,
    height: 56,
    borderRadius: 50,
    backgroundColor: DesignSystem.colors.interactive.ctaFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    ...DesignSystem.shadows.ctaButton,
  },
  startButtonText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 18,
    color: DesignSystem.colors.text.cta,
  },
});
