"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAdminSession,
  verifyAdminPassword,
} from "../../../lib/admin-auth";

export type LoginState = {
  error: string;
};

const MAX_PASSWORD_LENGTH = 256;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const FAILED_ATTEMPT_DELAY_MS = 350;
const MAX_TRACKED_IPS = 1000;

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const failedLoginAttempts = new Map<string, RateLimitRecord>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveClientIp(): Promise<string> {
  try {
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for");
    if (forwardedFor) {
      const firstIp = forwardedFor.split(",")[0]?.trim();
      if (firstIp) return firstIp;
    }
    const realIp = headerStore.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  } catch {
    // Fallback if headers() is unavailable in test context
  }
  return "unknown-ip";
}

function pruneExpiredRateLimits(now: number): void {
  if (failedLoginAttempts.size <= MAX_TRACKED_IPS) return;
  for (const [ip, entry] of failedLoginAttempts.entries()) {
    if (now >= entry.resetAt) {
      failedLoginAttempts.delete(ip);
    }
  }
}

function getRemainingLockoutMinutes(ip: string, now: number): number {
  const entry = failedLoginAttempts.get(ip);
  if (!entry) return 0;
  if (now >= entry.resetAt) {
    failedLoginAttempts.delete(ip);
    return 0;
  }
  if (entry.count < MAX_FAILED_ATTEMPTS) return 0;
  return Math.max(1, Math.ceil((entry.resetAt - now) / 60_000));
}

function recordFailedAttempt(ip: string, now: number): void {
  pruneExpiredRateLimits(now);
  const existing = failedLoginAttempts.get(ip);
  if (!existing || now >= existing.resetAt) {
    failedLoginAttempts.set(ip, {
      count: 1,
      resetAt: now + LOCKOUT_WINDOW_MS,
    });
    return;
  }
  existing.count += 1;
}

function clearFailedAttempts(ip: string): void {
  failedLoginAttempts.delete(ip);
}

function resolveSafeRedirectTarget(rawTarget: FormDataEntryValue | null): string {
  if (typeof rawTarget !== "string") return "/admin";
  const cleaned = rawTarget.trim();
  if (
    !cleaned.startsWith("/admin") ||
    cleaned.startsWith("//") ||
    cleaned.startsWith("/admin/login")
  ) {
    return "/admin";
  }
  return cleaned;
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const now = Date.now();
  const clientIp = await resolveClientIp();

  const lockoutMinutes = getRemainingLockoutMinutes(clientIp, now);
  if (lockoutMinutes > 0) {
    return {
      error: `Too many failed sign-in attempts. Please wait ${lockoutMinutes} minute${lockoutMinutes === 1 ? "" : "s"} and try again.`,
    };
  }

  const rawPassword = formData.get("password");
  if (typeof rawPassword !== "string" || rawPassword.length === 0) {
    return { error: "Enter the administrator password to continue." };
  }

  if (rawPassword.length > MAX_PASSWORD_LENGTH) {
    recordFailedAttempt(clientIp, now);
    await sleep(FAILED_ATTEMPT_DELAY_MS);
    return { error: "The administrator password is incorrect." };
  }

  try {
    const isValid = verifyAdminPassword(rawPassword);

    if (!isValid) {
      recordFailedAttempt(clientIp, now);
      await sleep(FAILED_ATTEMPT_DELAY_MS);

      const newLockoutMinutes = getRemainingLockoutMinutes(
        clientIp,
        Date.now(),
      );
      if (newLockoutMinutes > 0) {
        return {
          error: `Too many failed sign-in attempts. Please wait ${newLockoutMinutes} minute${newLockoutMinutes === 1 ? "" : "s"} and try again.`,
        };
      }

      return { error: "The administrator password is incorrect." };
    }

    await createAdminSession();
    clearFailedAttempts(clientIp);
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

    console.error("Administrator login failed due to configuration error:", error);
    return {
      error: "Administrator access has not been configured.",
    };
  }

  const targetUrl = resolveSafeRedirectTarget(formData.get("redirectTo"));
  redirect(targetUrl);
}