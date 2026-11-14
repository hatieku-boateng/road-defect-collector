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

function getParam(value: string | string[] | undefined): string {
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
  unauthorized:
    "Please sign in with your administrator credentials to continue.",
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
  const switchSession = getParam(params.switch) === "true";

  const alreadySignedIn = await isAdminAuthenticated();
  if (alreadySignedIn && !switchSession) {
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
      <style>{`
        .admin-login-page {
          --paper: #f6f3ea;
          --paper-2: #efeadc;
          --surface: #ffffff;
          --ink: #14231c;
          --ink-soft: #46564d;
          --ink-faint: #78857d;
          --line: #e6dfcf;
          --line-strong: #d4ccb8;
          --green: #0b6b45;
          --green-deep: #073f2a;
          --green-soft: #e1f0e6;
          --gold: #f0b429;
          --rejected: #c8372d;
          --rejected-bg: #fbe3e0;
          --pending: #b7791f;
          --pending-bg: #fbefce;

          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: clamp(1.25rem, 4vw, 2.5rem);
          background: var(--paper);
          color: var(--ink);
          font-family: var(--font-body, "Manrope"), ui-sans-serif, system-ui, sans-serif;
          line-height: 1.6;
        }

        .admin-login-page .admin-login-card {
          width: min(480px, 100%);
          display: grid;
          gap: 1.35rem;
          padding: clamp(1.75rem, 4vw, 2.5rem);
          border-radius: 28px;
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: 0 1px 2px rgba(20, 35, 28, 0.05),
            0 24px 48px -28px rgba(20, 35, 28, 0.35);
        }

        .admin-login-page .brand {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          color: inherit;
          justify-self: start;
        }

        .admin-login-page .brand-mark {
          position: relative;
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: var(--green);
          color: #fff;
          font-weight: 800;
          font-size: 0.95rem;
          letter-spacing: 0.02em;
        }

        .admin-login-page .brand-mark::after {
          content: "";
          position: absolute;
          left: 9px;
          right: 9px;
          bottom: 6px;
          height: 2px;
          background: repeating-linear-gradient(
            90deg,
            var(--gold) 0 5px,
            transparent 5px 9px
          );
        }

        .admin-login-page .brand strong {
          display: block;
          font-size: 1rem;
          font-weight: 800;
          line-height: 1.15;
        }

        .admin-login-page .brand small {
          display: block;
          color: var(--ink-faint);
          font-size: 0.78rem;
          line-height: 1.2;
        }

        .admin-login-page .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          margin: 0 0 0.6rem;
          color: var(--green);
          font-size: 0.84rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .admin-login-page .eyebrow::before {
          content: "";
          width: 24px;
          height: 3px;
          border-radius: 2px;
          background: var(--gold);
        }

        .admin-login-page h1 {
          margin: 0;
          font-family: var(--font-serif, "Fraunces"), Georgia, serif;
          font-size: clamp(1.85rem, 4vw, 2.35rem);
          font-weight: 600;
          line-height: 1.08;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .admin-login-page .intro {
          margin: 0.65rem 0 0;
          color: var(--ink-soft);
          font-size: 0.96rem;
        }

        .admin-login-page .configuration-alert,
        .admin-login-page .status-update-message {
          margin: 0;
          padding: 0.85rem 1.05rem;
          border-radius: 14px;
          border: 1px solid var(--line);
          border-left: 4px solid var(--green);
          font-size: 0.9rem;
          font-weight: 600;
        }

        .admin-login-page .configuration-alert {
          border-left-color: var(--pending);
          background: var(--pending-bg);
          color: #7a5200;
        }

        .admin-login-page .status-update-success {
          border-left-color: var(--green);
          background: var(--green-soft);
          color: var(--green-deep);
        }

        .admin-login-page .status-update-failed {
          border-left-color: var(--rejected);
          background: var(--rejected-bg);
          color: #8f2a22;
        }

        .admin-login-page .login-footer-links {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 0.5rem 1rem;
          padding-top: 0.9rem;
          border-top: 1px solid var(--line);
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--ink-soft);
        }

        .admin-login-page .login-footer-links a {
          color: var(--green);
          text-decoration: none;
        }

        .admin-login-page .login-footer-links a:hover {
          text-decoration: underline;
        }
      `}</style>

      <section
        aria-labelledby="admin-login-heading"
        className="admin-login-card"
      >
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

        {alreadySignedIn && switchSession ? (
          <p
            className="status-update-message status-update-success"
            role="status"
          >
            You already have an active administrator session. Sign in below to
            refresh your session, or{" "}
            <Link
              href={safeRedirectTarget}
              style={{ fontWeight: 800, textDecoration: "underline" }}
            >
              return to the dashboard
            </Link>
            .
          </p>
        ) : null}

        {loggedOut ? (
          <p
            className="status-update-message status-update-success"
            role="status"
          >
            You have been signed out safely.
          </p>
        ) : null}

        {statusBanner ? (
          <p
            className="status-update-message status-update-failed"
            role="alert"
          >
            {statusBanner}
          </p>
        ) : null}

        <LoginForm />

        <div className="login-footer-links">
          <Link href="/">← Back to home</Link>
          <Link href="/reports">Public map</Link>
          <Link href="/collect">Field collector</Link>
        </div>
      </section>
    </main>
  );
}