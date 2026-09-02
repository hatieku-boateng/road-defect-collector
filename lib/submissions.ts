import type { DefectType, ReviewStatus } from "./config";
import { ensureSchema, getSql } from "./db";

export type RoadSubmission = {
  area_name: string;
  collector_id: string;
  created_at: string;
  device_manufacturer: string | null;
  device_model: string | null;
  ai_confidence: number | null;
  gps_accuracy: number | null;
  gps_timestamp: string | null;
  id: string;
  image_name: string;
  image_path: string;
  image_sha256: string | null;
  image_size: number;
  image_type: string;
  latitude: number | null;
  longitude: number | null;
  privacy_blur_count: number;
  privacy_processed: boolean;
  review_note: string | null;
  reviewed_at: string | null;
  status: ReviewStatus;
  source: "drone-ai" | "manual";
  suspected_defect: DefectType;
  video_timestamp: number | null;
};

export type SubmissionFilters = {
  collector?: string;
  defect?: string;
  source?: string;
  status?: string;
};

export async function listSubmissions(filters: SubmissionFilters = {}) {
  await ensureSchema();
  const sql = getSql();

  const rows = await sql.query(
    `
      SELECT *
      FROM road_submissions
      WHERE ($1::text = '' OR status = $1)
        AND ($2::text = '' OR suspected_defect = $2)
        AND ($3::text = '' OR collector_id ILIKE '%' || $3 || '%')
        AND ($4::text = '' OR source = $4)
      ORDER BY created_at DESC
      LIMIT 500
    `,
    [
      filters.status ?? "",
      filters.defect ?? "",
      filters.collector ?? "",
      filters.source ?? "",
    ],
  );

  return rows as RoadSubmission[];
}

export async function getSubmission(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "SELECT * FROM road_submissions WHERE id = $1 LIMIT 1",
    [id],
  );

  return (rows[0] as RoadSubmission | undefined) ?? null;
}

export async function updateSubmissionReview(
  id: string,
  status: ReviewStatus,
  note: string,
) {
  await ensureSchema();
  const sql = getSql();

  await sql.query(
    `
      UPDATE road_submissions
      SET status = $2, review_note = NULLIF($3, ''), reviewed_at = NOW()
      WHERE id = $1
    `,
    [id, status, note],
  );
}
