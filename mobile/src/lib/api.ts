import Constants from 'expo-constants';

import type { DeviceIdentity, LocalReport } from './mobile-data';

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
  form.append('roadImage', {
    uri: draft.image.uri,
    name: draft.image.fileName,
    type: draft.image.mimeType,
  } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/api/submissions`, { method: 'POST', body: form });
  const body = await response.json().catch(() => ({})) as { error?: string; id?: string; status?: string };
  if (!response.ok || !body.id) throw new Error(body.error || 'The report could not be submitted.');

  return {
    area: draft.area.trim(),
    createdAt: new Date().toISOString(),
    defect: draft.defect,
    id: body.id,
    status: body.status || 'pending',
  };
}

export async function fetchPublicReports(): Promise<PublicReport[]> {
  const response = await fetch(`${API_BASE_URL}/api/public/submissions`);
  const body = await response.json().catch(() => ({})) as { error?: string; submissions?: PublicReport[] };
  if (!response.ok || !body.submissions) throw new Error(body.error || 'Reports are temporarily unavailable.');
  return body.submissions.map((report) => ({ ...report, imageUrl: `${API_BASE_URL}${report.imageUrl}` }));
}
