import express from "express";
import { FieldValue } from "firebase-admin/firestore";
import { computeAttendanceSummary, isValidDateString } from "../lib/attendanceSummary.js";
import { getAdminAuth, getAdminFirestore } from "../lib/firebaseAdmin.js";

export const attendanceRouter = express.Router();

function validateComputeRequest(body) {
  const errors = [];

  if (!body?.userId || typeof body.userId !== "string") {
    errors.push("userId is required.");
  }

  if (!body?.date || typeof body.date !== "string" || !isValidDateString(body.date)) {
    errors.push("date is required in YYYY-MM-DD format.");
  }

  return errors;
}

function getBearerToken(req) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

attendanceRouter.post("/compute", async (req, res) => {
  const validationErrors = validateComputeRequest(req.body);

  if (validationErrors.length > 0) {
    return res.status(400).json({ errors: validationErrors });
  }

  const db = getAdminFirestore();
  const auth = getAdminAuth();

  if (!db || !auth) {
    return res.status(500).json({
      error: "Firebase Admin SDK is not configured."
    });
  }

  const { userId, date } = req.body;

  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: "Authentication token is required."
      });
    }

    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (_error) {
      return res.status(401).json({
        error: "Authentication token is invalid or expired."
      });
    }

    const requesterSnapshot = await db.collection("users").doc(decodedToken.uid).get();
    const requesterRole = requesterSnapshot.data()?.role || "employee";

    if (decodedToken.uid !== userId && requesterRole !== "admin") {
      return res.status(403).json({
        error: "You do not have permission to compute this summary."
      });
    }

    const userSnapshot = await db.collection("users").doc(userId).get();

    if (!userSnapshot.exists) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    const attendanceSnapshot = await db
      .collection("attendance")
      .where("userId", "==", userId)
      .where("date", "==", date)
      .get();

    const punches = attendanceSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    const summary = computeAttendanceSummary({
      userId,
      date,
      user: userSnapshot.data(),
      punches
    });

    const summaryId = `${userId}_${date}`;
    const summaryToSave = {
      ...summary,
      computedAt: FieldValue.serverTimestamp()
    };

    await db.collection("dailySummary").doc(summaryId).set(summaryToSave);

    return res.json(summary);
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
});
