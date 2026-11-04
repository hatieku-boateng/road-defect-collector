import { createHash, timingSafeEqual } from "node:crypto";
import { ensureSchema, getSql } from "./db";

/** 12-digit numeric collector identifier */
const COLLECTOR_PATTERN = /^\d{12}$/;

/** 24–100 character alphanumeric/hyphen device token (supports UUIDv4 and custom tokens) */
const TOKEN_PATTERN = /^[a-z0-9-]{24,100}$/i;

/** Strict 64-character lowercase hexadecimal SHA-256 digest */
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

/** Strict 8-4-4-4-12 hexadecimal UUID pattern */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minimum distinct characters required in a device token to reject trivial/repeated strings */
const MIN_UNIQUE_TOKEN_CHARS = 4;

export interface MobileCredentials {
  collectorId: string;
  token: string;
  tokenHash: string;
}

/**
 * Computes a deterministic 64-character lowercase hex SHA-256 digest of a normalized device token.
 */
export function hashDeviceToken(token: string): string {
  const normalized = typeof token === "string" ? token.trim() : "";
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Constant-time comparison of two SHA-256 hex digests to prevent timing side-channel leaks.
 */
export function safeCompareTokenHashes(
  expectedHash: string | null | undefined,
  candidateHash: string | null | undefined,
): boolean {
  if (
    typeof expectedHash !== "string" ||
    typeof candidateHash !== "string" ||
    !SHA256_HEX_PATTERN.test(expectedHash) ||
    !SHA256_HEX_PATTERN.test(candidateHash)
  ) {
    return false;
  }

  try {
    const a = Buffer.from(expectedHash.toLowerCase(), "hex");
    const b = Buffer.from(candidateHash.toLowerCase(), "hex");
    if (a.byteLength !== 32 || b.byteLength !== 32) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Validates both the format and basic entropy of a mobile collector ID and device token.
 */
export function validateMobileCredentials(
  collectorId: string,
  token: string,
): boolean {
  if (typeof collectorId !== "string" || typeof token !== "string") {
    return false;
  }

  const cleanCollectorId = collectorId.trim();
  const cleanToken = token.trim();

  if (
    !COLLECTOR_PATTERN.test(cleanCollectorId) ||
    !TOKEN_PATTERN.test(cleanToken)
  ) {
    return false;
  }

  // Reject degenerate tokens like "000000000000000000000000" or "------------------------"
  const uniqueChars = new Set(cleanToken.toLowerCase().replace(/-/g, ""));
  if (uniqueChars.size < MIN_UNIQUE_TOKEN_CHARS) {
    return false;
  }

  return true;
}

/**
 * Extracts and validates mobile collector credentials from request headers.
 * Supports RFC 7235 case-insensitive `Authorization: Bearer <token>` as well as
 * `X-Collector-Token` / `X-Device-Token` fallback headers.
 */
export function readMobileCredentials(
  request: Request,
): MobileCredentials | null {
  const collectorId = request.headers.get("x-collector-id")?.trim() ?? "";
  const authorization = request.headers.get("authorization")?.trim() ?? "";

  let token = "";
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorization);

  if (bearerMatch?.[1]) {
    token = bearerMatch[1].trim();
  } else {
    token =
      request.headers.get("x-collector-token")?.trim() ||
      request.headers.get("x-device-token")?.trim() ||
      "";
  }

  if (!validateMobileCredentials(collectorId, token)) {
    return null;
  }

  return {
    collectorId,
    token,
    tokenHash: hashDeviceToken(token),
  };
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

/**
 * Verifies whether a mobile device owns a specific active submission using
 * pre-validated parameters and constant-time SHA-256 token hash verification.
 */
export async function deviceOwnsSubmission(
  submissionId: string,
  collectorId: string,
  tokenHash: string,
): Promise<boolean> {
  const cleanSubmissionId =
    typeof submissionId === "string" ? submissionId.trim() : "";
  const cleanCollectorId =
    typeof collectorId === "string" ? collectorId.trim() : "";
  const cleanTokenHash =
    typeof tokenHash === "string" ? tokenHash.trim().toLowerCase() : "";

  if (
    !UUID_PATTERN.test(cleanSubmissionId) ||
    !COLLECTOR_PATTERN.test(cleanCollectorId) ||
    !SHA256_HEX_PATTERN.test(cleanTokenHash)
  ) {
    return false;
  }

  try {
    await ensureSchema();
    const sql = getSql();

    const queryResult = await sql.query(
      `SELECT collector_token_hash
       FROM road_submissions
       WHERE id = $1
         AND collector_id = $2
         AND collector_token_hash IS NOT NULL
         AND archived_at IS NULL
       LIMIT 1`,
      [cleanSubmissionId, cleanCollectorId],
    );

    const rows = extractRows<{ collector_token_hash?: string | null }>(
      queryResult,
    );
    const storedHash = rows[0]?.collector_token_hash;

    return safeCompareTokenHashes(storedHash, cleanTokenHash);
  } catch (error) {
    console.error("Failed to verify mobile submission ownership", error);
    return false;
  }
}