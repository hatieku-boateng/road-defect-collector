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
<<<<<<< HEAD
          autoComplete="current-password"
          name="password"
          placeholder="Enter password"
=======
          aria-describedby={state.error ? "admin-login-error" : undefined}
          aria-invalid={state.error ? true : undefined}
          autoComplete="current-password"
          name="password"
          placeholder="Enter administrator password"
>>>>>>> aa728d9 (admin UI)
          required
          type="password"
        />
      </label>
<<<<<<< HEAD
      <p className="field-error" role="alert">
        {state.error}
      </p>
=======
      {state.error && (
        <p className="field-error" id="admin-login-error" role="alert">
          {state.error}
        </p>
      )}
>>>>>>> aa728d9 (admin UI)
      <button className="submit-button" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
