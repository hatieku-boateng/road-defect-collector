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
export const WORKFLOW_STATUS_LABELS = {
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  assigned: "Assigned",
  "inspection-scheduled": "Inspection scheduled",
  "repair-in-progress": "Repair in progress",
  "repair-completed": "Repair completed",
} as const;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export type DefectType = (typeof DEFECT_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export function statusAllowsDirections(status: WorkflowStatus) {
  return status !== "pending" && status !== "rejected";
}

export function getDirectionsUrl(latitude: number, longitude: number) {
  const destination = encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

export function storageIsConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.BLOB_READ_WRITE_TOKEN);
}
