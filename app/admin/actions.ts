"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin } from "../../lib/admin-auth";
import { REVIEW_STATUSES, type ReviewStatus } from "../../lib/config";
import { updateSubmissionReview } from "../../lib/submissions";

export async function reviewSubmissionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("Invalid submission identifier.");
  }

  if (!REVIEW_STATUSES.includes(status as ReviewStatus) || status === "pending") {
    throw new Error("Invalid review status.");
  }

  await updateSubmissionReview(id, status as ReviewStatus, note);
  revalidatePath("/admin");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}
