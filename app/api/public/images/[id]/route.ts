import { get } from "@vercel/blob";
import { getPublicSubmissionImage } from "../../../../../lib/submissions";

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

interface PublicSubmissionImageRecord {
  id?: string;
  image_path: string;
  image_name?: string | null;
  image_type: string;
  image_size?: number | string | null;
  image_sha256?: string | null;
  privacy_processed?: boolean | null;
  archived_at?: Date | string | null;
}

function sanitizeFileName(
  rawName: string | null | undefined,
  fallbackId: string,
): string {
  const cleaned = (rawName ?? "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return cleaned || `public-report-${fallbackId}.jpg`;
}

function buildETag(
  submission: PublicSubmissionImageRecord,
  fallbackId: string,
): string {
  const sha = submission.image_sha256?.trim();
  if (sha) {
    return `W/"${sha}"`;
  }

  const sizePart = Number(submission.image_size ?? 0) || 0;
  const pathTail = Buffer.from(submission.image_path)
    .toString("base64url")
    .slice(-16);
  return `W/"${submission.id ?? fallbackId}-${sizePart}-${pathTail}"`;
}

function matchesIfNoneMatch(
  ifNoneMatchHeader: string | null,
  etag: string,
): boolean {
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

async function handlePublicImageRequest(
  request: Request,
  context: DynamicRouteContext,
  headOnly: boolean,
): Promise<Response> {
  const { id: rawId } = await context.params;
  const id = (rawId ?? "").trim();

  if (!UUID_PATTERN.test(id)) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const submission = (await getPublicSubmissionImage(
      id,
    )) as PublicSubmissionImageRecord | null;

    if (
      !submission ||
      !submission.image_path ||
      submission.archived_at != null ||
      submission.privacy_processed === false
    ) {
      return new Response("Not found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const etag = buildETag(submission, id);
    const safeFileName = sanitizeFileName(submission.image_name, id);
    const dbMime = (submission.image_type ?? "").toLowerCase();
    const dbSize = Number(submission.image_size ?? 0);

    const baseSecurityHeaders: Record<string, string> = {
      // Revalidate on every request so newly archived reports stop serving immediately,
      // while allowing 304 Not Modified when the public image has not changed.
      "Cache-Control": "public, no-cache, max-age=0, must-revalidate",
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Cross-Origin-Resource-Policy": "same-origin",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    };

    if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
      return new Response(null, {
        status: 304,
        headers: baseSecurityHeaders,
      });
    }

    // Fast path for HEAD requests when valid metadata is already available in Postgres
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
          "Content-Type": submission.image_type,
        },
      });
    }

    const blob = await get(submission.image_path, { access: "private" });

    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return new Response("Image not found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const blobMime = (blob.blob.contentType ?? "").toLowerCase();
    const resolvedContentType = ALLOWED_OUTPUT_MIMES.has(blobMime)
      ? blob.blob.contentType
      : ALLOWED_OUTPUT_MIMES.has(dbMime)
        ? submission.image_type
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
    console.error(`Failed to serve public submission image [${id}]`, error);
    return new Response("Unable to load image", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export async function GET(request: Request, context: DynamicRouteContext) {
  return handlePublicImageRequest(request, context, false);
}

export async function HEAD(request: Request, context: DynamicRouteContext) {
  return handlePublicImageRequest(request, context, true);
}