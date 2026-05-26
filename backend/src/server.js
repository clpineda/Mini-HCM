import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { attendanceRouter } from "./routes/attendance.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
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
