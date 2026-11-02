"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

const initialState = { error: "" };

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="admin-login-form">
      <label className="field">
        <span>Administrator password</span>
        <input
          aria-describedby={state.error ? "admin-login-error" : undefined}
          aria-invalid={state.error ? true : undefined}
          autoComplete="current-password"
          name="password"
          placeholder="Enter administrator password"
          required
          type="password"
        />
      </label>
      {state.error && (
        <p className="field-error" id="admin-login-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="submit-button" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
