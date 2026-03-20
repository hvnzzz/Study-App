import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';

import { fishCatalog, FishCatalogItem, FishRarity, rarityWeights } from '@/constants/fish';
import { DesignSystem } from '@/constants/designSystem';
import {
  CAUGHT_FISH_STORAGE_KEY,
  CAT_COINS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  SETTINGS_STORAGE_KEY,
  normalizeSettings,
} from '@/constants/appSettings';
import { triggerCastLineHaptic } from '@/lib/haptics';
import { SudokuGame } from '@/components/games/SudokuGame';
import { Game2048 } from '@/components/games/Game2048';
import { GameWordSearch } from '@/components/games/GameWordSearch';

const REQUIRED_HITS = 5;
const SVG_WIDTH = 200;
const SVG_HEIGHT = 120;
const WAVE_Y = 80;
const WAVE_AMPLITUDE = 4;
const WAVE_PERIOD = 80;
const BOBBER_BODY_RADIUS = 11;
const BOBBER_CAP_WIDTH = 6;
const BOBBER_CAP_HEIGHT = 8;
const BOBBER_CAP_RADIUS = 3;
const BOBBER_TOP_OFFSET = BOBBER_BODY_RADIUS + BOBBER_CAP_HEIGHT;
const TAP_OUTER_START = 130;
const TAP_INNER_SIZE = 52;
const TAP_SHRINK_MS = 1800;

const SOUND_FILES = {
  cast: require('../../assets/sounds/cast.wav'),
  fishingBackground: require('../../assets/sounds/fishing-background.mp3'),
  hit: require('../../assets/sounds/hit.mp3'),
  miss: require('../../assets/sounds/miss.wav'),
  splash: require('../../assets/sounds/splash.wav'),
  successTick: require('../../assets/sounds/success-tick.wav'),
  reel: require('../../assets/sounds/reel.wav'),
  cardDismiss: require('../../assets/sounds/woosh.wav'),
} as const;

type SoundKey = keyof typeof SOUND_FILES;
type SpawnPoint = { x: number; y: number };
type GameMode = 'fishing' | 'sudoku' | 'game2048' | 'wordSearch';

const SOUND_VOLUMES: Partial<Record<SoundKey, number>> = {
  splash: 0.2,
  successTick: 0.35,
};

function getSoundVolume(name: SoundKey): number {
  return SOUND_VOLUMES[name] ?? 1;
}

const RARITY_COLORS: Record<FishRarity, string> = {
  Common: '#8A7A65',
  Uncommon: '#4A7A9B',
  Rare: '#5A7A55',
  Legendary: '#C47840',
  Mythic: '#7A5A9B',
};

const RARITY_REWARDS: Record<FishRarity, number> = {
  Common: 5,
  Uncommon: 12,
  Rare: 30,
  Legendary: 90,
  Mythic: 180,
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatMMSS(total: number): string {
  const safe = Math.max(0, total);
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const secs = (safe % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function wavePointY(x: number, phasePx: number): number {
  return WAVE_Y + WAVE_AMPLITUDE * Math.sin(((x + phasePx) / WAVE_PERIOD) * Math.PI * 2);
}

function buildWavePath(phasePx: number): string {
  const step = 6;
  let d = `M 0 ${wavePointY(0, phasePx)}`;
  for (let x = step; x <= SVG_WIDTH; x += step) {
    d += ` L ${x} ${wavePointY(x, phasePx)}`;
  }
  return d;
}

function buildAboveWaveClipPath(phasePx: number): string {
  const step = 6;
  let d = `M 0 0 L ${SVG_WIDTH} 0 L ${SVG_WIDTH} ${wavePointY(SVG_WIDTH, phasePx)}`;
  for (let x = SVG_WIDTH - step; x >= 0; x -= step) {
    d += ` L ${x} ${wavePointY(x, phasePx)}`;
  }
  d += ' Z';
  return d;
}

async function animateNumber(args: {
  from: number;
  to: number;
  duration: number;
  onUpdate: (value: number) => void;
  easing?: (t: number) => number;
}): Promise<void> {
  const { from, to, duration, onUpdate, easing = (t) => t } = args;
  const started = Date.now();

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = Date.now() - started;
      const t = Math.min(1, elapsed / duration);
      onUpdate(from + (to - from) * easing(t));
      if (t >= 1) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}

function pickWeightedFish(): FishCatalogItem {
  let rarityRoll = Math.random() * 100;
  let chosenRarity: FishRarity = 'Common';
  for (const entry of rarityWeights) {
    rarityRoll -= entry.chance;
    if (rarityRoll <= 0) {
      chosenRarity = entry.rarity;
      break;
    }
  }

  const pool = fishCatalog.filter((fish) => fish.rarity === chosenRarity);
  return pool[Math.floor(Math.random() * pool.length)] ?? fishCatalog[0];
}

function FishingIllustrationSvg({
  active,
  lineVisible,
  lineLength,
  bobberVisible,
  bobberScale,
  bobberXOffset,
  bobberYOffset,
}: {
  active: boolean;
  lineVisible: boolean;
  lineLength: number;
  bobberVisible: boolean;
  bobberScale: number;
  bobberXOffset: number;
  bobberYOffset: number;
}) {
  const [phasePx, setPhasePx] = useState(0);
  const [timeMs, setTimeMs] = useState(Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }

    let frame = 0;
    const loop = () => {
      setPhasePx((current) => (current + 0.45) % (WAVE_PERIOD * 6));
      setTimeMs(Date.now());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active]);

  const bobberIdleOffset = bobberVisible
    ? 3 * Math.sin(((timeMs % 2000) / 2000) * Math.PI * 2)
    : 0;
  const bobberCx = SVG_WIDTH / 2 + bobberXOffset;
  const waterYAtBobber = wavePointY(bobberCx, phasePx);
  const bobberCy = waterYAtBobber + bobberIdleOffset + bobberYOffset;
  const lineBottomY = Math.max(0, Math.min(lineLength, bobberCy - BOBBER_TOP_OFFSET));
  const clipPathD = buildAboveWaveClipPath(phasePx);

  return (
    <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
      <Defs>
        <ClipPath id="bobberWaterOcclusionClip">
          <Path d={clipPathD} fill="#000000" />
        </ClipPath>
      </Defs>

      {lineVisible ? (
        <Line
          x1={SVG_WIDTH / 2}
          y1={0}
          x2={SVG_WIDTH / 2}
          y2={lineBottomY}
          stroke="#3A3025"
          strokeWidth={1}
        />
      ) : null}
      {bobberVisible ? (
        <G clipPath="url(#bobberWaterOcclusionClip)">
          <Circle
            cx={bobberCx}
            cy={bobberCy}
            r={BOBBER_BODY_RADIUS * bobberScale}
            stroke="#3A3025"
            strokeWidth={1.5}
            fill="none"
          />
          <Rect
            x={bobberCx - BOBBER_CAP_WIDTH / 2}
            y={bobberCy - BOBBER_TOP_OFFSET}
            width={BOBBER_CAP_WIDTH}
            height={BOBBER_CAP_HEIGHT}
            rx={BOBBER_CAP_RADIUS}
            ry={BOBBER_CAP_RADIUS}
            stroke="#3A3025"
            strokeWidth={1.5}
            fill="none"
          />
          <Line
            x1={bobberCx - BOBBER_BODY_RADIUS * bobberScale}
            y1={bobberCy}
            x2={bobberCx + BOBBER_BODY_RADIUS * bobberScale}
            y2={bobberCy}
            stroke="#3A3025"
            strokeWidth={1.5}
          />
        </G>
      ) : null}
      <Path d={buildWavePath(phasePx)} stroke="#3A3025" strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

export default function GamesScreen() {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [breakSeconds, setBreakSeconds] = useState(DEFAULT_APP_SETTINGS.shortBreakMinutes * 60);
  const [running, setRunning] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('fishing');
  const [showCastButton, setShowCastButton] = useState(true);
  const [castLabel, setCastLabel] = useState<'Cast Line' | 'Cast Again'>('Cast Line');
  const [lineVisible, setLineVisible] = useState(false);
  const [lineLength, setLineLength] = useState(0);
  const [bobberVisible, setBobberVisible] = useState(false);
  const [bobberScale, setBobberScale] = useState(1);
  const [bobberYOffset, setBobberYOffset] = useState(0);
  const [bobberXOffset, setBobberXOffset] = useState(0);
  const [progressCount, setProgressCount] = useState(0);
  const [fishAwayVisible, setFishAwayVisible] = useState(false);
  const [tapCircleVisible, setTapCircleVisible] = useState(false);
  const [tapPosition, setTapPosition] = useState<SpawnPoint>({ x: width / 2, y: height * 0.62 });
  const [fishCard, setFishCard] = useState<FishCatalogItem | null>(null);
  const [endPendingAfterCard, setEndPendingAfterCard] = useState(false);

  const gameActiveRef = useRef(false);
  const timerAtZeroRef = useRef(false);
  const lastSpawnRef = useRef<SpawnPoint | null>(null);
  const soundsRef = useRef<Partial<Record<SoundKey, Audio.Sound>>>({});
  const circleIdRef = useRef(0);
  const onMissRef = useRef<(() => Promise<void>) | null>(null);

  const castOpacity = useRef(new Animated.Value(1)).current;
  const tapOpacity = useRef(new Animated.Value(0)).current;
  const tapScale = useRef(new Animated.Value(1)).current;
  const tapShake = useRef(new Animated.Value(0)).current;
  const outerProgress = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(height)).current;
  const dotScales = useRef(Array.from({ length: REQUIRED_HITS }, () => new Animated.Value(1))).current;
  const dotOpacities = useRef(Array.from({ length: REQUIRED_HITS }, () => new Animated.Value(1))).current;

  const gameTop = insets.top + 8;
  const illustrationTop = height * 0.45 - SVG_HEIGHT / 2;
  const spawnMinX = 60;
  const spawnMaxX = width - 60;
  const spawnMinY = illustrationTop + SVG_HEIGHT + 60;
  const spawnMaxY = height - (insets.bottom + 72 + 60);
  const breakTimerLabel = formatMMSS(breakSeconds);

  const tapOuterSize = outerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [TAP_OUTER_START, TAP_INNER_SIZE],
  });
  const tapTranslateX = tapShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  const playSound = useCallback(async (name: SoundKey, loop = false) => {
    const sound = soundsRef.current[name];
    if (!sound) {
      return;
    }
    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      await sound.setIsLoopingAsync(loop);
      await sound.setVolumeAsync(getSoundVolume(name));
      await sound.playAsync();
    } catch {
      // Ignore playback errors.
    }
  }, []);

  const stopSound = useCallback(async (name: SoundKey) => {
    const sound = soundsRef.current[name];
    if (!sound) {
      return;
    }
    try {
      if (name === 'fishingBackground') {
        const fadeSteps = 10;
        const fadeDurationMs = 360;
        const stepDelayMs = fadeDurationMs / fadeSteps;
        for (let step = fadeSteps; step >= 1; step -= 1) {
          await sound.setVolumeAsync((getSoundVolume(name) * step) / fadeSteps);
          await wait(stepDelayMs);
        }
      }
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      await sound.setIsLoopingAsync(false);
      await sound.setVolumeAsync(getSoundVolume(name));
    } catch {
      // Ignore stop errors.
    }
  }, []);

  const persistCatch = useCallback(async (fish: FishCatalogItem) => {
    const caughtRaw = await AsyncStorage.getItem(CAUGHT_FISH_STORAGE_KEY);
    const parsedCaught = caughtRaw
      ? (JSON.parse(caughtRaw) as Array<{ species: string; timestamp: string; rarity: FishRarity }>)
      : [];
    const nextCaught = [
      ...parsedCaught,
      { species: fish.name, timestamp: new Date().toISOString(), rarity: fish.rarity },
    ];

    const coinRaw = await AsyncStorage.getItem(CAT_COINS_STORAGE_KEY);
    const parsedCoins = Number(coinRaw ?? '0');
    const nextCoins = (Number.isFinite(parsedCoins) ? parsedCoins : 0) + RARITY_REWARDS[fish.rarity];

    await AsyncStorage.multiSet([
      [CAUGHT_FISH_STORAGE_KEY, JSON.stringify(nextCaught)],
      [CAT_COINS_STORAGE_KEY, String(nextCoins)],
    ]);
  }, []);

  const endFishingSession = useCallback(() => {
    gameActiveRef.current = false;
    timerAtZeroRef.current = false;
    setRunning(false);
    setShowCastButton(true);
    setCastLabel('Cast Again');
    setLineVisible(false);
    setLineLength(0);
    setBobberVisible(false);
    setBobberScale(1);
    setBobberYOffset(0);
    setBobberXOffset(0);
    setTapCircleVisible(false);
    setProgressCount(0);
    setFishAwayVisible(false);
    setFishCard(null);
    setEndPendingAfterCard(false);
    lastSpawnRef.current = null;
    castOpacity.setValue(1);
    tapOpacity.setValue(0);
    tapScale.setValue(1);
    tapShake.setValue(0);
    outerProgress.setValue(0);
    cardTranslateY.setValue(height);
    dotScales.forEach((v) => v.setValue(1));
    dotOpacities.forEach((v) => v.setValue(1));
    void stopSound('reel');
    void stopSound('fishingBackground');
  }, [cardTranslateY, castOpacity, dotOpacities, dotScales, height, outerProgress, stopSound, tapOpacity, tapScale, tapShake]);

  const runMissShake = useCallback(async () => {
    const start = Date.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const t = Math.min(1, (Date.now() - start) / 400);
        setBobberXOffset(6 * Math.sin(t * Math.PI * 6));
        if (t >= 1) {
          setBobberXOffset(0);
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  }, []);

  const runTensionCycles = useCallback(async (cycles: number) => {
    for (let i = 0; i < cycles; i += 1) {
      await animateNumber({ from: 0, to: 8, duration: 300, easing: easeOutCubic, onUpdate: setBobberYOffset });
      await wait(200);
      await animateNumber({ from: 8, to: 0, duration: 150, easing: easeOutCubic, onUpdate: setBobberYOffset });
    }
  }, []);

  const runRapidDips = useCallback(async () => {
    for (let i = 0; i < 3; i += 1) {
      await animateNumber({ from: 0, to: 8, duration: 90, easing: easeOutCubic, onUpdate: setBobberYOffset });
      await animateNumber({ from: 8, to: 0, duration: 110, easing: easeOutCubic, onUpdate: setBobberYOffset });
    }
  }, []);

  const spawnNextCircle = useCallback(async () => {
    if (!gameActiveRef.current || timerAtZeroRef.current) {
      return;
    }

    let point = { x: width / 2, y: (spawnMinY + spawnMaxY) / 2 };
    for (let i = 0; i < 20; i += 1) {
      const x = spawnMinX + Math.random() * Math.max(1, spawnMaxX - spawnMinX);
      const y = spawnMinY + Math.random() * Math.max(1, spawnMaxY - spawnMinY);
      const prev = lastSpawnRef.current;
      if (!prev || Math.hypot(prev.x - x, prev.y - y) >= 80) {
        point = { x, y };
        break;
      }
      point = { x, y };
    }

    setTapPosition(point);
    lastSpawnRef.current = point;
    setTapCircleVisible(true);
    tapOpacity.setValue(0);
    tapScale.setValue(1);
    tapShake.setValue(0);
    outerProgress.setValue(0);

    circleIdRef.current += 1;
    const circleId = circleIdRef.current;
    Animated.parallel([
      Animated.timing(tapOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(outerProgress, {
        toValue: 1,
        duration: TAP_SHRINK_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished && gameActiveRef.current && circleIdRef.current === circleId && onMissRef.current) {
        void onMissRef.current();
      }
    });
  }, [outerProgress, spawnMaxX, spawnMaxY, spawnMinX, spawnMinY, tapOpacity, tapScale, tapShake, width]);

  const onMiss = useCallback(async () => {
    if (!gameActiveRef.current) {
      return;
    }

    circleIdRef.current += 1;
    setTapCircleVisible(false);
    await playSound('miss');
    await runMissShake();
    await playSound('splash');

    dotOpacities.forEach((opacity, idx) => {
      if (idx < progressCount) {
        Animated.sequence([
          Animated.delay(idx * 40),
          Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
      }
    });

    setProgressCount(0);
    setFishAwayVisible(true);
    await wait(1200);
    setFishAwayVisible(false);
    endFishingSession();
  }, [dotOpacities, endFishingSession, playSound, progressCount, runMissShake]);

  useEffect(() => {
    onMissRef.current = onMiss;
  }, [onMiss]);

  useEffect(() => {
    if (gameMode !== 'fishing') {
      endFishingSession();
    }
  }, [endFishingSession, gameMode]);

  const onSuccessTap = useCallback(async () => {
    if (!gameActiveRef.current || !tapCircleVisible) {
      return;
    }

    circleIdRef.current += 1;
    await playSound('hit');
    await playSound('successTick');
    setTapCircleVisible(false);

    tapScale.setValue(1);
    await new Promise<void>((resolve) => {
      Animated.sequence([
        Animated.timing(tapScale, { toValue: 1.2, duration: 80, useNativeDriver: true }),
        Animated.timing(tapOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start(() => resolve());
    });
    tapOpacity.setValue(1);

    const next = progressCount + 1;
    setProgressCount(next);
    const dotScale = dotScales[next - 1];
    dotScale.setValue(1);
    Animated.sequence([
      Animated.timing(dotScale, {
        toValue: 1.4,
        duration: 100,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
      Animated.timing(dotScale, {
        toValue: 1,
        duration: 100,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
    ]).start();

    if (next >= REQUIRED_HITS) {
      await runRapidDips();
      await playSound('reel', true);
      await Promise.all([
        animateNumber({ from: 1, to: 0, duration: 200, easing: easeInOutSine, onUpdate: setBobberScale }),
        animateNumber({ from: 0, to: 28, duration: 200, easing: easeInOutSine, onUpdate: setBobberYOffset }),
        animateNumber({ from: lineLength, to: 0, duration: 400, easing: easeOutCubic, onUpdate: setLineLength }),
      ]);

      await stopSound('reel');
      await stopSound('fishingBackground');
      await wait(300);

      const fish = pickWeightedFish();
      await persistCatch(fish).catch(() => {
        // Ignore persistence failures.
      });

      gameActiveRef.current = false;
      setRunning(false);
      setFishCard(fish);
      cardTranslateY.setValue(height);
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 350,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }).start();
      return;
    }

    await runTensionCycles(1);
    await wait(600);
    await spawnNextCircle();
  }, [
    cardTranslateY,
    dotScales,
    height,
    lineLength,
    persistCatch,
    playSound,
    progressCount,
    runRapidDips,
    runTensionCycles,
    spawnNextCircle,
    stopSound,
    tapCircleVisible,
    tapOpacity,
    tapScale,
  ]);

  const startCastSequence = useCallback(async () => {
    if (!running || !showCastButton) {
      return;
    }

    triggerCastLineHaptic().catch(() => {
      // Ignore haptics failures.
    });
    await playSound('cast');

    await new Promise<void>((resolve) => {
      Animated.timing(castOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => resolve());
    });

    setShowCastButton(false);
    setLineVisible(true);
    setLineLength(0);
    await animateNumber({ from: 0, to: 60, duration: 400, easing: easeOutCubic, onUpdate: setLineLength });
    setLineLength(SVG_HEIGHT);

    setBobberVisible(true);
    setBobberScale(1);
    await animateNumber({ from: 1, to: 1.3, duration: 100, easing: easeOutCubic, onUpdate: setBobberScale });
    await animateNumber({ from: 1.3, to: 1, duration: 100, easing: easeOutCubic, onUpdate: setBobberScale });

    await runTensionCycles(2 + Math.floor(Math.random() * 2));
    await spawnNextCircle();
  }, [castOpacity, playSound, runTensionCycles, running, showCastButton, spawnNextCircle]);

  const dismissCard = useCallback(async () => {
    if (!fishCard) {
      return;
    }

    await playSound('cardDismiss');
    await new Promise<void>((resolve) => {
      Animated.timing(cardTranslateY, {
        toValue: height,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => resolve());
    });
    setFishCard(null);

    if (endPendingAfterCard || timerAtZeroRef.current || !gameActiveRef.current) {
      endFishingSession();
      return;
    }

    endFishingSession();
  }, [cardTranslateY, endFishingSession, endPendingAfterCard, fishCard, height, playSound]);

  const startFishingGame = useCallback(async () => {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_APP_SETTINGS;
    setBreakSeconds(settings.shortBreakMinutes * 60);
    setRunning(true);
    gameActiveRef.current = true;
    timerAtZeroRef.current = false;
    setShowCastButton(true);
    setCastLabel('Cast Line');
    setLineVisible(false);
    setLineLength(0);
    setBobberVisible(false);
    setBobberScale(1);
    setBobberYOffset(0);
    setBobberXOffset(0);
    setProgressCount(0);
    setTapCircleVisible(false);
    setFishAwayVisible(false);
    setFishCard(null);
    setEndPendingAfterCard(false);
    lastSpawnRef.current = null;
    castOpacity.setValue(1);
    dotScales.forEach((v) => v.setValue(1));
    dotOpacities.forEach((v) => v.setValue(1));
    await playSound('fishingBackground', true);
  }, [castOpacity, dotOpacities, dotScales, playSound]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        endFishingSession();
      };
    }, [endFishingSession]),
  );

  useEffect(() => {
    async function loadSounds() {
      const loaded = await Promise.all(
        (Object.keys(SOUND_FILES) as SoundKey[]).map(async (key) => {
          const created = await Audio.Sound.createAsync(SOUND_FILES[key], { shouldPlay: false });
          await created.sound.setVolumeAsync(getSoundVolume(key));
          return [key, created.sound] as const;
        }),
      );
      for (const [key, sound] of loaded) {
        soundsRef.current[key] = sound;
      }
    }

    loadSounds().catch(() => {
      // Ignore load failures.
    });

    return () => {
      Object.values(soundsRef.current).forEach((sound) => {
        sound?.unloadAsync().catch(() => {
          // Ignore unload failures.
        });
      });
    };
  }, []);

  useEffect(() => {
    if (!running) {
      return;
    }

    if (breakSeconds <= 0) {
      timerAtZeroRef.current = true;
      if (fishCard) {
        setEndPendingAfterCard(true);
        return;
      }
      if (tapCircleVisible) {
        setTapCircleVisible(false);
        void runMissShake();
      }
      endFishingSession();
      return;
    }

    const timer = setInterval(() => {
      setBreakSeconds((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [breakSeconds, endFishingSession, fishCard, runMissShake, running, tapCircleVisible]);

  const showStartState = !running && !fishCard;
  const showModeToggle = gameMode !== 'fishing' || showStartState;

  return (
    <View style={styles.screen}>
      {showModeToggle ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.modeToggleScroller, { top: insets.top + 8 }]}
          contentContainerStyle={styles.modeToggleWrap}>
          <Pressable
            onPress={() => setGameMode('fishing')}
            style={[styles.modeTogglePill, gameMode === 'fishing' && styles.modeTogglePillActive]}>
            <Text
              style={[
                styles.modeToggleText,
                gameMode === 'fishing' ? styles.modeToggleTextActive : styles.modeToggleTextInactive,
              ]}>
              Fishing
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setGameMode('sudoku')}
            style={[styles.modeTogglePill, gameMode === 'sudoku' && styles.modeTogglePillActive]}>
            <Text
              style={[
                styles.modeToggleText,
                gameMode === 'sudoku' ? styles.modeToggleTextActive : styles.modeToggleTextInactive,
              ]}>
              Sudoku
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setGameMode('game2048')}
            style={[styles.modeTogglePill, gameMode === 'game2048' && styles.modeTogglePillActive]}>
            <Text
              style={[
                styles.modeToggleText,
                gameMode === 'game2048' ? styles.modeToggleTextActive : styles.modeToggleTextInactive,
              ]}>
              2048
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setGameMode('wordSearch')}
            style={[styles.modeTogglePill, gameMode === 'wordSearch' && styles.modeTogglePillActive]}>
            <Text
              style={[
                styles.modeToggleText,
                gameMode === 'wordSearch' ? styles.modeToggleTextActive : styles.modeToggleTextInactive,
              ]}>
              Word Search
            </Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {gameMode === 'sudoku' ? (
        <SudokuGame />
      ) : gameMode === 'game2048' ? (
        <Game2048 />
      ) : gameMode === 'wordSearch' ? (
        <GameWordSearch />
      ) : showStartState ? (
        <View style={styles.startWrap}>
          <Text style={styles.title}>Games</Text>
          <Pressable onPress={() => void startFishingGame()} style={styles.primaryCta}>
            <Text style={styles.primaryCtaText}>Fishing Game</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.gameWrap}>
          <Text style={[styles.breakTimer, { top: gameTop }]}>{breakTimerLabel}</Text>

          <View style={[styles.progressRow, { top: insets.top + 26 }]}>
            {Array.from({ length: REQUIRED_HITS }).map((_, idx) => {
              const filled = idx < progressCount;
              return (
                <Animated.View
                  key={`dot-${idx}`}
                  style={[
                    styles.progressDot,
                    filled ? styles.progressDotFilled : styles.progressDotEmpty,
                    {
                      opacity: filled ? dotOpacities[idx] : 1,
                      transform: [{ scale: dotScales[idx] }],
                    },
                  ]}
                />
              );
            })}
          </View>

          <View style={[styles.illustrationZone, { top: illustrationTop }]}>
            <FishingIllustrationSvg
              active={running}
              lineVisible={lineVisible}
              lineLength={lineLength}
              bobberVisible={bobberVisible}
              bobberScale={bobberScale}
              bobberXOffset={bobberXOffset}
              bobberYOffset={bobberYOffset}
            />
          </View>

          {fishAwayVisible ? <Text style={styles.fishAwayText}>The fish got away...</Text> : null}

          {showCastButton ? (
            <Animated.View style={[styles.castWrap, { opacity: castOpacity }]}>
              <Pressable onPress={() => void startCastSequence()} style={styles.castButton}>
                <Text style={styles.castButtonText}>{castLabel}</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {tapCircleVisible ? (
            <Pressable
              onPress={() => void onSuccessTap()}
              style={[
                styles.tapCircleHitbox,
                { left: tapPosition.x - TAP_OUTER_START / 2, top: tapPosition.y - TAP_OUTER_START / 2 },
              ]}>
              <Animated.View
                style={[
                  styles.tapOuterRing,
                  {
                    opacity: tapOpacity,
                    width: tapOuterSize,
                    height: tapOuterSize,
                    borderRadius: Animated.divide(tapOuterSize, 2),
                    transform: [{ translateX: tapTranslateX }, { scale: tapScale }],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.tapInnerRing,
                  {
                    opacity: tapOpacity,
                    transform: [{ translateX: tapTranslateX }, { scale: tapScale }],
                  },
                ]}
              />
            </Pressable>
          ) : null}

          {fishCard ? (
            <Pressable onPress={() => void dismissCard()} style={styles.cardOverlay}>
              <Animated.View style={[styles.fishCard, { transform: [{ translateY: cardTranslateY }] }]}>
                <View style={styles.cardHandle} />
                <Image source={fishCard.image} style={styles.fishImage} resizeMode="contain" />
                <Text style={styles.fishName}>{fishCard.name}</Text>
                <Text style={[styles.rarityLabel, { color: RARITY_COLORS[fishCard.rarity] }]}>
                  {fishCard.rarity.toUpperCase()}
                </Text>
                <Text style={styles.flavorText}>{fishCard.flavorText}</Text>
                <Text style={[styles.dismissText, { marginBottom: 32 + insets.bottom }]}>
                  Tap anywhere to continue
                </Text>
              </Animated.View>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EDE5D4',
  },
  startWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  title: {
    fontFamily: DesignSystem.fonts.display,
    fontSize: 34,
    color: DesignSystem.colors.text.primary,
    marginBottom: 14,
  },
  primaryCta: {
    minWidth: 200,
    height: 56,
    borderRadius: 50,
    backgroundColor: DesignSystem.colors.interactive.ctaFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    ...DesignSystem.shadows.ctaButton,
  },
  primaryCtaText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  gameWrap: {
    flex: 1,
  },
  modeToggleScroller: {
    position: 'absolute',
    zIndex: 10,
    left: 16,
    right: 16,
  },
  modeToggleWrap: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    paddingRight: 20,
    borderRadius: 999,
    backgroundColor: DesignSystem.colors.backgrounds.cardBg,
  },
  modeTogglePill: {
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  modeTogglePillActive: {
    backgroundColor: DesignSystem.colors.interactive.ctaFill,
  },
  modeToggleText: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 13,
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
  },
  modeToggleTextInactive: {
    color: DesignSystem.colors.text.primary,
  },
  breakTimer: {
    position: 'absolute',
    right: 16,
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 13,
    color: '#8A7A65',
    zIndex: 2,
  },
  progressRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressDotEmpty: {
    borderWidth: 1.5,
    borderColor: '#C8BAA0',
    backgroundColor: 'transparent',
  },
  progressDotFilled: {
    backgroundColor: '#A8431A',
  },
  illustrationZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SVG_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  castWrap: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 150,
  },
  castButton: {
    width: 155,
    height: 52,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#8A6040',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  castButtonText: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 17,
    color: '#6B4A30',
  },
  tapCircleHitbox: {
    position: 'absolute',
    width: TAP_OUTER_START,
    height: TAP_OUTER_START,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapOuterRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#C47840',
    backgroundColor: 'transparent',
  },
  tapInnerRing: {
    width: TAP_INNER_SIZE,
    height: TAP_INNER_SIZE,
    borderRadius: TAP_INNER_SIZE / 2,
    borderWidth: 2,
    borderColor: '#A8431A',
    backgroundColor: 'transparent',
  },
  fishAwayText: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 220,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 15,
    color: '#8A7A65',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  fishCard: {
    marginHorizontal: 16,
    minHeight: 280,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#E8DCC8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C8BAA0',
    marginTop: 12,
  },
  fishImage: {
    width: 120,
    height: 80,
    marginTop: 16,
  },
  fishName: {
    marginTop: 8,
    fontFamily: DesignSystem.fonts.display,
    fontSize: 22,
    color: '#A0522D',
    textAlign: 'center',
  },
  rarityLabel: {
    marginTop: 4,
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  flavorText: {
    marginTop: 12,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 15,
    color: '#8A7A65',
    textAlign: 'center',
    maxWidth: 260,
  },
  dismissText: {
    marginTop: 'auto',
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 13,
    color: '#C8BAA0',
    textAlign: 'center',
  },
});
