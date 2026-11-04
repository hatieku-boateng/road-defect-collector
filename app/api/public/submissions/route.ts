import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { WORKFLOW_STATUSES } from "../../../../lib/config";
import {
  listPublicProgressImages,
  listPublicSubmissions,
} from "../../../../lib/submissions";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 500;
const VALID_STATUS_SET = new Set<string>(WORKFLOW_STATUSES);

interface FormattedProgressImage {
  capturedAt: string | null;
  id: string;
  imageUrl: string;
  note: string | null;
  stage: string;
}

function toIsoTimestamp(
  value: Date | string | null | undefined,
): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? String(value) : new Date(parsed).toISOString();
}

function toFiniteCoordinate(
  value: number | string | null | undefined,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

function parseBoundedInt(
  rawValue: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
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

async function handlePublicSubmissionsRequest(
  request: Request,
  headOnly: boolean,
): Promise<Response> {
  const url = new URL(request.url);

  const statusFilterRaw = url.searchParams.get("status")?.trim() ?? "";
  const statusFilter = VALID_STATUS_SET.has(statusFilterRaw)
    ? statusFilterRaw
    : null;
  const defectFilter =
    url.searchParams.get("defect")?.trim().toLowerCase() ?? "";
  const areaFilter = url.searchParams.get("area")?.trim().toLowerCase() ?? "";
  const sourceFilter =
    url.searchParams.get("source")?.trim().toLowerCase() ?? "";

  const hasPagination =
    url.searchParams.has("limit") || url.searchParams.has("offset");
  const limit = parseBoundedInt(
    url.searchParams.get("limit"),
    MAX_LIMIT,
    1,
    MAX_LIMIT,
  );
  const offset = parseBoundedInt(
    url.searchParams.get("offset"),
    0,
    0,
    10_000,
  );

  try {
    const [rawSubmissions, rawProgressImages] = await Promise.all([
      listPublicSubmissions(),
      listPublicProgressImages(),
    ]);

    const submissions = Array.isArray(rawSubmissions) ? rawSubmissions : [];
    const progressImages = Array.isArray(rawProgressImages)
      ? rawProgressImages
      : [];

    // Group progress images by submission_id in O(M) time
    const progressBySubmission = new Map<string, FormattedProgressImage[]>();

    for (const image of progressImages) {
      if (!image || !image.id || !image.submission_id) continue;

      const submissionId = String(image.submission_id);
      const imageId = String(image.id);
      const bucket = progressBySubmission.get(submissionId) ?? [];

      bucket.push({
        capturedAt: toIsoTimestamp(image.captured_at ?? image.created_at),
        id: imageId,
        imageUrl: `/api/public/progress-images/${imageId}`,
        note: image.note ?? null,
        stage: image.stage,
      });

      progressBySubmission.set(submissionId, bucket);
    }

    // Ensure chronological ordering for each submission's progress timeline
    for (const bucket of progressBySubmission.values()) {
      if (bucket.length > 1) {
        bucket.sort((a, b) =>
          (a.capturedAt ?? "").localeCompare(b.capturedAt ?? ""),
        );
      }
    }

    // Apply optional query filters if provided
    const filteredSubmissions = submissions.filter((submission) => {
      if (!submission || !submission.id) return false;

      if (statusFilter && submission.workflow_status !== statusFilter) {
        return false;
      }
      if (
        defectFilter &&
        !String(submission.suspected_defect ?? "")
          .toLowerCase()
          .includes(defectFilter)
      ) {
        return false;
      }
      if (
        areaFilter &&
        !String(submission.area_name ?? "")
          .toLowerCase()
          .includes(areaFilter)
      ) {
        return false;
      }
      if (
        sourceFilter &&
        String(submission.source ?? "").toLowerCase() !== sourceFilter
      ) {
        return false;
      }

      return true;
    });

    const slicedSubmissions = hasPagination
      ? filteredSubmissions.slice(offset, offset + limit)
      : filteredSubmissions;

    const formattedSubmissions = slicedSubmissions.map((submission) => {
      const id = String(submission.id);
      return {
        area: submission.area_name,
        createdAt: toIsoTimestamp(submission.created_at),
        defect: submission.suspected_defect,
        id,
        imageUrl: `/api/public/images/${id}`,
        latitude: toFiniteCoordinate(submission.latitude, -90, 90),
        longitude: toFiniteCoordinate(submission.longitude, -180, 180),
        progressImages: progressBySubmission.get(id) ?? [],
        source: submission.source,
        status: submission.workflow_status,
      };
    });

    const responsePayload = {
      count: formattedSubmissions.length,
      submissions: formattedSubmissions,
      total: filteredSubmissions.length,
    };

    const serialized = JSON.stringify(responsePayload);
    const etag = `W/"${createHash("sha256").update(serialized).digest("base64url").slice(0, 24)}"`;

    const headers: Record<string, string> = {
      "Cache-Control": "public, no-cache, max-age=0, must-revalidate",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    };

    if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
      return new Response(null, {
        status: 304,
        headers,
      });
    }

    if (headOnly) {
      return new Response(null, {
        status: 200,
        headers: {
          ...headers,
          "Content-Length": String(Buffer.byteLength(serialized, "utf8")),
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }

    return new NextResponse(serialized, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Public mobile submissions failed", error);
    return NextResponse.json(
      { error: "Reports are temporarily unavailable." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(request: Request) {
  return handlePublicSubmissionsRequest(request, false);
}

export async function HEAD(request: Request) {
  return handlePublicSubmissionsRequest(request, true);
}