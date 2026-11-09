export const DEFAULT_USER_TIME_ZONE = "America/Los_Angeles";

export interface ClockContext {
  now: Date;
  timeZone: string;
}

function formatInTimeZone(instant: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(instant);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function resolveLocalCalendarDate({
  now,
  timeZone,
}: ClockContext): string {
  try {
    return formatInTimeZone(now, timeZone || DEFAULT_USER_TIME_ZONE);
  } catch {
    return formatInTimeZone(now, DEFAULT_USER_TIME_ZONE);
  }
}
