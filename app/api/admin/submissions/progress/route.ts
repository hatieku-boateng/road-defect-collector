import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../../../../../lib/config";
import { ensureSchema, getSql } from "../../../../../lib/db";
import type { ProgressImageStage } from "../../../../../lib/submissions";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;
const PROGRESS_STAGES = new Set<ProgressImageStage>(["in-progress", "after"]);

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 80);
}

function progressRedirect(request: Request, result: "failed" | "success") {
  return NextResponse.redirect(new URL(`/admin?progress=${result}`, request.url), 303);
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const formData = await request.formData();
  const submissionId = String(formData.get("submissionId") ?? "");
  const stage = String(formData.get("stage") ?? "") as ProgressImageStage;
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const capturedAt = String(formData.get("capturedAt") ?? "");
  const privacyProcessed = String(formData.get("privacyProcessed") ?? "") === "true";
  const privacyBlurCount = Number(formData.get("privacyBlurCount"));
  const image = formData.get("roadImage");

  if (
    !UUID_PATTERN.test(submissionId) ||
    !PROGRESS_STAGES.has(stage) ||
    !privacyProcessed ||
    !Number.isInteger(privacyBlurCount) ||
    privacyBlurCount < 0 ||
    (capturedAt && Number.isNaN(Date.parse(capturedAt))) ||
    !(image instanceof File) ||
    image.size === 0 ||
    image.size > MAX_IMAGE_SIZE ||
    !ALLOWED_IMAGE_TYPES.includes(image.type as (typeof ALLOWED_IMAGE_TYPES)[number])
  ) {
    return progressRedirect(request, "failed");
  }

  const id = crypto.randomUUID();
  const safeName = sanitizeFileName(image.name) || "progress-image.jpg";
  let imagePath = "";

  try {
    await ensureSchema();
    const sql = getSql();
    const active = await sql.query(
      "SELECT id FROM road_submissions WHERE id = $1 AND archived_at IS NULL LIMIT 1",
      [submissionId],
    );
    if (active.length === 0) return progressRedirect(request, "failed");

    const blob = await put(`road-progress/${submissionId}/${id}-${safeName}`, image, {
      access: "private",
      addRandomSuffix: false,
      contentType: image.type,
    });
    imagePath = blob.pathname;

    await sql.query(
      `INSERT INTO road_progress_images (
        id, submission_id, stage, note, captured_at,
        image_path, image_name, image_type, image_size,
        privacy_processed, privacy_blur_count
      ) VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, '')::timestamptz,
        $6, $7, $8, $9, $10, $11)`,
      [
        id, submissionId, stage, note, capturedAt, imagePath,
        image.name, image.type, image.size, privacyProcessed, privacyBlurCount,
      ],
    );

    revalidatePath("/admin");
    revalidatePath("/reports");
    return progressRedirect(request, "success");
  } catch (error) {
    if (imagePath) await del(imagePath).catch(() => undefined);
    console.error("Progress image upload failed", error);
    return progressRedirect(request, "failed");
  }
}
