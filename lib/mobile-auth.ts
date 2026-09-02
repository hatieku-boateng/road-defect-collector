import { createHash } from "node:crypto";
import { ensureSchema, getSql } from "./db";

const COLLECTOR_PATTERN = /^\d{12}$/;
const TOKEN_PATTERN = /^[a-z0-9-]{24,100}$/i;

export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function validateMobileCredentials(collectorId: string, token: string) {
  return COLLECTOR_PATTERN.test(collectorId) && TOKEN_PATTERN.test(token);
}

export function readMobileCredentials(request: Request) {
  const collectorId = request.headers.get("x-collector-id")?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!validateMobileCredentials(collectorId, token)) return null;
  return { collectorId, token, tokenHash: hashDeviceToken(token) };
}

export async function deviceOwnsSubmission(
  submissionId: string,
  collectorId: string,
  tokenHash: string,
) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    `SELECT id FROM road_submissions
     WHERE id = $1 AND collector_id = $2 AND collector_token_hash = $3
       AND archived_at IS NULL
     LIMIT 1`,
    [submissionId, collectorId, tokenHash],
  );
  return rows.length > 0;
}
