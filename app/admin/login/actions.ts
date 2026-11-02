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
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ADMIN_PASSWORD is not configured."
    ) {
      return {
        error:
          "Administrator sign-in is not configured. Set ADMIN_PASSWORD in the deployment environment.",
      };
    }

    if (
      error instanceof Error &&
      error.message === "SESSION_SECRET is not configured."
    ) {
      return {
        error:
          "Administrator sessions are not configured. Set SESSION_SECRET in the deployment environment.",
      };
    }

    return {
      error: "Administrator access has not been configured.",
    };
  }

  redirect("/admin");
}
