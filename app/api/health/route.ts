import { storageIsConfigured } from "../../../lib/config";
import { getSql } from "../../../lib/db";

export const dynamic = "force-dynamic";

interface HealthStatusReport {
  application: string;
  status: "ready" | "configuration-required" | "degraded";
  timestamp: string;
  uptimeSeconds: number;
  nodeVersion: string;
  components: {
    database: {
      status: "healthy" | "unhealthy";
      schemaInitialized: boolean;
      error?: string;
    };
    storage: {
      status: "configured" | "missing-configuration";
    };
    auth: {
      status: "configured" | "missing-configuration";
    };
  };
  memoryUsage: NodeJS.MemoryUsage;
}

async function performHealthCheck(): Promise<HealthStatusReport> {
  const storageConfigured = storageIsConfigured();
  const hasAuthEnv = Boolean(
    process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET,
  );
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  let databaseHealthy = false;
  let schemaInitialized = false;
  let databaseError: string | null = null;

  try {
    const sql = getSql();
    await sql.query("SELECT 1 AS health_check");
    databaseHealthy = true;

    // Verify core tables exist in public schema
    const tableCheck = await sql.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('road_submissions', 'road_progress_images')`,
    );

    const tables = Array.isArray(tableCheck)
      ? tableCheck
      : (tableCheck as { rows?: unknown[] }).rows ?? [];
    schemaInitialized = tables.length > 0;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : String(error);
  }

  const isFullyReady =
    databaseHealthy && schemaInitialized && storageConfigured && hasAuthEnv;

  return {
    application: "road-defect-collector",
    status: isFullyReady ? "ready" : "configuration-required",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    components: {
      database: {
        status: databaseHealthy ? "healthy" : "unhealthy",
        schemaInitialized,
        ...(databaseError ? { error: databaseError } : {}),
      },
      storage: {
        status:
          storageConfigured && hasBlobToken
            ? "configured"
            : "missing-configuration",
      },
      auth: {
        status: hasAuthEnv ? "configured" : "missing-configuration",
      },
    },
    memoryUsage: process.memoryUsage(),
  };
}

export async function GET() {
  const health = await performHealthCheck();
  const statusCode = health.status === "ready" ? 200 : 503;

  return Response.json(health, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function HEAD() {
  const health = await performHealthCheck();
  const statusCode = health.status === "ready" ? 200 : 503;

  return new Response(null, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}