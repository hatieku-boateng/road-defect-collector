import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../../lib/db";
import { hashDeviceToken, validateMobileCredentials } from "../../../../lib/mobile-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    collectorId?: string;
    deviceToken?: string;
    expoPushToken?: string | null;
    manufacturer?: string;
    model?: string;
    platform?: string;
  } | null;
  const collectorId = body?.collectorId?.trim() ?? "";
  const deviceToken = body?.deviceToken?.trim() ?? "";
  const manufacturer = body?.manufacturer?.trim().slice(0, 80) ?? "";
  const model = body?.model?.trim().slice(0, 80) ?? "";
  const platform = body?.platform?.trim().slice(0, 20) ?? "";
  const expoPushToken = body?.expoPushToken?.trim() ?? "";

  if (!validateMobileCredentials(collectorId, deviceToken) || !manufacturer || !model) {
    return NextResponse.json({ error: "Invalid mobile device registration." }, { status: 400 });
  }
  if (expoPushToken && !/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/.test(expoPushToken)) {
    return NextResponse.json({ error: "Invalid notification token." }, { status: 400 });
  }

  await ensureSchema();
  const sql = getSql();
  const tokenHash = hashDeviceToken(deviceToken);
  await sql.query(
    `INSERT INTO road_mobile_devices (
      id, collector_id, device_token_hash, expo_push_token, platform
    ) VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''))
    ON CONFLICT (collector_id, device_token_hash)
    DO UPDATE SET expo_push_token = COALESCE(NULLIF(EXCLUDED.expo_push_token, ''), road_mobile_devices.expo_push_token),
      platform = EXCLUDED.platform, notifications_enabled = TRUE, updated_at = NOW()`,
    [crypto.randomUUID(), collectorId, tokenHash, expoPushToken, platform],
  );

  const claimed = await sql.query(
    `UPDATE road_submissions
     SET collector_token_hash = $1
     WHERE collector_id = $2 AND collector_token_hash IS NULL
       AND COALESCE(device_manufacturer, '') = $3
       AND COALESCE(device_model, '') = $4
     RETURNING id`,
    [tokenHash, collectorId, manufacturer, model],
  );

  return NextResponse.json({ claimedReports: claimed.length, notificationsEnabled: Boolean(expoPushToken) });
}
