import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  DefectType,
  ProgressImageStage,
  ReviewStatus,
  SubmissionSource,
  WorkflowStatus,
} from "./config";

export interface RoadSubmission {
  id: string;
  collector_id: string;
  area_name: string;
  suspected_defect: DefectType;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  gps_timestamp: string | null;
  digital_address?: string | null;
  landmark?: string | null;
  image_path: string;
  image_name: string;
  image_type: string;
  image_size: number;
  status: ReviewStatus;
  workflow_status: WorkflowStatus | "in_progress" | "repaired";
  review_note?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  source: SubmissionSource | "drone";
  video_timestamp?: number | null;
  ai_confidence?: number | null;
  privacy_processed: boolean;
  privacy_blur_count: number;
  device_manufacturer?: string | null;
  device_model?: string | null;
  collector_token_hash?: string | null;
  image_sha256?: string | null;
  archived_at?: string | null;
  archive_reason?: string | null;
}

export interface RoadProgressImage {
  id: string;
  submission_id: string;
  stage: ProgressImageStage;
  note?: string | null;
  captured_at?: string | null;
  image_path: string;
  image_name: string;
  image_type: string;
  image_size: number;
  privacy_processed: boolean;
  privacy_blur_count: number;
  created_at: string;
}

export interface RoadReportEvent {
  id: string;
  submission_id: string;
  event_type: "submitted" | "status" | "progress" | string;
  workflow_status: WorkflowStatus | string;
  note?: string | null;
  progress_image_id?: string | null;
  created_at: string;
}

export interface RoadMobileDevice {
  id: string;
  collector_id: string;
  device_token_hash: string;
  expo_push_token?: string | null;
  platform?: string | null;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

let cachedSql: NeonQueryFunction<false, false> | null = null;
let cachedDatabaseUrl: string | null = null;
let schemaReadyPromise: Promise<void> | null = null;

function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || "";

  if (!url) {
    throw new Error(
      "DATABASE_URL (or POSTGRES_URL) is not configured in environment variables.",
    );
  }

  return url;
}

/**
 * Returns a pooled, serverless-optimized Neon SQL instance.
 * Automatically re-initializes if the underlying connection string changes.
 */
export function getSql(): NeonQueryFunction<false, false> {
  const databaseUrl = resolveDatabaseUrl();

  if (!cachedSql || cachedDatabaseUrl !== databaseUrl) {
    cachedSql = neon(databaseUrl, {
      fetchOptions: {
        cache: "no-store",
      },
    });
    cachedDatabaseUrl = databaseUrl;
  }

  return cachedSql;
}

/**
 * Normalizes Neon query results across array and `{ rows }` return modes.
 */
export function extractRows<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

/**
 * Convenience wrapper around `getSql().query()` that always returns a typed array of rows.
 */
export async function queryRows<T = Record<string, unknown>>(
  queryText: string,
  params: unknown[] = [],
): Promise<T[]> {
  const sql = getSql();
  const result = await sql.query(queryText, params);
  return extractRows<T>(result);
}

/**
 * Lightweight health check for database availability (/api/health).
 */
export async function testConnection(): Promise<boolean> {
  try {
    const sql = getSql();
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection check failed:", error);
    return false;
  }
}

async function initializeSchemaOnce(): Promise<void> {
  // Allow opting out of runtime schema verification in environments with strict read-only DDL roles
  if (process.env.SKIP_RUNTIME_SCHEMA_SYNC === "true") {
    return;
  }

  const sql = getSql();

  await sql.query(`
    CREATE TABLE IF NOT EXISTS road_submissions (
      id UUID PRIMARY KEY,
      collector_id TEXT NOT NULL,
      area_name TEXT NOT NULL,
      suspected_defect TEXT NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      gps_accuracy DOUBLE PRECISION,
      gps_timestamp TIMESTAMPTZ,
      digital_address TEXT,
      landmark TEXT,
      image_path TEXT NOT NULL,
      image_name TEXT NOT NULL,
      image_type TEXT NOT NULL,
      image_size INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      workflow_status TEXT NOT NULL DEFAULT 'pending',
      review_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      source TEXT NOT NULL DEFAULT 'manual',
      video_timestamp DOUBLE PRECISION,
      ai_confidence DOUBLE PRECISION,
      privacy_processed BOOLEAN NOT NULL DEFAULT FALSE,
      privacy_blur_count INTEGER NOT NULL DEFAULT 0,
      device_manufacturer TEXT,
      device_model TEXT,
      collector_token_hash TEXT,
      image_sha256 TEXT,
      archived_at TIMESTAMPTZ,
      archive_reason TEXT,
      CONSTRAINT road_submissions_image_sha256_unique UNIQUE (image_sha256)
    );
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS road_progress_images (
      id UUID PRIMARY KEY,
      submission_id UUID NOT NULL REFERENCES road_submissions(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      note TEXT,
      captured_at TIMESTAMPTZ,
      image_path TEXT NOT NULL,
      image_name TEXT NOT NULL,
      image_type TEXT NOT NULL,
      image_size INTEGER NOT NULL,
      privacy_processed BOOLEAN NOT NULL DEFAULT FALSE,
      privacy_blur_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS road_report_events (
      id UUID PRIMARY KEY,
      submission_id UUID NOT NULL REFERENCES road_submissions(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      workflow_status TEXT NOT NULL,
      note TEXT,
      progress_image_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS road_mobile_devices (
      id UUID PRIMARY KEY,
      collector_id TEXT NOT NULL,
      device_token_hash TEXT NOT NULL,
      expo_push_token TEXT,
      platform TEXT,
      notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (collector_id, device_token_hash)
    );
  `);

  // Ensure performance indexes exist for high-frequency queries
  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_road_submissions_active_created
      ON road_submissions (created_at DESC)
      WHERE archived_at IS NULL;
  `);

  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_road_submissions_collector_lookup
      ON road_submissions (collector_id, collector_token_hash, created_at DESC)
      WHERE archived_at IS NULL;
  `);

  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_road_progress_images_submission
      ON road_progress_images (submission_id, created_at ASC);
  `);

  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_road_report_events_submission
      ON road_report_events (submission_id, created_at ASC);
  `);
}

/**
 * Ensures all core tables and indexes exist once per serverless instance cold start.
 * Subsequent calls on a warm instance resolve immediately with zero database overhead.
 */
export async function ensureSchema(): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = initializeSchemaOnce().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
}