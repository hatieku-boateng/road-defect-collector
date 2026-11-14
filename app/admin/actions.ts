"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession } from "../../lib/admin-auth";

export async function logoutAction(_formData?: FormData): Promise<never> {
  try {
    await clearAdminSession();
  } catch (error) {
    console.warn("Failed to clear admin session cookie during logout:", error);
  }

  try {
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/archives", "page");
    revalidatePath("/admin/login", "page");
  } catch {
    // Ignore revalidation errors if invoked outside standard request lifecycle
  }

  redirect("/admin/login?loggedOut=true");
}