"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { loginAction } from "./actions";

type LoginActionState = {
  error: string;
};

const initialState: LoginActionState = { error: "" };

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const visibleError = !errorDismissed && state?.error ? state.error : "";

  // Re-enable error display and refocus the password field whenever a new action result arrives
  useEffect(() => {
    if (!pending && state?.error) {
      setErrorDismissed(false);
      setShowPassword(false);
      passwordInputRef.current?.focus();
      passwordInputRef.current?.select();
    }
  }, [pending, state]);

  function handleKeyActivity(event: KeyboardEvent<HTMLInputElement>) {
    if (typeof event.getModifierState === "function") {
      setCapsLockActive(event.getModifierState("CapsLock"));
    }
  }

  const describedByIds = [
    visibleError ? "admin-login-error" : null,
    capsLockActive ? "admin-login-capslock" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <form
      action={action}
      aria-busy={pending}
      className="admin-login-form"
      noValidate
      onSubmit={() => {
        setErrorDismissed(false);
        setShowPassword(false);
      }}
    >
      {/* Hidden username hint for browser password manager compatibility */}
      <input
         aria-hidden="true"
        autoComplete="username"
        defaultValue="admin"
        name="username"
        readOnly
        style={{ display: "none" }}
        tabIndex={-1}
        type="text"
      />

      <label className="field" htmlFor="admin-password-input">
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <span>Administrator password</span>
          <button
            aria-controls="admin-password-input"
            aria-label={
              showPassword
                ? "Hide administrator password"
                : "Show administrator password"
            }
            aria-pressed={showPassword}
            className="text-button"
            disabled={pending}
            onClick={() => {
              setShowPassword((prev) => !prev);
              passwordInputRef.current?.focus();
            }}
            style={{ fontSize: "0.8125rem", padding: 0 }}
            type="button"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <input
          aria-describedby={describedByIds || undefined}
          aria-invalid={visibleError ? true : undefined}
          autoCapitalize="none"
          autoComplete="current-password"
          autoCorrect="off"
          autoFocus
          disabled={pending}
          id="admin-password-input"
          maxLength={256}
          name="password"
          onBlur={() => setCapsLockActive(false)}
          onChange={() => {
            if (errorDismissed === false && state?.error) {
              setErrorDismissed(true);
            }
          }}
          onKeyDown={handleKeyActivity}
          onKeyUp={handleKeyActivity}
          placeholder="Enter administrator password"
          ref={passwordInputRef}
          required
          spellCheck={false}
          type={showPassword ? "text" : "password"}
        />
      </label>

      {capsLockActive ? (
        <small
          aria-live="polite"
          id="admin-login-capslock"
          style={{ color: "#b45309", display: "block", marginTop: "-0.25rem" }}
        >
          Caps Lock is on.
        </small>
      ) : null}

      {visibleError ? (
        <p
          aria-live="assertive"
          className="field-error"
          id="admin-login-error"
          role="alert"
        >
          {visibleError}
        </p>
      ) : null}

      <button
        aria-disabled={pending}
        className="submit-button"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}