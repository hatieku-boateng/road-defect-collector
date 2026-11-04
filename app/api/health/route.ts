import { isAdminAuthenticated } from "../../../lib/admin-auth";
import { storageIsConfigured } from "../../../lib/config";
import { getSql } from "../../../lib/db";

export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 3_500;
const EXPECTED_TABLES = ["road_submissions", "road_progress_images"] as const;

interface DatabaseProbeResult {
  healthy: boolean;
  latencyMs: number;
  schemaInitialized: boolean;
  missingTables: string[];
  error?: string;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Database health probe timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function probeDatabase(): Promise<DatabaseProbeResult> {
  const start = performance.now();

  try {
    const sql = getSql();
    const result = await withTimeout(
      sql.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])`,
        [EXPECTED_TABLES],
      ),
      DB_TIMEOUT_MS,
    );

    const rows = Array.isArray(result)
      ? result
      : ((result as { rows?: Array<{ table_name?: string }> }).rows ?? []);

    const foundTables = new Set(
      rows
        .map((row) =>
          typeof row === "object" && row !== null && "table_name" in row
            ? String((row as { table_name: unknown }).table_name)
            : "",
        )
        .filter(Boolean),
    );

    const missingTables = EXPECTED_TABLES.filter((table) => !foundTables.has(table));

    return {
      healthy: true,
      latencyMs: Math.round(performance.now() - start),
      schemaInitialized: missingTables.length === 0,
      missingTables,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Math.round(performance.now() - start),
      schemaInitialized: false,
      missingTables: [...EXPECTED_TABLES],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function evaluateSystemHealth(includeDetailedDiagnostics: boolean) {
  const totalStart = performance.now();

  const storageConfigured = storageIsConfigured();
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  const storageReady = storageConfigured && hasBlobToken;

  const hasAdminPassword = Boolean(process.env.ADMIN_PASSWORD?.trim());
  const hasSessionSecret = Boolean(process.env.SESSION_SECRET?.trim());
  const authReady = hasAdminPassword && hasSessionSecret;

  const dbProbe = await probeDatabase();

  // Note: the database schema is created automatically on first operation,
  // so missing tables before first submission yields "degraded" rather than hard failure
  // as long as the database connection itself is healthy.
  const isReady = dbProbe.healthy && storageReady && authReady;
  const status: "ready" | "degraded" | "configuration-required" = !storageReady || !authReady || !dbProbe.healthy
    ? "configuration-required"
    : dbProbe.schemaInitialized
      ? "ready"
      : "degraded";

  const totalDurationMs = Math.round(performance.now() - totalStart);

  const basePayload = {
    application: "road-defect-collector",
    status: isReady ? "ready" : status,
    timestamp: new Date().toISOString(),
    // Preserved top-level boolean flags for backward compatibility
    admin: authReady,
    storage: storageReady,
    database: dbProbe.healthy,
    components: {
      database: {
        status: dbProbe.healthy ? "healthy" : "unhealthy",
        schemaInitialized: dbProbe.schemaInitialized,
        latencyMs: dbProbe.latencyMs,
      },
      storage: {
        status: storageReady ? "configured" : "missing-configuration",
      },
      auth: {
        status: authReady ? "configured" : "missing-configuration",
      },
    },
  };

  const payload = includeDetailedDiagnostics
    ? {
        ...basePayload,
        diagnostics: {
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV ?? "development",
          missingTables: dbProbe.missingTables,
          ...(dbProbe.error ? { databaseError: dbProbe.error } : {}),
          memoryUsage: process.memoryUsage(),
        },
      }
    : basePayload;

  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Health-Status": basePayload.status,
    "Server-Timing": `db;dur=${dbProbe.latencyMs}, total;dur=${totalDurationMs}`,
  };

  return {
    httpStatus: isReady ? 200 : 503,
    headers,
    payload,
  };
}

export async function GET() {
  const isAdmin = await isAdminAuthenticated().catch(() => false);
  const { httpStatus, headers, payload } = await evaluateSystemHealth(isAdmin);

  return Response.json(payload, {
    status: httpStatus,
    headers,
  });
}

export async function HEAD() {
  const { httpStatus, headers } = await evaluateSystemHealth(false);

  return new Response(null, {
    status: httpStatus,
    headers,
  });
}