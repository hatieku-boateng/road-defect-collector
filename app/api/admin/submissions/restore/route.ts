import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import { restoreSubmission } from "../../../../../lib/submissions";
import { notifyReportOwner } from "../../../../../lib/push";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.redirect(new URL("/admin/archives?restore=failed", request.url), 303);
  }

  try {
    await restoreSubmission(id);
    await notifyReportOwner({
      body: "Your road report was restored to the active dashboard.",
      submissionId: id,
      title: "Road report restored",
    }).catch((notificationError) => console.error("Restore notification failed", notificationError));
    revalidatePath("/admin");
    revalidatePath("/admin/archives");
    revalidatePath("/reports");
    return NextResponse.redirect(new URL("/admin/archives?restore=success", request.url), 303);
  } catch (error) {
    console.error("Submission restore failed", error);
    return NextResponse.redirect(new URL("/admin/archives?restore=failed", request.url), 303);
  }
}
