import type { DefectType, WorkflowStatus } from "./config";
import { ensureSchema, getSql } from "./db";

export type RoadSubmission = {
  archive_reason: string | null;
  archived_at: string | null;
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
  status: "approved" | "pending" | "rejected";
  source: "drone-ai" | "manual";
  suspected_defect: DefectType;
  video_timestamp: number | null;
  workflow_status: WorkflowStatus;
};

export type ProgressImageStage = "after" | "in-progress";

export type RoadProgressImage = {
  captured_at: string | null;
  created_at: string;
  id: string;
  image_name: string;
  image_path: string;
  image_size: number;
  image_type: string;
  note: string | null;
  privacy_blur_count: number;
  privacy_processed: boolean;
  stage: ProgressImageStage;
  submission_id: string;
};

export type SubmissionFilters = {
  collector?: string;
  defect?: string;
  source?: string;
  status?: string;
};

export type PublicRoadSubmission = Pick<
  RoadSubmission,
  | "area_name"
  | "created_at"
  | "id"
  | "latitude"
  | "longitude"
  | "source"
  | "suspected_defect"
  | "workflow_status"
>;

const publicLocationStatuses = [
  "verified",
  "assigned",
  "inspection-scheduled",
  "repair-in-progress",
  "repair-completed",
];

export async function listSubmissions(filters: SubmissionFilters = {}) {
  await ensureSchema();
  const sql = getSql();

  const rows = await sql.query(
    `
      SELECT *
      FROM road_submissions
      WHERE archived_at IS NULL
        AND ($1::text = '' OR workflow_status = $1)
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

export async function listArchivedSubmissions() {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    `SELECT * FROM road_submissions
     WHERE archived_at IS NOT NULL
     ORDER BY archived_at DESC
     LIMIT 500`,
  );
  return rows as RoadSubmission[];
}

export async function listProgressImages(includeArchived = false) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    `
      SELECT progress.*
      FROM road_progress_images progress
      JOIN road_submissions submission ON submission.id = progress.submission_id
      WHERE ($1::boolean OR submission.archived_at IS NULL)
      ORDER BY COALESCE(progress.captured_at, progress.created_at), progress.created_at
    `,
    [includeArchived],
  );
  return rows as RoadProgressImage[];
}

export async function getProgressImage(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "SELECT * FROM road_progress_images WHERE id = $1 LIMIT 1",
    [id],
  );
  return (rows[0] as RoadProgressImage | undefined) ?? null;
}

export async function archiveSubmission(id: string, reason: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    `UPDATE road_submissions
     SET archived_at = NOW(), archive_reason = NULLIF($2, '')
     WHERE id = $1 AND archived_at IS NULL
     RETURNING id`,
    [id, reason],
  );
  if (rows.length === 0) throw new Error("Submission not found.");
}

export async function restoreSubmission(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    `UPDATE road_submissions
     SET archived_at = NULL, archive_reason = NULL
     WHERE id = $1 AND archived_at IS NOT NULL
     RETURNING id`,
    [id],
  );
  if (rows.length === 0) throw new Error("Archived submission not found.");
}

export async function listPublicSubmissions() {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    `
      SELECT
        id,
        area_name,
        suspected_defect,
        created_at,
        workflow_status,
        source,
        CASE WHEN workflow_status = ANY($1::text[]) THEN latitude ELSE NULL END AS latitude,
        CASE WHEN workflow_status = ANY($1::text[]) THEN longitude ELSE NULL END AS longitude
      FROM road_submissions
      WHERE workflow_status <> 'rejected' AND archived_at IS NULL
      ORDER BY created_at DESC
      LIMIT 500
    `,
    [publicLocationStatuses],
  );

  return rows as PublicRoadSubmission[];
}

export async function getPublicSubmissionImage(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    `
      SELECT image_path, image_type
      FROM road_submissions
      WHERE id = $1 AND workflow_status <> 'rejected' AND archived_at IS NULL
      LIMIT 1
    `,
    [id],
  );

  return (rows[0] as Pick<RoadSubmission, "image_path" | "image_type"> | undefined) ?? null;
}

export async function listPublicProgressImages() {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    `
      SELECT progress.*
      FROM road_progress_images progress
      JOIN road_submissions submission ON submission.id = progress.submission_id
      WHERE submission.workflow_status <> 'rejected'
        AND submission.archived_at IS NULL
      ORDER BY COALESCE(progress.captured_at, progress.created_at), progress.created_at
    `,
  );
  return rows as RoadProgressImage[];
}

export async function getPublicProgressImage(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    `
      SELECT progress.*
      FROM road_progress_images progress
      JOIN road_submissions submission ON submission.id = progress.submission_id
      WHERE progress.id = $1
        AND submission.workflow_status <> 'rejected'
        AND submission.archived_at IS NULL
      LIMIT 1
    `,
    [id],
  );
  return (rows[0] as RoadProgressImage | undefined) ?? null;
}

export async function updateSubmissionReview(
  id: string,
  status: WorkflowStatus,
  note: string,
) {
  await ensureSchema();
  const sql = getSql();
  const reviewStatus = status === "pending"
    ? "pending"
    : status === "rejected"
      ? "rejected"
      : "approved";

  const updated = await sql.query(
    `
      UPDATE road_submissions
      SET workflow_status = $2,
          status = $3,
          review_note = NULLIF($4, ''),
          reviewed_at = NOW()
      WHERE id = $1 AND archived_at IS NULL
      RETURNING id
    `,
    [id, status, reviewStatus, note],
  );

  if (updated.length === 0) {
    throw new Error("Submission not found.");
  }
}
