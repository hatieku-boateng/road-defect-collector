import { get } from "@vercel/blob";
import { ensureSchema, getSql } from "../../../../../../lib/db";
import { readMobileCredentials } from "../../../../../../lib/mobile-auth";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request, context: RouteContext<"/api/mobile/images/progress/[id]">) {
  const credentials = readMobileCredentials(request);
  const { id } = await context.params;
  if (!credentials || !UUID_PATTERN.test(id)) return new Response("Not found", { status: 404 });
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    `SELECT progress.image_path, progress.image_type
     FROM road_progress_images progress
     JOIN road_submissions submission ON submission.id = progress.submission_id
     WHERE progress.id = $1 AND submission.collector_id = $2
       AND submission.collector_token_hash = $3 AND submission.archived_at IS NULL
     LIMIT 1`,
    [id, credentials.collectorId, credentials.tokenHash],
  );
  if (rows.length === 0) return new Response("Not found", { status: 404 });
  const blob = await get(String(rows[0].image_path), { access: "private" });
  if (!blob?.stream || blob.statusCode !== 200) return new Response("Not found", { status: 404 });
  return new Response(blob.stream, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": String(rows[0].image_type),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
