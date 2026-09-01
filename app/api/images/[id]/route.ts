import { get } from "@vercel/blob";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { getSubmission } from "../../../../lib/submissions";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/images/[id]">,
) {
  if (!(await isAdminAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const submission = await getSubmission(id);

  if (!submission) {
    return new Response("Not found", { status: 404 });
  }

  const blob = await get(submission.image_path, { access: "private" });

  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return new Response("Image not found", { status: 404 });
  }

  return new Response(blob.stream, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(blob.blob.size),
      "Content-Type": blob.blob.contentType,
    },
  });
}
