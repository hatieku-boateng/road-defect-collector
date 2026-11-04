import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "road_admin_session";
const SESSION_VERSION = "v1";
const SESSION_SUBJECT = "road-admin";

/** Default session lifetime: 8 hours (in seconds) */
const SESSION_TTL_SECONDS = 60 * 60 * 8;

/** Refresh threshold: renew session when less than 2 hours remain */
const REFRESH_THRESHOLD_SECONDS = 60 * 60 * 2;

/** Maximum failed login attempts before temporary lockout */
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface AdminSessionPayload {
  v: number;
  sub: typeof SESSION_SUBJECT;
  role: "admin";
  iat: number;
  exp: number;
  jti: string;
}

interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const loginAttempts = new Map<string, RateLimitEntry>();

/**
 * Constant-time string comparison that hashes both inputs with SHA-256 first
 * so that secret lengths are never leaked via timing side-channels.
 */
function safeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function getSessionSecrets(): string[] {
  const rawSecret = process.env.SESSION_SECRET;

  if (!rawSecret || !rawSecret.trim()) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  const secrets = rawSecret
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (secrets.length === 0) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return secrets;
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${SESSION_VERSION}.${encodedPayload}`)
    .digest("base64url");
}

function createSessionToken(ttlSeconds: number = SESSION_TTL_SECONDS): string {
  const [primarySecret] = getSessionSecrets();
  const nowSeconds = Math.floor(Date.now() / 1000);

  const payload: AdminSessionPayload = {
    v: 1,
    sub: SESSION_SUBJECT,
    role: "admin",
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    jti: randomBytes(16).toString("base64url"),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload, primarySecret);

  return `${SESSION_VERSION}.${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string): AdminSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [version, encodedPayload, signature] = parts;
  if (version !== SESSION_VERSION || !encodedPayload || !signature) {
    return null;
  }

  const secrets = getSessionSecrets();
  const isSignatureValid = secrets.some((secret) =>
    safeEqual(signature, signPayload(encodedPayload, secret)),
  );

  if (!isSignatureValid) return null;

  try {
    const json = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(json) as Partial<AdminSessionPayload>;

    const nowSeconds = Math.floor(Date.now() / 1000);

    if (
      payload.v !== 1 ||
      payload.sub !== SESSION_SUBJECT ||
      payload.role !== "admin" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      typeof payload.jti !== "string" ||
      payload.exp <= nowSeconds
    ) {
      return null;
    }

    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

function getCookieOptions(maxAgeSeconds: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    maxAge: maxAgeSeconds,
    path: "/",
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * Returns the decoded admin session payload if valid and unexpired, or null.
 */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  return verifySessionToken(token);
}

/**
 * Checks whether the current request has a valid, unexpired admin session.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getAdminSession();
  return session !== null;
}

/**
 * Enforces admin authentication in Server Components and Server Actions.
 * Redirects to /admin/login if unauthenticated; otherwise returns the session payload.
 */
export async function requireAdmin(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}

/**
 * Verifies the administrator password in constant time without leaking password length.
 * Supports multiple comma-separated passwords in ADMIN_PASSWORD if needed.
 */
export function verifyAdminPassword(password: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredPassword) {
    throw new Error("ADMIN_PASSWORD is not configured.");
  }

  if (!password) return false;

  return safeEqual(password, configuredPassword);
}

/**
 * Issues a new signed, time-bound admin session cookie.
 */
export async function createAdminSession(ttlSeconds: number = SESSION_TTL_SECONDS): Promise<void> {
  const token = createSessionToken(ttlSeconds);
  (await cookies()).set(COOKIE_NAME, token, getCookieOptions(ttlSeconds));
}

/**
 * Sliding session renewal: extends the session cookie if it is valid
 * and within REFRESH_THRESHOLD_SECONDS of expiring.
 */
export async function refreshAdminSession(): Promise<boolean> {
  const session = await getAdminSession();
  if (!session) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const remainingSeconds = session.exp - nowSeconds;

  if (remainingSeconds <= REFRESH_THRESHOLD_SECONDS) {
    await createAdminSession(SESSION_TTL_SECONDS);
    return true;
  }

  return false;
}

/**
 * Clears the admin session cookie cleanly using matching path and security attributes.
 */
export async function clearAdminSession(): Promise<void> {
  (await cookies()).set(COOKIE_NAME, "", {
    ...getCookieOptions(0),
    expires: new Date(0),
  });
}

/**
 * Brute-force protection helpers for the admin login endpoint.
 */
export function checkLoginRateLimit(clientKey: string = "global"): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const entry = loginAttempts.get(clientKey);

  if (!entry) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  if (now - entry.firstAttemptAt > LOCKOUT_WINDOW_MS) {
    loginAttempts.delete(clientKey);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(clientKey: string = "global"): void {
  const now = Date.now();
  const existing = loginAttempts.get(clientKey);

  if (!existing || now - existing.firstAttemptAt > LOCKOUT_WINDOW_MS) {
    loginAttempts.set(clientKey, {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    });
    return;
  }

  const attempts = existing.attempts + 1;
  loginAttempts.set(clientKey, {
    ...existing,
    attempts,
    lockedUntil: attempts >= MAX_LOGIN_ATTEMPTS ? now + LOCKOUT_WINDOW_MS : null,
  });
}

export function resetLoginRateLimit(clientKey: string = "global"): void {
  loginAttempts.delete(clientKey);
}