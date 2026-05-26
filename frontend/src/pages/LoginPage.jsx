import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export function LoginPage() {
  const { login, isConfigured } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (authError) {
      setError(authError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="eyebrow">Mini HCM</p>
        <h1 id="login-title">Login</h1>
        <p className="intro">Sign in to access your time tracking dashboard.</p>

        {!isConfigured && (
          <p className="notice">Firebase is not configured. Add values to `.env` first.</p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={updateField}
              required
              type="email"
              value={form.email}
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              name="password"
              onChange={updateField}
              required
              type="password"
              value={form.password}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button disabled={submitting || !isConfigured} type="submit">
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="auth-switch">
          Need an account? <Link to="/register">Register</Link>
        </p>
      </section>
    </main>
  );
}
