import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Administrator sign in" };

export default function AdminLoginPage() {
  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">GR</span>
          <span>
            <strong>Ghana Road Defect</strong>
            <small>Administrator workspace</small>
          </span>
        </Link>
        <div>
          <p className="eyebrow">Protected access</p>
          <h1>Review collected road data.</h1>
          <p className="intro">
            Sign in to approve, correct or reject submitted road images.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
