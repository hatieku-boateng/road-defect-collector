import { ensureSchema, getSql } from "./db";

type PushPayload = {
  body: string;
  submissionId: string;
  title: string;
};

export async function notifyReportOwner(payload: PushPayload) {
  await ensureSchema();
  const sql = getSql();
  const devices = await sql.query(
    `SELECT DISTINCT device.expo_push_token
     FROM road_submissions submission
     JOIN road_mobile_devices device
       ON device.collector_id = submission.collector_id
      AND device.device_token_hash = submission.collector_token_hash
     WHERE submission.id = $1
       AND device.notifications_enabled = TRUE
       AND device.expo_push_token IS NOT NULL`,
    [payload.submissionId],
  );
  const messages = devices.flatMap((device) => {
    const token = typeof device.expo_push_token === "string" ? device.expo_push_token : "";
    return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")
      ? [{
          body: payload.body,
          data: { reportId: payload.submissionId, url: "/activity" },
          sound: "default",
          title: payload.title,
          to: token,
        }]
      : [];
  });
  if (messages.length === 0) return;

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    body: JSON.stringify(messages),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Expo push service returned ${response.status}.`);
  }
}
