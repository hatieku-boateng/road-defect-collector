import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "../../../lib/admin-auth";
import { adminAuthIsConfigured } from "../../../lib/config";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrator sign in",
  description:
    "Restricted administrator portal for reviewing and triaging road defect submissions.",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  value: string | string[] | undefined,
): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }
  return "";
}

/**
 * Ensures any post-login redirect target stays strictly within `/admin`
 * and prevents open-redirect vulnerabilities (e.g. `//attacker.com`).
 */
function resolveSafeAdminRedirect(rawTarget: string): string {
  if (
    !rawTarget ||
    !rawTarget.startsWith("/admin") ||
    rawTarget.startsWith("//") ||
    rawTarget.startsWith("/admin/login")
  ) {
    return "/admin";
  }
  return rawTarget;
}

const REASON_MESSAGES: Readonly<Record<string, string>> = {
  expired: "Your administrator session has expired. Please sign in again.",
  unauthorized: "Please sign in with your administrator credentials to continue.",
  "rate-limited":
    "Too many sign-in attempts were detected. Wait a moment before trying again.",
};

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const requestedRedirect =
    getParam(params.next) || getParam(params.redirectTo);
  const safeRedirectTarget = resolveSafeAdminRedirect(requestedRedirect);

  const alreadySignedIn = await isAdminAuthenticated();
  if (alreadySignedIn) {
    redirect(safeRedirectTarget);
  }

  const authConfigured = adminAuthIsConfigured();
  const reasonKey = (
    getParam(params.reason) || getParam(params.error)
  ).toLowerCase();
  const loggedOut = getParam(params.loggedOut) === "true";
  const statusBanner = REASON_MESSAGES[reasonKey] ?? "";

  return (
    <main className="admin-login-page">
      <section aria-labelledby="admin-login-heading" className="admin-login-card">
        <Link className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            GR
          </span>
          <span>
            <strong>Ghana Road Defect</strong>
            <small>Administrator workspace</small>
          </span>
        </Link>

        <div>
          <p className="eyebrow">Protected access</p>
          <h1 id="admin-login-heading">Review collected road data.</h1>
          <p className="intro">
            Sign in to approve, correct, or reject submitted road images and
            manage repair progress updates.
          </p>
        </div>

        {!authConfigured ? (
          <p className="configuration-alert" role="alert">
            Administrator authentication is not configured for this deployment.
            Set <code>ADMIN_PASSWORD</code> and <code>SESSION_SECRET</code> in
            your environment variables.
          </p>
        ) : null}

        {loggedOut ? (
          <p className="status-update-message status-update-success" role="status">
            You have been signed out safely.
          </p>
        ) : null}

        {statusBanner ? (
          <p className="status-update-message status-update-failed" role="alert">
            {statusBanner}
          </p>
        ) : null}

        <LoginForm />
      </section>
    </main>
  );
}