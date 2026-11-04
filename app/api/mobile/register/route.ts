import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../../lib/db";
import {
  hashDeviceToken,
  validateMobileCredentials,
} from "../../../../lib/mobile-auth";

const EXPO_PUSH_TOKEN_PATTERN =
  /^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{8,128}\]$/;

const MAX_DEVICE_FIELD_LENGTH = 80;
const MAX_PLATFORM_LENGTH = 20;

interface RegisterRequestBody {
  collectorId?: unknown;
  deviceToken?: unknown;
  expoPushToken?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  platform?: unknown;
}

interface UpsertedDeviceRow {
  id: string;
  expo_push_token: string | null;
  notifications_enabled: boolean;
}

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
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

export async function POST(request: Request) {
  const body = (await request
    .json()
    .catch(() => null)) as RegisterRequestBody | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Malformed JSON request body." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const collectorId = cleanString(body.collectorId, 128);
  const deviceToken = cleanString(body.deviceToken, 256);
  const manufacturer = cleanString(body.manufacturer, MAX_DEVICE_FIELD_LENGTH);
  const model = cleanString(body.model, MAX_DEVICE_FIELD_LENGTH);
  const platform = cleanString(body.platform, MAX_PLATFORM_LENGTH).toLowerCase();

  // Distinguish between omitted/empty token vs explicitly disabling/clearing token
  const rawPushToken = body.expoPushToken;
  if (
    rawPushToken !== undefined &&
    rawPushToken !== null &&
    typeof rawPushToken !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid notification token." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const expoPushToken = cleanString(rawPushToken, 160);

  if (
    !validateMobileCredentials(collectorId, deviceToken) ||
    !manufacturer ||
    !model
  ) {
    return NextResponse.json(
      { error: "Invalid mobile device registration." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (expoPushToken && !EXPO_PUSH_TOKEN_PATTERN.test(expoPushToken)) {
    return NextResponse.json(
      { error: "Invalid notification token." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    await ensureSchema();
    const sql = getSql();
    const tokenHash = hashDeviceToken(deviceToken);
    const deviceId = randomUUID();

    const upsertResult = await sql.query(
      `INSERT INTO road_mobile_devices (
         id,
         collector_id,
         device_token_hash,
         expo_push_token,
         platform,
         notifications_enabled
       )
       VALUES (
         $1,
         $2,
         $3,
         NULLIF($4, ''),
         NULLIF($5, ''),
         CASE WHEN NULLIF($4, '') IS NOT NULL THEN TRUE ELSE FALSE END
       )
       ON CONFLICT (collector_id, device_token_hash)
       DO UPDATE SET
         expo_push_token = COALESCE(
           NULLIF(EXCLUDED.expo_push_token, ''),
           road_mobile_devices.expo_push_token
         ),
         platform = COALESCE(
           NULLIF(EXCLUDED.platform, ''),
           road_mobile_devices.platform
         ),
         notifications_enabled = CASE
           WHEN COALESCE(
             NULLIF(EXCLUDED.expo_push_token, ''),
             road_mobile_devices.expo_push_token
           ) IS NOT NULL THEN TRUE
           ELSE FALSE
         END,
         updated_at = NOW()
       RETURNING id, expo_push_token, notifications_enabled`,
      [deviceId, collectorId, tokenHash, expoPushToken, platform],
    );

    const deviceRows = extractRows<UpsertedDeviceRow>(upsertResult);
    const registeredDevice = deviceRows[0];

    // Claim previously submitted reports from the same collector & device hardware
    // that have not yet been bound to a device token hash.
    const claimedResult = await sql.query(
      `UPDATE road_submissions
       SET collector_token_hash = $1
       WHERE collector_id = $2
         AND collector_token_hash IS NULL
         AND archived_at IS NULL
         AND LOWER(BTRIM(COALESCE(device_manufacturer, ''))) = LOWER(BTRIM($3))
         AND LOWER(BTRIM(COALESCE(device_model, ''))) = LOWER(BTRIM($4))
       RETURNING id`,
      [tokenHash, collectorId, manufacturer, model],
    );

    const claimedRows = extractRows<{ id: string }>(claimedResult);
    const notificationsEnabled = Boolean(
      registeredDevice
        ? registeredDevice.notifications_enabled &&
            registeredDevice.expo_push_token
        : expoPushToken,
    );

    return NextResponse.json(
      {
        claimedReports: claimedRows.length,
        deviceId: registeredDevice?.id ?? deviceId,
        notificationsEnabled,
        success: true,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    console.error("Mobile device registration failed", error);
    return NextResponse.json(
      { error: "Unable to register mobile device." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}