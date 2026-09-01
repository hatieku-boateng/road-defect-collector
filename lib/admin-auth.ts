import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "road_admin_session";
const SESSION_PAYLOAD = "road-admin";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return secret;
}

function createSessionToken() {
  const signature = createHmac("sha256", getSessionSecret())
    .update(SESSION_PAYLOAD)
    .digest("hex");

  return `${SESSION_PAYLOAD}.${signature}`;
}

export async function isAdminAuthenticated() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  if (!token) return false;

  return safeEqual(token, createSessionToken());
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export function verifyAdminPassword(password: string) {
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredPassword) {
    throw new Error("ADMIN_PASSWORD is not configured.");
  }

  return safeEqual(password, configuredPassword);
}

export async function createAdminSession() {
  (await cookies()).set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(COOKIE_NAME);
}
