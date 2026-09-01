import { storageIsConfigured } from "../../../lib/config";

export function GET() {
  const storage = storageIsConfigured();
  const admin = Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET);

  return Response.json(
    {
      admin,
      application: "ghana-road-defect-monitoring",
      status: storage && admin ? "ready" : "configuration-required",
      storage,
    },
    { status: storage && admin ? 200 : 503 },
  );
}
