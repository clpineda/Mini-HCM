import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { AppHeader } from "../components/AppHeader.jsx";
import { db } from "../lib/firebase.js";
import { formatAppTime } from "../lib/time.js";

export function HistoryPage() {
  const { currentUser } = useAuth();
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSummaries() {
      if (!currentUser || !db) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const snapshot = await getDocs(
          query(collection(db, "dailySummary"), where("userId", "==", currentUser.uid))
        );

        setSummaries(
          snapshot.docs
            .map((summaryDoc) => ({
              id: summaryDoc.id,
              ...summaryDoc.data()
            }))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        );
      } catch (summaryError) {
        setError(summaryError.message);
      } finally {
        setLoading(false);
      }
    }

    loadSummaries();
  }, [currentUser]);

  return (
    <main className="dashboard-shell">
      <AppHeader title="History" />

      <section className="history-panel">
        <h2>Daily summaries</h2>

        {loading && <p className="muted">Loading history...</p>}
        {error && <p className="form-error">{error}</p>}
        {!loading && !error && summaries.length === 0 && (
          <p className="muted">No computed summaries yet.</p>
        )}

        {summaries.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Regular Hours</th>
                  <th>Overtime Hours</th>
                  <th>Night Diff Hours</th>
                  <th>Late Minutes</th>
                  <th>Undertime Minutes</th>
                  <th>First In</th>
                  <th>Last Out</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => (
                  <tr key={summary.id}>
                    <td>{summary.date}</td>
                    <td>{summary.regularHours ?? 0}</td>
                    <td>{summary.overtimeHours ?? 0}</td>
                    <td>{summary.nightDiffHours ?? 0}</td>
                    <td>{summary.lateMinutes ?? 0}</td>
                    <td>{summary.undertimeMinutes ?? 0}</td>
                    <td>{formatAppTime(summary.firstIn)}</td>
                    <td>{formatAppTime(summary.lastOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
