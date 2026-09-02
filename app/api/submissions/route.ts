import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_TYPES,
  DEFECT_TYPES,
  MAX_IMAGE_SIZE,
  storageIsConfigured,
} from "../../../lib/config";
import { ensureSchema, getSql } from "../../../lib/db";

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const textValue = getText(formData, key);
  if (!textValue) return null;
  const value = Number(textValue);
  return Number.isFinite(value) ? value : null;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function createImageFingerprint(image: File) {
  const digest = await crypto.subtle.digest("SHA-256", await image.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function isDuplicateImageError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: string; constraint?: string };
  return databaseError.code === "23505" &&
    databaseError.constraint === "road_submissions_image_sha256_unique";
}

export async function POST(request: Request) {
  if (!storageIsConfigured()) {
    return NextResponse.json(
      { error: "Storage has not been configured for this deployment." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const collectorId = getText(formData, "collectorId");
  const deviceManufacturer = getText(formData, "deviceManufacturer");
  const deviceModel = getText(formData, "deviceModel");
  const areaName = getText(formData, "areaName");
  const suspectedDefect = getText(formData, "suspectedDefect");
  const latitude = getNumber(formData, "latitude");
  const longitude = getNumber(formData, "longitude");
  const gpsAccuracy = getNumber(formData, "gpsAccuracy");
  const gpsTimestamp = getText(formData, "gpsTimestamp");
  const source = getText(formData, "source") || "manual";
  const videoTimestamp = getNumber(formData, "videoTimestamp");
  const aiConfidence = getNumber(formData, "aiConfidence");
  const privacyProcessed = getText(formData, "privacyProcessed") === "true";
  const privacyBlurCount = getNumber(formData, "privacyBlurCount");
  const image = formData.get("roadImage");

  if (source !== "manual" && source !== "drone-ai") {
    return NextResponse.json({ error: "Select a valid submission source." }, { status: 400 });
  }

  if (
    !privacyProcessed ||
    privacyBlurCount === null ||
    privacyBlurCount < 0 ||
    !Number.isInteger(privacyBlurCount)
  ) {
    return NextResponse.json(
      { error: "Complete the privacy check before submitting this image." },
      { status: 400 },
    );
  }

  if (source === "manual" && !/^\d{12}$/.test(collectorId)) {
    return NextResponse.json(
      { error: "The device collector ID is invalid. Reload the collection form and try again." },
      { status: 400 },
    );
  }

  if (source === "drone-ai" && !/^[a-z0-9][a-z0-9_-]{2,49}$/i.test(collectorId)) {
    return NextResponse.json(
      { error: "Operator ID must contain 3–50 letters, numbers, hyphens or underscores." },
      { status: 400 },
    );
  }

  if (
    source === "manual" &&
    (!deviceManufacturer || deviceManufacturer.length > 80 || !deviceModel || deviceModel.length > 80)
  ) {
    return NextResponse.json(
      { error: "The device information is invalid. Reload the collection form and try again." },
      { status: 400 },
    );
  }

  if (areaName.length < 3 || areaName.length > 160) {
    return NextResponse.json(
      { error: "Enter a road or area name between 3 and 160 characters." },
      { status: 400 },
    );
  }

  if (!DEFECT_TYPES.includes(suspectedDefect as (typeof DEFECT_TYPES)[number])) {
    return NextResponse.json(
      { error: "Select a valid suspected defect type." },
      { status: 400 },
    );
  }

  if (source === "manual" && (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    gpsAccuracy === null ||
    gpsAccuracy < 0
  )) {
    return NextResponse.json(
      { error: "Capture a valid GPS location before submitting." },
      { status: 400 },
    );
  }

  if (source === "manual" && (!gpsTimestamp || Number.isNaN(Date.parse(gpsTimestamp)))) {
    return NextResponse.json(
      { error: "The GPS capture time is invalid. Capture the location again." },
      { status: 400 },
    );
  }

  if (
    source === "drone-ai" &&
    (videoTimestamp === null || videoTimestamp < 0 || aiConfidence === null ||
      aiConfidence < 0 || aiConfidence > 1)
  ) {
    return NextResponse.json(
      { error: "The drone candidate metadata is invalid." },
      { status: 400 },
    );
  }

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json(
      { error: "Select a road image before submitting." },
      { status: 400 },
    );
  }

  if (!ALLOWED_IMAGE_TYPES.includes(image.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return NextResponse.json(
      { error: "Only JPG, PNG and WebP images are accepted." },
      { status: 400 },
    );
  }

  if (image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: "The road image must be 10 MB or smaller." },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const safeName = sanitizeFileName(image.name) || "road-image";
  let imagePath = "";

  try {
    const fingerprintPromise = createImageFingerprint(image);
    await ensureSchema();
    const sql = getSql();
    const imageSha256 = await fingerprintPromise;
    const existing = await sql.query(
      "SELECT id FROM road_submissions WHERE image_sha256 = $1 LIMIT 1",
      [imageSha256],
    );

    if (existing.length > 0) {
      return NextResponse.json(
        {
          error: "This image has already been submitted.",
          existingId: String(existing[0].id),
        },
        { status: 409 },
      );
    }

    const blob = await put(`road-images/${id}-${safeName}`, image, {
      access: "private",
      addRandomSuffix: false,
      contentType: image.type,
    });
    imagePath = blob.pathname;

    await sql.query(
      `
        INSERT INTO road_submissions (
          id, collector_id, area_name, suspected_defect,
          latitude, longitude, gps_accuracy, gps_timestamp,
          image_path, image_name, image_type, image_size,
          source, video_timestamp, ai_confidence,
          privacy_processed, privacy_blur_count,
          device_manufacturer, device_model, image_sha256
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::timestamptz,
          $9, $10, $11, $12, $13, $14, $15, $16, $17,
          NULLIF($18, ''), NULLIF($19, ''), $20)
      `,
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
        image.name,
        image.type,
        image.size,
        source,
        videoTimestamp,
        aiConfidence,
        privacyProcessed,
        privacyBlurCount,
        deviceManufacturer,
        deviceModel,
        imageSha256,
      ],
    );

    return NextResponse.json({ id, status: "pending" }, { status: 201 });
  } catch (error) {
    if (imagePath) {
      await del(imagePath).catch(() => undefined);
    }

    if (isDuplicateImageError(error)) {
      return NextResponse.json(
        { error: "This image has already been submitted." },
        { status: 409 },
      );
    }

    console.error("Road submission failed", error);
    return NextResponse.json(
      { error: "The record could not be saved. Please try again." },
      { status: 500 },
    );
  }
}
