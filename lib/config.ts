export const DEFECT_TYPES = [
  "pothole",
  "road-crack",
  "damaged-road-edge",
  "unsure",
] as const;

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

export const WORKFLOW_STATUS_LABELS: Record<
  (typeof WORKFLOW_STATUSES)[number],
  string
> = {
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  assigned: "Assigned",
  "inspection-scheduled": "Inspection scheduled",
  "repair-in-progress": "Repair in progress",
  "repair-completed": "Repair completed",
};

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

/** Maximum allowed image upload size: 10 MB */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export type DefectType = (typeof DEFECT_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type ProgressImageStage = "in-progress" | "after";

export function statusAllowsDirections(status: WorkflowStatus): boolean {
  return status !== "pending" && status !== "rejected";
}

export function getDirectionsUrl(latitude: number, longitude: number): string {
  const lat = Number.isFinite(latitude) ? latitude : 0;
  const lon = Number.isFinite(longitude) ? longitude : 0;
  const destination = encodeURIComponent(`${lat},${lon}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

/**
 * Verifies whether Vercel Blob storage is properly configured.
 */
export function storageIsConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/**
 * Verifies whether Neon Postgres database URL is configured.
 */
export function databaseIsConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim(),
  );
}

/**
 * Verifies whether administrative authentication environment variables are set.
 */
export function adminAuthIsConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_PASSWORD?.trim() && process.env.SESSION_SECRET?.trim(),
  );
}