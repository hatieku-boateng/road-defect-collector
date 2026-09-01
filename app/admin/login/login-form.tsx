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
          autoComplete="current-password"
          name="password"
          placeholder="Enter password"
          required
          type="password"
        />
      </label>
      <p className="field-error" role="alert">
        {state.error}
      </p>
      <button className="submit-button" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
