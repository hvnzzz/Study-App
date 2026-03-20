import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  AppStateStatus,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesignSystem } from '@/constants/designSystem';
import { Difficulty, Grid, generatePuzzle, getBoxIndex, isCompleteAndValid } from '@/lib/sudoku';

type SelectedCell = { row: number; col: number };
type NotesMap = Record<string, number[]>;

const STORAGE_KEY = '@sudoku_minigame_state_v1';
const MAX_MISTAKES = 3;
const MAX_HINTS = 3;
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

function keyFor(row: number, col: number): string {
  return `${row}-${col}`;
}

function parseKey(key: string): { row: number; col: number } {
  const [row, col] = key.split('-').map(Number);
  return { row, col };
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

function emptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0));
}

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function relatedCell(a: SelectedCell, row: number, col: number): boolean {
  return (
    a.row === row ||
    a.col === col ||
    getBoxIndex(a.row, a.col) === getBoxIndex(row, col)
  );
}

export function SudokuGame() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const compact = height <= 760;
  const topOffset = insets.top + 56;
  const difficultyHeight = 36;
  const metaRowTopMargin = compact ? 8 : 10;
  const metaRowHeight = 20;
  const gridTopMargin = compact ? 10 : 14;
  const actionTopMargin = compact ? 12 : 16;
  const actionContentHeight = compact ? 50 : 54;
  const numberPadTopMargin = compact ? 12 : 16;
  const numberPadHeight = compact ? 44 : 48;
  const bottomPadding = Math.max(insets.bottom, 8) + 8;
  const layoutSafetyBuffer = compact ? 24 : 20;
  const staticVerticalSpace =
    topOffset +
    difficultyHeight +
    metaRowTopMargin +
    metaRowHeight +
    gridTopMargin +
    actionTopMargin +
    actionContentHeight +
    numberPadTopMargin +
    numberPadHeight +
    bottomPadding +
    tabBarHeight +
    layoutSafetyBuffer;
  const maxByHeight = Math.max(190, height - staticVerticalSpace);
  const gridSize = Math.min(width - 32, 420, maxByHeight);
  const cellSize = gridSize / 9;

  const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
  const [puzzle, setPuzzle] = useState<Grid>(emptyGrid());
  const [solution, setSolution] = useState<Grid>(emptyGrid());
  const [entries, setEntries] = useState<Grid>(emptyGrid());
  const [notes, setNotes] = useState<NotesMap>({});
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notesMode, setNotesMode] = useState(false);
  const [errorCellKey, setErrorCellKey] = useState<string | null>(null);
  const [flashRings, setFlashRings] = useState<number[]>([]);
  const [showCompletionCard, setShowCompletionCard] = useState(false);

  const errorShake = useRef(new Animated.Value(0)).current;
  const completionTranslate = useRef(new Animated.Value(1000)).current;
  const numpadScale = useRef(Array.from({ length: 9 }, () => new Animated.Value(1))).current;
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pauseForBackgroundRef = useRef(false);

  const selectedValue = selected ? entries[selected.row][selected.col] : 0;

  const givenCellSet = useMemo(() => {
    const set = new Set<string>();
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (puzzle[row][col] !== 0) {
          set.add(keyFor(row, col));
        }
      }
    }
    return set;
  }, [puzzle]);

  const solved = useMemo(() => isCompleteAndValid(entries, solution), [entries, solution]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasActive = appStateRef.current === 'active';
      const nowActive = nextState === 'active';
      appStateRef.current = nextState;
      if (wasActive && !nowActive) {
        pauseForBackgroundRef.current = true;
      }
      if (!wasActive && nowActive) {
        pauseForBackgroundRef.current = false;
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const canTick =
      !showCompletionCard &&
      !solved &&
      puzzle.flat().some((value) => value !== 0) &&
      !pauseForBackgroundRef.current;
    if (!canTick) {
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [puzzle, showCompletionCard, solved]);

  useEffect(() => {
    async function loadState() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          const generated = generatePuzzle('Easy');
          setDifficulty('Easy');
          setPuzzle(generated.puzzle);
          setSolution(generated.solution);
          setEntries(cloneGrid(generated.puzzle));
          return;
        }

        const parsed = JSON.parse(raw) as {
          difficulty: Difficulty;
          puzzle: Grid;
          solution: Grid;
          entries: Grid;
          notes: NotesMap;
          elapsedSeconds: number;
          mistakes: number;
          hintsUsed: number;
          selected: SelectedCell | null;
          notesMode: boolean;
        };

        setDifficulty(parsed.difficulty);
        setPuzzle(parsed.puzzle);
        setSolution(parsed.solution);
        setEntries(parsed.entries);
        setNotes(parsed.notes ?? {});
        setElapsedSeconds(parsed.elapsedSeconds ?? 0);
        setMistakes(parsed.mistakes ?? 0);
        setHintsUsed(parsed.hintsUsed ?? 0);
        setSelected(parsed.selected ?? null);
        setNotesMode(Boolean(parsed.notesMode));
      } catch {
        const generated = generatePuzzle('Easy');
        setDifficulty('Easy');
        setPuzzle(generated.puzzle);
        setSolution(generated.solution);
        setEntries(cloneGrid(generated.puzzle));
      }
    }

    loadState();
  }, []);

  useEffect(() => {
    if (showCompletionCard) {
      return;
    }
    if (!puzzle.flat().some((value) => value !== 0)) {
      return;
    }

    const payload = {
      difficulty,
      puzzle,
      solution,
      entries,
      notes,
      elapsedSeconds,
      mistakes,
      hintsUsed,
      selected,
      notesMode,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {
      // Ignore persistence failures.
    });
  }, [
    difficulty,
    entries,
    elapsedSeconds,
    hintsUsed,
    mistakes,
    notes,
    notesMode,
    puzzle,
    selected,
    showCompletionCard,
    solution,
  ]);

  useEffect(() => {
    if (!solved || showCompletionCard) {
      return;
    }

    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {
      // Ignore clear failures.
    });

    const ringTimeouts: NodeJS.Timeout[] = [];
    for (let ring = 0; ring <= 4; ring += 1) {
      ringTimeouts.push(
        setTimeout(() => {
          setFlashRings((prev) => (prev.includes(ring) ? prev : [...prev, ring]));
        }, ring * 20),
      );
      ringTimeouts.push(
        setTimeout(() => {
          setFlashRings((prev) => prev.filter((value) => value !== ring));
        }, ring * 20 + 300),
      );
    }

    const showCardTimer = setTimeout(() => {
      setShowCompletionCard(true);
      completionTranslate.setValue(1000);
      Animated.timing(completionTranslate, {
        toValue: 0,
        duration: 350,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }).start();
    }, 360);

    return () => {
      ringTimeouts.forEach((timeout) => clearTimeout(timeout));
      clearTimeout(showCardTimer);
    };
  }, [completionTranslate, showCompletionCard, solved]);

  const generateNewPuzzle = useCallback((nextDifficulty: Difficulty) => {
    const generated = generatePuzzle(nextDifficulty);
    setDifficulty(nextDifficulty);
    setPuzzle(generated.puzzle);
    setSolution(generated.solution);
    setEntries(cloneGrid(generated.puzzle));
    setNotes({});
    setSelected(null);
    setMistakes(0);
    setHintsUsed(0);
    setElapsedSeconds(0);
    setNotesMode(false);
    setErrorCellKey(null);
    setFlashRings([]);
    setShowCompletionCard(false);
    completionTranslate.setValue(1000);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {
      // Ignore clear failures.
    });
  }, [completionTranslate]);

  const resetSamePuzzle = useCallback(() => {
    setEntries(cloneGrid(puzzle));
    setNotes({});
    setSelected(null);
    setMistakes(0);
    setErrorCellKey(null);
  }, [puzzle]);

  const clearNotesForPeers = useCallback((row: number, col: number, value: number) => {
    setNotes((current) => {
      const next: NotesMap = {};
      for (const [cellKey, values] of Object.entries(current)) {
        const parsed = parseKey(cellKey);
        const sameGroup =
          parsed.row === row ||
          parsed.col === col ||
          getBoxIndex(parsed.row, parsed.col) === getBoxIndex(row, col);
        if (!sameGroup) {
          next[cellKey] = values;
          continue;
        }
        const filtered = values.filter((note) => note !== value);
        if (filtered.length > 0) {
          next[cellKey] = filtered;
        }
      }
      return next;
    });
  }, []);

  const triggerErrorShake = useCallback(() => {
    errorShake.setValue(0);
    Animated.sequence([
      Animated.timing(errorShake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [errorShake]);

  const applyNumber = useCallback((value: number) => {
    if (!selected) {
      return;
    }
    const selectedKey = keyFor(selected.row, selected.col);
    if (givenCellSet.has(selectedKey)) {
      return;
    }

    if (notesMode) {
      setNotes((current) => {
        const existing = current[selectedKey] ?? [];
        const has = existing.includes(value);
        const nextValues = has
          ? existing.filter((item) => item !== value)
          : [...existing, value].sort((a, b) => a - b);
        const next = { ...current };
        if (nextValues.length === 0) {
          delete next[selectedKey];
        } else {
          next[selectedKey] = nextValues;
        }
        return next;
      });
      return;
    }

    if (solution[selected.row][selected.col] === value) {
      setEntries((current) => {
        const next = cloneGrid(current);
        next[selected.row][selected.col] = value;
        return next;
      });
      setNotes((current) => {
        const next = { ...current };
        delete next[selectedKey];
        return next;
      });
      clearNotesForPeers(selected.row, selected.col, value);
      setErrorCellKey(null);
      return;
    }

    setEntries((current) => {
      const next = cloneGrid(current);
      next[selected.row][selected.col] = value;
      return next;
    });
    setErrorCellKey(selectedKey);
    triggerErrorShake();
    setMistakes((current) => {
      const next = current + 1;
      if (next >= MAX_MISTAKES) {
        setTimeout(() => generateNewPuzzle(difficulty), 250);
      }
      return next;
    });
    setTimeout(() => {
      setErrorCellKey((current) => (current === selectedKey ? null : current));
    }, 600);
  }, [
    clearNotesForPeers,
    difficulty,
    givenCellSet,
    generateNewPuzzle,
    notesMode,
    selected,
    solution,
    triggerErrorShake,
  ]);

  const eraseCell = useCallback(() => {
    if (!selected) {
      return;
    }
    const selectedKey = keyFor(selected.row, selected.col);
    if (givenCellSet.has(selectedKey)) {
      return;
    }
    setEntries((current) => {
      const next = cloneGrid(current);
      next[selected.row][selected.col] = 0;
      return next;
    });
    setNotes((current) => {
      const next = { ...current };
      delete next[selectedKey];
      return next;
    });
    setErrorCellKey((current) => (current === selectedKey ? null : current));
  }, [givenCellSet, selected]);

  const useHint = useCallback(() => {
    if (!selected || hintsUsed >= MAX_HINTS) {
      return;
    }
    const selectedKey = keyFor(selected.row, selected.col);
    if (givenCellSet.has(selectedKey)) {
      return;
    }
    if (entries[selected.row][selected.col] !== 0) {
      return;
    }

    const correctValue = solution[selected.row][selected.col];
    setEntries((current) => {
      const next = cloneGrid(current);
      next[selected.row][selected.col] = correctValue;
      return next;
    });
    setNotes((current) => {
      const next = { ...current };
      delete next[selectedKey];
      return next;
    });
    clearNotesForPeers(selected.row, selected.col, correctValue);
    setHintsUsed((current) => Math.min(MAX_HINTS, current + 1));
  }, [clearNotesForPeers, entries, givenCellSet, hintsUsed, selected, solution]);

  const numberPlacedCount = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let value = 1; value <= 9; value += 1) {
      counts[value] = 0;
    }
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const value = entries[row][col];
        if (value >= 1 && value <= 9) {
          counts[value] += 1;
        }
      }
    }
    return counts;
  }, [entries]);

  const dismissCompletion = useCallback(() => {
    Animated.timing(completionTranslate, {
      toValue: 1000,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowCompletionCard(false);
    });
  }, [completionTranslate]);

  return (
    <View style={[styles.screen, { paddingBottom: bottomPadding }]}>
      <View style={[styles.difficultyRow, { marginTop: topOffset }]}>
        {DIFFICULTIES.map((item) => {
          const active = item === difficulty;
          return (
            <Pressable
              key={item}
              onPress={() => {
                if (!active) {
                  generateNewPuzzle(item);
                }
              }}
              style={[styles.difficultyPill, active ? styles.difficultyPillActive : styles.difficultyPillInactive]}>
              <Text style={active ? styles.difficultyTextActive : styles.difficultyTextInactive}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.metaRow, { marginTop: metaRowTopMargin }]}>
        <Text style={styles.metaText}>{formatTimer(elapsedSeconds)}</Text>
        <Text style={styles.metaText}>Mistakes: {mistakes}/{MAX_MISTAKES}</Text>
      </View>

      <View style={[styles.gridContainer, { marginTop: gridTopMargin, width: gridSize, height: gridSize }]}>
        {Array.from({ length: 9 }).map((_, row) => (
          <View key={`row-${row}`} style={styles.gridRow}>
            {Array.from({ length: 9 }).map((__, col) => {
              const cellKey = keyFor(row, col);
              const value = entries[row][col];
              const isGiven = givenCellSet.has(cellKey);
              const isSelected = Boolean(selected && selected.row === row && selected.col === col);
              const isRelated = Boolean(selected && relatedCell(selected, row, col) && !isSelected);
              const isMatching = Boolean(selectedValue !== 0 && value === selectedValue && !isSelected);
              const isError = errorCellKey === cellKey;
              const isCorrectPlayer = !isGiven && value !== 0 && value === solution[row][col];
              const ring = Math.max(Math.abs(row - 4), Math.abs(col - 4));
              const flash = flashRings.includes(ring);

              const backgroundColor = flash
                ? '#5A7A55'
                : isError
                  ? 'rgba(192, 57, 43, 0.08)'
                  : isSelected
                    ? '#DDD0B8'
                    : isRelated || isMatching
                      ? '#E5D9C4'
                      : '#E8DCC8';

              let textColor = '#A8431A';
              if (isGiven) {
                textColor = '#3A3025';
              } else if (isError) {
                textColor = '#C0392B';
              } else if (isCorrectPlayer) {
                textColor = '#5A7A55';
              } else if (isMatching) {
                textColor = '#A8431A';
              }

              return (
                <Pressable
                  key={cellKey}
                  onPress={() => setSelected({ row, col })}
                  style={[
                    styles.cell,
                    { width: cellSize, height: cellSize, backgroundColor },
                    isSelected && styles.cellSelected,
                  ]}>
                  {value !== 0 ? (
                    <Animated.Text
                      style={[
                        isGiven ? styles.givenNumber : styles.playerNumber,
                        { color: textColor },
                        isError
                          ? {
                              transform: [
                                {
                                  translateX: errorShake.interpolate({
                                    inputRange: [-1, 1],
                                    outputRange: [-4, 4],
                                  }),
                                },
                              ],
                            }
                          : undefined,
                      ]}>
                      {value}
                    </Animated.Text>
                  ) : (
                    <View style={styles.notesWrap}>
                      {Array.from({ length: 9 }).map((__, index) => {
                        const noteValue = index + 1;
                        const hasNote = (notes[cellKey] ?? []).includes(noteValue);
                        if (!hasNote) {
                          return null;
                        }
                        const noteRow = Math.floor(index / 3);
                        const noteCol = index % 3;
                        return (
                          <Text
                            key={`${cellKey}-note-${noteValue}`}
                            style={[
                              styles.noteText,
                              {
                                left: noteCol * (cellSize / 3),
                                top: noteRow * (cellSize / 3),
                                width: cellSize / 3,
                                height: cellSize / 3,
                              },
                            ]}>
                            {noteValue}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}

        {Array.from({ length: 8 }).map((_, lineIndex) => {
          const index = lineIndex + 1;
          return (
          <View
            key={`v-line-${index}`}
            style={[
              styles.gridLineVertical,
              {
                left: index * cellSize,
                width: index % 3 === 0 ? 1.5 : 0.5,
                backgroundColor: index % 3 === 0 ? '#8A7A65' : '#C8BAA0',
              },
            ]}
          />
          );
        })}
        {Array.from({ length: 8 }).map((_, lineIndex) => {
          const index = lineIndex + 1;
          return (
          <View
            key={`h-line-${index}`}
            style={[
              styles.gridLineHorizontal,
              {
                top: index * cellSize,
                height: index % 3 === 0 ? 1.5 : 0.5,
                backgroundColor: index % 3 === 0 ? '#8A7A65' : '#C8BAA0',
              },
            ]}
          />
          );
        })}
      </View>

      <View style={[styles.actionRow, { marginTop: actionTopMargin }]}>
        <Pressable onPress={eraseCell} style={styles.actionItem}>
          <MaterialCommunityIcons name="eraser" size={compact ? 22 : 24} color="#8A7A65" />
          <Text style={styles.actionLabel}>Erase</Text>
        </Pressable>

        <Pressable onPress={() => setNotesMode((current) => !current)} style={styles.actionItem}>
          <Feather name="edit-3" size={compact ? 22 : 24} color={notesMode ? '#A8431A' : '#8A7A65'} />
          <Text style={[styles.actionLabel, notesMode ? styles.notesActive : undefined]}>Notes</Text>
          {notesMode ? <View style={styles.notesUnderline} /> : null}
        </Pressable>

        <Pressable onPress={useHint} style={styles.actionItem}>
          <Feather name="sun" size={compact ? 22 : 24} color={hintsUsed >= MAX_HINTS ? '#C8BAA0' : '#C47840'} />
          <Text style={[styles.actionLabel, { color: hintsUsed >= MAX_HINTS ? '#C8BAA0' : '#C47840' }]}>
            Hint
          </Text>
          <Text style={styles.hintCounter}>{hintsUsed}/{MAX_HINTS}</Text>
        </Pressable>
      </View>

      <View style={[styles.numberPadRow, { marginTop: numberPadTopMargin }]}>
        {Array.from({ length: 9 }).map((_, index) => {
          const value = index + 1;
          const disabled = numberPlacedCount[value] >= 9;
          const scale = numpadScale[index];

          return (
            <Animated.View key={`num-${value}`} style={{ transform: [{ scale }] }}>
              <Pressable
                onPress={() => !disabled && applyNumber(value)}
                onPressIn={() => {
                  Animated.timing(scale, {
                    toValue: 0.92,
                    duration: 80,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(scale, {
                    toValue: 1,
                    speed: 20,
                    bounciness: 8,
                    useNativeDriver: true,
                  }).start();
                }}
                disabled={disabled}
                style={[
                  styles.numberPadButton,
                  compact ? styles.numberPadButtonCompact : null,
                  disabled ? styles.numberPadButtonDisabled : styles.numberPadButtonActive,
                ]}>
                <Text style={disabled ? styles.numberPadTextDisabled : styles.numberPadTextActive}>{value}</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {showCompletionCard ? (
        <Pressable onPress={dismissCompletion} style={styles.completionOverlay}>
          <Animated.View style={[styles.completionCard, { transform: [{ translateY: completionTranslate }] }]}>
            <View style={styles.completionHandle} />
            <Text style={styles.completionTitle}>Puzzle Complete</Text>
            <View style={styles.completionBadge}>
              <Text style={styles.completionBadgeText}>{difficulty}</Text>
            </View>
            <Text style={styles.completionMeta}>Solved in {formatTimer(elapsedSeconds)}</Text>
            <Text style={styles.completionMeta}>{mistakes} mistakes made</Text>

            <Pressable
              onPress={() => generateNewPuzzle(difficulty)}
              style={styles.completionButton}>
              <Text style={styles.completionButtonText}>New Game</Text>
            </Pressable>

            <Text style={[styles.dismissHint, { marginBottom: 32 + insets.bottom }]}>
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
  difficultyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  difficultyPill: {
    height: 36,
    minWidth: 80,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  difficultyPillActive: {
    backgroundColor: '#A8431A',
  },
  difficultyPillInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#8A6040',
  },
  difficultyTextActive: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    color: '#FFFFFF',
    fontSize: 14,
  },
  difficultyTextInactive: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    color: '#6B4A30',
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  metaText: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 15,
    color: '#8A7A65',
  },
  gridContainer: {
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#8A7A65',
    backgroundColor: '#E8DCC8',
    overflow: 'hidden',
    boxShadow:
      'inset 0px 1px 0px 0px rgba(255,255,255,0.4), 0px 1px 3px 0px rgba(0,0,0,0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  gridRow: {
    flexDirection: 'row',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: {
    boxShadow: 'inset 0px 0px 0px 1.5px #A8431A',
  },
  givenNumber: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 18,
    color: '#3A3025',
  },
  playerNumber: {
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 18,
    color: '#A8431A',
  },
  notesWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  noteText: {
    position: 'absolute',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 8,
    color: '#8A7A65',
    lineHeight: 13,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  actionItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  actionLabel: {
    marginTop: 6,
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 12,
    color: '#8A7A65',
  },
  notesActive: {
    color: '#A8431A',
  },
  notesUnderline: {
    marginTop: 4,
    width: 24,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#A8431A',
  },
  hintCounter: {
    marginTop: 2,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 10,
    color: '#C8BAA0',
  },
  numberPadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  numberPadButton: {
    width: 36,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberPadButtonCompact: {
    width: 34,
    height: 44,
  },
  numberPadButtonActive: {
    backgroundColor: '#E8DCC8',
    boxShadow: 'inset 0px 1px 2px 0px rgba(0,0,0,0.05)',
  },
  numberPadButtonDisabled: {
    backgroundColor: 'transparent',
  },
  numberPadTextActive: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 18,
    color: '#3A3025',
  },
  numberPadTextDisabled: {
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 18,
    color: '#C8BAA0',
  },
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  completionCard: {
    marginHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    minHeight: 280,
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
  completionBadge: {
    marginTop: 10,
    height: 30,
    borderRadius: 50,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A8431A',
  },
  completionBadgeText: {
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
    fontSize: 16,
    color: '#FFFFFF',
  },
  dismissHint: {
    marginTop: 'auto',
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 13,
    color: '#C8BAA0',
  },
});
