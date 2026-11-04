import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import {
  WORKFLOW_STATUSES,
  type WorkflowStatus,
} from "../../../../../lib/config";
import { ensureSchema, getSql } from "../../../../../lib/db";
import { notifyReportOwner } from "../../../../../lib/push";
import {
  recordReportEvent,
  updateSubmissionReview,
} from "../../../../../lib/submissions";

/** Strict 8-4-4-4-12 hexadecimal UUID pattern */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_NOTE_LENGTH = 500;
const VALID_WORKFLOW_SET = new Set<string>(WORKFLOW_STATUSES);

function normalizeNote(rawValue: string): string {
  return rawValue
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_NOTE_LENGTH);
}

function wantsJsonResponse(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

function adminResponse(
  request: Request,
  result: "failed" | "success",
  options?: {
    status?: number;
    errorCode?: string;
    message?: string;
  },
) {
  if (wantsJsonResponse(request)) {
    return NextResponse.json(
      {
        success: result === "success",
        ...(options?.errorCode ? { error: options.errorCode } : {}),
        ...(options?.message ? { message: options.message } : {}),
      },
      {
        status: options?.status ?? (result === "success" ? 200 : 400),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const url = new URL(`/admin?update=${result}`, request.url);
  if (options?.errorCode && /^[a-z0-9_-]{2,30}$/i.test(options.errorCode)) {
    url.searchParams.set("error", options.errorCode);
  }
  return NextResponse.redirect(url, 303);
}

async function extractPayload(request: Request): Promise<{
  id: string;
  status: WorkflowStatus;
  note: string;
} | null> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  try {
    let rawId = "";
    let rawStatus = "";
    let rawNote = "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        id?: unknown;
        status?: unknown;
        note?: unknown;
      };
      rawId = typeof body?.id === "string" ? body.id : "";
      rawStatus = typeof body?.status === "string" ? body.status : "";
      rawNote = typeof body?.note === "string" ? body.note : "";
    } else {
      const formData = await request.formData();
      rawId = String(formData.get("id") ?? "");
      rawStatus = String(formData.get("status") ?? "");
      rawNote = String(formData.get("note") ?? "");
    }

    const id = rawId.trim();
    const status = rawStatus.trim() as WorkflowStatus;
    const note = normalizeNote(rawNote);

    if (!UUID_PATTERN.test(id) || !VALID_WORKFLOW_SET.has(status)) {
      return null;
    }

    return { id, status, note };
  } catch {
    return null;
  }
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

  const payload = await extractPayload(request);
  if (!payload) {
    return adminResponse(request, "failed", {
      status: 400,
      errorCode: "invalid-parameters",
      message: "Invalid submission ID or workflow status.",
    });
  }

  const { id, status, note } = payload;

  try {
    await ensureSchema();
    const sql = getSql();

    // Verify submission exists and is active
    const active = await sql.query(
      "SELECT id FROM road_submissions WHERE id = $1 AND archived_at IS NULL LIMIT 1",
      [id],
    );
    const activeCount = Array.isArray(active)
      ? active.length
      : (active as { rowCount?: number }).rowCount ?? 0;

    if (activeCount === 0) {
      return adminResponse(request, "failed", {
        status: 404,
        errorCode: "not-found",
        message: "Submission not found or archived.",
      });
    }

    await updateSubmissionReview(id, status, note);

    // Post-commit side effects: isolated so audit events or notification failures
    // never mark a successful review update as a database failure.
    await recordReportEvent(
      id,
      "status",
      status,
      note || `Status updated to ${status.replaceAll("-", " ")}.`,
    ).catch((eventError) =>
      console.warn("Status change event recording warning:", eventError),
    );

    await notifyReportOwner({
      body: note || `Your road report is now ${status.replaceAll("-", " ")}.`,
      submissionId: id,
      title: "Road report updated",
    }).catch((notificationError) =>
      console.error("Status notification failed", notificationError),
    );

    try {
      revalidatePath("/admin");
      revalidatePath("/reports");
      revalidatePath("/");
    } catch (revalidateError) {
      console.warn("Cache revalidation warning:", revalidateError);
    }

    return adminResponse(request, "success");
  } catch (error) {
    const databaseCode =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "update-failed";

    console.error(
      JSON.stringify({
        code: databaseCode,
        error: error instanceof Error ? error.message : String(error),
        level: "error",
        msg: "submission status update failed",
        submissionId: id,
        targetStatus: status,
      }),
    );

    return adminResponse(request, "failed", {
      status: 500,
      errorCode: databaseCode,
      message: "Submission status update failed.",
    });
  }
}