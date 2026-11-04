import { get } from "@vercel/blob";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { getSubmission } from "../../../../lib/submissions";

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

function sanitizeFileName(rawName: string | null | undefined, fallbackId: string): string {
  const cleaned = (rawName ?? "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return cleaned || `submission-${fallbackId}.jpg`;
}

function buildETag(submission: {
  id: string;
  image_path: string;
  image_sha256?: string | null;
  image_size?: number | null;
}): string {
  const token =
    submission.image_sha256?.trim() ||
    `${submission.id}-${submission.image_size ?? 0}-${Buffer.from(submission.image_path).toString("base64url").slice(-16)}`;
  return `W/"${token}"`;
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

async function handleImageRequest(
  request: Request,
  context: DynamicRouteContext,
  headOnly: boolean,
): Promise<Response> {
  if (!(await isAdminAuthenticated())) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { id: rawId } = await context.params;
  const id = (rawId ?? "").trim();

  if (!UUID_PATTERN.test(id)) {
    return new Response("Invalid submission ID", {
      status: 400,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  try {
    const submission = await getSubmission(id);

    if (!submission || !submission.image_path) {
      return new Response("Not found", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const etag = buildETag(submission);
    const url = new URL(request.url);
    const forceDownload =
      url.searchParams.get("download") === "1" ||
      url.searchParams.get("download") === "true";

    const safeFileName = sanitizeFileName(submission.image_name, submission.id);
    const dispositionType = forceDownload ? "attachment" : "inline";

    const baseSecurityHeaders: Record<string, string> = {
      // Revalidate with server on every request (enforcing admin auth check),
      // while allowing 304 Not Modified when the image hash has not changed.
      "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
      "Content-Disposition": `${dispositionType}; filename="${safeFileName}"`,
      "Cross-Origin-Resource-Policy": "same-origin",
      ETag: etag,
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    };

    if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
      return new Response(null, {
        status: 304,
        headers: baseSecurityHeaders,
      });
    }

    // For HEAD requests when size and type are already recorded in the database,
    // respond without streaming the full binary payload from Vercel Blob.
    if (
      headOnly &&
      submission.image_type &&
      ALLOWED_OUTPUT_MIMES.has(submission.image_type.toLowerCase()) &&
      typeof submission.image_size === "number" &&
      submission.image_size > 0
    ) {
      return new Response(null, {
        status: 200,
        headers: {
          ...baseSecurityHeaders,
          "Content-Length": String(submission.image_size),
          "Content-Type": submission.image_type,
        },
      });
    }

    const blob = await get(submission.image_path, { access: "private" });

    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return new Response("Image not found", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const resolvedContentType = ALLOWED_OUTPUT_MIMES.has(
      blob.blob.contentType.toLowerCase(),
    )
      ? blob.blob.contentType
      : submission.image_type &&
          ALLOWED_OUTPUT_MIMES.has(submission.image_type.toLowerCase())
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
    console.error(`Failed to serve admin submission image [${id}]`, error);
    return new Response("Unable to load image", {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}

export async function GET(request: Request, context: DynamicRouteContext) {
  return handleImageRequest(request, context, false);
}

export async function HEAD(request: Request, context: DynamicRouteContext) {
  return handleImageRequest(request, context, true);
}