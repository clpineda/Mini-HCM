import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where
} from "firebase/firestore";
import { useAuth } from "../auth/AuthContext.jsx";
import { AppHeader } from "../components/AppHeader.jsx";
import { db } from "../lib/firebase.js";
import { APP_TIMEZONE, formatAppTime, getAppDate } from "../lib/time.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function getPunchState(punches) {
  const hasIn = punches.some((punch) => punch.type === "IN");
  const hasOut = punches.some((punch) => punch.type === "OUT");

  if (!hasIn) {
    return "needs-in";
  }

  if (!hasOut) {
    return "needs-out";
  }

  return "completed";
}

export function DashboardPage() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [punches, setPunches] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [punching, setPunching] = useState(false);
  const [health, setHealth] = useState({
    loading: true,
    data: null,
    error: null
  });
  const today = getAppDate();
  const punchState = getPunchState(punches);
  const inPunch = punches.find((punch) => punch.type === "IN");
  const outPunch = punches.find((punch) => punch.type === "OUT");

  useEffect(() => {
    async function loadHealth() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/health`);

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const data = await response.json();
        setHealth({ loading: false, data, error: null });
      } catch (error) {
        setHealth({ loading: false, data: null, error: error.message });
      }
    }

    loadHealth();
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      if (!currentUser || !db) {
        return;
      }

      setAttendanceLoading(true);
      setAttendanceError("");

      try {
        const [profileSnapshot, attendanceSnapshot, summarySnapshot] = await Promise.all([
          getDoc(doc(db, "users", currentUser.uid)),
          getDocs(
            query(
              collection(db, "attendance"),
              where("userId", "==", currentUser.uid),
              where("date", "==", today)
            )
          ),
          getDoc(doc(db, "dailySummary", `${currentUser.uid}_${today}`))
        ]);

        setProfile(profileSnapshot.exists() ? profileSnapshot.data() : null);
        setDailySummary(summarySnapshot.exists() ? summarySnapshot.data() : null);
        setPunches(
          attendanceSnapshot.docs
            .map((attendanceDoc) => ({
              id: attendanceDoc.id,
              ...attendanceDoc.data()
            }))
            .sort((a, b) => {
              const first = a.timestamp?.toMillis?.() || 0;
              const second = b.timestamp?.toMillis?.() || 0;
              return first - second;
            })
        );
      } catch (error) {
        setAttendanceError(error.message);
      } finally {
        setAttendanceLoading(false);
      }
    }

    loadDashboardData();
  }, [currentUser, today]);

  async function computeDailySummary() {
    if (!currentUser) {
      return null;
    }

    setSummaryLoading(true);
    setSummaryError("");

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${apiBaseUrl}/api/attendance/compute`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          date: today
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.errors?.join(" ") || "Unable to compute summary.");
      }

      setDailySummary(data);
      return data;
    } catch (error) {
      setSummaryError(error.message);
      return null;
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handlePunch(type) {
    if (!currentUser || !db) {
      return;
    }

    setPunching(true);
    setAttendanceError("");

    try {
      const now = new Date();
      const attendanceDate = getAppDate(now);
      const newPunch = {
        userId: currentUser.uid,
        type,
        timestamp: Timestamp.fromDate(now),
        date: attendanceDate,
        createdAt: serverTimestamp()
      };

      const attendanceRef = await addDoc(collection(db, "attendance"), newPunch);

      setDailySummary(null);
      setPunches((currentPunches) =>
        [...currentPunches, { id: attendanceRef.id, ...newPunch }]
          .filter((punch) => punch.date === today)
          .sort((a, b) => {
            const first = a.timestamp?.toMillis?.() || 0;
            const second = b.timestamp?.toMillis?.() || 0;
            return first - second;
          })
      );

      if (type === "OUT") {
        await computeDailySummary();
      }
    } catch (error) {
      setAttendanceError(error.message);
    } finally {
      setPunching(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <AppHeader title="Dashboard" />

      <section className="dashboard-grid">
        <div className="status-panel">
          <h2>Employee</h2>
          <dl className="profile-list">
            <div>
              <dt>Name</dt>
              <dd>{profile?.name || currentUser?.displayName || "Not set"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{profile?.email || currentUser?.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{profile?.role || "employee"}</dd>
            </div>
            <div>
              <dt>Schedule</dt>
              <dd>
                {profile?.schedule?.start || "09:00"} - {profile?.schedule?.end || "18:00"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="status-panel">
          <h2>Today</h2>
          <p className="date-line">{today} - {APP_TIMEZONE}</p>

          {attendanceLoading && <p className="muted">Loading attendance...</p>}
          {attendanceError && <p className="form-error">{attendanceError}</p>}

          {!attendanceLoading && !attendanceError && (
            <>
              <div className="punch-status">
                <span className={`status-dot ${punchState}`} />
                {punchState === "needs-in" && <strong>Ready to punch in</strong>}
                {punchState === "needs-out" && <strong>Punched in</strong>}
                {punchState === "completed" && <strong>Completed for today</strong>}
              </div>

              <div className="punch-times">
                <div>
                  <span className="label">In</span>
                  <strong>{inPunch ? formatAppTime(inPunch.timestamp) : "-"}</strong>
                </div>
                <div>
                  <span className="label">Out</span>
                  <strong>{outPunch ? formatAppTime(outPunch.timestamp) : "-"}</strong>
                </div>
              </div>

              <div className="punch-actions">
                <button
                  disabled={punching || punchState !== "needs-in"}
                  onClick={() => handlePunch("IN")}
                  type="button"
                >
                  {punching && punchState === "needs-in" ? "Saving..." : "Punch In"}
                </button>
                <button
                  disabled={punching || summaryLoading || punchState !== "needs-out"}
                  onClick={() => handlePunch("OUT")}
                  type="button"
                >
                  {punching && punchState === "needs-out" ? "Saving..." : "Punch Out"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="status-panel summary-panel">
          <h2>Daily summary</h2>
          {attendanceLoading && <p className="muted">Loading summary...</p>}
          {summaryLoading && <p className="muted">Computing summary...</p>}
          {summaryError && <p className="form-error">{summaryError}</p>}
          {!attendanceLoading && !summaryLoading && !summaryError && !dailySummary && (
            <p className="muted">Punch out to compute today's summary.</p>
          )}

          {dailySummary && (
            <>
              <div className="kpi-grid">
                <div className="kpi-card">
                  <span>Regular Hours</span>
                  <strong>{dailySummary.regularHours ?? 0}</strong>
                </div>
                <div className="kpi-card">
                  <span>Overtime Hours</span>
                  <strong>{dailySummary.overtimeHours ?? 0}</strong>
                </div>
                <div className="kpi-card">
                  <span>Night Differential Hours</span>
                  <strong>{dailySummary.nightDiffHours ?? 0}</strong>
                </div>
                <div className="kpi-card">
                  <span>Late Minutes</span>
                  <strong>{dailySummary.lateMinutes ?? 0}</strong>
                </div>
                <div className="kpi-card">
                  <span>Undertime Minutes</span>
                  <strong>{dailySummary.undertimeMinutes ?? 0}</strong>
                </div>
              </div>

              <dl className="summary-list">
                <div>
                  <dt>First In</dt>
                  <dd>{formatAppTime(dailySummary.firstIn)}</dd>
                </div>
                <div>
                  <dt>Last Out</dt>
                  <dd>{formatAppTime(dailySummary.lastOut)}</dd>
                </div>
                <div>
                  <dt>Schedule</dt>
                  <dd>
                    {dailySummary.schedule?.start || profile?.schedule?.start || "09:00"} -{" "}
                    {dailySummary.schedule?.end || profile?.schedule?.end || "18:00"}
                  </dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{dailySummary.date || today}</dd>
                </div>
              </dl>
            </>
          )}
        </div>

        <div className="status-panel">
          <h2>Backend health</h2>
          <div className="health-card">
            <span className="label">Status</span>
            {health.loading && <strong className="muted">Checking...</strong>}
            {health.error && <strong className="error">{health.error}</strong>}
            {health.data && <strong className="success">{health.data.status}</strong>}
          </div>
        </div>
      </section>
    </main>
  );
}
