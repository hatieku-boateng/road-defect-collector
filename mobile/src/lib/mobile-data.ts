import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';

export type LocalReport = {
  area: string;
  createdAt: string;
  defect: string;
  id: string;
  status: string;
};

export type DeviceIdentity = {
  collectorId: string;
  manufacturer: string;
  model: string;
};

const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
const identityFile = `${root}collector-identity.json`;
const historyFile = `${root}report-history.json`;

function numericId() {
  return Array.from({ length: 12 }, (_, index) => {
    const value = Math.floor(Math.random() * 10);
    return String(index === 0 && value === 0 ? 1 : value);
  }).join('');
}

async function readJson<T>(uri: string, fallback: T): Promise<T> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return fallback;
    return JSON.parse(await FileSystem.readAsStringAsync(uri)) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(uri: string, value: unknown) {
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(value));
}

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  const current = await readJson<Partial<DeviceIdentity>>(identityFile, {});
  const collectorId = /^\d{12}$/.test(current.collectorId ?? '') ? current.collectorId! : numericId();
  const identity = {
    collectorId,
    manufacturer: Device.manufacturer || 'Unknown manufacturer',
    model: Device.modelName || 'Unknown model',
  };
  await writeJson(identityFile, identity);
  return identity;
}

export async function listLocalReports() {
  return readJson<LocalReport[]>(historyFile, []);
}

export async function saveLocalReport(report: LocalReport) {
  const reports = await listLocalReports();
  await writeJson(historyFile, [report, ...reports].slice(0, 100));
}
