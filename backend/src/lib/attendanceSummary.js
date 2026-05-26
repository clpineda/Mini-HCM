const DEFAULT_TIMEZONE = "Asia/Manila";
const MANILA_OFFSET_HOURS = 8;
const MINUTES_PER_HOUR = 60;

export function isValidDateString(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

export function isValidTimeString(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return false;
  }

  const [hour, minute] = time.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function timestampToDate(value) {
  if (!value) {
    return null;
  }

  return value.toDate ? value.toDate() : new Date(value);
}

export function buildManilaDateTime(date, time) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, hour - MANILA_OFFSET_HOURS, minute, 0, 0)
  );
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function minutesBetween(start, end) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function overlapMinutes(startA, endA, startB, endB) {
  const start = new Date(Math.max(startA.getTime(), startB.getTime()));
  const end = new Date(Math.min(endA.getTime(), endB.getTime()));
  return minutesBetween(start, end);
}

function minutesToHours(minutes) {
  return Number((minutes / MINUTES_PER_HOUR).toFixed(2));
}

function getShiftWindow(date, schedule) {
  const shiftStart = buildManilaDateTime(date, schedule.start);
  let shiftEnd = buildManilaDateTime(date, schedule.end);

  if (shiftEnd <= shiftStart) {
    shiftEnd = addDays(shiftEnd, 1);
  }

  return { shiftStart, shiftEnd };
}

function getNightDiffMinutes(workStart, workEnd, date) {
  const nightWindows = [
    {
      start: buildManilaDateTime(date, "00:00"),
      end: buildManilaDateTime(date, "06:00")
    },
    {
      start: buildManilaDateTime(date, "22:00"),
      end: addDays(buildManilaDateTime(date, "06:00"), 1)
    }
  ];

  return nightWindows.reduce(
    (total, window) => total + overlapMinutes(workStart, workEnd, window.start, window.end),
    0
  );
}

export function computeAttendanceSummary({ userId, date, user, punches }) {
  const schedule = {
    start: user.schedule?.start || "09:00",
    end: user.schedule?.end || "18:00"
  };

  if (!isValidTimeString(schedule.start) || !isValidTimeString(schedule.end)) {
    throw new Error("User schedule must have start and end in HH:mm format.");
  }

  const sortedPunches = punches
    .map((punch) => ({
      ...punch,
      timestampDate: timestampToDate(punch.timestamp)
    }))
    .filter((punch) => punch.timestampDate)
    .sort((a, b) => a.timestampDate.getTime() - b.timestampDate.getTime());

  const inPunches = sortedPunches.filter((punch) => punch.type === "IN");
  const outPunches = sortedPunches.filter((punch) => punch.type === "OUT");
  const firstIn = inPunches[0]?.timestampDate || null;
  const lastOut = outPunches[outPunches.length - 1]?.timestampDate || null;
  const { shiftStart, shiftEnd } = getShiftWindow(date, schedule);

  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let nightDiffMinutes = 0;
  let lateMinutes = 0;
  let undertimeMinutes = 0;

  if (firstIn) {
    lateMinutes = minutesBetween(shiftStart, firstIn);
  }

  if (lastOut) {
    undertimeMinutes = minutesBetween(lastOut, shiftEnd);
  }

  if (firstIn && lastOut && lastOut > firstIn) {
    regularMinutes = overlapMinutes(firstIn, lastOut, shiftStart, shiftEnd);
    overtimeMinutes = overlapMinutes(firstIn, lastOut, shiftEnd, lastOut);
    nightDiffMinutes = getNightDiffMinutes(firstIn, lastOut, date);
  }

  return {
    userId,
    date,
    timezone: user.timezone || DEFAULT_TIMEZONE,
    schedule,
    regularHours: minutesToHours(regularMinutes),
    overtimeHours: minutesToHours(overtimeMinutes),
    nightDiffHours: minutesToHours(nightDiffMinutes),
    lateMinutes,
    undertimeMinutes,
    firstIn: firstIn ? firstIn.toISOString() : null,
    lastOut: lastOut ? lastOut.toISOString() : null
  };
}
