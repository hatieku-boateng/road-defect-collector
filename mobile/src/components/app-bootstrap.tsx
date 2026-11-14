import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { syncMobileData } from '@/lib/sync';

const SYNC_INTERVAL_MS = 30_000;

if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Ignore notification handler registration issues in unsupported runtimes
  }
}

export default function AppBootstrap() {
  const router = useRouter();
  const syncInFlightRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const triggerSafeSync = useCallback(async () => {
    if (Platform.OS === 'web' || syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      await syncMobileData();
    } catch {
      // Offline or transient network errors are handled gracefully inside syncMobileData
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const initialTimer = setTimeout(() => {
      void triggerSafeSync();
    }, 1200);

    const interval = setInterval(() => {
      if (appStateRef.current === 'active') {
        void triggerSafeSync();
      }
    }, SYNC_INTERVAL_MS);

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState) => {
        const wasBackground = appStateRef.current.match(/inactive|background/);
        appStateRef.current = nextState;
        if (wasBackground && nextState === 'active') {
          void triggerSafeSync();
        }
      },
    );

    let notificationSubscription: Notifications.EventSubscription | null = null;

    try {
      void Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            router.push('/activity');
          }
        })
        .catch(() => {});

      notificationSubscription =
        Notifications.addNotificationResponseReceivedListener(() => {
          void triggerSafeSync();
          router.push('/activity');
        });
    } catch {
      // Ignore listener registration errors on unsupported simulators/environments
    }

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      appStateSubscription.remove();
      notificationSubscription?.remove();
    };
  }, [router, triggerSafeSync]);

  return null;
}