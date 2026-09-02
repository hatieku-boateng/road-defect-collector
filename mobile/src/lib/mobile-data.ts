import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';

import type { MyReport, ReportDraft } from './api';

export type LocalReport = {
  area: string;
  createdAt: string;
  defect: string;
  id: string;
  status: string;
};

export type DeviceIdentity = {
  collectorId: string;
  deviceToken: string;
  manufacturer: string;
  model: string;
};

export type QueuedReport = ReportDraft & { queueId: string; queuedAt: string };

const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
const identityFile = `${root}collector-identity.json`;
const historyFile = `${root}report-history.json`;
const queueFile = `${root}pending-report-queue.json`;
const remoteReportsFile = `${root}remote-report-cache.json`;
const queueDirectory = `${root}pending-road-photos/`;

function numericId() {
  return Array.from({ length: 12 }, (_, index) => {
    const value = Math.floor(Math.random() * 10);
    return String(index === 0 && value === 0 ? 1 : value);
  }).join('');
}

function secretToken() {
  const random = Array.from({ length: 5 }, () => Math.random().toString(36).slice(2)).join('');
  return `device-${Date.now().toString(36)}-${random}`.slice(0, 80);
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
  const deviceToken = /^[a-z0-9-]{24,100}$/i.test(current.deviceToken ?? '') ? current.deviceToken! : secretToken();
  const identity = {
    collectorId,
    deviceToken,
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
  if (reports.some((item) => item.id === report.id)) return;
  await writeJson(historyFile, [report, ...reports].slice(0, 100));
}

export async function cacheMyReports(reports: MyReport[]) {
  await writeJson(remoteReportsFile, reports);
}

export async function readCachedMyReports() {
  return readJson<MyReport[]>(remoteReportsFile, []);
}

export async function listQueuedReports() {
  return readJson<QueuedReport[]>(queueFile, []);
}

export async function queueReport(draft: ReportDraft) {
  await FileSystem.makeDirectoryAsync(queueDirectory, { intermediates: true });
  const queueId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const imageUri = `${queueDirectory}${queueId}.jpg`;
  await FileSystem.copyAsync({ from: draft.image.uri, to: imageUri });
  const queued: QueuedReport = {
    ...draft,
    image: { ...draft.image, uri: imageUri },
    queueId,
    queuedAt: new Date().toISOString(),
  };
  const reports = await listQueuedReports();
  await writeJson(queueFile, [...reports, queued]);
  return queued;
}

export async function removeQueuedReport(queueId: string) {
  const reports = await listQueuedReports();
  const removed = reports.find((item) => item.queueId === queueId);
  await writeJson(queueFile, reports.filter((item) => item.queueId !== queueId));
  if (removed) await FileSystem.deleteAsync(removed.image.uri, { idempotent: true }).catch(() => undefined);
}
