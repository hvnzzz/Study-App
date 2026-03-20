import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesignSystem } from '@/constants/designSystem';
import {
  CellCoord,
  WORD_SEARCH_GRID,
  WordSearchCategory,
  cellsToKey,
  generateWordSearchPuzzle,
  getLineCells,
  wordFromCells,
} from '@/lib/wordSearch';

const STORAGE_KEY = '@word_search_state_v1';

const CATEGORY_ORDER: WordSearchCategory[] = [
  'Animals',
  'Food',
  'Nature',
  'Space',
  'Sports',
  'Weather',
  'Colors',
  'Music',
];

const FOUND_COLORS = [
  { bg: 'rgba(168, 67, 26, 0.20)', text: '#A8431A' },
  { bg: 'rgba(90, 122, 85, 0.20)', text: '#5A7A55' },
  { bg: 'rgba(74, 122, 155, 0.20)', text: '#4A7A9B' },
  { bg: 'rgba(122, 90, 155, 0.20)', text: '#7A5A9B' },
  { bg: 'rgba(196, 120, 64, 0.20)', text: '#C47840' },
  { bg: 'rgba(138, 122, 101, 0.20)', text: '#8A7A65' },
  { bg: 'rgba(168, 67, 26, 0.15)', text: '#A8431A' },
  { bg: 'rgba(90, 122, 85, 0.15)', text: '#5A7A55' },
];

type FoundWordState = {
  colorIndex: number;
  cells: CellCoord[];
};

type PersistedWordSearch = {
  category: WordSearchCategory;
  grid: string[][];
  words: string[];
  foundWords: Record<string, FoundWordState>;
  elapsedSeconds: number;
};

function formatMMSS(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function cellKey(cell: CellCoord): string {
  return `${cell.row}-${cell.col}`;
}

export function GameWordSearch() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const topContentOffset = insets.top + 62;
  const staticVertical =
    topContentOffset +
    40 + // category pills row bucket
    12 +
    20 + // timer row
    14 + // grid top margin
    16 + // word list margin
    160 + // word list area
    tabBarHeight +
    insets.bottom +
    16;
  const maxByHeight = Math.max(220, height - staticVertical);
  const gridSize = Math.min(width - 32, 420, maxByHeight);
  const cellSize = (gridSize - 16) / WORD_SEARCH_GRID;

  const [category, setCategory] = useState<WordSearchCategory>('Animals');
  const [grid, setGrid] = useState<string[][]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [foundWords, setFoundWords] = useState<Record<string, FoundWordState>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectionCells, setSelectionCells] = useState<CellCoord[]>([]);
  const [tapStart, setTapStart] = useState<CellCoord | null>(null);
  const [invalidSelectionKeys, setInvalidSelectionKeys] = useState<string[]>([]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [dimUnfoundLetters, setDimUnfoundLetters] = useState(false);

  const dragStartRef = useRef<CellCoord | null>(null);
  const cellScaleRef = useRef<Record<string, Animated.Value>>({});
  const cardTranslateY = useRef(new Animated.Value(1000)).current;

  const remainingWords = words.length - Object.keys(foundWords).length;

  const ensureCellScale = useCallback((key: string) => {
    if (!cellScaleRef.current[key]) {
      cellScaleRef.current[key] = new Animated.Value(1);
    }
    return cellScaleRef.current[key];
  }, []);

  const generatePuzzle = useCallback(
    (nextCategory: WordSearchCategory) => {
      const puzzle = generateWordSearchPuzzle(nextCategory);
      setCategory(nextCategory);
      setGrid(puzzle.grid);
      setWords(puzzle.words);
      setFoundWords({});
      setElapsedSeconds(0);
      setSelectionCells([]);
      setTapStart(null);
      setInvalidSelectionKeys([]);
      setDimUnfoundLetters(false);
      setShowCompletion(false);
      cardTranslateY.setValue(1000);
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {
        // Ignore clear failures.
      });
    },
    [cardTranslateY],
  );

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          generatePuzzle('Animals');
          return;
        }
        const parsed = JSON.parse(raw) as PersistedWordSearch;
        if (!parsed?.grid?.length || !parsed?.words?.length) {
          generatePuzzle('Animals');
          return;
        }
        setCategory(parsed.category);
        setGrid(parsed.grid);
        setWords(parsed.words);
        setFoundWords(parsed.foundWords ?? {});
        setElapsedSeconds(parsed.elapsedSeconds ?? 0);
      } catch {
        generatePuzzle('Animals');
      }
    }
    load();
  }, [generatePuzzle]);

  useEffect(() => {
    if (!grid.length || showCompletion) {
      return;
    }
    const payload: PersistedWordSearch = {
      category,
      grid,
      words,
      foundWords,
      elapsedSeconds,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {
      // Ignore persistence failures.
    });
  }, [category, elapsedSeconds, foundWords, grid, showCompletion, words]);

  useEffect(() => {
    if (!grid.length || showCompletion) {
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [grid, showCompletion]);

  useEffect(() => {
    if (!words.length || remainingWords !== 0 || showCompletion) {
      return;
    }
    setDimUnfoundLetters(true);
    setTimeout(() => {
      setShowCompletion(true);
      cardTranslateY.setValue(1000);
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 350,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }).start();
    }, 300);
  }, [cardTranslateY, remainingWords, showCompletion, words.length]);

  const selectCellsTo = useCallback(
    (start: CellCoord, end: CellCoord) => {
      const cells = getLineCells(start, end);
      setSelectionCells(cells);
      return cells;
    },
    [],
  );

  const runInvalidFlash = useCallback((cells: CellCoord[]) => {
    const keys = cells.map(cellKey);
    setInvalidSelectionKeys(keys);
    setTimeout(() => {
      setInvalidSelectionKeys((current) => current.filter((key) => !keys.includes(key)));
    }, 150);
  }, []);

  const commitSelection = useCallback(
    (cells: CellCoord[]) => {
      if (!cells.length || !grid.length) {
        setSelectionCells([]);
        return;
      }
      const selectedWord = wordFromCells(grid, cells);
      const reversedWord = selectedWord.split('').reverse().join('');
      const unfoundWords = words.filter((word) => !foundWords[word]);
      const matchedWord = unfoundWords.find((word) => word === selectedWord || word === reversedWord);

      if (!matchedWord) {
        runInvalidFlash(cells);
        setSelectionCells([]);
        return;
      }

      const colorIndex = Object.keys(foundWords).length % FOUND_COLORS.length;
      setFoundWords((current) => ({
        ...current,
        [matchedWord]: { colorIndex, cells },
      }));
      cells.forEach((cell, idx) => {
        const scale = ensureCellScale(cellKey(cell));
        setTimeout(() => {
          scale.setValue(1);
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.1,
              duration: 75,
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 75,
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
              useNativeDriver: true,
            }),
          ]).start();
        }, idx * 15);
      });
      setSelectionCells([]);
      setTapStart(null);
    },
    [ensureCellScale, foundWords, grid, runInvalidFlash, words],
  );

  const cellFromTouch = useCallback(
    (x: number, y: number): CellCoord | null => {
      const localX = x - 8;
      const localY = y - 8;
      if (localX < 0 || localY < 0) {
        return null;
      }
      const col = Math.floor(localX / cellSize);
      const row = Math.floor(localY / cellSize);
      if (row < 0 || row >= WORD_SEARCH_GRID || col < 0 || col >= WORD_SEARCH_GRID) {
        return null;
      }
      return { row, col };
    },
    [cellSize],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const start = cellFromTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          if (!start) {
            return;
          }
          dragStartRef.current = start;
          setSelectionCells([start]);
        },
        onPanResponderMove: (evt) => {
          const start = dragStartRef.current;
          if (!start) {
            return;
          }
          const current = cellFromTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          if (!current) {
            return;
          }
          selectCellsTo(start, current);
        },
        onPanResponderRelease: (evt, gesture) => {
          const start = dragStartRef.current;
          dragStartRef.current = null;
          if (!start) {
            return;
          }
          const end = cellFromTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY) ?? start;
          const moved = Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > 6;

          if (!moved) {
            if (!tapStart) {
              setTapStart(start);
              setSelectionCells([start]);
              return;
            }
            if (tapStart.row === start.row && tapStart.col === start.col) {
              setTapStart(null);
              setSelectionCells([]);
              return;
            }
            const tapCells = getLineCells(tapStart, start);
            commitSelection(tapCells);
            return;
          }

          const cells = selectCellsTo(start, end);
          commitSelection(cells);
        },
        onPanResponderTerminate: () => {
          dragStartRef.current = null;
          setSelectionCells([]);
        },
      }),
    [cellFromTouch, commitSelection, selectCellsTo, tapStart],
  );

  const foundCellMap = useMemo(() => {
    const map: Record<string, number> = {};
    Object.values(foundWords).forEach((item) => {
      item.cells.forEach((cell) => {
        map[cellKey(cell)] = item.colorIndex;
      });
    });
    return map;
  }, [foundWords]);

  const selectionKeySet = useMemo(() => new Set(selectionCells.map(cellKey)), [selectionCells]);
  const invalidKeySet = useMemo(() => new Set(invalidSelectionKeys), [invalidSelectionKeys]);

  const dismissCompletion = useCallback(() => {
    Animated.timing(cardTranslateY, {
      toValue: 1000,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setShowCompletion(false));
  }, [cardTranslateY]);

  return (
    <View style={[styles.screen, { paddingBottom: tabBarHeight + insets.bottom + 8 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.categoryRow, { marginTop: topContentOffset }]}>
        {CATEGORY_ORDER.map((item) => {
          const active = item === category;
          return (
            <Pressable
              key={item}
              onPress={() => {
                if (!active) {
                  generatePuzzle(item);
                }
              }}
              style={[styles.categoryPill, active ? styles.categoryPillActive : styles.categoryPillInactive]}>
              <Text style={active ? styles.categoryTextActive : styles.categoryTextInactive}>{item}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{formatMMSS(elapsedSeconds)}</Text>
        <Text style={styles.metaText}>{remainingWords} words left</Text>
      </View>

      <View style={[styles.gridWrap, { width: gridSize, height: gridSize }]} {...panResponder.panHandlers}>
        {grid.map((row, r) =>
          row.map((letter, c) => {
            const key = `${r}-${c}`;
            const foundColorIndex = foundCellMap[key];
            const foundColor = Number.isFinite(foundColorIndex) ? FOUND_COLORS[foundColorIndex] : null;
            const selected = selectionKeySet.has(key);
            const invalid = invalidKeySet.has(key);
            const scale = ensureCellScale(key);

            const backgroundColor = invalid
              ? 'rgba(0,0,0,0.05)'
              : foundColor
                ? foundColor.bg
                : selected
                  ? 'rgba(168, 67, 26, 0.15)'
                  : 'transparent';

            const color = foundColor
              ? foundColor.text
              : dimUnfoundLetters
                ? '#C8BAA0'
                : '#3A3025';

            return (
              <Animated.View
                key={key}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    left: 8 + c * cellSize,
                    top: 8 + r * cellSize,
                    backgroundColor,
                    transform: [{ scale }],
                  },
                ]}>
                <Text style={[styles.cellLetter, { color }]}>{letter}</Text>
              </Animated.View>
            );
          }),
        )}
      </View>

      <View style={styles.wordListWrap}>
        <View style={styles.wordListCol}>
          {words.filter((_, index) => index % 2 === 0).map((word) => {
            const found = foundWords[word];
            const dot = found ? FOUND_COLORS[found.colorIndex] : null;
            return (
              <View key={word} style={styles.wordRow}>
                {dot ? <View style={[styles.wordDot, { backgroundColor: dot.text }]} /> : <View style={styles.wordDotSpacer} />}
                <Text
                  style={[
                    styles.wordText,
                    found ? styles.wordTextFound : null,
                    found ? { textDecorationLine: 'line-through' } : null,
                  ]}>
                  {word}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.wordListCol}>
          {words.filter((_, index) => index % 2 === 1).map((word) => {
            const found = foundWords[word];
            const dot = found ? FOUND_COLORS[found.colorIndex] : null;
            return (
              <View key={word} style={styles.wordRow}>
                {dot ? <View style={[styles.wordDot, { backgroundColor: dot.text }]} /> : <View style={styles.wordDotSpacer} />}
                <Text
                  style={[
                    styles.wordText,
                    found ? styles.wordTextFound : null,
                    found ? { textDecorationLine: 'line-through' } : null,
                  ]}>
                  {word}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {showCompletion ? (
        <Pressable onPress={dismissCompletion} style={styles.completionOverlay}>
          <Animated.View style={[styles.completionCard, { transform: [{ translateY: cardTranslateY }] }]}>
            <View style={styles.completionHandle} />
            <Text style={styles.completionTitle}>Puzzle Complete</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{category}</Text>
            </View>
            <Text style={styles.completionMeta}>Solved in {formatMMSS(elapsedSeconds)}</Text>

            <Pressable onPress={() => generatePuzzle(category)} style={styles.completionButton}>
              <Text style={styles.completionButtonText}>New Puzzle</Text>
            </Pressable>

            <Text style={[styles.dismissHint, { marginBottom: 32 + insets.bottom }]}>Tap anywhere to dismiss</Text>
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
  categoryRow: {
    paddingHorizontal: 24,
    gap: 8,
    paddingRight: 36,
  },
  categoryPill: {
    height: 32,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  categoryPillActive: {
    backgroundColor: '#A8431A',
  },
  categoryPillInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#8A6040',
  },
  categoryTextActive: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  categoryTextInactive: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 13,
    color: '#6B4A30',
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  metaText: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 15,
    color: '#8A7A65',
  },
  gridWrap: {
    marginTop: 14,
    alignSelf: 'center',
    borderRadius: 12,
    backgroundColor: '#E8DCC8',
    padding: 8,
    overflow: 'hidden',
    boxShadow: 'inset 0px 1px 0px 0px rgba(255,255,255,0.4), 0px 1px 3px 0px rgba(0,0,0,0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cell: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  cellLetter: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 14,
  },
  wordListWrap: {
    marginTop: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  wordListCol: {
    flex: 1,
    gap: 6,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
  },
  wordDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  wordDotSpacer: {
    width: 12,
  },
  wordText: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 15,
    color: '#3A3025',
  },
  wordTextFound: {
    color: '#C8BAA0',
  },
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  completionCard: {
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
  completionHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C8BAA0',
    marginTop: 12,
  },
  completionTitle: {
    marginTop: 16,
    fontFamily: DesignSystem.fonts.display,
    fontSize: 22,
    color: '#A0522D',
  },
  categoryBadge: {
    marginTop: 10,
    height: 30,
    borderRadius: 50,
    backgroundColor: '#A8431A',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadgeText: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    color: '#FFFFFF',
    fontSize: 13,
  },
  completionMeta: {
    marginTop: 8,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 15,
    color: '#8A7A65',
  },
  completionButton: {
    marginTop: 24,
    width: 155,
    height: 52,
    borderRadius: 50,
    backgroundColor: '#A8431A',
    alignItems: 'center',
    justifyContent: 'center',
    ...DesignSystem.shadows.ctaButton,
  },
  completionButtonText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    color: '#FFFFFF',
    fontSize: 16,
  },
  dismissHint: {
    marginTop: 'auto',
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 13,
    color: '#C8BAA0',
  },
});
