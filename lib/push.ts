import { ensureSchema, extractRows, getSql } from "./db";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_TOKEN_PATTERN =
  /^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{8,128}\]$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 240;
const EXPO_BATCH_LIMIT = 100;
const PUSH_TIMEOUT_MS = 5_000;

export interface PushPayload {
  body: string;
  submissionId: string;
  title: string;
  url?: string;
}

export interface PushDeliverySummary {
  attempted: number;
  delivered: number;
  prunedTokens: number;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId: string;
  data: {
    reportId: string;
    url: string;
  };
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?:
      | "DeviceNotRegistered"
      | "InvalidCredentials"
      | "MessageTooBig"
      | "MessageRateExceeded"
      | string;
  };
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[];
  errors?: Array<{ code?: string; message?: string }>;
}

function cleanNotificationText(raw: string, maxLength: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function sendExpoBatchWithRetry(
  batch: ExpoPushMessage[],
): Promise<ExpoPushResponse> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };

  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
        signal: controller.signal,
      });

      if (response.ok) {
        return (await response.json().catch(() => ({}))) as ExpoPushResponse;
      }

      // Retry once on transient rate-limit (429) or server errors (5xx)
      if (attempt === 1 && (response.status === 429 || response.status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }

      throw new Error(`Expo push service returned HTTP ${response.status}.`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Expo push delivery failed after retry.");
}

async function deactivateStalePushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;

  try {
    const sql = getSql();
    await sql.query(
      `UPDATE road_mobile_devices
       SET notifications_enabled = FALSE,
           expo_push_token = NULL,
           updated_at = NOW()
       WHERE expo_push_token = ANY($1::text[])`,
      [tokens],
    );
  } catch (cleanupError) {
    console.warn("Failed to prune unregistered Expo push tokens:", cleanupError);
  }
}

export async function notifyReportOwner(
  payload: PushPayload,
): Promise<PushDeliverySummary> {
  const submissionId =
    typeof payload?.submissionId === "string"
      ? payload.submissionId.trim()
      : "";
  const title = cleanNotificationText(payload?.title, MAX_TITLE_LENGTH);
  const body = cleanNotificationText(payload?.body, MAX_BODY_LENGTH);
  const targetUrl =
    typeof payload?.url === "string" && payload.url.startsWith("/")
      ? payload.url
      : "/activity";

  if (!UUID_PATTERN.test(submissionId) || !title || !body) {
    return { attempted: 0, delivered: 0, prunedTokens: 0 };
  }

  await ensureSchema();
  const sql = getSql();

  const deviceResult = await sql.query(
    `SELECT DISTINCT device.expo_push_token
     FROM road_submissions submission
     INNER JOIN road_mobile_devices device
       ON device.collector_id = submission.collector_id
      AND (
        submission.collector_token_hash IS NULL
        OR device.device_token_hash = submission.collector_token_hash
      )
     WHERE submission.id = $1
       AND device.notifications_enabled = TRUE
       AND device.expo_push_token IS NOT NULL`,
    [submissionId],
  );

  const deviceRows = extractRows<{ expo_push_token?: string | null }>(
    deviceResult,
  );

  const uniqueTokens = Array.from(
    new Set(
      deviceRows
        .map((row) =>
          typeof row.expo_push_token === "string"
            ? row.expo_push_token.trim()
            : "",
        )
        .filter((token) => EXPO_PUSH_TOKEN_PATTERN.test(token)),
    ),
  );

  if (uniqueTokens.length === 0) {
    return { attempted: 0, delivered: 0, prunedTokens: 0 };
  }

  const messages: ExpoPushMessage[] = uniqueTokens.map((token) => ({
    to: token,
    title,
    body,
    sound: "default",
    priority: "high",
    channelId: "default",
    data: {
      reportId: submissionId,
      url: targetUrl,
    },
  }));

  const batches = chunkArray(messages, EXPO_BATCH_LIMIT);
  const unregisteredTokens: string[] = [];
  let deliveredCount = 0;

  for (const batch of batches) {
    const result = await sendExpoBatchWithRetry(batch);
    const tickets = Array.isArray(result.data) ? result.data : [];

    for (let i = 0; i < batch.length; i++) {
      const ticket = tickets[i];
      const targetToken = batch[i].to;

      if (!ticket || ticket.status === "ok") {
        deliveredCount++;
        continue;
      }

      if (ticket.details?.error === "DeviceNotRegistered") {
        unregisteredTokens.push(targetToken);
      } else {
        console.warn(
          `Expo push ticket error for submission [${submissionId}]:`,
          ticket.details?.error ?? ticket.message ?? "Unknown ticket error",
        );
      }
    }
  }

  if (unregisteredTokens.length > 0) {
    await deactivateStalePushTokens(unregisteredTokens);
  }

  return {
    attempted: messages.length,
    delivered: deliveredCount,
    prunedTokens: unregisteredTokens.length,
  };
}