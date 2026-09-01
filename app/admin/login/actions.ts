"use server";

import { redirect } from "next/navigation";
import {
  createAdminSession,
  verifyAdminPassword,
} from "../../../lib/admin-auth";

export type LoginState = { error: string };

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");

  try {
    if (!verifyAdminPassword(password)) {
      return { error: "The administrator password is incorrect." };
    }

    await createAdminSession();
  } catch {
    return { error: "Administrator access has not been configured." };
  }

  redirect("/admin");
}
