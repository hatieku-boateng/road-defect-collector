import { randomUUID } from "node:crypto";
import {
  deriveReviewStatus,
  isDefectType,
  isSubmissionSource,
  isWorkflowStatus,
  MAX_NOTE_LENGTH,
  type DefectType,
  type ProgressImageStage,
  type ReviewStatus,
  type SubmissionSource,
  type WorkflowStatus,
} from "./config";
import { ensureSchema, extractRows, getSql } from "./db";

export type { ProgressImageStage };

export type RoadSubmission = {
  archive_reason: string | null;
  archived_at: string | null;
  area_name: string;
  collector_id: string;
  collector_token_hash: string | null;
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
  source: SubmissionSource;
  suspected_defect: DefectType;
  video_timestamp: number | null;
  workflow_status: WorkflowStatus;
};

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

export type RoadReportEvent = {
  created_at: string;
  event_type: "archived" | "progress" | "restored" | "status" | "submitted";
  id: string;
  note: string | null;
  progress_image_id: string | null;
  submission_id: string;
  workflow_status: WorkflowStatus;
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

export type PublicSubmissionImageMetadata = Pick<
  RoadSubmission,
  | "id"
  | "image_path"
  | "image_name"
  | "image_type"
  | "image_size"
  | "image_sha256"
  | "privacy_processed"
  | "archived_at"
>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PUBLIC_LOCATION_STATUSES: readonly WorkflowStatus[] = Object.freeze([
  "verified",
  "assigned",
  "inspection-scheduled",
  "repair-in-progress",
  "repair-completed",
]);

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function sanitizeNote(rawNote: string | null | undefined): string {
  if (typeof rawNote !== "string") return "";
  return rawNote
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_NOTE_LENGTH);
}

/**
 * Escapes `%`, `_`, and `\` so user-supplied search substrings are matched literally in ILIKE.
 */
function escapeIlikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function listSubmissions(
  filters: SubmissionFilters = {},
): Promise<RoadSubmission[]> {
  await ensureSchema();
  const sql = getSql();

  const statusFilter =
    filters.status && isWorkflowStatus(filters.status)
      ? filters.status.trim()
      : "";
  const defectFilter =
    filters.defect && isDefectType(filters.defect) ? filters.defect.trim() : "";
  const sourceFilter =
    filters.source && isSubmissionSource(filters.source)
      ? filters.source.trim()
      : "";
  const collectorFilter = filters.collector?.trim()
    ? escapeIlikePattern(filters.collector.trim().slice(0, 64))
    : "";

  const result = await sql.query(
    `SELECT *
     FROM road_submissions
     WHERE archived_at IS NULL
       AND ($1::text = '' OR workflow_status = $1)
       AND ($2::text = '' OR suspected_defect = $2)
       AND ($3::text = '' OR collector_id ILIKE '%' || $3 || '%' ESCAPE '\\')
       AND ($4::text = '' OR source = $4)
     ORDER BY created_at DESC
     LIMIT 500`,
    [statusFilter, defectFilter, collectorFilter, sourceFilter],
  );

  return extractRows<RoadSubmission>(result);
}

export async function getSubmission(
  id: string,
): Promise<RoadSubmission | null> {
  const cleanId = typeof id === "string" ? id.trim() : "";
  if (!isValidUuid(cleanId)) return null;

  await ensureSchema();
  const sql = getSql();
  const result = await sql.query(
    "SELECT * FROM road_submissions WHERE id = $1 LIMIT 1",
    [cleanId],
  );

  const rows = extractRows<RoadSubmission>(result);
  return rows[0] ?? null;
}

export async function listArchivedSubmissions(): Promise<RoadSubmission[]> {
  await ensureSchema();
  const sql = getSql();
  const result = await sql.query(
    `SELECT *
     FROM road_submissions
     WHERE archived_at IS NOT NULL
     ORDER BY archived_at DESC
     LIMIT 500`,
  );
  return extractRows<RoadSubmission>(result);
}

export async function listProgressImages(
  includeArchived = false,
): Promise<RoadProgressImage[]> {
  await ensureSchema();
  const sql = getSql();
  const result = await sql.query(
    `SELECT progress.*
     FROM road_progress_images progress
     INNER JOIN road_submissions submission
       ON submission.id = progress.submission_id
     WHERE ($1::boolean OR submission.archived_at IS NULL)
     ORDER BY COALESCE(progress.captured_at, progress.created_at) ASC, progress.created_at ASC`,
    [Boolean(includeArchived)],
  );
  return extractRows<RoadProgressImage>(result);
}

export async function getProgressImage(
  id: string,
): Promise<RoadProgressImage | null> {
  const cleanId = typeof id === "string" ? id.trim() : "";
  if (!isValidUuid(cleanId)) return null;

  await ensureSchema();
  const sql = getSql();
  const result = await sql.query(
    "SELECT * FROM road_progress_images WHERE id = $1 LIMIT 1",
    [cleanId],
  );
  const rows = extractRows<RoadProgressImage>(result);
  return rows[0] ?? null;
}

export async function listReportEvents(
  submissionIds: string[],
): Promise<RoadReportEvent[]> {
  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    return [];
  }

  const validIds = Array.from(
    new Set(
      submissionIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => isValidUuid(id)),
    ),
  );

  if (validIds.length === 0) {
    return [];
  }

  await ensureSchema();
  const sql = getSql();
  const result = await sql.query(
    `SELECT *
     FROM road_report_events
     WHERE submission_id = ANY($1::uuid[])
     ORDER BY created_at DESC`,
    [validIds],
  );
  return extractRows<RoadReportEvent>(result);
}

export async function recordReportEvent(
  submissionId: string,
  eventType: RoadReportEvent["event_type"],
  status: WorkflowStatus | null,
  note: string,
  progressImageId?: string,
): Promise<void> {
  const cleanSubmissionId =
    typeof submissionId === "string" ? submissionId.trim() : "";
  if (!isValidUuid(cleanSubmissionId)) {
    throw new Error("Invalid submission ID for report event.");
  }

  const cleanProgressImageId =
    progressImageId && isValidUuid(progressImageId)
      ? progressImageId.trim()
      : null;
  const cleanNote = sanitizeNote(note);

  await ensureSchema();
  const sql = getSql();

  // road_report_events.workflow_status is NOT NULL; if caller passes null,
  // resolve the current workflow_status from road_submissions atomically.
  await sql.query(
    `INSERT INTO road_report_events (
       id,
       submission_id,
       event_type,
       workflow_status,
       note,
       progress_image_id
     )
     SELECT
       $1,
       submission.id,
       $3,
       COALESCE($4::text, submission.workflow_status, 'pending'),
       NULLIF($5, ''),
       $6
     FROM road_submissions submission
     WHERE submission.id = $2`,
    [
      randomUUID(),
      cleanSubmissionId,
      eventType,
      status ?? null,
      cleanNote,
      cleanProgressImageId,
    ],
  );
}

export async function archiveSubmission(
  id: string,
  reason: string,
): Promise<void> {
  const cleanId = typeof id === "string" ? id.trim() : "";
  if (!isValidUuid(cleanId)) {
    throw new Error("Submission not found.");
  }

  const cleanReason = sanitizeNote(reason);

  await ensureSchema();
  const sql = getSql();

  const result = await sql.query(
    `WITH archived AS (
       UPDATE road_submissions
       SET archived_at = NOW(),
           archive_reason = NULLIF($2, '')
       WHERE id = $1
         AND archived_at IS NULL
       RETURNING id, workflow_status
     )
     INSERT INTO road_report_events (
       id,
       submission_id,
       event_type,
       workflow_status,
       note
     )
     SELECT
       $3,
       archived.id,
       'archived',
       archived.workflow_status,
       COALESCE(NULLIF($2, ''), 'Report archived by administrator.')
     FROM archived
     RETURNING submission_id AS id`,
    [cleanId, cleanReason, randomUUID()],
  );

  const rows = extractRows<{ id: string }>(result);
  if (rows.length === 0) {
    throw new Error("Submission not found.");
  }
}

export async function restoreSubmission(id: string): Promise<void> {
  const cleanId = typeof id === "string" ? id.trim() : "";
  if (!isValidUuid(cleanId)) {
    throw new Error("Archived submission not found.");
  }

  await ensureSchema();
  const sql = getSql();

  const result = await sql.query(
    `WITH restored AS (
       UPDATE road_submissions
       SET archived_at = NULL,
           archive_reason = NULL
       WHERE id = $1
         AND archived_at IS NOT NULL
       RETURNING id, workflow_status
     )
     INSERT INTO road_report_events (
       id,
       submission_id,
       event_type,
       workflow_status,
       note
     )
     SELECT
       $2,
       restored.id,
       'restored',
       restored.workflow_status,
       'Report restored from archive.'
     FROM restored
     RETURNING submission_id AS id`,
    [cleanId, randomUUID()],
  );

  const rows = extractRows<{ id: string }>(result);
  if (rows.length === 0) {
    throw new Error("Archived submission not found.");
  }
}

export async function listPublicSubmissions(): Promise<PublicRoadSubmission[]> {
  await ensureSchema();
  const sql = getSql();
  const result = await sql.query(
    `SELECT
       id,
       area_name,
       suspected_defect,
       created_at,
       workflow_status,
       source,
       CASE WHEN workflow_status = ANY($1::text[]) THEN latitude ELSE NULL END AS latitude,
       CASE WHEN workflow_status = ANY($1::text[]) THEN longitude ELSE NULL END AS longitude
     FROM road_submissions
     WHERE workflow_status = ANY($1::text[])
       AND archived_at IS NULL
       AND privacy_processed = TRUE
     ORDER BY created_at DESC
     LIMIT 500`,
    [PUBLIC_LOCATION_STATUSES],
  );

  return extractRows<PublicRoadSubmission>(result);
}

export async function getPublicSubmissionImage(
  id: string,
): Promise<PublicSubmissionImageMetadata | null> {
  const cleanId = typeof id === "string" ? id.trim() : "";
  if (!isValidUuid(cleanId)) return null;

  await ensureSchema();
  const sql = getSql();
  const result = await sql.query(
    `SELECT
       id,
       image_path,
       image_name,
       image_type,
       image_size,
       image_sha256,
       privacy_processed,
       archived_at
     FROM road_submissions
     WHERE id = $1
       AND workflow_status = ANY($2::text[])
       AND archived_at IS NULL
       AND privacy_processed = TRUE
     LIMIT 1`,
    [cleanId, PUBLIC_LOCATION_STATUSES],
  );

  const rows = extractRows<PublicSubmissionImageMetadata>(result);
  return rows[0] ?? null;
}

export async function listPublicProgressImages(): Promise<RoadProgressImage[]> {
  await ensureSchema();
  const sql = getSql();
  const result = await sql.query(
    `SELECT progress.*
     FROM road_progress_images progress
     INNER JOIN road_submissions submission
       ON submission.id = progress.submission_id
     WHERE submission.workflow_status = ANY($1::text[])
       AND submission.archived_at IS NULL
       AND progress.privacy_processed = TRUE
     ORDER BY COALESCE(progress.captured_at, progress.created_at) ASC, progress.created_at ASC`,
    [PUBLIC_LOCATION_STATUSES],
  );
  return extractRows<RoadProgressImage>(result);
}

export async function getPublicProgressImage(
  id: string,
): Promise<RoadProgressImage | null> {
  const cleanId = typeof id === "string" ? id.trim() : "";
  if (!isValidUuid(cleanId)) return null;

  await ensureSchema();
  const sql = getSql();
  const result = await sql.query(
    `SELECT progress.*
     FROM road_progress_images progress
     INNER JOIN road_submissions submission
       ON submission.id = progress.submission_id
     WHERE progress.id = $1
       AND submission.workflow_status = ANY($2::text[])
       AND submission.archived_at IS NULL
       AND progress.privacy_processed = TRUE
     LIMIT 1`,
    [cleanId, PUBLIC_LOCATION_STATUSES],
  );
  const rows = extractRows<RoadProgressImage>(result);
  return rows[0] ?? null;
}

export async function updateSubmissionReview(
  id: string,
  status: WorkflowStatus,
  note: string,
): Promise<{ id: string }> {
  const cleanId = typeof id === "string" ? id.trim() : "";
  if (!isValidUuid(cleanId)) {
    throw new Error("Submission not found.");
  }

  if (!isWorkflowStatus(status)) {
    throw new Error("Invalid workflow status.");
  }

  const reviewStatus = deriveReviewStatus(status);
  const cleanNote = sanitizeNote(note);

  await ensureSchema();
  const sql = getSql();

  const result = await sql.query(
    `WITH updated AS (
       UPDATE road_submissions
       SET workflow_status = $2,
           status = $3,
           review_note = NULLIF($4, ''),
           reviewed_at = NOW()
       WHERE id = $1
         AND archived_at IS NULL
       RETURNING id, workflow_status
     )
     INSERT INTO road_report_events (
       id,
       submission_id,
       event_type,
       workflow_status,
       note
     )
     SELECT
       $5,
       updated.id,
       'status',
       updated.workflow_status,
       NULLIF($4, '')
     FROM updated
     RETURNING submission_id AS id`,
    [cleanId, status, reviewStatus, cleanNote, randomUUID()],
  );

  const rows = extractRows<{ id: string }>(result);
  if (rows.length === 0) {
    throw new Error("Submission not found.");
  }

  return rows[0];
}