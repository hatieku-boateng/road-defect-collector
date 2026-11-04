import { createHash, randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../../../../../lib/config";
import { ensureSchema, getSql } from "../../../../../lib/db";
import { getSubmission } from "../../../../../lib/submissions";

/** Strict 8-4-4-4-12 hexadecimal UUID pattern */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BLUR_COUNT = 10_000;

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
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

  // Fallback for any other explicitly configured ALLOWED_IMAGE_TYPES
  return true;
}

/**
 * Sanitizes client-supplied filenames and ensures the extension matches the MIME type.
 */
function sanitizeImageName(rawName: string, extension: string): string {
  const baseName = rawName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${baseName || "privacy-safe-image"}.${extension}`;
}

/**
 * Parses a non-negative integer strictly from FormData (rejects null, empty strings, and floats).
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

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Malformed multipart form data." },
      { status: 400 },
    );
  }

  const id = String(form.get("id") ?? "").trim();
  const blurCount = parseBlurCount(form.get("privacyBlurCount"));
  const image = form.get("roadImage");

  const isAllowedType =
    image instanceof File &&
    ALLOWED_IMAGE_TYPES.includes(
      image.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    );

  if (
    !UUID_PATTERN.test(id) ||
    blurCount === null ||
    !(image instanceof File) ||
    image.size <= 0 ||
    image.size > MAX_IMAGE_SIZE ||
    !isAllowedType
  ) {
    return NextResponse.json(
      { error: "Invalid privacy-safe image or parameters." },
      { status: 400 },
    );
  }

  let imageBuffer: Buffer;
  try {
    imageBuffer = Buffer.from(await image.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "Unable to read uploaded image buffer." },
      { status: 400 },
    );
  }

  if (!hasValidImageSignature(imageBuffer, image.type)) {
    return NextResponse.json(
      { error: "Image binary header does not match its declared MIME type." },
      { status: 400 },
    );
  }

  const submission = await getSubmission(id);
  if (!submission || submission.archived_at) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const imageHash = computeSha256(imageBuffer);
  const extension = MIME_TO_EXTENSION[image.type] ?? "jpg";
  const safeImageName = sanitizeImageName(image.name, extension);

  await ensureSchema();
  const sql = getSql();

  // Fast path: if the uploaded image bytes are identical to the current submission image,
  // update the privacy flags in-place without re-uploading or deleting the existing blob.
  if (submission.image_sha256 === imageHash && submission.image_path) {
    try {
      await sql.query(
        `UPDATE road_submissions
         SET privacy_processed = TRUE,
             privacy_blur_count = $2
         WHERE id = $1 AND archived_at IS NULL`,
        [id, blurCount],
      );

      return NextResponse.json(
        { blurCount, deduplicated: true, sha256: imageHash, success: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      console.error("Admin privacy metadata update failed", error);
      return NextResponse.json(
        { error: "Privacy-safe replacement failed." },
        { status: 500 },
      );
    }
  }

  let replacementPath = "";
  const blobKey = `road-images/${id}-admin-privacy-safe-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;

  try {
    const blob = await put(blobKey, imageBuffer, {
      access: "private",
      addRandomSuffix: false,
      contentType: image.type,
    });
    replacementPath = blob.pathname;

    const updateResult = await sql.query(
      `UPDATE road_submissions
       SET image_path = $2,
           image_name = $3,
           image_type = $4,
           image_size = $5,
           image_sha256 = $6,
           privacy_processed = TRUE,
           privacy_blur_count = $7
       WHERE id = $1 AND archived_at IS NULL
       RETURNING id`,
      [
        id,
        replacementPath,
        safeImageName,
        image.type,
        imageBuffer.byteLength,
        imageHash,
        blurCount,
      ],
    );

    const updatedRows = Array.isArray(updateResult)
      ? updateResult.length
      : (updateResult as { rowCount?: number }).rowCount ?? 0;

    if (updatedRows === 0) {
      await del(replacementPath).catch(() => undefined);
      return NextResponse.json(
        { error: "Report is no longer active or could not be updated." },
        { status: 409 },
      );
    }

    if (submission.image_path && submission.image_path !== replacementPath) {
      await del(submission.image_path).catch((delError) => {
        console.warn("Failed to remove previous submission blob:", delError);
      });
    }

    return NextResponse.json(
      { blurCount, sha256: imageHash, success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (replacementPath) {
      await del(replacementPath).catch(() => undefined);
    }

    const dbErrorCode = (error as { code?: string })?.code;
    if (dbErrorCode === "23505") {
      return NextResponse.json(
        { error: "This exact processed image already exists in another report." },
        { status: 409 },
      );
    }

    console.error("Admin privacy replacement failed", error);
    return NextResponse.json(
      { error: "Privacy-safe replacement failed." },
      { status: 500 },
    );
  }
}