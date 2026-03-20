import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DesignSystem } from '@/constants/designSystem';
import {
  CAUGHT_FISH_STORAGE_KEY,
  CAT_EQUIPPED_STORAGE_KEY,
  CAT_COINS_STORAGE_KEY,
  CAT_OWNED_ITEMS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  LEGACY_CAT_COINS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  normalizeSettings,
} from '@/constants/appSettings';
import { getCatCoins, setCatCoins as persistCatCoins } from '@/lib/catStorage';

function StepperRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (nextValue: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const commitDraft = () => {
    const parsed = Number(draftValue);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
      return;
    }
    setDraftValue(String(value));
  };

  return (
    <View style={styles.pillRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepperWrap}>
        <Pressable
          onPress={() => onChange(value - 1)}
          style={styles.stepperButton}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}>
          <Text style={styles.stepperText}>-</Text>
        </Pressable>
        <TextInput
          value={draftValue}
          onChangeText={(text) => setDraftValue(text.replace(/[^0-9]/g, ''))}
          onBlur={commitDraft}
          onSubmitEditing={commitDraft}
          keyboardType="number-pad"
          style={styles.stepperInput}
          maxLength={3}
          returnKeyType="done"
        />
        <Pressable
          onPress={() => onChange(value + 1)}
          style={styles.stepperButton}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}>
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.pillRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: '#C8BAA0',
          true: '#A8431A',
        }}
        thumbColor={value ? '#FFFFFF' : '#F5EFE1'}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [catCoins, setCatCoins] = useState(0);
  const [coinAmountDraft, setCoinAmountDraft] = useState('10');

  const loadCoinBalance = useCallback(async () => {
    try {
      const parsed = await getCatCoins();
      setCatCoins(parsed);
    } catch (error) {
      console.warn('Failed to load coin balance', error);
      setCatCoins(0);
    }
  }, []);

  useEffect(() => {
    async function loadSavedSettings() {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_APP_SETTINGS>;
        setSettings(normalizeSettings(parsed));
      } catch (error) {
        console.warn('Failed to load settings', error);
      }
    }

    loadSavedSettings();
    loadCoinBalance();
  }, [loadCoinBalance]);

  const saveSettings = useCallback(async () => {
    const normalized = normalizeSettings(settings);
    setIsSaving(true);
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
      setSettings(normalized);
      Alert.alert('Saved', 'All settings updated.');
    } catch (error) {
      console.warn('Failed to save settings', error);
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const updateNumber = (key: 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakInterval', nextValue: number) => {
    setSettings((current) => normalizeSettings({ ...current, [key]: nextValue }));
  };

  const resetCollectionData = useCallback(() => {
    Alert.alert('Reset Collection?', 'This will clear all caught fish and Cat Coins.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              CAUGHT_FISH_STORAGE_KEY,
              CAT_COINS_STORAGE_KEY,
              LEGACY_CAT_COINS_STORAGE_KEY,
              CAT_OWNED_ITEMS_STORAGE_KEY,
              CAT_EQUIPPED_STORAGE_KEY,
              'fishCollection',
              'catCoins',
              'caughtFish',
            ]);
            setCatCoins(0);
            Alert.alert('Collection Reset', 'Fish collection and Cat Coins have been cleared.');
          } catch (error) {
            console.warn('Failed to reset collection data', error);
            Alert.alert('Error', 'Could not reset collection data.');
          }
        },
      },
    ]);
  }, []);

  const adjustCoins = useCallback(async (direction: 'add' | 'take') => {
    const amount = Number(coinAmountDraft);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a number greater than 0.');
      return;
    }

    const signed = direction === 'add' ? amount : -amount;
    const nextValue = Math.max(0, catCoins + signed);
    try {
      await persistCatCoins(nextValue);
      setCatCoins(nextValue);
    } catch (error) {
      console.warn('Failed to update coin balance', error);
      Alert.alert('Error', 'Could not update Cat Coins.');
    }
  }, [catCoins, coinAmountDraft]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeader}>Timer</Text>
        <StepperRow
          label="Focus session length"
          value={settings.focusMinutes}
          onChange={(value) => updateNumber('focusMinutes', value)}
        />
        <StepperRow
          label="Short break length"
          value={settings.shortBreakMinutes}
          onChange={(value) => updateNumber('shortBreakMinutes', value)}
        />
        <StepperRow
          label="Long break length"
          value={settings.longBreakMinutes}
          onChange={(value) => updateNumber('longBreakMinutes', value)}
        />
        <StepperRow
          label="Long break interval"
          value={settings.longBreakInterval}
          onChange={(value) => updateNumber('longBreakInterval', value)}
        />
        <ToggleRow
          label="Auto-start break"
          value={settings.autoStartBreak}
          onChange={(value) => setSettings((current) => ({ ...current, autoStartBreak: value }))}
        />
        <ToggleRow
          label="Auto-start focus"
          value={settings.autoStartFocus}
          onChange={(value) => setSettings((current) => ({ ...current, autoStartFocus: value }))}
        />

        <Text style={styles.sectionHeader}>Notifications</Text>
        <ToggleRow
          label="Session end notification"
          value={settings.sessionEndNotification}
          onChange={(value) =>
            setSettings((current) => ({ ...current, sessionEndNotification: value }))
          }
        />
        <ToggleRow
          label="Break end notification"
          value={settings.breakEndNotification}
          onChange={(value) => setSettings((current) => ({ ...current, breakEndNotification: value }))}
        />

        <Text style={styles.sectionHeader}>Data</Text>
        <View style={styles.pillRow}>
          <Text style={styles.rowLabel}>Cat Coins (test)</Text>
          <Text style={styles.coinBalanceValue}>{catCoins}</Text>
        </View>
        <View style={[styles.pillRow, styles.coinAdjustRow]}>
          <TextInput
            value={coinAmountDraft}
            onChangeText={(text) => setCoinAmountDraft(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            returnKeyType="done"
            style={styles.coinAmountInput}
            maxLength={6}
          />
          <View style={styles.coinAdjustButtons}>
            <Pressable onPress={() => void adjustCoins('add')} style={styles.coinAdjustButton}>
              <Text style={styles.coinAdjustButtonText}>Give</Text>
            </Pressable>
            <Pressable onPress={() => void adjustCoins('take')} style={styles.coinAdjustButton}>
              <Text style={styles.coinAdjustButtonText}>Take</Text>
            </Pressable>
          </View>
        </View>
        <Pressable onPress={resetCollectionData} style={[styles.pillRow, styles.resetRow]}>
          <Text style={styles.resetLabel}>Reset fish collection</Text>
        </Pressable>

        <Pressable onPress={saveSettings} disabled={isSaving} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Settings'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignSystem.colors.backgrounds.pageFill,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  sectionHeader: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 20,
    color: '#2A2018',
    marginTop: 4,
    marginBottom: 10,
  },
  pillRow: {
    height: 56,
    borderRadius: 50,
    backgroundColor: DesignSystem.colors.backgrounds.taskUnchecked,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
    boxShadow: 'inset 0px 1px 2px 0px rgba(0,0,0,0.05)',
  },
  rowLabel: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 15,
    color: DesignSystem.colors.text.primary,
    flex: 1,
    marginRight: 10,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 16,
    backgroundColor: DesignSystem.colors.backgrounds.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 18,
    color: DesignSystem.colors.text.primary,
    lineHeight: 20,
  },
  stepperInput: {
    width: 34,
    textAlign: 'center',
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 16,
    color: DesignSystem.colors.text.primary,
    paddingVertical: 0,
  },
  coinBalanceValue: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 18,
    color: DesignSystem.colors.text.primary,
  },
  coinAdjustRow: {
    gap: 10,
  },
  coinAmountInput: {
    width: 72,
    height: 36,
    borderRadius: 14,
    backgroundColor: DesignSystem.colors.backgrounds.cardBg,
    textAlign: 'center',
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 16,
    color: DesignSystem.colors.text.primary,
    paddingVertical: 0,
  },
  coinAdjustButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  coinAdjustButton: {
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DesignSystem.colors.backgrounds.cardBg,
  },
  coinAdjustButtonText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 14,
    color: DesignSystem.colors.interactive.ctaFill,
  },
  resetRow: {
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: DesignSystem.colors.interactive.resetBorder,
    backgroundColor: DesignSystem.colors.backgrounds.pageFill,
  },
  resetLabel: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 15,
    color: DesignSystem.colors.interactive.ctaFill,
  },
  saveButtonText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 17,
    color: DesignSystem.colors.text.cta,
  },
  saveButton: {
    marginTop: 8,
    height: 54,
    borderRadius: 50,
    backgroundColor: DesignSystem.colors.interactive.ctaFill,
    alignItems: 'center',
    justifyContent: 'center',
    ...DesignSystem.shadows.ctaButton,
  },
});
