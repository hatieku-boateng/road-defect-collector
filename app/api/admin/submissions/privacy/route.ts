import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../../../../../lib/config";
import { ensureSchema, getSql } from "../../../../../lib/db";
import { getSubmission } from "../../../../../lib/submissions";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

async function fingerprint(image: File) {
  const digest = await crypto.subtle.digest("SHA-256", await image.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const count = Number(form.get("privacyBlurCount"));
  const image = form.get("roadImage");
  if (!UUID_PATTERN.test(id) || !Number.isInteger(count) || count < 0 || !(image instanceof File) ||
      image.size === 0 || image.size > MAX_IMAGE_SIZE ||
      !ALLOWED_IMAGE_TYPES.includes(image.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid privacy-safe image." }, { status: 400 });
  }

  const submission = await getSubmission(id);
  if (!submission || submission.archived_at) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  let replacementPath = "";
  try {
    const blob = await put(`road-images/${id}-admin-privacy-safe-${Date.now()}.jpg`, image, {
      access: "private", addRandomSuffix: false, contentType: image.type,
    });
    replacementPath = blob.pathname;
    await ensureSchema();
    const sql = getSql();
    await sql.query(
      `UPDATE road_submissions SET image_path = $2, image_name = $3, image_type = $4,
       image_size = $5, image_sha256 = $6, privacy_processed = TRUE,
       privacy_blur_count = $7 WHERE id = $1`,
      [id, replacementPath, image.name, image.type, image.size, await fingerprint(image), count],
    );
    await del(submission.image_path).catch(() => undefined);
    return NextResponse.json({ blurCount: count, success: true });
  } catch (error) {
    if (replacementPath) await del(replacementPath).catch(() => undefined);
    console.error("Admin privacy replacement failed", error);
    return NextResponse.json({ error: "Privacy-safe replacement failed." }, { status: 500 });
  }
}
