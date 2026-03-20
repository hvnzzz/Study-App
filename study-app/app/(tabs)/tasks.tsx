import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DesignSystem } from '@/constants/designSystem';
import { triggerTaskCheckHaptic } from '@/lib/haptics';

type TaskItem = {
  id: string;
  title: string;
  completed: boolean;
};

type StorageShape = {
  tasks: TaskItem[];
  routines: TaskItem[];
};

type SectionKind = 'tasks' | 'routines';

const STORAGE_KEY = '@cat_focus_tasks_v1';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function AnimatedCheckbox({
  checked,
  onPress,
}: {
  checked: boolean;
  onPress: () => void;
}) {
  const progress = useMemo(() => new Animated.Value(checked ? 1 : 0), [checked]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: checked ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [checked, progress]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.checkboxOuter}>
      <Animated.View
        style={[
          styles.checkboxFill,
          {
            opacity: progress,
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.checkmarkWrap,
          {
            opacity: progress,
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          },
        ]}>
        <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
      </Animated.View>
    </Pressable>
  );
}

export default function TasksScreen() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [routines, setRoutines] = useState<TaskItem[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [routineInput, setRoutineInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<SectionKind | null>(null);
  const [editingText, setEditingText] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setHydrated(true);
          return;
        }

        const parsed = JSON.parse(raw) as Partial<StorageShape>;
        setTasks(Array.isArray(parsed.tasks) ? parsed.tasks : []);
        setRoutines(Array.isArray(parsed.routines) ? parsed.routines : []);
      } catch (error) {
        console.warn('Failed to load task data', error);
      } finally {
        setHydrated(true);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const payload: StorageShape = { tasks, routines };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch((error) => {
      console.warn('Failed to save task data', error);
    });
  }, [hydrated, tasks, routines]);

  const updateSection = useCallback(
    (section: SectionKind, updater: (items: TaskItem[]) => TaskItem[]) => {
      if (section === 'tasks') {
        setTasks((current) => updater(current));
        return;
      }
      setRoutines((current) => updater(current));
    },
    [],
  );

  const addItem = useCallback(
    (section: SectionKind) => {
      const value = section === 'tasks' ? taskInput : routineInput;
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      const newItem: TaskItem = {
        id: makeId(section),
        title: trimmed,
        completed: false,
      };

      updateSection(section, (current) => [newItem, ...current]);
      if (section === 'tasks') {
        setTaskInput('');
      } else {
        setRoutineInput('');
      }
    },
    [routineInput, taskInput, updateSection],
  );

  const startEditing = useCallback((section: SectionKind, item: TaskItem) => {
    setEditingSection(section);
    setEditingId(item.id);
    setEditingText(item.title);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingSection(null);
    setEditingId(null);
    setEditingText('');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingSection || !editingId) {
      return;
    }

    const nextTitle = editingText.trim();
    if (!nextTitle) {
      return;
    }

    updateSection(editingSection, (current) =>
      current.map((item) =>
        item.id === editingId
          ? {
              ...item,
              title: nextTitle,
            }
          : item,
      ),
    );

    cancelEditing();
  }, [cancelEditing, editingId, editingSection, editingText, updateSection]);

  const toggleChecked = useCallback(
    (section: SectionKind, id: string) => {
      triggerTaskCheckHaptic().catch(() => {
        // Ignore haptics failures.
      });
      updateSection(section, (current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                completed: !item.completed,
              }
            : item,
        ),
      );
    },
    [updateSection],
  );

  const deleteItem = useCallback(
    (section: SectionKind, id: string) => {
      updateSection(section, (current) => current.filter((item) => item.id !== id));
      if (editingId === id && editingSection === section) {
        cancelEditing();
      }
    },
    [cancelEditing, editingId, editingSection, updateSection],
  );

  const renderList = (section: SectionKind, list: TaskItem[]) => {
    if (list.length === 0) {
      return (
        <Text style={styles.emptyLabel}>
          {section === 'tasks' ? 'No tasks yet.' : 'No routines yet.'}
        </Text>
      );
    }

    return list.map((item) => {
      const isEditing = editingId === item.id && editingSection === section;
      return (
        <View
          key={item.id}
          style={[styles.rowBase, item.completed ? styles.rowChecked : styles.rowUnchecked]}>
          <AnimatedCheckbox
            checked={item.completed}
            onPress={() => toggleChecked(section, item.id)}
          />

          {isEditing ? (
            <TextInput
              value={editingText}
              onChangeText={setEditingText}
              style={styles.editInput}
              autoFocus
              placeholder="Edit item"
              placeholderTextColor={DesignSystem.colors.text.secondary}
              maxLength={80}
            />
          ) : (
            <Text
              style={[styles.rowText, item.completed && styles.rowTextCompleted]}
              numberOfLines={1}>
              {item.title}
            </Text>
          )}

          {isEditing ? (
            <View style={styles.rowActions}>
              <Pressable
                onPress={saveEdit}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Save edit">
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={22}
                  color={DesignSystem.colors.text.sessionLabel}
                />
              </Pressable>
              <Pressable
                onPress={cancelEditing}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Cancel edit">
                <MaterialCommunityIcons
                  name="close-circle-outline"
                  size={22}
                  color={DesignSystem.colors.interactive.resetBorder}
                />
              </Pressable>
            </View>
          ) : (
            <View style={styles.rowActions}>
              <Pressable
                onPress={() => startEditing(section, item)}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Edit item">
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={20}
                  color={DesignSystem.colors.text.secondary}
                />
              </Pressable>
              <Pressable
                onPress={() => deleteItem(section, item.id)}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Delete item">
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={20}
                  color={DesignSystem.colors.interactive.ctaFill}
                />
              </Pressable>
            </View>
          )}
        </View>
      );
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Tasks</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={taskInput}
              onChangeText={setTaskInput}
              style={styles.addInput}
              placeholder="Add a task..."
              placeholderTextColor={DesignSystem.colors.text.secondary}
              onSubmitEditing={() => addItem('tasks')}
              returnKeyType="done"
              maxLength={80}
            />
            <Pressable
              onPress={() => addItem('tasks')}
              style={styles.addButton}
              accessibilityRole="button"
              accessibilityLabel="Add task">
              <MaterialCommunityIcons
                name="plus"
                size={22}
                color={DesignSystem.colors.text.cta}
              />
            </Pressable>
          </View>
          {renderList('tasks', tasks)}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Routines</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={routineInput}
              onChangeText={setRoutineInput}
              style={styles.addInput}
              placeholder="Add a daily routine..."
              placeholderTextColor={DesignSystem.colors.text.secondary}
              onSubmitEditing={() => addItem('routines')}
              returnKeyType="done"
              maxLength={80}
            />
            <Pressable
              onPress={() => addItem('routines')}
              style={styles.addButton}
              accessibilityRole="button"
              accessibilityLabel="Add routine">
              <MaterialCommunityIcons
                name="plus"
                size={22}
                color={DesignSystem.colors.text.cta}
              />
            </Pressable>
          </View>
          {renderList('routines', routines)}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DesignSystem.colors.backgrounds.pageFill,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  sectionBlock: {
    marginBottom: 26,
  },
  sectionHeader: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 20,
    color: '#2A2018',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  addInput: {
    flex: 1,
    height: 46,
    borderRadius: 24,
    backgroundColor: DesignSystem.colors.backgrounds.cardBg,
    paddingHorizontal: 16,
    color: DesignSystem.colors.text.primary,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 15,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DesignSystem.colors.interactive.ctaFill,
    ...DesignSystem.shadows.ctaButton,
  },
  rowBase: {
    minHeight: 56,
    borderRadius: 50,
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  rowUnchecked: {
    backgroundColor: DesignSystem.colors.backgrounds.taskUnchecked,
    boxShadow: 'inset 0px 1px 2px 0px rgba(0,0,0,0.05)',
  },
  rowChecked: {
    backgroundColor: DesignSystem.colors.backgrounds.taskChecked,
    boxShadow: 'inset 0px 1px 3px 0px rgba(0,0,0,0.08)',
  },
  checkboxOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D7CAB3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  checkboxFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#8A7A65',
    borderRadius: 14,
  },
  checkmarkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    fontFamily: DesignSystem.fonts.bodyRegular,
    color: DesignSystem.colors.text.primary,
    fontSize: 15,
  },
  rowTextCompleted: {
    color: DesignSystem.colors.text.secondary,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 2,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editInput: {
    flex: 1,
    height: 38,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 12,
    color: DesignSystem.colors.text.primary,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 15,
  },
  emptyLabel: {
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 14,
    color: DesignSystem.colors.text.secondary,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
