import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { attendanceRouter } from "./routes/attendance.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173"
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "mini-hcm-time-tracking-api"
  });
});

app.use("/api/attendance", attendanceRouter);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
