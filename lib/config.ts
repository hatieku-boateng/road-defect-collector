export const DEFECT_TYPES = [
  "pothole",
  "road-crack",
  "damaged-road-edge",
  "unsure",
] as const;

export const DEFECT_TYPE_LABELS: Readonly<
  Record<(typeof DEFECT_TYPES)[number], string>
> = Object.freeze({
  pothole: "Pothole",
  "road-crack": "Road crack",
  "damaged-road-edge": "Damaged road edge",
  unsure: "Unsure / other defect",
});

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;

export const WORKFLOW_STATUSES = [
  "pending",
  "verified",
  "rejected",
  "assigned",
  "inspection-scheduled",
  "repair-in-progress",
  "repair-completed",
] as const;

export const WORKFLOW_STATUS_LABELS: Readonly<
  Record<(typeof WORKFLOW_STATUSES)[number], string>
> = Object.freeze({
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  assigned: "Assigned",
  "inspection-scheduled": "Inspection scheduled",
  "repair-in-progress": "Repair in progress",
  "repair-completed": "Repair completed",
});

export const PROGRESS_IMAGE_STAGES = ["in-progress", "after"] as const;

export const PROGRESS_STAGE_LABELS: Readonly<
  Record<(typeof PROGRESS_IMAGE_STAGES)[number], string>
> = Object.freeze({
  "in-progress": "Repair in progress",
  after: "Repair completed",
});

export const SUBMISSION_SOURCES = ["manual", "drone-ai"] as const;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const IMAGE_MIME_TO_EXTENSION: Readonly<
  Record<(typeof ALLOWED_IMAGE_TYPES)[number], "jpg" | "png" | "webp">
> = Object.freeze({
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

/** Maximum allowed image upload size: 10 MB (10,485,760 bytes) */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Maximum length for administrative or progress notes */
export const MAX_NOTE_LENGTH = 500;

/** Maximum length for road/area names */
export const MIN_AREA_NAME_LENGTH = 3;
export const MAX_AREA_NAME_LENGTH = 160;

/** Approximate geographic bounding box for Ghana (with coastal/border buffer) */
export const GHANA_BOUNDS = Object.freeze({
  minLatitude: 4.5,
  maxLatitude: 11.5,
  minLongitude: -3.5,
  maxLongitude: 1.5,
});

export type DefectType = (typeof DEFECT_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type ProgressImageStage = (typeof PROGRESS_IMAGE_STAGES)[number];
export type SubmissionSource = (typeof SUBMISSION_SOURCES)[number];
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const DEFECT_TYPE_SET = new Set<string>(DEFECT_TYPES);
const REVIEW_STATUS_SET = new Set<string>(REVIEW_STATUSES);
const WORKFLOW_STATUS_SET = new Set<string>(WORKFLOW_STATUSES);
const PROGRESS_STAGE_SET = new Set<string>(PROGRESS_IMAGE_STAGES);
const SUBMISSION_SOURCE_SET = new Set<string>(SUBMISSION_SOURCES);
const ALLOWED_IMAGE_TYPE_SET = new Set<string>(ALLOWED_IMAGE_TYPES);

/**
 * Type guard for valid road defect types.
 */
export function isDefectType(value: unknown): value is DefectType {
  return typeof value === "string" && DEFECT_TYPE_SET.has(value.trim());
}

/**
 * Type guard for valid 3-state review statuses.
 */
export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && REVIEW_STATUS_SET.has(value.trim());
}

/**
 * Type guard for valid 7-state workflow statuses.
 */
export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return typeof value === "string" && WORKFLOW_STATUS_SET.has(value.trim());
}

/**
 * Type guard for valid repair progress image stages ("in-progress" | "after").
 */
export function isProgressImageStage(
  value: unknown,
): value is ProgressImageStage {
  return typeof value === "string" && PROGRESS_STAGE_SET.has(value.trim());
}

/**
 * Type guard for valid submission sources ("manual" | "drone-ai").
 */
export function isSubmissionSource(value: unknown): value is SubmissionSource {
  return typeof value === "string" && SUBMISSION_SOURCE_SET.has(value.trim());
}

/**
 * Type guard for allowed image MIME types.
 */
export function isAllowedImageType(value: unknown): value is AllowedImageType {
  return (
    typeof value === "string" &&
    ALLOWED_IMAGE_TYPE_SET.has(value.trim().toLowerCase())
  );
}

/**
 * Maps a detailed WorkflowStatus to its parent 3-state ReviewStatus.
 */
export function deriveReviewStatus(
  workflowStatus: WorkflowStatus,
): ReviewStatus {
  if (workflowStatus === "pending") return "pending";
  if (workflowStatus === "rejected") return "rejected";
  return "approved";
}

/**
 * Returns true if the submission's workflow status allows navigating to the defect location.
 */
export function statusAllowsDirections(status: WorkflowStatus): boolean {
  return status !== "pending" && status !== "rejected";
}

/**
 * Validates that latitude and longitude are finite WGS84 coordinates
 * and not an uninitialized (0, 0) Null Island reading.
 */
export function isValidGpsCoordinate(
  latitude: unknown,
  longitude: unknown,
): boolean {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return false;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }
  if (Math.abs(latitude) < 1e-6 && Math.abs(longitude) < 1e-6) {
    return false;
  }
  return true;
}

/**
 * Checks whether a valid GPS coordinate pair falls within Ghana's geographic boundaries.
 */
export function isWithinGhanaBounds(
  latitude: number,
  longitude: number,
): boolean {
  if (!isValidGpsCoordinate(latitude, longitude)) return false;
  return (
    latitude >= GHANA_BOUNDS.minLatitude &&
    latitude <= GHANA_BOUNDS.maxLatitude &&
    longitude >= GHANA_BOUNDS.minLongitude &&
    longitude <= GHANA_BOUNDS.maxLongitude
  );
}

/**
 * Builds a safe Google Maps turn-by-turn directions URL for a coordinate pair.
 */
export function getDirectionsUrl(latitude: number, longitude: number): string {
  const lat =
    Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
      ? Number(latitude.toFixed(6))
      : 0;
  const lon =
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
      ? Number(longitude.toFixed(6))
      : 0;
  const destination = encodeURIComponent(`${lat},${lon}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

/**
 * Verifies whether Neon Postgres database connection strings are configured.
 */
export function databaseIsConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim(),
  );
}

/**
 * Verifies whether Vercel Blob read/write token is configured.
 */
export function blobStorageIsConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/**
 * Verifies whether administrative authentication environment variables are configured.
 */
export function adminAuthIsConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_PASSWORD?.trim() && process.env.SESSION_SECRET?.trim(),
  );
}

/**
 * Verifies whether both persistent database storage and blob storage are configured.
 */
export function storageIsConfigured(): boolean {
  return databaseIsConfigured() && blobStorageIsConfigured();
}