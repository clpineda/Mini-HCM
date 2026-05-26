import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { AppHeader } from "../components/AppHeader.jsx";
import { db } from "../lib/firebase.js";
import {
  formatAppDateTime,
  formatAppDateTimeInput,
  formatAppTime,
  getAppDate,
  getWeekStart,
  parseAppDateTimeInput
} from "../lib/time.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function toNumber(value) {
  return Number(value || 0);
}

export function AdminPage() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [punchDrafts, setPunchDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPunchId, setEditingPunchId] = useState("");
  const [recomputingKey, setRecomputingKey] = useState("");

  useEffect(() => {
    async function loadAdminData() {
      if (!db) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [usersSnapshot, attendanceSnapshot, summariesSnapshot] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "attendance")),
          getDocs(collection(db, "dailySummary"))
        ]);

        setUsers(
          usersSnapshot.docs
            .map((userDoc) => ({
              id: userDoc.id,
              ...userDoc.data()
            }))
            .sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)))
        );

        setAttendance(
          attendanceSnapshot.docs
            .map((attendanceDoc) => ({
              id: attendanceDoc.id,
              ...attendanceDoc.data()
            }))
            .sort((a, b) => {
              const first = b.timestamp?.toMillis?.() || 0;
              const second = a.timestamp?.toMillis?.() || 0;
              return first - second;
            })
        );

        setPunchDrafts(
          attendanceSnapshot.docs.reduce((drafts, attendanceDoc) => {
            const punch = attendanceDoc.data();
            drafts[attendanceDoc.id] = {
              type: punch.type || "IN",
              timestamp: formatAppDateTimeInput(punch.timestamp)
            };
            return drafts;
          }, {})
        );

        setSummaries(
          summariesSnapshot.docs
            .map((summaryDoc) => ({
              id: summaryDoc.id,
              ...summaryDoc.data()
            }))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        );
      } catch (adminError) {
        setError(adminError.message);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  function updatePunchDraft(punchId, field, value) {
    setPunchDrafts((currentDrafts) => ({
      ...currentDrafts,
      [punchId]: {
        ...currentDrafts[punchId],
        [field]: value
      }
    }));
  }

  async function savePunchEdit(punch) {
    const draft = punchDrafts[punch.id];

    if (!draft?.timestamp || !draft?.type) {
      setError("Punch type and timestamp are required.");
      return;
    }

    const confirmed = window.confirm("Save changes to this attendance punch?");

    if (!confirmed) {
      return;
    }

    setEditingPunchId(punch.id);
    setError("");

    try {
      if (!currentUser) {
        throw new Error("Admin user is not loaded.");
      }

      const timestampDate = parseAppDateTimeInput(draft.timestamp);

      if (!timestampDate || Number.isNaN(timestampDate.getTime())) {
        throw new Error("Punch timestamp is invalid.");
      }

      const nextPunch = {
        type: draft.type,
        timestamp: Timestamp.fromDate(timestampDate),
        date: getAppDate(timestampDate),
        editedBy: currentUser.uid,
        editedAt: serverTimestamp()
      };

      await updateDoc(doc(db, "attendance", punch.id), nextPunch);

      setAttendance((currentAttendance) =>
        currentAttendance
          .map((item) =>
            item.id === punch.id
              ? {
                  ...item,
                  ...nextPunch,
                  editedAt: new Date()
                }
              : item
          )
          .sort((a, b) => {
            const first = b.timestamp?.toMillis?.() || 0;
            const second = a.timestamp?.toMillis?.() || 0;
            return first - second;
          })
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setEditingPunchId("");
    }
  }

  async function recomputeSummary(userId, date) {
    if (!userId || !date) {
      setError("Cannot recompute without userId and date.");
      return;
    }

    const key = `${userId}_${date}`;
    setRecomputingKey(key);
    setError("");

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${apiBaseUrl}/api/attendance/compute`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId, date })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.errors?.join(" ") || "Unable to recompute summary.");
      }

      setSummaries((currentSummaries) => {
        const nextSummary = { id: key, ...data };
        const exists = currentSummaries.some((summary) => summary.id === key);
        const updatedSummaries = exists
          ? currentSummaries.map((summary) => (summary.id === key ? nextSummary : summary))
          : [nextSummary, ...currentSummaries];

        return updatedSummaries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      });
    } catch (recomputeError) {
      setError(recomputeError.message);
    } finally {
      setRecomputingKey("");
    }
  }

  const usersById = useMemo(
    () =>
      users.reduce((lookup, user) => {
        lookup[user.id] = user;
        return lookup;
      }, {}),
    [users]
  );

  const weeklyReports = useMemo(() => {
    const grouped = summaries.reduce((lookup, summary) => {
      const weekStart = getWeekStart(summary.date);

      if (!weekStart) {
        return lookup;
      }

      const key = `${summary.userId}_${weekStart}`;

      if (!lookup[key]) {
        lookup[key] = {
          key,
          userId: summary.userId,
          employee: usersById[summary.userId]?.name || usersById[summary.userId]?.email || summary.userId,
          weekStart,
          regularHours: 0,
          overtimeHours: 0,
          nightDiffHours: 0,
          lateMinutes: 0,
          undertimeMinutes: 0
        };
      }

      lookup[key].regularHours += toNumber(summary.regularHours);
      lookup[key].overtimeHours += toNumber(summary.overtimeHours);
      lookup[key].nightDiffHours += toNumber(summary.nightDiffHours);
      lookup[key].lateMinutes += toNumber(summary.lateMinutes);
      lookup[key].undertimeMinutes += toNumber(summary.undertimeMinutes);

      return lookup;
    }, {});

    return Object.values(grouped)
      .map((report) => ({
        ...report,
        regularHours: Number(report.regularHours.toFixed(2)),
        overtimeHours: Number(report.overtimeHours.toFixed(2)),
        nightDiffHours: Number(report.nightDiffHours.toFixed(2))
      }))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.employee.localeCompare(b.employee));
  }, [summaries, usersById]);

  return (
    <main className="dashboard-shell">
      <AppHeader title="Admin" />

      <section className="admin-stack">
        {loading && <p className="muted">Loading admin data...</p>}
        {error && <p className="form-error">{error}</p>}

        {!loading && (
          <>
            <section className="history-panel">
              <h2>Employee list</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Timezone</th>
                      <th>Schedule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && (
                      <tr>
                        <td className="empty-row" colSpan="5">
                          No employees found.
                        </td>
                      </tr>
                    )}
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.name || "-"}</td>
                        <td>{user.email || "-"}</td>
                        <td>{user.role || "employee"}</td>
                        <td>{user.timezone || "-"}</td>
                        <td>
                          {user.schedule?.start || "09:00"} - {user.schedule?.end || "18:00"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="history-panel">
              <h2>Attendance punches</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Timestamp</th>
                      <th>Edited By</th>
                      <th>Edited At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length === 0 && (
                      <tr>
                        <td className="empty-row" colSpan="7">
                          No attendance punches found.
                        </td>
                      </tr>
                    )}
                    {attendance.map((punch) => {
                      const draft = punchDrafts[punch.id] || {
                        type: punch.type || "IN",
                        timestamp: formatAppDateTimeInput(punch.timestamp)
                      };
                      const recomputeKey = `${punch.userId}_${punch.date}`;

                      return (
                        <tr key={punch.id}>
                          <td>{punch.date || "-"}</td>
                          <td>
                            {usersById[punch.userId]?.name || usersById[punch.userId]?.email || punch.userId}
                          </td>
                          <td>
                            <select
                              className="table-input"
                              onChange={(event) =>
                                updatePunchDraft(punch.id, "type", event.target.value)
                              }
                              value={draft.type}
                            >
                              <option value="IN">IN</option>
                              <option value="OUT">OUT</option>
                            </select>
                          </td>
                          <td>
                            <input
                              className="table-input"
                              onChange={(event) =>
                                updatePunchDraft(punch.id, "timestamp", event.target.value)
                              }
                              type="datetime-local"
                              value={draft.timestamp}
                            />
                          </td>
                          <td>{punch.editedBy || "-"}</td>
                          <td>{formatAppDateTime(punch.editedAt)}</td>
                          <td>
                            <div className="table-actions">
                              <button
                                disabled={editingPunchId === punch.id}
                                onClick={() => savePunchEdit(punch)}
                                type="button"
                              >
                                {editingPunchId === punch.id ? "Saving..." : "Save"}
                              </button>
                              <button
                                disabled={recomputingKey === recomputeKey}
                                onClick={() => recomputeSummary(punch.userId, punch.date)}
                                type="button"
                              >
                                {recomputingKey === recomputeKey ? "Recomputing..." : "Recompute Summary"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="history-panel">
              <h2>Daily report</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
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
                    {summaries.length === 0 && (
                      <tr>
                        <td className="empty-row" colSpan="9">
                          No daily summaries found.
                        </td>
                      </tr>
                    )}
                    {summaries.map((summary) => (
                      <tr key={summary.id}>
                        <td>{summary.date}</td>
                        <td>
                          {usersById[summary.userId]?.name ||
                            usersById[summary.userId]?.email ||
                            summary.userId}
                        </td>
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
            </section>

            <section className="history-panel">
              <h2>Weekly report</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Week Start</th>
                      <th>Employee</th>
                      <th>Regular Hours</th>
                      <th>Overtime Hours</th>
                      <th>Night Diff Hours</th>
                      <th>Late Minutes</th>
                      <th>Undertime Minutes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyReports.length === 0 && (
                      <tr>
                        <td className="empty-row" colSpan="7">
                          No weekly reports found.
                        </td>
                      </tr>
                    )}
                    {weeklyReports.map((report) => (
                      <tr key={report.key}>
                        <td>{report.weekStart}</td>
                        <td>{report.employee}</td>
                        <td>{report.regularHours}</td>
                        <td>{report.overtimeHours}</td>
                        <td>{report.nightDiffHours}</td>
                        <td>{report.lateMinutes}</td>
                        <td>{report.undertimeMinutes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
