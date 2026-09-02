import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerMobileDevice, syncQueuedReports } from './api';
import { getDeviceIdentity, listQueuedReports, removeQueuedReport, saveLocalReport } from './mobile-data';

let pushToken: string | null | undefined;

export async function configureNotifications() {
  if (pushToken !== undefined) return pushToken;
  pushToken = null;
  if (!Device.isDevice) return null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('report-updates', {
        importance: Notifications.AndroidImportance.HIGH,
        name: 'Road report updates',
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return null;

    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    const projectId = Constants.easConfig?.projectId ?? extra?.eas?.projectId;
    if (!projectId) return null;
    pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return pushToken;
  } catch {
    return null;
  }
}

export async function syncMobileData() {
  const identity = await getDeviceIdentity();
  const token = await configureNotifications();
  await registerMobileDevice(identity, token).catch(() => undefined);
  const queued = await listQueuedReports();
  return syncQueuedReports(queued, async (queueId, report) => {
    await saveLocalReport(report);
    await removeQueuedReport(queueId);
  });
}
