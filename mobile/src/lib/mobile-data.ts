import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export type DeviceIdentity = {
  collectorId: string;
  deviceToken: string;
  manufacturer: string;
  model: string;
};

export type LocalReport = {
  area: string;
  createdAt: string;
  defect: string;
  id: string;
  status: string;
};

export type QueuedReport = {
  area: string;
  defect: any;
  gps: {
    accuracy: number;
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  identity: DeviceIdentity;
  image: {
    fileName: string;
    mimeType: string;
    uri: string;
  };
  privacyConfirmed: boolean;
  queuedAt: string;
  queueId: string;
};

export type MyReportCache = {
  reports?: any[];
  [key: string]: any;
};

const IDENTITY_FILE = `${FileSystem.documentDirectory ?? ''}road-watcher-identity.json`;
const REPORTS_FILE = `${FileSystem.documentDirectory ?? ''}road-watcher-reports.json`;
const QUEUE_FILE = `${FileSystem.documentDirectory ?? ''}road-watcher-queue.json`;
const MY_REPORTS_CACHE_FILE = `${FileSystem.documentDirectory ?? ''}road-watcher-my-reports.json`;

const WEB_STORAGE_KEYS = {
  identity: 'road_watcher_web_identity',
  reports: 'road_watcher_web_reports',
  queue: 'road_watcher_web_queue',
  myReports: 'road_watcher_web_my_reports',
};

async function readJson<T>(fileUri: string, webKey: string, fallback: T): Promise<T> {
  if (Platform.OS === 'web') {
    try {
      const item = localStorage.getItem(webKey);
      return item ? (JSON.parse(item) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return fallback;
    const content = await FileSystem.readAsStringAsync(fileUri);
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(fileUri: string, webKey: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(webKey, serialized);
    } catch (error) {
      console.warn('Failed to save to web localStorage', error);
    }
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(fileUri, serialized);
  } catch (error) {
    console.warn('Failed to write local file system cache', error);
  }
}

function generateCollectorId(): string {
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

function generateDeviceToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 36; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function generateQueueId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `queue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  const existing = await readJson<DeviceIdentity | null>(
    IDENTITY_FILE,
    WEB_STORAGE_KEYS.identity,
    null,
  );

  if (existing && existing.collectorId && existing.deviceToken) {
    return existing;
  }

  const identity: DeviceIdentity = {
    collectorId: generateCollectorId(),
    deviceToken: generateDeviceToken(),
    manufacturer: Device.manufacturer || 'Unknown',
    model: Device.modelName || Device.deviceName || 'Generic Device',
  };

  await writeJson(IDENTITY_FILE, WEB_STORAGE_KEYS.identity, identity);
  return identity;
}

export async function getLocalReports(): Promise<LocalReport[]> {
  return readJson<LocalReport[]>(REPORTS_FILE, WEB_STORAGE_KEYS.reports, []);
}

/** Alias for compatibility with screens calling listLocalReports */
export async function listLocalReports(): Promise<LocalReport[]> {
  return getLocalReports();
}

export async function saveLocalReport(report: LocalReport): Promise<void> {
  const reports = await getLocalReports();
  const updated = [report, ...reports.filter((r) => r.id !== report.id)];
  await writeJson(REPORTS_FILE, WEB_STORAGE_KEYS.reports, updated);
}

export async function getQueuedReports(): Promise<QueuedReport[]> {
  return readJson<QueuedReport[]>(QUEUE_FILE, WEB_STORAGE_KEYS.queue, []);
}

/** Alias for compatibility with sync routines calling listQueuedReports */
export async function listQueuedReports(): Promise<QueuedReport[]> {
  return getQueuedReports();
}

export async function queueReport(
  draft: QueuedReport['identity'] extends any
    ? Omit<QueuedReport, 'queueId' | 'queuedAt'>
    : never,
): Promise<void> {
  const queue = await getQueuedReports();
  const newEntry: QueuedReport = {
    ...draft,
    queueId: generateQueueId(),
    queuedAt: new Date().toISOString(),
  };
  await writeJson(QUEUE_FILE, WEB_STORAGE_KEYS.queue, [...queue, newEntry]);
}

export async function removeQueuedReport(queueId: string): Promise<void> {
  const queue = await getQueuedReports();
  const updated = queue.filter((item) => item.queueId !== queueId);
  await writeJson(QUEUE_FILE, WEB_STORAGE_KEYS.queue, updated);
}

export async function readCachedMyReports(): Promise<any[]> {
  const data = await readJson<any[] | MyReportCache>(
    MY_REPORTS_CACHE_FILE,
    WEB_STORAGE_KEYS.myReports,
    [],
  );
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as MyReportCache).reports)) {
    return (data as MyReportCache).reports!;
  }
  return [];
}

/** Alias for compatibility */
export async function getCachedMyReports(): Promise<any[]> {
  return readCachedMyReports();
}

export async function saveCachedMyReports(reports: any[]): Promise<void> {
  await writeJson(MY_REPORTS_CACHE_FILE, WEB_STORAGE_KEYS.myReports, reports);
}

/** Alias for compatibility with screens calling cacheMyReports */
export async function cacheMyReports(reports: any[]): Promise<void> {
  return saveCachedMyReports(reports);
}