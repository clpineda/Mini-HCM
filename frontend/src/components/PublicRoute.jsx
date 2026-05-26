import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export function PublicRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <main className="app-shell">Loading...</main>;
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
