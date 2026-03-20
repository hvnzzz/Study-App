import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DesignSystem } from '@/constants/designSystem';

type TabIconProps = {
  iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  focused: boolean;
  color: string;
};

function TabIcon({ iconName, focused, color }: TabIconProps) {
  return (
    <View style={styles.iconWrapper}>
      <View style={[styles.indicator, !focused && styles.indicatorHidden]} />
      <MaterialCommunityIcons name={iconName} size={24} color={color} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: DesignSystem.colors.text.primary,
        tabBarInactiveTintColor: DesignSystem.colors.text.secondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
      }}>
      <Tabs.Screen
        name="focus"
        options={{
          title: 'Focus',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iconName="timer-sand" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iconName="check-circle-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iconName="fish" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: 'Games',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iconName="gamepad-variant-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cat-avatar"
        options={{
          title: 'Avatar',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iconName="paw" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iconName="cog-outline" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: DesignSystem.colors.backgrounds.pageFill,
    borderTopColor: 'transparent',
    elevation: 0,
    height: 72,
    paddingTop: 4,
  },
  label: {
    fontFamily: DesignSystem.fonts.bodyMedium,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 6,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 30,
    height: 32,
  },
  indicator: {
    width: 24,
    height: 3,
    borderRadius: 999,
    backgroundColor: DesignSystem.colors.interactive.ctaFill,
    marginBottom: 4,
  },
  indicatorHidden: {
    backgroundColor: 'transparent',
  },
});
