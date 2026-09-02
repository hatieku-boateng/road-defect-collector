import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import {
  WORKFLOW_STATUSES,
  type WorkflowStatus,
} from "../../../../../lib/config";
import { updateSubmissionReview } from "../../../../../lib/submissions";

function adminRedirect(request: Request, result: "failed" | "success") {
  return NextResponse.redirect(new URL(`/admin?update=${result}`, request.url), 303);
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !WORKFLOW_STATUSES.includes(status as WorkflowStatus)
  ) {
    return adminRedirect(request, "failed");
  }

  try {
    await updateSubmissionReview(id, status as WorkflowStatus, note);
    revalidatePath("/admin");
    return adminRedirect(request, "success");
  } catch (error) {
    console.error(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      level: "error",
      msg: "submission status update failed",
      submissionId: id,
      targetStatus: status,
    }));
    return adminRedirect(request, "failed");
  }
}
