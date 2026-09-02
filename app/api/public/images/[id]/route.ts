import { get } from "@vercel/blob";
import { getPublicSubmissionImage } from "../../../../../lib/submissions";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: RouteContext<"/api/public/images/[id]">,
) {
  const { id } = await context.params;

  if (!UUID_PATTERN.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const submission = await getPublicSubmissionImage(id);

  if (!submission) {
    return new Response("Not found", { status: 404 });
  }

  const blob = await get(submission.image_path, { access: "private" });

  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return new Response("Image not found", { status: 404 });
  }

  return new Response(blob.stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": String(blob.blob.size),
      "Content-Type": submission.image_type,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
