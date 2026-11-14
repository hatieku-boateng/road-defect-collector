import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View, type ColorValue } from 'react-native';

import AppBootstrap from '@/components/app-bootstrap';
import { palette } from '@/constants/theme';

const tabIcon = (symbol: string, isPrimaryAction = false) =>
  function TabBarIcon({
    color,
    focused,
  }: {
    color: ColorValue;
    focused: boolean;
  }) {
    if (isPrimaryAction) {
      return (
        <View
          style={[
            styles.actionIconWrap,
            focused && styles.actionIconWrapActive,
          ]}>
          <Text style={styles.actionIconText}>{symbol}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.iconPill, focused && styles.iconPillActive]}>
        <Text
          style={[
            styles.iconSymbol,
            { color },
            focused && styles.iconSymbolActive,
          ]}>
          {symbol}
        </Text>
      </View>
    );
  };

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <AppBootstrap />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: palette.canvas },
          tabBarActiveTintColor: palette.primary,
          tabBarHideOnKeyboard: true,
          tabBarInactiveTintColor: palette.muted,
          tabBarItemStyle: styles.tabBarItem,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarStyle: styles.tabBar,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: tabIcon('⌂'),
          }}
        />
        <Tabs.Screen
          name="report"
          options={{
            title: 'Report',
            tabBarIcon: tabIcon('＋', true),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: 'My reports',
            tabBarIcon: tabIcon('◷'),
          }}
        />
        <Tabs.Screen
          name="public"
          options={{
            title: 'Public map',
            tabBarIcon: tabIcon('◎'),
          }}
        />
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: palette.surface,
    borderTopColor: palette.border,
    borderTopWidth: 1,
    elevation: 10,
    height: Platform.select({ ios: 84, android: 74, default: 74 }),
    paddingBottom: Platform.select({ ios: 22, android: 12, default: 12 }),
    paddingHorizontal: 8,
    paddingTop: 8,
    shadowColor: '#14231c',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  tabBarItem: {
    borderRadius: 14,
    paddingVertical: 2,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.15,
    marginTop: 2,
  },
  iconPill: {
    alignItems: 'center',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    minWidth: 46,
    paddingHorizontal: 10,
  },
  iconPillActive: {
    backgroundColor: 'rgba(11, 107, 69, 0.12)',
  },
  iconSymbol: {
    fontSize: 19,
    lineHeight: 22,
  },
  iconSymbolActive: {
    fontWeight: '800',
  },
  actionIconWrap: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    minWidth: 46,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  actionIconWrapActive: {
    backgroundColor: '#073f2a',
    borderColor: '#f0b429',
    borderWidth: 1.5,
  },
  actionIconText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
});