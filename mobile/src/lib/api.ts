import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type { DeviceIdentity, LocalReport, QueuedReport } from './mobile-data';

const configuredUrl = Constants.expoConfig?.extra?.apiBaseUrl;
export const API_BASE_URL = typeof configuredUrl === 'string'
  ? configuredUrl.replace(/\/$/, '')
  : 'https://road-defect-collector.vercel.app';

export const defects = [
  { label: 'Pothole', value: 'pothole' },
  { label: 'Road crack', value: 'road-crack' },
  { label: 'Damaged road edge', value: 'damaged-road-edge' },
  { label: 'Not sure', value: 'unsure' },
] as const;

export type GpsFix = { accuracy: number; latitude: number; longitude: number; timestamp: string };

export type PublicReport = {
  area: string;
  createdAt: string;
  defect: string;
  id: string;
  imageUrl: string;
  latitude: number | null;
  longitude: number | null;
  source: string;
  status: string;
  progressImages: ProgressImage[];
};

export type ProgressImage = {
  capturedAt: string | null;
  id: string;
  imageUrl: string;
  note: string | null;
  stage: 'after' | 'in-progress';
};

export type ReportEvent = {
  createdAt: string;
  id: string;
  note: string | null;
  status: string | null;
  type: string;
};

export type MyReport = {
  area: string;
  createdAt: string;
  defect: string;
  events: ReportEvent[];
  id: string;
  imageUrl: string;
  progressImages: ProgressImage[];
  reviewNote?: string | null;
  status: string;
};

export type ReportDraft = {
  area: string;
  defect: (typeof defects)[number]['value'];
  gps: GpsFix;
  identity: DeviceIdentity;
  image: { fileName: string; mimeType: string; uri: string };
  privacyConfirmed: boolean;
};

export async function submitReport(draft: ReportDraft): Promise<LocalReport> {
  const form = new FormData();
  form.append('collectorId', draft.identity.collectorId);
  form.append('collectorToken', draft.identity.deviceToken);
  form.append('deviceManufacturer', draft.identity.manufacturer);
  form.append('deviceModel', draft.identity.model);
  form.append('areaName', draft.area.trim());
  form.append('suspectedDefect', draft.defect);
  form.append('latitude', String(draft.gps.latitude));
  form.append('longitude', String(draft.gps.longitude));
  form.append('gpsAccuracy', String(draft.gps.accuracy));
  form.append('gpsTimestamp', draft.gps.timestamp);
  form.append('source', 'manual');
  form.append('privacyProcessed', draft.privacyConfirmed ? 'true' : 'false');
  form.append('privacyBlurCount', '0');
  const roadImage = new File(draft.image.uri);
  form.append('roadImage', roadImage, draft.image.fileName);

  const response = await fetch(`${API_BASE_URL}/api/submissions`, { method: 'POST', body: form });
  const body = await response.json().catch(() => ({})) as { error?: string; existingId?: string; id?: string; status?: string };
  if (response.status === 409 && body.existingId) {
    return {
      area: draft.area.trim(),
      createdAt: new Date().toISOString(),
      defect: draft.defect,
      id: body.existingId,
      status: 'pending',
    };
  }
  if (!response.ok || !body.id) throw new Error(body.error || 'The report could not be submitted.');

  return {
    area: draft.area.trim(),
    createdAt: new Date().toISOString(),
    defect: draft.defect,
    id: body.id,
    status: body.status || 'pending',
  };
}

function mobileHeaders(identity: DeviceIdentity) {
  return { Authorization: `Bearer ${identity.deviceToken}`, 'x-collector-id': identity.collectorId };
}

export function privateImageSource(url: string, identity: DeviceIdentity) {
  return { headers: mobileHeaders(identity), uri: url };
}

export async function registerMobileDevice(identity: DeviceIdentity, expoPushToken?: string | null) {
  const response = await fetch(`${API_BASE_URL}/api/mobile/register`, {
    body: JSON.stringify({
      collectorId: identity.collectorId,
      deviceToken: identity.deviceToken,
      expoPushToken: expoPushToken || null,
      manufacturer: identity.manufacturer,
      model: identity.model,
      platform: Platform.OS,
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error('This device could not be registered.');
}

export async function fetchMyReports(identity: DeviceIdentity): Promise<MyReport[]> {
  const response = await fetch(`${API_BASE_URL}/api/mobile/reports`, { headers: mobileHeaders(identity) });
  const body = await response.json().catch(() => ({})) as { error?: string; reports?: MyReport[] };
  if (!response.ok || !body.reports) throw new Error(body.error || 'Your reports are temporarily unavailable.');
  return body.reports.map((report) => ({
    ...report,
    imageUrl: `${API_BASE_URL}${report.imageUrl}`,
    progressImages: (report.progressImages ?? []).map((image) => ({ ...image, imageUrl: `${API_BASE_URL}${image.imageUrl}` })),
  }));
}

export async function syncQueuedReports(
  reports: QueuedReport[],
  onSubmitted: (queueId: string, report: LocalReport) => Promise<void>,
) {
  let submitted = 0;
  for (const queued of reports) {
    try {
      const report = await submitReport(queued);
      await onSubmitted(queued.queueId, report);
      submitted += 1;
    } catch {
      break;
    }
  }
  return { failed: reports.length - submitted, submitted };
}

export async function fetchPublicReports(): Promise<PublicReport[]> {
  const response = await fetch(`${API_BASE_URL}/api/public/submissions`);
  const body = await response.json().catch(() => ({})) as { error?: string; submissions?: PublicReport[] };
  if (!response.ok || !body.submissions) throw new Error(body.error || 'Reports are temporarily unavailable.');
  return body.submissions.map((report) => ({
    ...report,
    imageUrl: `${API_BASE_URL}${report.imageUrl}`,
    progressImages: (report.progressImages ?? []).map((image) => ({ ...image, imageUrl: `${API_BASE_URL}${image.imageUrl}` })),
  }));
}
