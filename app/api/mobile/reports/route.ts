import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { WORKFLOW_STATUSES } from "../../../../lib/config";
import { ensureSchema, getSql } from "../../../../lib/db";
import { readMobileCredentials } from "../../../../lib/mobile-auth";
import { listReportEvents } from "../../../../lib/submissions";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const VALID_STATUS_SET = new Set<string>(WORKFLOW_STATUSES);

interface SubmissionRow {
  id: string;
  area_name: string | null;
  suspected_defect: string | null;
  created_at: Date | string;
  workflow_status: string | null;
  review_note: string | null;
}

interface ProgressImageRow {
  id: string;
  submission_id: string;
  stage: string;
  note: string | null;
  captured_at: Date | string | null;
  created_at: Date | string;
}

interface ReportEventItem {
  id: string;
  submission_id: string;
  event_type: string;
  workflow_status: string;
  note: string | null;
  created_at: Date | string;
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

function toIsoTimestamp(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? String(value) : new Date(parsed).toISOString();
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

function parseSinceTimestamp(rawValue: string | null): string | null {
  if (!rawValue) return null;
  const parsed = Date.parse(rawValue.trim());
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
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

export async function GET(request: Request) {
  const credentials = readMobileCredentials(request);
  if (!credentials?.collectorId || !credentials?.tokenHash) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const url = new URL(request.url);
  const limit = parseBoundedInt(
    url.searchParams.get("limit"),
    DEFAULT_LIMIT,
    1,
    MAX_LIMIT,
  );
  const offset = parseBoundedInt(url.searchParams.get("offset"), 0, 0, 10_000);
  const statusFilterRaw = url.searchParams.get("status")?.trim() ?? "";
  const statusFilter = VALID_STATUS_SET.has(statusFilterRaw)
    ? statusFilterRaw
    : null;
  const sinceIso = parseSinceTimestamp(url.searchParams.get("since"));

  try {
    await ensureSchema();
    const sql = getSql();

    const reportsResult = await sql.query(
      `SELECT
         id,
         area_name,
         suspected_defect,
         created_at,
         workflow_status,
         review_note
       FROM road_submissions
       WHERE collector_id = $1
         AND collector_token_hash = $2
         AND archived_at IS NULL
         AND ($3::text IS NULL OR workflow_status = $3)
         AND ($4::timestamptz IS NULL OR created_at >= $4::timestamptz)
       ORDER BY created_at DESC
       LIMIT $5 OFFSET $6`,
      [
        credentials.collectorId,
        credentials.tokenHash,
        statusFilter,
        sinceIso,
        limit,
        offset,
      ],
    );

    const reports = extractRows<SubmissionRow>(reportsResult);
    const ids = reports.map((report) => String(report.id));

    let progressRows: ProgressImageRow[] = [];
    let eventRows: ReportEventItem[] = [];

    if (ids.length > 0) {
      const [rawProgress, rawEvents] = await Promise.all([
        sql.query(
          `SELECT
             id,
             submission_id,
             stage,
             note,
             captured_at,
             created_at
           FROM road_progress_images
           WHERE submission_id = ANY($1::uuid[])
           ORDER BY COALESCE(captured_at, created_at) ASC, created_at ASC`,
          [ids],
        ),
        listReportEvents(ids),
      ]);

      progressRows = extractRows<ProgressImageRow>(rawProgress);
      eventRows = (Array.isArray(rawEvents) ? rawEvents : []) as ReportEventItem[];
    }

    // Group child records by submission_id in O(N) time
    const progressBySubmission = new Map<
      string,
      Array<{
        capturedAt: string | null;
        id: string;
        imageUrl: string;
        note: string | null;
        stage: string;
      }>
    >();

    for (const image of progressRows) {
      const parentId = String(image.submission_id);
      const imageId = String(image.id);
      const bucket = progressBySubmission.get(parentId) ?? [];
      bucket.push({
        capturedAt: toIsoTimestamp(image.captured_at ?? image.created_at),
        id: imageId,
        imageUrl: `/api/mobile/images/progress/${imageId}`,
        note: image.note ?? null,
        stage: image.stage,
      });
      progressBySubmission.set(parentId, bucket);
    }

    const eventsBySubmission = new Map<
      string,
      Array<{
        createdAt: string | null;
        id: string;
        note: string | null;
        status: string;
        type: string;
      }>
    >();

    for (const event of eventRows) {
      const parentId = String(event.submission_id);
      const bucket = eventsBySubmission.get(parentId) ?? [];
      bucket.push({
        createdAt: toIsoTimestamp(event.created_at),
        id: String(event.id),
        note: event.note ?? null,
        status: event.workflow_status,
        type: event.event_type,
      });
      eventsBySubmission.set(parentId, bucket);
    }

    const formattedReports = reports.map((report) => {
      const reportId = String(report.id);
      return {
        area: report.area_name,
        createdAt: toIsoTimestamp(report.created_at),
        defect: report.suspected_defect,
        events: eventsBySubmission.get(reportId) ?? [],
        id: reportId,
        imageUrl: `/api/mobile/images/reports/${reportId}`,
        progressImages: progressBySubmission.get(reportId) ?? [],
        reviewNote: report.review_note ?? null,
        status: report.workflow_status,
      };
    });

    const responsePayload = {
      count: formattedReports.length,
      hasMore: formattedReports.length === limit,
      reports: formattedReports,
    };

    const serialized = JSON.stringify(responsePayload);
    const etag = `W/"${createHash("sha256").update(serialized).digest("base64url").slice(0, 24)}"`;

    const headers: Record<string, string> = {
      "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
      ETag: etag,
      Vary: "Authorization, X-Collector-Id, X-Collector-Token",
      "X-Content-Type-Options": "nosniff",
    };

    if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
      return new Response(null, {
        status: 304,
        headers,
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
    console.error("Failed to list mobile reports", error);
    return NextResponse.json(
      { error: "Unable to load mobile reports." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}