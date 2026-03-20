import { StyleSheet, View } from 'react-native';

type CatCoinIconProps = {
  size?: number;
};

export function CatCoinIcon({ size = 22 }: CatCoinIconProps) {
  const ringInset = Math.max(2, Math.round(size * 0.14));
  const coreInset = Math.max(4, Math.round(size * 0.27));

  return (
    <View style={[styles.coin, { width: size, height: size, borderRadius: size / 2 }]}>
      <View
        style={[
          styles.ring,
          {
            top: ringInset,
            left: ringInset,
            right: ringInset,
            bottom: ringInset,
            borderRadius: (size - ringInset * 2) / 2,
          },
        ]}
      />
      <View
        style={[
          styles.core,
          {
            top: coreInset,
            left: coreInset,
            right: coreInset,
            bottom: coreInset,
            borderRadius: (size - coreInset * 2) / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  coin: {
    backgroundColor: '#D4A63D',
    borderWidth: 1,
    borderColor: '#A87918',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#E8C46A',
    backgroundColor: 'transparent',
  },
  core: {
    position: 'absolute',
    backgroundColor: '#E5BB55',
  },
});
