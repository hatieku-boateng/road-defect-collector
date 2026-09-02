"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin } from "../../lib/admin-auth";

export async function logoutAction() {
  revalidatePath("/admin");
  await requireAdmin();
  await clearAdminSession();
  redirect("/admin/login");
}
