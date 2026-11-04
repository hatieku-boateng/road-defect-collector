import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import { ensureSchema, getSql } from "../../../../../lib/db";
import { notifyReportOwner } from "../../../../../lib/push";
import {
  recordReportEvent,
  restoreSubmission,
} from "../../../../../lib/submissions";

/** Strict 8-4-4-4-12 hexadecimal UUID pattern */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Maximum number of archived submissions that can be restored in a single request */
const MAX_BATCH_SIZE = 50;

type WorkflowStatus =
  | "pending"
  | "rejected"
  | "verified"
  | "assigned"
  | "inspection-scheduled"
  | "repair-in-progress"
  | "repair-completed";

function normalizeWorkflowStatus(status?: string | null): WorkflowStatus | null {
  switch (status) {
    case "pending":
    case "rejected":
    case "verified":
    case "assigned":
    case "inspection-scheduled":
    case "repair-in-progress":
    case "repair-completed":
      return status;
    default:
      return null;
  }
}

function wantsJsonResponse(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

function respondWithRestoreResult(
  request: Request,
  result: "failed" | "success",
  options?: {
    status?: number;
    message?: string;
    restoredIds?: string[];
  },
) {
  if (wantsJsonResponse(request)) {
    return NextResponse.json(
      {
        success: result === "success",
        ...(options?.restoredIds
          ? {
              restoredCount: options.restoredIds.length,
              restoredIds: options.restoredIds,
            }
          : {}),
        ...(options?.message ? { message: options.message } : {}),
      },
      {
        status: options?.status ?? (result === "success" ? 200 : 400),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.redirect(
    new URL(`/admin/archives?restore=${result}`, request.url),
    303,
  );
}

/**
 * Extracts one or more candidate submission UUIDs from either FormData or a JSON body.
 */
async function extractTargetIds(request: Request): Promise<string[] | null> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  const rawTokens: string[] = [];

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        id?: unknown;
        ids?: unknown;
      };

      if (typeof body?.id === "string") {
        rawTokens.push(body.id);
      }
      if (Array.isArray(body?.ids)) {
        for (const item of body.ids) {
          if (typeof item === "string") rawTokens.push(item);
        }
      } else if (typeof body?.ids === "string") {
        rawTokens.push(...body.ids.split(","));
      }
    } else {
      const formData = await request.formData();
      const entries = [...formData.getAll("id"), ...formData.getAll("ids")];

      for (const entry of entries) {
        if (typeof entry === "string") {
          rawTokens.push(...entry.split(","));
        }
      }
    }
  } catch {
    return null;
  }

  const normalized = Array.from(
    new Set(rawTokens.map((token) => token.trim()).filter(Boolean)),
  );

  if (normalized.length === 0 || normalized.length > MAX_BATCH_SIZE) {
    return null;
  }

  if (!normalized.every((candidate) => UUID_PATTERN.test(candidate))) {
    return null;
  }

  return normalized;
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    if (wantsJsonResponse(request)) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const targetIds = await extractTargetIds(request);
  if (!targetIds) {
    return respondWithRestoreResult(request, "failed", {
      status: 400,
      message: "Invalid or missing submission ID.",
    });
  }

  try {
    await ensureSchema();
    const sql = getSql();

    // Verify which of the requested IDs currently exist in an archived state
    // so we do not fire duplicate notifications for missing or already-active reports.
    const existingRows = (await sql.query(
      `SELECT id, workflow_status
       FROM road_submissions
       WHERE id = ANY($1::uuid[]) AND archived_at IS NOT NULL`,
      [targetIds],
    )) as Array<{ id: string; workflow_status?: string | null }>;

    if (!Array.isArray(existingRows) || existingRows.length === 0) {
      return respondWithRestoreResult(request, "failed", {
        status: 404,
        message: "No matching archived report found to restore.",
      });
    }

    const restoredIds: string[] = [];

    for (const row of existingRows) {
      await restoreSubmission(row.id);
      restoredIds.push(row.id);

      // Post-commit side effects: isolated so a notification or event-log error
      // never causes the restore operation to report a false failure.
      await recordReportEvent(
        row.id,
        "status",
        normalizeWorkflowStatus(row.workflow_status),
        "Report restored from administrator archive.",
      ).catch((eventError) =>
        console.warn("Restore event logging warning:", eventError),
      );

      await notifyReportOwner({
        body: "Your road report was restored to the active dashboard.",
        submissionId: row.id,
        title: "Road report restored",
      }).catch((notificationError) =>
        console.error("Restore notification failed", notificationError),
      );
    }

    try {
      revalidatePath("/admin");
      revalidatePath("/admin/archives");
      revalidatePath("/reports");
    } catch (revalidateError) {
      console.warn("Cache revalidation warning:", revalidateError);
    }

    return respondWithRestoreResult(request, "success", {
      restoredIds,
    });
  } catch (error) {
    console.error("Submission restore failed", error);
    return respondWithRestoreResult(request, "failed", {
      status: 500,
      message: "Failed to restore submission.",
    });
  }
}