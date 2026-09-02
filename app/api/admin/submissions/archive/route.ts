import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import { archiveSubmission } from "../../../../../lib/submissions";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.redirect(new URL("/admin?archive=failed", request.url), 303);
  }

  try {
    await archiveSubmission(id, reason);
    revalidatePath("/admin");
    revalidatePath("/admin/archives");
    revalidatePath("/reports");
    return NextResponse.redirect(new URL("/admin?archive=success", request.url), 303);
  } catch (error) {
    console.error("Submission archive failed", error);
    return NextResponse.redirect(new URL("/admin?archive=failed", request.url), 303);
  }
}
