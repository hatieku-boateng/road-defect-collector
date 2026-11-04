import { get } from "@vercel/blob";
import { ensureSchema, getSql } from "../../../../../../lib/db";
import { readMobileCredentials } from "../../../../../../lib/mobile-auth";

/** Strict 8-4-4-4-12 hexadecimal UUID pattern */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_OUTPUT_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

interface DynamicRouteContext {
  params: Promise<{ id: string }>;
}

interface ProgressImageRow {
  id: string;
  image_path: string;
  image_name?: string | null;
  image_type?: string | null;
  image_size?: number | string | null;
}

function sanitizeFileName(rawName: string | null | undefined, fallbackId: string): string {
  const cleaned = (rawName ?? "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return cleaned || `progress-${fallbackId}.jpg`;
}

function buildETag(row: ProgressImageRow): string {
  const sizePart = Number(row.image_size ?? 0) || 0;
  const pathTail = Buffer.from(row.image_path).toString("base64url").slice(-16);
  return `W/"${row.id}-${sizePart}-${pathTail}"`;
}

function matchesIfNoneMatch(ifNoneMatchHeader: string | null, etag: string): boolean {
  if (!ifNoneMatchHeader) return false;
  const candidates = ifNoneMatchHeader.split(",").map((part) => part.trim());
  const normalizedTarget = etag.replace(/^W\//, "");

  return candidates.some(
    (candidate) =>
      candidate === "*" ||
      candidate === etag ||
      candidate.replace(/^W\//, "") === normalizedTarget,
  );
}

async function handleMobileProgressImageRequest(
  request: Request,
  context: DynamicRouteContext,
  headOnly: boolean,
): Promise<Response> {
  const credentials = readMobileCredentials(request);
  if (!credentials?.collectorId || !credentials?.tokenHash) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { id: rawId } = await context.params;
  const id = (rawId ?? "").trim();

  if (!UUID_PATTERN.test(id)) {
    return new Response("Invalid progress image ID", {
      status: 400,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  try {
    await ensureSchema();
    const sql = getSql();

    const queryResult = await sql.query(
      `SELECT
         progress.id,
         progress.image_path,
         progress.image_name,
         progress.image_type,
         progress.image_size
       FROM road_progress_images progress
       INNER JOIN road_submissions submission
         ON submission.id = progress.submission_id
       WHERE progress.id = $1
         AND submission.collector_id = $2
         AND submission.collector_token_hash = $3
         AND submission.archived_at IS NULL
       LIMIT 1`,
      [id, credentials.collectorId, credentials.tokenHash],
    );

    const rows = (
      Array.isArray(queryResult)
        ? queryResult
        : ((queryResult as { rows?: unknown[] }).rows ?? [])
    ) as ProgressImageRow[];

    const record = rows[0];
    if (!record || !record.image_path) {
      return new Response("Not found", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const etag = buildETag(record);
    const safeFileName = sanitizeFileName(record.image_name, record.id);
    const dbMime = (record.image_type ?? "").toLowerCase();
    const dbSize = Number(record.image_size ?? 0);

    const baseSecurityHeaders: Record<string, string> = {
      // Revalidate collector credentials on every request while allowing 304 Not Modified
      "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Cross-Origin-Resource-Policy": "same-origin",
      ETag: etag,
      Vary: "Authorization, X-Collector-Id, X-Collector-Token",
      "X-Content-Type-Options": "nosniff",
    };

    if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
      return new Response(null, {
        status: 304,
        headers: baseSecurityHeaders,
      });
    }

    // Fast path for HEAD requests when valid metadata is already stored in Postgres
    if (
      headOnly &&
      ALLOWED_OUTPUT_MIMES.has(dbMime) &&
      Number.isFinite(dbSize) &&
      dbSize > 0
    ) {
      return new Response(null, {
        status: 200,
        headers: {
          ...baseSecurityHeaders,
          "Content-Length": String(dbSize),
          "Content-Type": dbMime,
        },
      });
    }

    const blob = await get(String(record.image_path), { access: "private" });

    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return new Response("Not found", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const blobMime = (blob.blob.contentType ?? "").toLowerCase();
    const resolvedContentType = ALLOWED_OUTPUT_MIMES.has(blobMime)
      ? blob.blob.contentType
      : ALLOWED_OUTPUT_MIMES.has(dbMime)
        ? String(record.image_type)
        : "application/octet-stream";

    const responseHeaders: Record<string, string> = {
      ...baseSecurityHeaders,
      "Content-Length": String(blob.blob.size),
      "Content-Type": resolvedContentType,
    };

    if (headOnly) {
      await blob.stream.cancel().catch(() => undefined);
      return new Response(null, {
        status: 200,
        headers: responseHeaders,
      });
    }

    return new Response(blob.stream, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`Failed to serve mobile progress image [${id}]`, error);
    return new Response("Unable to load progress image", {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}

export async function GET(request: Request, context: DynamicRouteContext) {
  return handleMobileProgressImageRequest(request, context, false);
}

export async function HEAD(request: Request, context: DynamicRouteContext) {
  return handleMobileProgressImageRequest(request, context, true);
}