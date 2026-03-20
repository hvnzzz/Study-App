import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DesignSystem } from '@/constants/designSystem';
import {
  CAUGHT_FISH_STORAGE_KEY,
  CAT_COINS_STORAGE_KEY,
  EQUIPPED_COSMETIC_STORAGE_KEY,
  PURCHASED_SHOP_ITEMS_STORAGE_KEY,
  TOTAL_SESSIONS_STORAGE_KEY,
} from '@/constants/appSettings';
import { CaughtFishRecord } from '@/lib/fishingGame';
import { fishCatalog } from '@/constants/fish';
import { SHOP_ITEMS } from '@/lib/shopItems';
import { CatCoinIcon } from '@/components/CatCoinIcon';

type CollectionView = 'fishDex' | 'shop';

export default function CollectionScreen() {
  const [activeView, setActiveView] = useState<CollectionView>('fishDex');
  const [caughtFish, setCaughtFish] = useState<CaughtFishRecord[]>([]);
  const [totalSessionsCompleted, setTotalSessionsCompleted] = useState(0);
  const [catCoins, setCatCoins] = useState(0);
  const [purchasedItemIds, setPurchasedItemIds] = useState<string[]>([]);
  const [equippedItemId, setEquippedItemId] = useState<string | null>(null);

  const loadCollectionData = useCallback(async () => {
    try {
      const [caughtRaw, sessionsRaw, coinsRaw, purchasedRaw, equippedRaw] = await AsyncStorage.multiGet([
        CAUGHT_FISH_STORAGE_KEY,
        TOTAL_SESSIONS_STORAGE_KEY,
        CAT_COINS_STORAGE_KEY,
        PURCHASED_SHOP_ITEMS_STORAGE_KEY,
        EQUIPPED_COSMETIC_STORAGE_KEY,
      ]);

      const caughtValue = caughtRaw[1];
      const sessionsValue = sessionsRaw[1];
      const coinsValue = coinsRaw[1];
      const purchasedValue = purchasedRaw[1];
      const equippedValue = equippedRaw[1];

      const parsedCaught = caughtValue ? (JSON.parse(caughtValue) as CaughtFishRecord[]) : [];
      const parsedSessions = Number(sessionsValue ?? '0');
      const parsedCoins = Number(coinsValue ?? '0');
      const parsedPurchased = purchasedValue ? (JSON.parse(purchasedValue) as string[]) : [];

      setCaughtFish(Array.isArray(parsedCaught) ? parsedCaught : []);
      setTotalSessionsCompleted(Number.isFinite(parsedSessions) ? parsedSessions : 0);
      setCatCoins(Number.isFinite(parsedCoins) ? parsedCoins : 0);
      setPurchasedItemIds(Array.isArray(parsedPurchased) ? parsedPurchased : []);
      setEquippedItemId(equippedValue ?? null);
    } catch (error) {
      console.warn('Failed to load collection data', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCollectionData();
    }, [loadCollectionData]),
  );

  const caughtSpeciesSet = useMemo(
    () => new Set(caughtFish.map((record) => record.species)),
    [caughtFish],
  );

  const buyItem = useCallback(
    async (itemId: string, price: number) => {
      if (purchasedItemIds.includes(itemId) || catCoins < price) {
        return;
      }

      const nextCoins = catCoins - price;
      const nextPurchased = [...purchasedItemIds, itemId];

      try {
        await AsyncStorage.multiSet([
          [CAT_COINS_STORAGE_KEY, String(nextCoins)],
          [PURCHASED_SHOP_ITEMS_STORAGE_KEY, JSON.stringify(nextPurchased)],
        ]);
        setCatCoins(nextCoins);
        setPurchasedItemIds(nextPurchased);
      } catch (error) {
        console.warn('Failed to purchase shop item', error);
      }
    },
    [catCoins, purchasedItemIds],
  );

  const equipItem = useCallback(
    async (itemId: string) => {
      if (!purchasedItemIds.includes(itemId)) {
        return;
      }

      try {
        await AsyncStorage.setItem(EQUIPPED_COSMETIC_STORAGE_KEY, itemId);
        setEquippedItemId(itemId);
      } catch (error) {
        console.warn('Failed to equip item', error);
      }
    },
    [purchasedItemIds],
  );

  return (
    <View style={styles.container}>
      <View style={styles.statsCard}>
        <View style={styles.statsColumn}>
          <MaterialCommunityIcons name="clock-check-outline" size={20} color="#C47840" />
          <Text style={styles.statsValue}>{totalSessionsCompleted}</Text>
          <Text style={styles.statsLabel}>Sessions</Text>
        </View>

        <View style={styles.statsDivider} />

        <View style={styles.statsColumn}>
          <MaterialCommunityIcons name="fish" size={20} color="#C47840" />
          <Text style={styles.statsValue}>{caughtFish.length}</Text>
          <Text style={styles.statsLabel}>Fish Caught</Text>
        </View>
      </View>

      <View style={styles.viewToggle}>
        <Pressable
          onPress={() => setActiveView('fishDex')}
          style={[styles.toggleButton, activeView === 'fishDex' && styles.toggleButtonActive]}>
          <Text
            style={[
              styles.toggleText,
              activeView === 'fishDex' ? styles.toggleTextActive : styles.toggleTextInactive,
            ]}>
            Fish Dex
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveView('shop')}
          style={[styles.toggleButton, activeView === 'shop' && styles.toggleButtonActive]}>
          <Text
            style={[
              styles.toggleText,
              activeView === 'shop' ? styles.toggleTextActive : styles.toggleTextInactive,
            ]}>
            Shop
          </Text>
        </Pressable>
      </View>

      {activeView === 'fishDex' ? (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          style={styles.contentArea}>
          {fishCatalog.map((fish) => {
            const isCaught = caughtSpeciesSet.has(fish.name);
            return (
              <View key={fish.id} style={styles.fishCard}>
                {isCaught ? (
                  <>
                    <Image source={fish.image} style={styles.fishImage} resizeMode="contain" />
                    <Text style={styles.fishName}>{fish.name}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.fishHiddenEmoji}>🐟</Text>
                    <Text style={styles.fishUnknown}>?</Text>
                    <Text style={styles.fishNameHidden}>Unknown Fish</Text>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.contentArea}>
          <View style={styles.coinsCard}>
            <Text style={styles.coinsLabel}>Cat Coins</Text>
            <View style={styles.coinsValueRow}>
              <CatCoinIcon size={22} />
              <Text style={styles.coinsValue}>{catCoins}</Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.shopList}
            style={styles.contentArea}>
            {SHOP_ITEMS.map((item) => {
              const isPurchased = purchasedItemIds.includes(item.id);
              const isEquipped = equippedItemId === item.id;
              const canAfford = catCoins >= item.price;
              const buyDisabled = isPurchased || !canAfford;

              let buttonLabel = `Buy (${item.price})`;
              if (isEquipped) {
                buttonLabel = 'Equipped';
              } else if (isPurchased) {
                buttonLabel = 'Equip';
              }

              return (
                <View key={item.id} style={styles.shopItemRow}>
                  <View style={styles.shopItemTextWrap}>
                    <Text style={styles.shopItemName}>{item.name}</Text>
                    <Text style={styles.shopItemDescription}>{item.description}</Text>
                  </View>

                  {isPurchased ? (
                    <Pressable
                      onPress={() => equipItem(item.id)}
                      disabled={isEquipped}
                      style={[styles.shopActionButton, isEquipped && styles.shopActionButtonDisabled]}>
                      <Text style={styles.shopActionButtonText}>{buttonLabel}</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => buyItem(item.id, item.price)}
                      disabled={buyDisabled}
                      style={[styles.shopActionButton, buyDisabled && styles.shopActionButtonDisabled]}>
                      <Text
                        style={[
                          styles.shopActionButtonText,
                          !canAfford && styles.shopActionTextDisabled,
                        ]}>
                        {buttonLabel}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignSystem.colors.backgrounds.pageFill,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statsCard: {
    width: '100%',
    height: 72,
    borderRadius: 20,
    backgroundColor: DesignSystem.colors.backgrounds.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: 'inset 0px 1px 0px 0px rgba(255,255,255,0.4), 0px 1px 3px 0px rgba(0,0,0,0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  statsColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#C8BAA0',
  },
  statsValue: {
    marginTop: 2,
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 18,
    color: DesignSystem.colors.text.primary,
  },
  statsLabel: {
    marginTop: 1,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 13,
    color: DesignSystem.colors.text.secondary,
  },
  viewToggle: {
    marginTop: 14,
    marginBottom: 12,
    flexDirection: 'row',
    backgroundColor: DesignSystem.colors.backgrounds.cardBg,
    borderRadius: 999,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: DesignSystem.colors.interactive.ctaFill,
  },
  toggleText: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 14,
  },
  toggleTextActive: {
    color: DesignSystem.colors.text.cta,
  },
  toggleTextInactive: {
    color: DesignSystem.colors.text.primary,
  },
  contentArea: {
    flex: 1,
  },
  grid: {
    paddingBottom: 120,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  fishCard: {
    width: '48.5%',
    minHeight: 112,
    borderRadius: 16,
    backgroundColor: DesignSystem.colors.backgrounds.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  fishImage: {
    width: 64,
    height: 44,
    marginBottom: 6,
  },
  fishName: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 14,
    color: DesignSystem.colors.text.primary,
    textAlign: 'center',
  },
  fishHiddenEmoji: {
    fontSize: 30,
    marginBottom: 2,
    opacity: 0.18,
  },
  fishUnknown: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 20,
    color: '#8A7A65',
  },
  fishNameHidden: {
    marginTop: 2,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 12,
    color: '#8A7A65',
    opacity: 0.85,
  },
  coinsCard: {
    height: 72,
    borderRadius: 20,
    backgroundColor: DesignSystem.colors.backgrounds.cardBg,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    boxShadow: 'inset 0px 1px 0px 0px rgba(255,255,255,0.4), 0px 1px 3px 0px rgba(0,0,0,0.06)',
  },
  coinsLabel: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 18,
    color: '#2A2018',
  },
  coinsValue: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 22,
    color: DesignSystem.colors.text.timerDigits,
  },
  coinsValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shopList: {
    paddingBottom: 120,
    gap: 10,
  },
  shopItemRow: {
    borderRadius: 16,
    backgroundColor: DesignSystem.colors.backgrounds.cardBg,
    padding: 14,
  },
  shopItemTextWrap: {
    marginBottom: 10,
  },
  shopItemName: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 16,
    color: DesignSystem.colors.text.primary,
    marginBottom: 4,
  },
  shopItemDescription: {
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 13,
    color: DesignSystem.colors.text.secondary,
  },
  shopActionButton: {
    alignSelf: 'flex-end',
    minWidth: 108,
    height: 38,
    borderRadius: 50,
    backgroundColor: DesignSystem.colors.interactive.ctaFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  shopActionButtonDisabled: {
    backgroundColor: '#BDAE97',
  },
  shopActionButtonText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 13,
    color: DesignSystem.colors.text.cta,
  },
  shopActionTextDisabled: {
    color: '#EFE7D8',
  },
});
