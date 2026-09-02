import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, type ColorValue } from 'react-native';

import { palette } from '@/constants/theme';

const icon = (symbol: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{symbol}</Text>;
  };

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: palette.canvas },
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: palette.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            height: 76,
            paddingBottom: 12,
            paddingTop: 8,
          },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('⌂') }} />
        <Tabs.Screen name="report" options={{ title: 'Report', tabBarIcon: icon('＋') }} />
        <Tabs.Screen name="activity" options={{ title: 'My reports', tabBarIcon: icon('◷') }} />
        <Tabs.Screen name="public" options={{ title: 'Public', tabBarIcon: icon('◎') }} />
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>
    </>
  );
}
