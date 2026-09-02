import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../../lib/db";
import { readMobileCredentials } from "../../../../lib/mobile-auth";
import { listReportEvents } from "../../../../lib/submissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const credentials = readMobileCredentials(request);
  if (!credentials) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  await ensureSchema();
  const sql = getSql();
  const reports = await sql.query(
    `SELECT id, area_name, suspected_defect, created_at, workflow_status, review_note
     FROM road_submissions
     WHERE collector_id = $1 AND collector_token_hash = $2 AND archived_at IS NULL
     ORDER BY created_at DESC
     LIMIT 100`,
    [credentials.collectorId, credentials.tokenHash],
  );
  const ids = reports.map((report) => String(report.id));
  const progress = ids.length === 0 ? [] : await sql.query(
    `SELECT id, submission_id, stage, note, captured_at, created_at
     FROM road_progress_images
     WHERE submission_id = ANY($1::uuid[])
     ORDER BY COALESCE(captured_at, created_at)`,
    [ids],
  );
  const events = await listReportEvents(ids);

  return NextResponse.json({
    reports: reports.map((report) => ({
      area: report.area_name,
      createdAt: report.created_at,
      defect: report.suspected_defect,
      events: events.filter((event) => event.submission_id === String(report.id)).map((event) => ({
        createdAt: event.created_at,
        id: event.id,
        note: event.note,
        status: event.workflow_status,
        type: event.event_type,
      })),
      id: report.id,
      imageUrl: `/api/mobile/images/reports/${report.id}`,
      progressImages: progress.filter((image) => String(image.submission_id) === String(report.id)).map((image) => ({
        capturedAt: image.captured_at ?? image.created_at,
        id: image.id,
        imageUrl: `/api/mobile/images/progress/${image.id}`,
        note: image.note,
        stage: image.stage,
      })),
      reviewNote: report.review_note,
      status: report.workflow_status,
    })),
  });
}
