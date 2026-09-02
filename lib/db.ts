import { neon } from "@neondatabase/serverless";

let schemaPromise: Promise<void> | null = null;

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(databaseUrl);
}

export async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSql();

      await sql`
        CREATE TABLE IF NOT EXISTS road_submissions (
          id UUID PRIMARY KEY,
          collector_id VARCHAR(50) NOT NULL,
          area_name VARCHAR(160) NOT NULL,
          suspected_defect VARCHAR(40) NOT NULL,
          latitude DOUBLE PRECISION NOT NULL,
          longitude DOUBLE PRECISION NOT NULL,
          gps_accuracy DOUBLE PRECISION NOT NULL,
          gps_timestamp TIMESTAMPTZ NOT NULL,
          image_path TEXT NOT NULL,
          image_name TEXT NOT NULL,
          image_type VARCHAR(80) NOT NULL,
          image_size INTEGER NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          workflow_status VARCHAR(30) NOT NULL DEFAULT 'pending',
          review_note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          reviewed_at TIMESTAMPTZ,
          source VARCHAR(20) NOT NULL DEFAULT 'manual',
          video_timestamp DOUBLE PRECISION,
          ai_confidence DOUBLE PRECISION,
          privacy_processed BOOLEAN NOT NULL DEFAULT FALSE,
          privacy_blur_count INTEGER NOT NULL DEFAULT 0,
          device_manufacturer VARCHAR(80),
          device_model VARCHAR(80),
          collector_token_hash CHAR(64),
          image_sha256 CHAR(64),
          archived_at TIMESTAMPTZ,
          archive_reason TEXT,
          CONSTRAINT road_submissions_status_check
            CHECK (status IN ('pending', 'approved', 'rejected')),
          CONSTRAINT road_submissions_defect_check
            CHECK (suspected_defect IN (
              'pothole', 'road-crack', 'damaged-road-edge', 'unsure'
            ))
        )
      `;

      await sql`
        ALTER TABLE road_submissions
        ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS video_timestamp DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS ai_confidence DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS privacy_processed BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS privacy_blur_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS device_manufacturer VARCHAR(80),
        ADD COLUMN IF NOT EXISTS device_model VARCHAR(80),
        ADD COLUMN IF NOT EXISTS collector_token_hash CHAR(64),
        ADD COLUMN IF NOT EXISTS image_sha256 CHAR(64),
        ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30),
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS archive_reason TEXT
      `;

      await sql`
        UPDATE road_submissions
        SET workflow_status = CASE
          WHEN status = 'approved' THEN 'verified'
          WHEN status = 'rejected' THEN 'rejected'
          ELSE 'pending'
        END
        WHERE workflow_status IS NULL
      `;
      await sql`
        ALTER TABLE road_submissions
        ALTER COLUMN workflow_status SET DEFAULT 'pending'
      `;
      await sql`
        ALTER TABLE road_submissions
        ALTER COLUMN workflow_status SET NOT NULL
      `;

      await sql`ALTER TABLE road_submissions ALTER COLUMN latitude DROP NOT NULL`;
      await sql`ALTER TABLE road_submissions ALTER COLUMN longitude DROP NOT NULL`;
      await sql`ALTER TABLE road_submissions ALTER COLUMN gps_accuracy DROP NOT NULL`;
      await sql`ALTER TABLE road_submissions ALTER COLUMN gps_timestamp DROP NOT NULL`;

      await sql`
        CREATE INDEX IF NOT EXISTS road_submissions_created_at_idx
        ON road_submissions (created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS road_submissions_workflow_status_idx
        ON road_submissions (workflow_status)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS road_submissions_collector_idx
        ON road_submissions (collector_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS road_submissions_collector_token_idx
        ON road_submissions (collector_id, collector_token_hash)
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS road_submissions_image_sha256_unique
        ON road_submissions (image_sha256)
        WHERE image_sha256 IS NOT NULL
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS road_submissions_archived_at_idx
        ON road_submissions (archived_at)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS road_progress_images (
          id UUID PRIMARY KEY,
          submission_id UUID NOT NULL REFERENCES road_submissions(id) ON DELETE CASCADE,
          stage VARCHAR(20) NOT NULL,
          note TEXT,
          captured_at TIMESTAMPTZ,
          image_path TEXT NOT NULL,
          image_name TEXT NOT NULL,
          image_type VARCHAR(80) NOT NULL,
          image_size INTEGER NOT NULL,
          privacy_processed BOOLEAN NOT NULL DEFAULT FALSE,
          privacy_blur_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT road_progress_images_stage_check
            CHECK (stage IN ('in-progress', 'after'))
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS road_progress_images_submission_idx
        ON road_progress_images (submission_id, created_at)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS road_report_events (
          id UUID PRIMARY KEY,
          submission_id UUID NOT NULL REFERENCES road_submissions(id) ON DELETE CASCADE,
          event_type VARCHAR(30) NOT NULL,
          workflow_status VARCHAR(30),
          note TEXT,
          progress_image_id UUID REFERENCES road_progress_images(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT road_report_events_type_check
            CHECK (event_type IN ('submitted', 'status', 'progress', 'archived', 'restored'))
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS road_report_events_submission_idx
        ON road_report_events (submission_id, created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS road_mobile_devices (
          id UUID PRIMARY KEY,
          collector_id VARCHAR(50) NOT NULL,
          device_token_hash CHAR(64) NOT NULL,
          expo_push_token TEXT,
          platform VARCHAR(20),
          notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (collector_id, device_token_hash)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS road_mobile_devices_collector_idx
        ON road_mobile_devices (collector_id, device_token_hash)
      `;
    })();
  }

  try {
    await schemaPromise;
  } catch (error) {
    schemaPromise = null;
    throw error;
  }
}
