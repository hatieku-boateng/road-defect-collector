import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../../../../../lib/config";
import { ensureSchema, getSql } from "../../../../../lib/db";
import { notifyReportOwner } from "../../../../../lib/push";
import type { ProgressImageStage } from "../../../../../lib/submissions";
import { recordReportEvent } from "../../../../../lib/submissions";

/** Strict 8-4-4-4-12 hexadecimal UUID pattern */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROGRESS_STAGES = new Set<ProgressImageStage>(["in-progress", "after"]);
const MAX_BLUR_COUNT = 10_000;
const MAX_NOTE_LENGTH = 500;

/** Allow up to 10 minutes of device clock drift into the future */
const MAX_FUTURE_DRIFT_MS = 10 * 60 * 1000;

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function sanitizeFileName(rawName: string, extension: string): string {
  const baseName = rawName
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);

  return `${baseName || "progress-image"}.${extension}`;
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

/**
 * Strictly parses a non-negative integer from FormData (rejects null, empty strings, and decimals).
 */
function parseBlurCount(rawValue: FormDataEntryValue | null): number | null {
  if (typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_BLUR_COUNT) {
    return null;
  }

  return parsed;
}

/**
 * Parses and normalizes an optional timestamp to ISO-8601 UTC format for PostgreSQL timestamptz.
 * Returns "" if empty, an ISO string if valid, or null if invalid/unreasonable.
 */
function normalizeCapturedAt(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;

  if (timestamp > Date.now() + MAX_FUTURE_DRIFT_MS) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function normalizeNote(rawValue: string): string {
  return rawValue
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_NOTE_LENGTH);
}

function wantsJsonResponse(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

function respondWithProgressResult(
  request: Request,
  result: "failed" | "success",
  options?: { status?: number; message?: string; progressImageId?: string },
) {
  if (wantsJsonResponse(request)) {
    return NextResponse.json(
      {
        success: result === "success",
        ...(options?.progressImageId ? { id: options.progressImageId } : {}),
        ...(options?.message ? { message: options.message } : {}),
      },
      {
        status: options?.status ?? (result === "success" ? 200 : 400),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.redirect(
    new URL(`/admin?progress=${result}`, request.url),
    303,
  );
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    if (wantsJsonResponse(request)) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return respondWithProgressResult(request, "failed", {
      status: 400,
      message: "Malformed multipart form data.",
    });
  }

  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const stage = String(formData.get("stage") ?? "").trim() as ProgressImageStage;
  const note = normalizeNote(String(formData.get("note") ?? ""));
  const capturedAt = normalizeCapturedAt(String(formData.get("capturedAt") ?? ""));
  const privacyProcessed =
    String(formData.get("privacyProcessed") ?? "").trim() === "true";
  const privacyBlurCount = parseBlurCount(formData.get("privacyBlurCount"));
  const image = formData.get("roadImage");

  const isAllowedType =
    image instanceof File &&
    ALLOWED_IMAGE_TYPES.includes(
      image.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    );

  if (
    !UUID_PATTERN.test(submissionId) ||
    !PROGRESS_STAGES.has(stage) ||
    !privacyProcessed ||
    privacyBlurCount === null ||
    capturedAt === null ||
    !(image instanceof File) ||
    image.size <= 0 ||
    image.size > MAX_IMAGE_SIZE ||
    !isAllowedType
  ) {
    return respondWithProgressResult(request, "failed", {
      status: 400,
      message: "Invalid progress image or parameters.",
    });
  }

  let imageBuffer: Buffer;
  try {
    imageBuffer = Buffer.from(await image.arrayBuffer());
  } catch {
    return respondWithProgressResult(request, "failed", {
      status: 400,
      message: "Unable to read uploaded image buffer.",
    });
  }

  if (!hasValidImageSignature(imageBuffer, image.type)) {
    return respondWithProgressResult(request, "failed", {
      status: 400,
      message: "Image binary header does not match its declared MIME type.",
    });
  }

  const id = randomUUID();
  const extension = MIME_TO_EXTENSION[image.type] ?? "jpg";
  const safeName = sanitizeFileName(image.name, extension);
  const targetWorkflowStatus =
    stage === "after" ? "repair-completed" : "repair-in-progress";

  let imagePath = "";
  let dbCommitted = false;

  try {
    await ensureSchema();
    const sql = getSql();

    const active = await sql.query(
      "SELECT id FROM road_submissions WHERE id = $1 AND archived_at IS NULL LIMIT 1",
      [submissionId],
    );
    const activeCount = Array.isArray(active)
      ? active.length
      : (active as { rowCount?: number }).rowCount ?? 0;

    if (activeCount === 0) {
      return respondWithProgressResult(request, "failed", {
        status: 404,
        message: "Active submission not found.",
      });
    }

    const blob = await put(
      `road-progress/${submissionId}/${id}-${safeName}`,
      imageBuffer,
      {
        access: "private",
        addRandomSuffix: false,
        contentType: image.type,
      },
    );
    imagePath = blob.pathname;

    // Atomically verify the submission is still unarchived, insert the progress image,
    // and advance the submission workflow status without downgrading completed repairs.
    const writeResult = await sql.query(
      `WITH updated_submission AS (
         UPDATE road_submissions
         SET workflow_status = CASE
               WHEN workflow_status = 'repair-completed' THEN 'repair-completed'
               ELSE $12
             END,
             status = 'approved',
             reviewed_at = COALESCE(reviewed_at, NOW())
         WHERE id = $2 AND archived_at IS NULL
         RETURNING id
       )
       INSERT INTO road_progress_images (
         id, submission_id, stage, note, captured_at,
         image_path, image_name, image_type, image_size,
         privacy_processed, privacy_blur_count
       )
       SELECT
         $1, updated_submission.id, $3, NULLIF($4, ''), NULLIF($5, '')::timestamptz,
         $6, $7, $8, $9, $10, $11
       FROM updated_submission
       RETURNING id`,
      [
        id,
        submissionId,
        stage,
        note,
        capturedAt,
        imagePath,
        safeName,
        image.type,
        imageBuffer.byteLength,
        privacyProcessed,
        privacyBlurCount,
        targetWorkflowStatus,
      ],
    );

    const insertedCount = Array.isArray(writeResult)
      ? writeResult.length
      : (writeResult as { rowCount?: number }).rowCount ?? 0;

    if (insertedCount === 0) {
      await del(imagePath).catch(() => undefined);
      return respondWithProgressResult(request, "failed", {
        status: 409,
        message: "Submission was archived or removed during upload.",
      });
    }

    dbCommitted = true;

    // Post-commit side effects: isolated so a notification or audit log hiccup
    // never deletes the committed blob or reports a false failure.
    const defaultEventNote =
      stage === "after"
        ? "Repair completion image added."
        : "Repair progress image added.";

    await recordReportEvent(
      submissionId,
      "progress",
      targetWorkflowStatus,
      note || defaultEventNote,
      id,
    ).catch((eventError) =>
      console.error("Failed to record progress report event", eventError),
    );

    await notifyReportOwner({
      body:
        note ||
        (stage === "after"
          ? "A completed repair image was added."
          : "A new repair progress image was added."),
      submissionId,
      title: "New road repair update",
    }).catch((notificationError) =>
      console.error("Progress notification failed", notificationError),
    );

    try {
      revalidatePath("/admin");
      revalidatePath("/reports");
    } catch (revalidateError) {
      console.warn("Cache revalidation warning:", revalidateError);
    }

    return respondWithProgressResult(request, "success", {
      progressImageId: id,
    });
  } catch (error) {
    if (imagePath && !dbCommitted) {
      await del(imagePath).catch(() => undefined);
    }
    console.error("Progress image upload failed", error);
    return respondWithProgressResult(request, "failed", {
      status: 500,
      message: "Progress image upload failed.",
    });
  }
}