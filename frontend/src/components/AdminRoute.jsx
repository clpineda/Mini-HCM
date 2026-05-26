import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return <main className="app-shell">Loading...</main>;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
