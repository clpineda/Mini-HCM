import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export function AppHeader({ title }) {
  const { isAdmin, logout } = useAuth();

  return (
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">Mini HCM</p>
        <h1>{title}</h1>
      </div>

      <div className="header-actions">
        <nav className="app-nav" aria-label="Main navigation">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/history">History</NavLink>
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <button className="secondary-button" onClick={logout} type="button">
          Logout
        </button>
      </div>
    </header>
  );
}
