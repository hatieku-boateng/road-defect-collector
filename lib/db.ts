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
        ADD COLUMN IF NOT EXISTS device_model VARCHAR(80)
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
        CREATE INDEX IF NOT EXISTS road_submissions_status_idx
        ON road_submissions (status)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS road_submissions_collector_idx
        ON road_submissions (collector_id)
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
