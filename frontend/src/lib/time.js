export const APP_TIMEZONE = "Asia/Manila";

const MANILA_OFFSET_HOURS = 8;

function getDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function getAppDate(value = new Date()) {
  const dateParts = getDateParts(value);
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

export function timestampToDate(value) {
  return value?.toDate ? value.toDate() : value ? new Date(value) : null;
}

export function formatAppTime(value) {
  const date = timestampToDate(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatAppDateTime(value) {
  const date = timestampToDate(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatAppDateTimeInput(value) {
  const date = timestampToDate(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}:${lookup.minute}`;
}

export function parseAppDateTimeInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match.map(Number);
  const dateIsValid =
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59;

  if (!dateIsValid) {
    return null;
  }

  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, hour - MANILA_OFFSET_HOURS, minute, 0, 0));
}

export function getWeekStart(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || "")) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - dayOfWeek + 1);
  return date.toISOString().slice(0, 10);
}
