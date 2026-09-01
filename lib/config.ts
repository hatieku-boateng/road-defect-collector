export const DEFECT_TYPES = [
  "pothole",
  "road-crack",
  "damaged-road-edge",
  "unsure",
] as const;

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export type DefectType = (typeof DEFECT_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export function storageIsConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.BLOB_READ_WRITE_TOKEN);
}
