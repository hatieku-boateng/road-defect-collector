import { get } from "@vercel/blob";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { getProgressImage } from "../../../../lib/submissions";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function GET(_request: Request, context: RouteContext<"/api/progress-images/[id]">) {
  if (!(await isAdminAuthenticated())) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return new Response("Not found", { status: 404 });
  const image = await getProgressImage(id);
  if (!image) return new Response("Not found", { status: 404 });
  const blob = await get(image.image_path, { access: "private" });
  if (!blob || blob.statusCode !== 200 || !blob.stream) return new Response("Not found", { status: 404 });
  return new Response(blob.stream, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": image.image_type,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
