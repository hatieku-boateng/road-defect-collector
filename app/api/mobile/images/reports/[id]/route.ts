import { get } from "@vercel/blob";
import { deviceOwnsSubmission, readMobileCredentials } from "../../../../../../lib/mobile-auth";
import { getSubmission } from "../../../../../../lib/submissions";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request, context: RouteContext<"/api/mobile/images/reports/[id]">) {
  const credentials = readMobileCredentials(request);
  const { id } = await context.params;
  if (!credentials || !UUID_PATTERN.test(id)) return new Response("Not found", { status: 404 });
  if (!(await deviceOwnsSubmission(id, credentials.collectorId, credentials.tokenHash))) {
    return new Response("Not found", { status: 404 });
  }
  const submission = await getSubmission(id);
  if (!submission) return new Response("Not found", { status: 404 });
  const blob = await get(submission.image_path, { access: "private" });
  if (!blob?.stream || blob.statusCode !== 200) return new Response("Not found", { status: 404 });
  return new Response(blob.stream, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": submission.image_type,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
