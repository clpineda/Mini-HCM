import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

const defaultForm = {
  name: "",
  email: "",
  password: "",
  role: "employee",
  timezone: "Asia/Manila",
  scheduleStart: "09:00",
  scheduleEnd: "18:00"
};

export function RegisterPage() {
  const { register, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      await register(form);
      navigate("/dashboard", { replace: true });
    } catch (authError) {
      setError(authError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="auth-panel wide" aria-labelledby="register-title">
        <p className="eyebrow">Mini HCM</p>
        <h1 id="register-title">Register</h1>
        <p className="intro">Create an employee profile with a default work schedule.</p>

        {!isConfigured && (
          <p className="notice">Firebase is not configured. Add values to `.env` first.</p>
        )}

        <form className="auth-form grid-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              autoComplete="name"
              name="name"
              onChange={updateField}
              required
              type="text"
              value={form.name}
            />
          </label>

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
              autoComplete="new-password"
              minLength="6"
              name="password"
              onChange={updateField}
              required
              type="password"
              value={form.password}
            />
          </label>

          <label>
            Role
            <select name="role" onChange={updateField} value={form.role}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <label>
            Timezone
            <input
              name="timezone"
              onChange={updateField}
              required
              type="text"
              value={form.timezone}
            />
          </label>

          <div className="time-row">
            <label>
              Schedule start
              <input
                name="scheduleStart"
                onChange={updateField}
                required
                type="time"
                value={form.scheduleStart}
              />
            </label>

            <label>
              Schedule end
              <input
                name="scheduleEnd"
                onChange={updateField}
                required
                type="time"
                value={form.scheduleEnd}
              />
            </label>
          </div>

          {error && <p className="form-error full-width">{error}</p>}

          <button className="full-width" disabled={submitting || !isConfigured} type="submit">
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
