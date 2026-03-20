import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesignSystem } from '@/constants/designSystem';
import {
  MoveDirection,
  Tile2048,
  TileTransition,
  canMove,
  createInitialState,
  hasTileValue,
  moveTiles,
  spawnRandomTile,
} from '@/lib/game2048';

const STORAGE_KEY = '@game_2048_state_v1';
const GRID_SIZE = 4;
const TILE_GAP = 8;
const GRID_PADDING = 8;
const SWIPE_MIN = 20;
const MOVE_SOUND_FILE = require('../../assets/sounds/slide.wav');
const MOVE_SOUND_VOLUME = 0.22;

type PersistedGame2048 = {
  tiles: Tile2048[];
  score: number;
  bestScore: number;
  nextId: number;
  continueAfterWin: boolean;
};

const TILE_STYLE: Record<number, { bg: string; text: string; size: number }> = {
  2: { bg: '#E8DCC8', text: '#3A3025', size: 24 },
  4: { bg: '#E0D0B0', text: '#3A3025', size: 24 },
  8: { bg: '#C47840', text: '#FFFFFF', size: 24 },
  16: { bg: '#B85C2A', text: '#FFFFFF', size: 22 },
  32: { bg: '#A8431A', text: '#FFFFFF', size: 22 },
  64: { bg: '#8F3815', text: '#FFFFFF', size: 20 },
  128: { bg: '#5A7A55', text: '#FFFFFF', size: 18 },
  256: { bg: '#4A7A9B', text: '#FFFFFF', size: 18 },
  512: { bg: '#7A5A9B', text: '#FFFFFF', size: 18 },
  1024: { bg: '#3A3025', text: '#FFFFFF', size: 16 },
  2048: { bg: '#A0522D', text: '#FFFFFF', size: 16 },
};

function tileTheme(value: number) {
  return TILE_STYLE[value] ?? { bg: '#6E5D47', text: '#FFFFFF', size: 15 };
}

export function Game2048() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const topContentOffset = insets.top + 62;

  const staticVerticalSpace =
    topContentOffset +
    44 + // score bar height
    16 + // grid margin-top
    14 + // swipe label margin-top
    16 + // swipe label line-height bucket
    16 + // controls margin-top
    52 + // up arrow button
    8 + // bottom row margin-top
    52 + // bottom row button height
    tabBarHeight +
    insets.bottom +
    16; // breathing room
  const maxByHeight = Math.max(220, height - staticVerticalSpace);
  const gridSize = Math.min(width - 32, 420, maxByHeight);
  const cellSize = (gridSize - GRID_PADDING * 2 - TILE_GAP * 3) / GRID_SIZE;

  const [tiles, setTiles] = useState<Tile2048[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [nextId, setNextId] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showWinCard, setShowWinCard] = useState(false);
  const [continueAfterWin, setContinueAfterWin] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const tileAnimsRef = useRef<
    Record<number, { x: Animated.Value; y: Animated.Value; scale: Animated.Value }>
  >({});
  const buttonScalesRef = useRef<Record<MoveDirection, Animated.Value>>({
    up: new Animated.Value(1),
    down: new Animated.Value(1),
    left: new Animated.Value(1),
    right: new Animated.Value(1),
  });

  const cardTranslate = useRef(new Animated.Value(1000)).current;
  const moveSoundRef = useRef<Audio.Sound | null>(null);

  const updateGameOver = useCallback((nextTiles: Tile2048[]) => {
    setGameOver(!canMove(nextTiles));
  }, []);

  const ensureTileAnim = useCallback(
    (tile: Tile2048) => {
      const existing = tileAnimsRef.current[tile.id];
      const x = GRID_PADDING + tile.col * (cellSize + TILE_GAP);
      const y = GRID_PADDING + tile.row * (cellSize + TILE_GAP);
      if (existing) {
        return existing;
      }
      const created = {
        x: new Animated.Value(x),
        y: new Animated.Value(y),
        scale: new Animated.Value(1),
      };
      tileAnimsRef.current[tile.id] = created;
      return created;
    },
    [cellSize],
  );

  const resetBoard = useCallback(
    (preserveBest = true) => {
      const fresh = createInitialState(1);
      setTiles(fresh.tiles);
      setScore(0);
      setNextId(fresh.nextId);
      setGameOver(false);
      setContinueAfterWin(false);
      setShowWinCard(false);
      cardTranslate.setValue(1000);
      tileAnimsRef.current = {};
      fresh.tiles.forEach((tile) => {
        const anim = ensureTileAnim(tile);
        const x = GRID_PADDING + tile.col * (cellSize + TILE_GAP);
        const y = GRID_PADDING + tile.row * (cellSize + TILE_GAP);
        anim.x.setValue(x);
        anim.y.setValue(y);
        anim.scale.setValue(0);
        Animated.sequence([
          Animated.timing(anim.scale, {
            toValue: 1.1,
            duration: 90,
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            useNativeDriver: true,
          }),
          Animated.timing(anim.scale, {
            toValue: 1,
            duration: 60,
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            useNativeDriver: true,
          }),
        ]).start();
      });
      if (!preserveBest) {
        setBestScore(0);
      }
    },
    [cardTranslate, cellSize, ensureTileAnim],
  );

  useEffect(() => {
    async function loadMoveSound() {
      try {
        const created = await Audio.Sound.createAsync(MOVE_SOUND_FILE, { shouldPlay: false });
        await created.sound.setVolumeAsync(MOVE_SOUND_VOLUME);
        moveSoundRef.current = created.sound;
      } catch {
        moveSoundRef.current = null;
      }
    }
    loadMoveSound();

    return () => {
      moveSoundRef.current?.unloadAsync().catch(() => {
        // Ignore unload failures.
      });
    };
  }, []);

  const playMoveSound = useCallback(async () => {
    const sound = moveSoundRef.current;
    if (!sound) {
      return;
    }
    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      await sound.setVolumeAsync(MOVE_SOUND_VOLUME);
      await sound.playAsync();
    } catch {
      // Ignore playback failures.
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          resetBoard(true);
          return;
        }
        const parsed = JSON.parse(raw) as PersistedGame2048;
        const parsedTiles = Array.isArray(parsed.tiles) ? parsed.tiles : [];
        setTiles(parsedTiles);
        setScore(Number.isFinite(parsed.score) ? parsed.score : 0);
        setBestScore(Number.isFinite(parsed.bestScore) ? parsed.bestScore : 0);
        setNextId(Number.isFinite(parsed.nextId) ? parsed.nextId : Math.max(...parsedTiles.map((t) => t.id), 0) + 1);
        setContinueAfterWin(Boolean(parsed.continueAfterWin));
        updateGameOver(parsedTiles);
        parsedTiles.forEach((tile) => {
          const anim = ensureTileAnim(tile);
          anim.x.setValue(GRID_PADDING + tile.col * (cellSize + TILE_GAP));
          anim.y.setValue(GRID_PADDING + tile.row * (cellSize + TILE_GAP));
          anim.scale.setValue(1);
        });
      } catch {
        resetBoard(true);
      }
    }
    load();
  }, [cellSize, ensureTileAnim, resetBoard, updateGameOver]);

  useEffect(() => {
    const payload: PersistedGame2048 = {
      tiles,
      score,
      bestScore,
      nextId,
      continueAfterWin,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {
      // Ignore persistence errors.
    });
  }, [bestScore, continueAfterWin, nextId, score, tiles]);

  const runMove = useCallback(
    (direction: MoveDirection) => {
      if (isAnimating || showWinCard || tiles.length === 0) {
        return;
      }

      const result = moveTiles(tiles, direction);
      if (!result.moved) {
        return;
      }

      void playMoveSound();
      setIsAnimating(true);
      const slideAnimations: Animated.CompositeAnimation[] = [];
      result.transitions.forEach((transition: TileTransition) => {
        const sourceTile = tiles.find((tile) => tile.id === transition.id);
        if (!sourceTile) {
          return;
        }
        const anim = ensureTileAnim(sourceTile);
        const x = GRID_PADDING + transition.toCol * (cellSize + TILE_GAP);
        const y = GRID_PADDING + transition.toRow * (cellSize + TILE_GAP);
        slideAnimations.push(
          Animated.timing(anim.x, { toValue: x, duration: 100, easing: Easing.linear, useNativeDriver: true }),
        );
        slideAnimations.push(
          Animated.timing(anim.y, { toValue: y, duration: 100, easing: Easing.linear, useNativeDriver: true }),
        );
      });

      Animated.parallel(slideAnimations).start(() => {
        const mergedSet = new Set(result.mergedTileIds);
        result.mergedTileIds.forEach((id) => {
          const anim = tileAnimsRef.current[id];
          if (!anim) {
            return;
          }
          anim.scale.setValue(1);
          Animated.sequence([
            Animated.timing(anim.scale, {
              toValue: 1.2,
              duration: 75,
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 1,
              duration: 75,
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
              useNativeDriver: true,
            }),
          ]).start();
        });

        const withNewTile = spawnRandomTile(result.tiles, nextId);
        const nextTiles = withNewTile.tiles;
        const newSpawnedId = withNewTile.spawnedId;

        if (newSpawnedId) {
          const newTile = nextTiles.find((tile) => tile.id === newSpawnedId);
          if (newTile) {
            const spawnAnim = ensureTileAnim(newTile);
            spawnAnim.x.setValue(GRID_PADDING + newTile.col * (cellSize + TILE_GAP));
            spawnAnim.y.setValue(GRID_PADDING + newTile.row * (cellSize + TILE_GAP));
            spawnAnim.scale.setValue(0);
            Animated.sequence([
              Animated.timing(spawnAnim.scale, {
                toValue: 1.1,
                duration: 90,
                easing: Easing.bezier(0.34, 1.56, 0.64, 1),
                useNativeDriver: true,
              }),
              Animated.timing(spawnAnim.scale, {
                toValue: 1,
                duration: 60,
                easing: Easing.bezier(0.34, 1.56, 0.64, 1),
                useNativeDriver: true,
              }),
            ]).start();
          }
        }

        Object.keys(tileAnimsRef.current).forEach((idText) => {
          const id = Number(idText);
          if (!nextTiles.some((tile) => tile.id === id)) {
            delete tileAnimsRef.current[id];
          } else if (!mergedSet.has(id)) {
            tileAnimsRef.current[id].scale.setValue(1);
          }
        });

        const nextScore = score + result.scoreDelta;
        const nextBest = Math.max(bestScore, nextScore);
        const reached2048 = hasTileValue(nextTiles, 2048);

        setTiles(nextTiles);
        setScore(nextScore);
        setBestScore(nextBest);
        setNextId(newSpawnedId ? nextId + 1 : nextId);
        updateGameOver(nextTiles);

        if (reached2048 && !continueAfterWin) {
          setShowWinCard(true);
          cardTranslate.setValue(1000);
          Animated.timing(cardTranslate, {
            toValue: 0,
            duration: 350,
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            useNativeDriver: true,
          }).start();
        }

        setIsAnimating(false);
      });
    },
    [
      bestScore,
      cardTranslate,
      cellSize,
      continueAfterWin,
      ensureTileAnim,
      isAnimating,
      nextId,
      score,
      showWinCard,
      tiles,
      updateGameOver,
      playMoveSound,
    ],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10,
        onPanResponderRelease: (_evt, gestureState) => {
          const { dx, dy } = gestureState;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) {
            return;
          }
          if (Math.abs(dx) >= Math.abs(dy)) {
            runMove(dx > 0 ? 'right' : 'left');
          } else {
            runMove(dy > 0 ? 'down' : 'up');
          }
        },
      }),
    [runMove],
  );

  const handleDirectionPress = useCallback(
    (direction: MoveDirection) => {
      const scale = buttonScalesRef.current[direction];
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 8, useNativeDriver: true }),
      ]).start();
      runMove(direction);
    },
    [runMove],
  );

  const dismissWinCard = useCallback(() => {
    Animated.timing(cardTranslate, {
      toValue: 1000,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowWinCard(false);
      setContinueAfterWin(true);
    });
  }, [cardTranslate]);

  return (
    <View style={[styles.screen, { paddingBottom: tabBarHeight + insets.bottom + 8 }]}>
      <View style={[styles.scoreBar, { marginTop: topContentOffset }]}>
        <View style={styles.scoreCol}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>

        <Pressable onPress={() => resetBoard(true)} style={styles.newGameButton}>
          <Text style={styles.newGameButtonText}>New Game</Text>
        </Pressable>

        <View style={[styles.scoreCol, styles.scoreColRight]}>
          <Text style={styles.scoreLabel}>BEST</Text>
          <Text style={styles.scoreValue}>{bestScore}</Text>
        </View>
      </View>

      <View style={[styles.gridWrap, { width: gridSize, height: gridSize }]} {...panResponder.panHandlers}>
        {Array.from({ length: GRID_SIZE }).map((_, row) => (
          <View key={`row-${row}`} style={[styles.gridRow, row < GRID_SIZE - 1 ? styles.gridRowGap : null]}>
            {Array.from({ length: GRID_SIZE }).map((__, col) => (
              <View
                key={`cell-${row}-${col}`}
                style={[
                  styles.emptyCell,
                  col < GRID_SIZE - 1 ? styles.emptyCellGap : null,
                  {
                    width: cellSize,
                    height: cellSize,
                  },
                ]}
              />
            ))}
          </View>
        ))}

        {tiles.map((tile) => {
          const theme = tileTheme(tile.value);
          const anim = ensureTileAnim(tile);
          return (
            <Animated.View
              key={tile.id}
              style={[
                styles.tile,
                {
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: theme.bg,
                  left: 0,
                  top: 0,
                  transform: [{ translateX: anim.x }, { translateY: anim.y }, { scale: anim.scale }],
                },
              ]}>
              <Text style={[styles.tileText, { color: theme.text, fontSize: theme.size }]}>{tile.value}</Text>
            </Animated.View>
          );
        })}

        {gameOver ? (
          <View style={styles.gameOverOverlay}>
            <Text style={styles.gameOverTitle}>Game Over</Text>
            <Pressable onPress={() => resetBoard(true)} style={styles.newGameCta}>
              <Text style={styles.newGameCtaText}>New Game</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text style={styles.swipeLabel}>Swipe the board or use arrows</Text>

      <View style={styles.controlsWrap}>
        <Animated.View style={{ transform: [{ scale: buttonScalesRef.current.up }] }}>
          <Pressable onPress={() => handleDirectionPress('up')} style={styles.arrowButton}>
            <MaterialIcons name="keyboard-arrow-up" size={24} color="#3A3025" />
          </Pressable>
        </Animated.View>
        <View style={styles.bottomArrowRow}>
          <Animated.View style={{ transform: [{ scale: buttonScalesRef.current.left }] }}>
            <Pressable onPress={() => handleDirectionPress('left')} style={styles.arrowButton}>
              <MaterialIcons name="keyboard-arrow-left" size={24} color="#3A3025" />
            </Pressable>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: buttonScalesRef.current.down }] }}>
            <Pressable onPress={() => handleDirectionPress('down')} style={styles.arrowButton}>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#3A3025" />
            </Pressable>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: buttonScalesRef.current.right }] }}>
            <Pressable onPress={() => handleDirectionPress('right')} style={styles.arrowButton}>
              <MaterialIcons name="keyboard-arrow-right" size={24} color="#3A3025" />
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {showWinCard ? (
        <Pressable onPress={dismissWinCard} style={styles.winOverlay}>
          <Animated.View style={[styles.winCard, { transform: [{ translateY: cardTranslate }] }]}>
            <View style={styles.winHandle} />
            <Text style={styles.winTitle}>2048 Reached</Text>
            <Text style={styles.winSub}>Score: {score}</Text>

            <View style={styles.winActions}>
              <Pressable
                onPress={() => {
                  setContinueAfterWin(true);
                  dismissWinCard();
                }}
                style={styles.continueButton}>
                <Text style={styles.continueButtonText}>Continue</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  dismissWinCard();
                  resetBoard(true);
                }}
                style={styles.restartButton}>
                <Text style={styles.restartButtonText}>New Game</Text>
              </Pressable>
            </View>

            <Text style={[styles.winHint, { marginBottom: 32 + insets.bottom }]}>
              Tap anywhere to dismiss
            </Text>
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EDE5D4',
  },
  scoreBar: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreCol: {
    minWidth: 72,
  },
  scoreColRight: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: '#8A7A65',
  },
  scoreValue: {
    marginTop: 2,
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 20,
    color: '#3A3025',
  },
  newGameButton: {
    width: 110,
    height: 40,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#8A6040',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  newGameButtonText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 15,
    color: '#6B4A30',
  },
  gridWrap: {
    alignSelf: 'center',
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#C8BAA0',
    padding: GRID_PADDING,
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridRowGap: {
    marginBottom: TILE_GAP,
  },
  emptyCellGap: {
    marginRight: TILE_GAP,
  },
  emptyCell: {
    borderRadius: 8,
    backgroundColor: '#DDD0B8',
  },
  tile: {
    position: 'absolute',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    fontFamily: DesignSystem.fonts.bodyBold,
  },
  swipeLabel: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 13,
    color: '#8A7A65',
  },
  controlsWrap: {
    marginTop: 16,
    alignItems: 'center',
  },
  bottomArrowRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  arrowButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#E8DCC8',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0px 1px 2px 0px rgba(0,0,0,0.05)',
  },
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(237, 229, 212, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameOverTitle: {
    fontFamily: DesignSystem.fonts.display,
    fontSize: 22,
    color: '#A0522D',
  },
  newGameCta: {
    marginTop: 14,
    width: 120,
    height: 40,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#8A6040',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  newGameCtaText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 14,
    color: '#6B4A30',
  },
  winOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  winCard: {
    marginHorizontal: 16,
    minHeight: 280,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#E8DCC8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  winHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C8BAA0',
    marginTop: 12,
  },
  winTitle: {
    marginTop: 16,
    fontFamily: DesignSystem.fonts.display,
    fontSize: 22,
    color: '#A0522D',
  },
  winSub: {
    marginTop: 8,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 15,
    color: '#8A7A65',
  },
  winActions: {
    marginTop: 24,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  continueButton: {
    width: 120,
    height: 44,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#8A6040',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 14,
    color: '#6B4A30',
  },
  restartButton: {
    width: 120,
    height: 44,
    borderRadius: 50,
    backgroundColor: '#A8431A',
    alignItems: 'center',
    justifyContent: 'center',
    ...DesignSystem.shadows.ctaButton,
  },
  restartButtonText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  winHint: {
    marginTop: 'auto',
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 13,
    color: '#C8BAA0',
  },
});
