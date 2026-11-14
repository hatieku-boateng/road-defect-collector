"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
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
  const [clientError, setClientError] = useState("");
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const serverError = !errorDismissed && state?.error ? state.error : "";
  const visibleError = clientError || serverError;

  // Re-enable error display and refocus the password field whenever a new action result arrives
  useEffect(() => {
    if (!pending && state?.error) {
      setErrorDismissed(false);
      setClientError("");
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const currentValue = passwordInputRef.current?.value ?? "";
    if (!currentValue.trim()) {
      event.preventDefault();
      setClientError("Please enter the administrator password.");
      passwordInputRef.current?.focus();
      return;
    }
    setClientError("");
    setErrorDismissed(false);
    setShowPassword(false);
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
      onSubmit={handleSubmit}
    >
      <style>{`
        .admin-login-form {
          display: grid;
          gap: 1.1rem;
        }

        .admin-login-form .field {
          display: grid;
          gap: 0.45rem;
        }

        .admin-login-form .field-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .admin-login-form .field-label-row > span {
          color: var(--ink-soft, #46564d);
          font-size: 0.86rem;
          font-weight: 700;
        }

        .admin-login-form .toggle-password-btn {
          padding: 0.2rem 0.65rem;
          border: 1px solid var(--line, #e6dfcf);
          border-radius: 999px;
          background: var(--paper, #f6f3ea);
          color: var(--green, #0b6b45);
          font: inherit;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .admin-login-form .toggle-password-btn:hover:not(:disabled) {
          background: var(--green-soft, #e1f0e6);
          border-color: var(--green, #0b6b45);
        }

        .admin-login-form .toggle-password-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .admin-login-form input[type="password"],
        .admin-login-form input[type="text"] {
          width: 100%;
          padding: 0.8rem 0.95rem;
          border: 1.5px solid var(--line-strong, #d4ccb8);
          border-radius: 12px;
          background: #fdfcf8;
          color: var(--ink, #14231c);
          font: inherit;
          font-size: 0.96rem;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
        }

        .admin-login-form input[type="password"]:hover:not(:disabled),
        .admin-login-form input[type="text"]:hover:not(:disabled) {
          border-color: var(--ink-faint, #78857d);
        }

        .admin-login-form input[type="password"]:focus,
        .admin-login-form input[type="text"]:focus {
          outline: none;
          background: #ffffff;
          border-color: var(--green, #0b6b45);
          box-shadow: 0 0 0 4px rgba(11, 107, 69, 0.14);
        }

        .admin-login-form input[aria-invalid="true"] {
          border-color: var(--rejected, #c8372d);
        }

        .admin-login-form .capslock-notice {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          margin-top: -0.35rem;
          padding: 0.35rem 0.7rem;
          border-radius: 8px;
          background: var(--pending-bg, #fbefce);
          color: #7a5200;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .admin-login-form .field-error {
          margin: 0;
          padding: 0.75rem 0.95rem;
          border-radius: 12px;
          border: 1px solid rgba(200, 55, 45, 0.25);
          border-left: 4px solid var(--rejected, #c8372d);
          background: var(--rejected-bg, #fbe3e0);
          color: #8f2a22;
          font-size: 0.88rem;
          font-weight: 700;
        }

        .admin-login-form .submit-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 0.88rem 1.4rem;
          border: 2px solid transparent;
          border-radius: 999px;
          background: var(--green, #0b6b45);
          color: #ffffff;
          font: inherit;
          font-size: 0.96rem;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 22px -12px rgba(11, 107, 69, 0.8);
          transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
        }

        .admin-login-form .submit-button:hover:not(:disabled) {
          background: var(--green-deep, #073f2a);
          transform: translateY(-1px);
        }

        .admin-login-form .submit-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .admin-login-form .submit-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>

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
        <div className="field-label-row">
          <span>Administrator password</span>
          <button
            aria-controls="admin-password-input"
            aria-label={
              showPassword
                ? "Hide administrator password"
                : "Show administrator password"
            }
            aria-pressed={showPassword}
            className="toggle-password-btn"
            disabled={pending}
            onClick={() => {
              setShowPassword((prev) => !prev);
              passwordInputRef.current?.focus();
            }}
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
            if (clientError) setClientError("");
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
          className="capslock-notice"
          id="admin-login-capslock"
        >
          Caps Lock is on
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
        {pending ? "Signing in…" : "Sign in to workspace"}
      </button>
    </form>
  );
}