import { get } from "@vercel/blob";
import { getPublicProgressImage } from "../../../../../lib/submissions";

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

interface PublicProgressImageRecord {
  id?: string;
  image_path: string;
  image_name?: string | null;
  image_type: string;
  image_size?: number | string | null;
  privacy_processed?: boolean | null;
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

  return cleaned || `public-progress-${fallbackId}.jpg`;
}

function buildETag(
  image: PublicProgressImageRecord,
  fallbackId: string,
): string {
  const sizePart = Number(image.image_size ?? 0) || 0;
  const pathTail = Buffer.from(image.image_path)
    .toString("base64url")
    .slice(-16);
  return `W/"${image.id ?? fallbackId}-${sizePart}-${pathTail}"`;
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

async function handlePublicProgressImageRequest(
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
    const image = (await getPublicProgressImage(
      id,
    )) as PublicProgressImageRecord | null;

    if (
      !image ||
      !image.image_path ||
      image.privacy_processed === false
    ) {
      return new Response("Not found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const etag = buildETag(image, id);
    const safeFileName = sanitizeFileName(image.image_name, id);
    const dbMime = (image.image_type ?? "").toLowerCase();
    const dbSize = Number(image.image_size ?? 0);

    const baseSecurityHeaders: Record<string, string> = {
      // Revalidate on every request so archived parent reports stop serving immediately,
      // while allowing 304 Not Modified when the public progress image is unchanged.
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
          "Content-Type": image.image_type,
        },
      });
    }

    const blob = await get(image.image_path, { access: "private" });

    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return new Response("Not found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const blobMime = (blob.blob.contentType ?? "").toLowerCase();
    const resolvedContentType = ALLOWED_OUTPUT_MIMES.has(blobMime)
      ? blob.blob.contentType
      : ALLOWED_OUTPUT_MIMES.has(dbMime)
        ? image.image_type
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
    console.error(`Failed to serve public progress image [${id}]`, error);
    return new Response("Unable to load progress image", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export async function GET(request: Request, context: DynamicRouteContext) {
  return handlePublicProgressImageRequest(request, context, false);
}

export async function HEAD(request: Request, context: DynamicRouteContext) {
  return handlePublicProgressImageRequest(request, context, true);
}