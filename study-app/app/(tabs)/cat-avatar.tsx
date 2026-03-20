import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatAvatarStage } from '@/components/cat/CatAvatarStage';
import { FurShopCircle } from '@/components/cat/FurShopCircle';
import { CAT_SHOP_ITEMS, type CatShopItem } from '@/constants/catShopItems';
import { DesignSystem } from '@/constants/designSystem';
import { CatCoinIcon } from '@/components/CatCoinIcon';
import {
  CatEquipState,
  DEFAULT_CAT_EQUIP,
  getCatCoins,
  getEquippedState,
  getOwnedItems,
  setCatCoins,
  setEquippedState,
  setOwnedItems,
} from '@/lib/catStorage';

const PRICE_COLORS = {
  affordable: '#C47840',
  unaffordable: '#C8BAA0',
};

export default function CatAvatarScreen() {
  const insets = useSafeAreaInsets();
  const [coins, setCoins] = useState(0);
  const [displayCoins, setDisplayCoins] = useState(0);
  const [owned, setOwned] = useState<string[]>([]);
  const [equip, setEquip] = useState<CatEquipState>(DEFAULT_CAT_EQUIP);
  const [pendingPurchase, setPendingPurchase] = useState<CatShopItem | null>(null);
  const [notEnoughFor, setNotEnoughFor] = useState<string | null>(null);

  const animatedCoin = useRef(new Animated.Value(0)).current;
  const purchaseTranslate = useRef(new Animated.Value(1000)).current;
  const shakeMap = useRef<Record<string, Animated.Value>>({}).current;

  const loadState = useCallback(async () => {
    const [coinBalance, ownedItems, equipped] = await Promise.all([
      getCatCoins(),
      getOwnedItems(),
      getEquippedState(),
    ]);
    setCoins(coinBalance);
    setDisplayCoins(coinBalance);
    setOwned(ownedItems);
    setEquip(equipped);
    animatedCoin.setValue(coinBalance);
  }, [animatedCoin]);

  useEffect(() => {
    const id = animatedCoin.addListener(({ value }) => {
      setDisplayCoins(Math.max(0, Math.floor(value)));
    });
    return () => {
      animatedCoin.removeListener(id);
    };
  }, [animatedCoin]);

  useFocusEffect(
    useCallback(() => {
      loadState().catch(() => {
        // Ignore refresh errors.
      });
    }, [loadState]),
  );

  const animateCoinsTo = useCallback(
    (nextValue: number) => {
      Animated.timing(animatedCoin, {
        toValue: nextValue,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [animatedCoin],
  );

  const showPurchaseSheet = (item: CatShopItem) => {
    setPendingPurchase(item);
    purchaseTranslate.setValue(1000);
    Animated.timing(purchaseTranslate, {
      toValue: 0,
      duration: 350,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: true,
    }).start();
  };

  const closePurchaseSheet = useCallback(() => {
    Animated.timing(purchaseTranslate, {
      toValue: 1000,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setPendingPurchase(null));
  }, [purchaseTranslate]);

  const handleEquipToggle = useCallback(
    async (item: CatShopItem) => {
      const next: CatEquipState = {
        fur: equip.fur === item.id ? 'fur-grey' : item.id,
      };
      setEquip(next);
      await setEquippedState(next);
    },
    [equip],
  );

  const ensureOwned = useCallback(
    async (itemId: string) => {
      if (owned.includes(itemId)) {
        return owned;
      }
      const next = [...owned, itemId];
      setOwned(next);
      await setOwnedItems(next);
      return next;
    },
    [owned],
  );

  const handleCardPress = useCallback(
    async (item: CatShopItem) => {
      const isOwned = owned.includes(item.id) || item.price === 0;
      if (isOwned) {
        await ensureOwned(item.id);
        await handleEquipToggle(item);
        return;
      }
      if (coins < item.price) {
        const key = item.id;
        if (!shakeMap[key]) {
          shakeMap[key] = new Animated.Value(0);
        }
        setNotEnoughFor(key);
        Animated.sequence([
          Animated.timing(shakeMap[key], { toValue: 1, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeMap[key], { toValue: -1, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeMap[key], { toValue: 1, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeMap[key], { toValue: -1, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeMap[key], { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
        setTimeout(() => setNotEnoughFor((current) => (current === key ? null : current)), 1150);
        return;
      }
      showPurchaseSheet(item);
    },
    [coins, ensureOwned, handleEquipToggle, owned, shakeMap],
  );

  const confirmPurchase = useCallback(async () => {
    if (!pendingPurchase) {
      return;
    }
    const nextCoins = Math.max(0, coins - pendingPurchase.price);
    const nextOwned = owned.includes(pendingPurchase.id) ? owned : [...owned, pendingPurchase.id];
    const nextEquip: CatEquipState = {
      fur: pendingPurchase.id,
    };

    await Promise.all([setCatCoins(nextCoins), setOwnedItems(nextOwned), setEquippedState(nextEquip)]);
    setCoins(nextCoins);
    setOwned(nextOwned);
    setEquip(nextEquip);
    animateCoinsTo(nextCoins);
    closePurchaseSheet();
  }, [animateCoinsTo, closePurchaseSheet, coins, equip, owned, pendingPurchase]);

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + 8 }]}>
      <View style={[styles.coinBar, { marginTop: insets.top + 16 }]}>
        <View style={styles.coinLeft}>
          <CatCoinIcon size={18} />
          <Text style={styles.coinText}>{displayCoins} coins</Text>
        </View>
        <Text style={styles.earnHint}>Earn coins by studying</Text>
      </View>

      <CatAvatarStage equip={equip} />

      <Text style={styles.sectionTitle}>Fur colors</Text>

      <ScrollView contentContainerStyle={styles.itemGrid} showsVerticalScrollIndicator={false}>
        {CAT_SHOP_ITEMS.map((item) => {
          const isOwned = owned.includes(item.id) || item.defaultOwned === true || item.price === 0;
          const isEquipped = equip.fur === item.id;
          const canAfford = coins >= item.price;
          if (!shakeMap[item.id]) {
            shakeMap[item.id] = new Animated.Value(0);
          }
          const shakeX = shakeMap[item.id].interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] });
          const priceColor = canAfford ? PRICE_COLORS.affordable : PRICE_COLORS.unaffordable;

          return (
            <Animated.View key={item.id} style={[styles.itemCard, { transform: [{ translateX: shakeX }] }]}>
              <Pressable onPress={() => void handleCardPress(item)} style={styles.itemCardInner}>
                <FurShopCircle fill={item.furHex ?? '#A8B4C0'} selected={isEquipped} />
                <Text style={styles.itemName}>{item.name}</Text>
                {isEquipped ? (
                  <Text style={styles.statusEquipped}>Equipped ✓</Text>
                ) : isOwned ? (
                  <Text style={styles.statusOwned}>Owned</Text>
                ) : (
                  <View style={styles.priceRow}>
                    <CatCoinIcon size={14} />
                    <Text style={[styles.priceText, { color: priceColor }]}>{item.price}</Text>
                  </View>
                )}
                {notEnoughFor === item.id ? <Text style={styles.notEnough}>Not enough coins</Text> : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      {pendingPurchase ? (
        <Pressable onPress={closePurchaseSheet} style={styles.sheetOverlay}>
          <Animated.View style={[styles.sheetCard, { transform: [{ translateY: purchaseTranslate }] }]}>
            <View style={styles.handle} />
            <FurShopCircle fill={pendingPurchase.furHex ?? '#A8B4C0'} selected />
            <Text style={styles.sheetTitle}>{pendingPurchase.name}</Text>
            <View style={styles.sheetPrice}>
              <CatCoinIcon size={18} />
              <Text style={styles.sheetPriceText}>{pendingPurchase.price} coins</Text>
            </View>
            <Text style={styles.sheetBalanceText}>
              Balance after: {Math.max(0, coins - pendingPurchase.price)} coins
            </Text>
            <Pressable onPress={() => void confirmPurchase()} style={styles.buyButton}>
              <Text style={styles.buyButtonText}>Buy & Equip</Text>
            </Pressable>
            <Pressable onPress={closePurchaseSheet}>
              <Text style={[styles.cancelText, { marginBottom: 32 + insets.bottom }]}>Cancel</Text>
            </Pressable>
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
  coinBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  coinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coinText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 17,
    color: '#3A3025',
  },
  earnHint: {
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 13,
    color: '#8A7A65',
  },
  sectionTitle: {
    marginTop: 20,
    paddingHorizontal: 24,
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 16,
    color: '#3A3025',
  },
  itemGrid: {
    marginTop: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 120,
  },
  itemCard: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: '#E8DCC8',
    boxShadow: 'inset 0px 1px 0px 0px rgba(255,255,255,0.4), 0px 1px 3px 0px rgba(0,0,0,0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  itemCardInner: {
    padding: 12,
    alignItems: 'center',
    minHeight: 152,
  },
  itemName: {
    marginTop: 8,
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 13,
    color: '#3A3025',
    textAlign: 'center',
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 13,
  },
  statusOwned: {
    marginTop: 8,
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 12,
    color: '#5A7A55',
  },
  statusEquipped: {
    marginTop: 8,
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 12,
    color: '#A8431A',
  },
  notEnough: {
    marginTop: 4,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 12,
    color: '#8A7A65',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    marginHorizontal: 16,
    minHeight: 200,
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
  handle: {
    marginTop: 12,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C8BAA0',
  },
  sheetTitle: {
    marginTop: 12,
    fontFamily: DesignSystem.fonts.display,
    fontSize: 20,
    color: '#A0522D',
    textAlign: 'center',
  },
  sheetPrice: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetPriceText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 17,
    color: '#3A3025',
  },
  sheetBalanceText: {
    marginTop: 6,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 13,
    color: '#8A7A65',
  },
  buyButton: {
    marginTop: 20,
    width: 155,
    height: 52,
    borderRadius: 50,
    backgroundColor: '#A8431A',
    alignItems: 'center',
    justifyContent: 'center',
    ...DesignSystem.shadows.ctaButton,
  },
  buyButtonText: {
    fontFamily: DesignSystem.fonts.bodyBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  cancelText: {
    marginTop: 12,
    fontFamily: DesignSystem.fonts.bodyRegular,
    fontSize: 13,
    color: '#8A7A65',
  },
});
