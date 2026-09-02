import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncMobileData } from '@/lib/sync';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function AppBootstrap() {
  const router = useRouter();

  useEffect(() => {
    void syncMobileData();
    const interval = setInterval(() => { void syncMobileData(); }, 30_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncMobileData();
    });
    const notification = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/activity');
    });
    return () => {
      clearInterval(interval);
      appState.remove();
      notification.remove();
    };
  }, [router]);

  return null;
}
