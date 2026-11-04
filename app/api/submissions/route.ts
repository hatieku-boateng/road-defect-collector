import { createHash, randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_TYPES,
  DEFECT_TYPES,
  MAX_IMAGE_SIZE,
  storageIsConfigured,
} from "../../../lib/config";
import { ensureSchema, getSql } from "../../../lib/db";
import {
  hashDeviceToken,
  validateMobileCredentials,
} from "../../../lib/mobile-auth";

const MAX_BLUR_COUNT = 10_000;
const MAX_GPS_ACCURACY_METERS = 100_000;
/** Allow up to 10 minutes of mobile/drone clock drift into the future */
const MAX_FUTURE_DRIFT_MS = 10 * 60 * 1000;

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function getText(formData: FormData, key: string, maxLength = 500): string {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function getNumber(formData: FormData, key: string): number | null {
  const textValue = getText(formData, key, 64);
  if (!textValue) return null;
  const value = Number(textValue);
  return Number.isFinite(value) ? value : null;
}

function getStrictNonNegativeInt(
  formData: FormData,
  key: string,
  max: number,
): number | null {
  const textValue = getText(formData, key, 32);
  if (!/^\d+$/.test(textValue)) return null;
  const parsed = Number.parseInt(textValue, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > max) {
    return null;
  }
  return parsed;
}

function normalizeTimestamp(rawValue: string): string | null {
  if (!rawValue) return "";
  const parsed = Date.parse(rawValue);
  if (Number.isNaN(parsed)) return null;
  if (parsed > Date.now() + MAX_FUTURE_DRIFT_MS) return null;
  return new Date(parsed).toISOString();
}

function sanitizeFileName(fileName: string, extension: string): string {
  const baseName = fileName
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return `${baseName || "road-image"}.${extension}`;
}

/**
 * Verifies that the binary file signature (magic bytes) matches the claimed MIME type.
 */
function hasValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // WebP: "RIFF" .... "WEBP"
  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return true;
}

function extractRows<T>(result: unknown): T[] {
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

function isDuplicateImageError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: string; constraint?: string };
  return (
    databaseError.code === "23505" &&
    databaseError.constraint === "road_submissions_image_sha256_unique"
  );
}

export async function POST(request: Request) {
  if (!storageIsConfigured()) {
    return NextResponse.json(
      { error: "Storage has not been configured for this deployment." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Malformed submission form data." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const collectorId = getText(formData, "collectorId", 64);
  const collectorToken = getText(formData, "collectorToken", 256);
  const deviceManufacturer = getText(formData, "deviceManufacturer", 100);
  const deviceModel = getText(formData, "deviceModel", 100);
  const areaName = getText(formData, "areaName", 200);
  const suspectedDefect = getText(formData, "suspectedDefect", 80);
  const latitude = getNumber(formData, "latitude");
  const longitude = getNumber(formData, "longitude");
  const gpsAccuracy = getNumber(formData, "gpsAccuracy");
  const rawGpsTimestamp = getText(formData, "gpsTimestamp", 64);
  const gpsTimestamp = normalizeTimestamp(rawGpsTimestamp);
  const source = getText(formData, "source", 32) || "manual";
  const videoTimestamp = getNumber(formData, "videoTimestamp");
  const aiConfidence = getNumber(formData, "aiConfidence");
  const privacyProcessed = getText(formData, "privacyProcessed", 16) === "true";
  const privacyBlurCount = getStrictNonNegativeInt(
    formData,
    "privacyBlurCount",
    MAX_BLUR_COUNT,
  );
  const image = formData.get("roadImage");

  if (source !== "manual" && source !== "drone-ai") {
    return NextResponse.json(
      { error: "Select a valid submission source." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (!privacyProcessed || privacyBlurCount === null) {
    return NextResponse.json(
      { error: "Complete the privacy check before submitting this image." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (source === "manual" && !/^\d{12}$/.test(collectorId)) {
    return NextResponse.json(
      {
        error:
          "The device collector ID is invalid. Reload the collection form and try again.",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (
    collectorToken &&
    !validateMobileCredentials(collectorId, collectorToken)
  ) {
    return NextResponse.json(
      { error: "The mobile collector credentials are invalid." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (
    source === "drone-ai" &&
    !/^[a-z0-9][a-z0-9_-]{2,49}$/i.test(collectorId)
  ) {
    return NextResponse.json(
      {
        error:
          "Operator ID must contain 3–50 letters, numbers, hyphens or underscores.",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (
    source === "manual" &&
    (!deviceManufacturer ||
      deviceManufacturer.length > 80 ||
      !deviceModel ||
      deviceModel.length > 80)
  ) {
    return NextResponse.json(
      {
        error:
          "The device information is invalid. Reload the collection form and try again.",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (
    source === "drone-ai" &&
    (deviceManufacturer.length > 80 || deviceModel.length > 80)
  ) {
    return NextResponse.json(
      { error: "The device information exceeds the maximum allowed length." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (areaName.length < 3 || areaName.length > 160) {
    return NextResponse.json(
      { error: "Enter a road or area name between 3 and 160 characters." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (!DEFECT_TYPES.includes(suspectedDefect as (typeof DEFECT_TYPES)[number])) {
    return NextResponse.json(
      { error: "Select a valid suspected defect type." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const hasValidCoordinates =
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  const hasValidGpsAccuracy =
    gpsAccuracy !== null &&
    gpsAccuracy >= 0 &&
    gpsAccuracy <= MAX_GPS_ACCURACY_METERS;

  if (
    source === "manual" &&
    (!hasValidCoordinates || !hasValidGpsAccuracy)
  ) {
    return NextResponse.json(
      { error: "Capture a valid GPS location before submitting." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  // If drone-ai optionally provides coordinates or accuracy, validate their bounds too
  if (
    source === "drone-ai" &&
    ((latitude !== null || longitude !== null) && !hasValidCoordinates ||
      (gpsAccuracy !== null && !hasValidGpsAccuracy))
  ) {
    return NextResponse.json(
      { error: "Capture a valid GPS location before submitting." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (source === "manual" && (!gpsTimestamp || gpsTimestamp === null)) {
    return NextResponse.json(
      {
        error: "The GPS capture time is invalid. Capture the location again.",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (source === "drone-ai" && gpsTimestamp === null) {
    return NextResponse.json(
      {
        error: "The GPS capture time is invalid. Capture the location again.",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (
    source === "drone-ai" &&
    (videoTimestamp === null ||
      videoTimestamp < 0 ||
      aiConfidence === null ||
      aiConfidence < 0 ||
      aiConfidence > 1)
  ) {
    return NextResponse.json(
      { error: "The drone candidate metadata is invalid." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (!(image instanceof File) || image.size <= 0) {
    return NextResponse.json(
      { error: "Select a road image before submitting." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (
    !ALLOWED_IMAGE_TYPES.includes(
      image.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  ) {
    return NextResponse.json(
      { error: "Only JPG, PNG and WebP images are accepted." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: "The road image must be 10 MB or smaller." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  let imageBuffer: Buffer;
  try {
    imageBuffer = Buffer.from(await image.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "Unable to read the uploaded road image." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (!hasValidImageSignature(imageBuffer, image.type)) {
    return NextResponse.json(
      { error: "Only valid JPG, PNG and WebP image files are accepted." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const id = randomUUID();
  const eventId = randomUUID();
  const extension = MIME_TO_EXTENSION[image.type] ?? "jpg";
  const safeName = sanitizeFileName(image.name, extension);
  const imageSha256 = createHash("sha256").update(imageBuffer).digest("hex");
  const tokenHash = collectorToken ? hashDeviceToken(collectorToken) : null;

  let imagePath = "";
  let dbCommitted = false;

  try {
    await ensureSchema();
    const sql = getSql();

    const existingResult = await sql.query(
      "SELECT id FROM road_submissions WHERE image_sha256 = $1 LIMIT 1",
      [imageSha256],
    );
    const existingRows = extractRows<{ id: string }>(existingResult);

    if (existingRows.length > 0) {
      return NextResponse.json(
        {
          error: "This image has already been submitted.",
          existingId: String(existingRows[0].id),
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const blob = await put(`road-images/${id}-${safeName}`, imageBuffer, {
      access: "private",
      addRandomSuffix: false,
      contentType: image.type,
    });
    imagePath = blob.pathname;

    // Atomically insert both the submission record and its initial audit event
    // in a single PostgreSQL CTE statement.
    await sql.query(
      `WITH inserted_submission AS (
         INSERT INTO road_submissions (
           id, collector_id, area_name, suspected_defect,
           latitude, longitude, gps_accuracy, gps_timestamp,
           image_path, image_name, image_type, image_size,
           source, video_timestamp, ai_confidence,
           privacy_processed, privacy_blur_count,
           device_manufacturer, device_model, image_sha256, collector_token_hash
         )
         VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, NULLIF($8, '')::timestamptz,
           $9, $10, $11, $12,
           $13, $14, $15,
           $16, $17,
           NULLIF($18, ''), NULLIF($19, ''), $20, $21
         )
         RETURNING id
       )
       INSERT INTO road_report_events (
         id, submission_id, event_type, workflow_status, note
       )
       SELECT
         $22,
         inserted_submission.id,
         'submitted',
         'pending',
         'Report submitted and awaiting review.'
       FROM inserted_submission`,
      [
        id,
        collectorId,
        areaName,
        suspectedDefect,
        latitude,
        longitude,
        gpsAccuracy,
        gpsTimestamp,
        imagePath,
        safeName,
        image.type,
        imageBuffer.byteLength,
        source,
        source === "drone-ai" ? videoTimestamp : null,
        source === "drone-ai" ? aiConfidence : null,
        privacyProcessed,
        privacyBlurCount,
        deviceManufacturer,
        deviceModel,
        imageSha256,
        tokenHash,
        eventId,
      ],
    );

    dbCommitted = true;

    try {
      revalidatePath("/admin");
      revalidatePath("/reports");
    } catch (revalidateError) {
      console.warn("Submission cache revalidation warning:", revalidateError);
    }

    return NextResponse.json(
      { id, status: "pending" },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (imagePath && !dbCommitted) {
      await del(imagePath).catch(() => undefined);
    }

    if (isDuplicateImageError(error)) {
      let existingId: string | undefined;
      try {
        const sql = getSql();
        const duplicateLookup = await sql.query(
          "SELECT id FROM road_submissions WHERE image_sha256 = $1 LIMIT 1",
          [imageSha256],
        );
        const rows = extractRows<{ id: string }>(duplicateLookup);
        if (rows[0]?.id) existingId = String(rows[0].id);
      } catch {
        // Ignore secondary lookup error
      }

      return NextResponse.json(
        {
          error: "This image has already been submitted.",
          ...(existingId ? { existingId } : {}),
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    console.error("Road submission failed", error);
    return NextResponse.json(
      { error: "The record could not be saved. Please try again." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}