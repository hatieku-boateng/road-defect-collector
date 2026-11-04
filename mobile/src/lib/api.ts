import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type { DeviceIdentity, LocalReport, QueuedReport } from './mobile-data';

const DEFAULT_API_BASE_URL = 'https://road-defect-collector.vercel.app';
const JSON_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 45_000;

function resolveBaseUrl(): string {
  const configuredUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (typeof configuredUrl === 'string' && /^https?:\/\//i.test(configuredUrl.trim())) {
    return configuredUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_API_BASE_URL;
}

export const API_BASE_URL = resolveBaseUrl();

export const defects = [
  { label: 'Pothole', value: 'pothole' },
  { label: 'Road crack', value: 'road-crack' },
  { label: 'Damaged road edge', value: 'damaged-road-edge' },
  { label: 'Not sure', value: 'unsure' },
] as const;

export type DefectValue = (typeof defects)[number]['value'];

export type GpsFix = {
  accuracy: number;
  latitude: number;
  longitude: number;
  timestamp: string;
};

export type ProgressImage = {
  capturedAt: string | null;
  id: string;
  imageUrl: string;
  note: string | null;
  stage: 'after' | 'in-progress';
};

export type PublicReport = {
  area: string;
  createdAt: string;
  defect: string;
  id: string;
  imageUrl: string;
  latitude: number | null;
  longitude: number | null;
  progressImages: ProgressImage[];
  source: string;
  status: string;
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
  defect: DefectValue;
  gps: GpsFix;
  identity: DeviceIdentity;
  image: {
    blurCount?: number;
    fileName: string;
    mimeType: string;
    uri: string;
  };
  privacyBlurCount?: number;
  privacyConfirmed: boolean;
};

type CachedEndpointEntry<T> = {
  data: T;
  etag: string;
};

const responseCache = new Map<string, CachedEndpointEntry<unknown>>();

/**
 * Safely resolves a relative API path against API_BASE_URL without double-prefixing.
 */
export function resolveApiUrl(pathOrUrl: string): string {
  const trimmed = (pathOrUrl ?? '').trim();
  if (!trimmed) return API_BASE_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${API_BASE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

function normalizeImageMimeType(rawMime: string, fileName: string): string {
  const lowered = (rawMime ?? '').trim().toLowerCase();
  if (lowered === 'image/jpg' || lowered === 'image/jpeg') return 'image/jpeg';
  if (lowered === 'image/png') return 'image/png';
  if (lowered === 'image/webp') return 'image/webp';

  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function normalizeFileName(rawName: string, mimeType: string): string {
  const cleaned = (rawName ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (cleaned && /\.(jpe?g|png|webp)$/i.test(cleaned)) {
    return cleaned;
  }

  const ext =
    mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const base = cleaned.replace(/\.[^/.]+$/, '') || `road-defect-${Date.now()}`;
  return `${base}.${ext}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = JSON_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The network request timed out. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function appendRoadImageToFormData(
  form: FormData,
  image: ReportDraft['image'],
): void {
  const mimeType = normalizeImageMimeType(image.mimeType, image.fileName);
  const fileName = normalizeFileName(image.fileName, mimeType);

  // On native iOS/Android, React Native's FormData networking layer reliably transmits
  // `{ uri, name, type }` with the exact declared Content-Type header, while also
  // supporting Expo's `File` instance when `type` is populated.
  if (Platform.OS === 'web') {
    const roadImage = new File(image.uri);
    form.append('roadImage', roadImage, fileName);
    return;
  }

  try {
    const expoFile = new File(image.uri);
    if (expoFile && typeof expoFile === 'object' && 'type' in expoFile && expoFile.type) {
      form.append('roadImage', expoFile, fileName);
      return;
    }
  } catch {
    // Fall back to standard React Native FormData file descriptor
  }

  form.append('roadImage', {
    uri: image.uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
}

export async function submitReport(draft: ReportDraft): Promise<LocalReport> {
  const cleanArea = draft.area.trim();
  const blurCount = Math.max(
    0,
    Math.trunc(draft.privacyBlurCount ?? draft.image.blurCount ?? 0),
  );

  const form = new FormData();
  form.append('collectorId', draft.identity.collectorId.trim());
  form.append('collectorToken', draft.identity.deviceToken.trim());
  form.append('deviceManufacturer', draft.identity.manufacturer.trim());
  form.append('deviceModel', draft.identity.model.trim());
  form.append('areaName', cleanArea);
  form.append('suspectedDefect', draft.defect);
  form.append('latitude', String(draft.gps.latitude));
  form.append('longitude', String(draft.gps.longitude));
  form.append('gpsAccuracy', String(Math.max(0, draft.gps.accuracy)));
  form.append('gpsTimestamp', draft.gps.timestamp);
  form.append('source', 'manual');
  form.append('privacyProcessed', draft.privacyConfirmed ? 'true' : 'false');
  form.append('privacyBlurCount', String(blurCount));

  appendRoadImageToFormData(form, draft.image);

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/submissions`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: form,
    },
    UPLOAD_TIMEOUT_MS,
  );

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    existingId?: string;
    id?: string;
    status?: string;
  };

  if (response.status === 409 && body.existingId) {
    return {
      area: cleanArea,
      createdAt: new Date().toISOString(),
      defect: draft.defect,
      id: body.existingId,
      status: 'pending',
    };
  }

  if (!response.ok || !body.id) {
    throw new Error(body.error || 'The report could not be submitted.');
  }

  // Invalidate cached report lists so the next fetch includes the newly submitted report
  responseCache.clear();

  return {
    area: cleanArea,
    createdAt: new Date().toISOString(),
    defect: draft.defect,
    id: body.id,
    status: body.status || 'pending',
  };
}

function mobileHeaders(identity: DeviceIdentity): Record<string, string> {
  const token = identity.deviceToken.trim();
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'x-collector-id': identity.collectorId.trim(),
    'x-collector-token': token,
  };
}

export function privateImageSource(url: string, identity: DeviceIdentity) {
  return {
    headers: mobileHeaders(identity),
    uri: resolveApiUrl(url),
  };
}

export async function registerMobileDevice(
  identity: DeviceIdentity,
  expoPushToken?: string | null,
): Promise<{ claimedReports: number; notificationsEnabled: boolean }> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/mobile/register`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      collectorId: identity.collectorId.trim(),
      deviceToken: identity.deviceToken.trim(),
      expoPushToken: expoPushToken?.trim() || null,
      manufacturer: identity.manufacturer.trim(),
      model: identity.model.trim(),
      platform: Platform.OS,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    claimedReports?: number;
    error?: string;
    notificationsEnabled?: boolean;
  };

  if (!response.ok) {
    throw new Error(body.error || 'This device could not be registered.');
  }

  return {
    claimedReports: Number(body.claimedReports ?? 0),
    notificationsEnabled: Boolean(body.notificationsEnabled),
  };
}

export async function fetchMyReports(identity: DeviceIdentity): Promise<MyReport[]> {
  const cacheKey = `my-reports:${identity.collectorId.trim()}`;
  const cached = responseCache.get(cacheKey) as CachedEndpointEntry<MyReport[]> | undefined;

  const headers: Record<string, string> = {
    ...mobileHeaders(identity),
    ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}),
  };

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/mobile/reports`, {
    method: 'GET',
    headers,
  });

  if (response.status === 304 && cached) {
    return cached.data;
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    reports?: MyReport[];
  };

  if (!response.ok || !Array.isArray(body.reports)) {
    throw new Error(body.error || 'Your reports are temporarily unavailable.');
  }

  const normalizedReports: MyReport[] = body.reports.map((report) => ({
    ...report,
    events: Array.isArray(report.events) ? report.events : [],
    imageUrl: resolveApiUrl(report.imageUrl),
    progressImages: (report.progressImages ?? []).map((image) => ({
      ...image,
      imageUrl: resolveApiUrl(image.imageUrl),
    })),
  }));

  const etag = response.headers.get('etag');
  if (etag) {
    responseCache.set(cacheKey, { data: normalizedReports, etag });
  }

  return normalizedReports;
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error.name === 'TypeError' ||
    msg.includes('network request failed') ||
    msg.includes('timed out') ||
    msg.includes('failed to fetch')
  );
}

export async function syncQueuedReports(
  reports: QueuedReport[],
  onSubmitted: (queueId: string, report: LocalReport) => Promise<void>,
): Promise<{ failed: number; submitted: number }> {
  if (!Array.isArray(reports) || reports.length === 0) {
    return { failed: 0, submitted: 0 };
  }

  let submitted = 0;

  for (const queued of reports) {
    try {
      const report = await submitReport(queued);
      await onSubmitted(queued.queueId, report);
      submitted += 1;
    } catch (error) {
      // If the device lost connectivity, stop immediately so remaining items stay queued.
      // If a single item failed due to a validation/4xx error, continue syncing other items.
      if (isNetworkError(error)) {
        break;
      }
    }
  }

  return {
    failed: Math.max(0, reports.length - submitted),
    submitted,
  };
}

export async function fetchPublicReports(): Promise<PublicReport[]> {
  const cacheKey = 'public-reports';
  const cached = responseCache.get(cacheKey) as CachedEndpointEntry<PublicReport[]> | undefined;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}),
  };

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/public/submissions`, {
    method: 'GET',
    headers,
  });

  if (response.status === 304 && cached) {
    return cached.data;
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    submissions?: PublicReport[];
  };

  if (!response.ok || !Array.isArray(body.submissions)) {
    throw new Error(body.error || 'Reports are temporarily unavailable.');
  }

  const normalizedSubmissions: PublicReport[] = body.submissions.map((report) => ({
    ...report,
    imageUrl: resolveApiUrl(report.imageUrl),
    progressImages: (report.progressImages ?? []).map((image) => ({
      ...image,
      imageUrl: resolveApiUrl(image.imageUrl),
    })),
  }));

  const etag = response.headers.get('etag');
  if (etag) {
    responseCache.set(cacheKey, { data: normalizedSubmissions, etag });
  }

  return normalizedSubmissions;
}