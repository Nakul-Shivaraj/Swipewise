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

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  const daysPerMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return daysPerMonth[month - 1] ?? 30;
}

export function clampDayToMonth(
  year: number,
  month: number,
  dueDay: number,
): number {
  const maxDay = getDaysInMonth(year, month);
  return Math.min(Math.max(1, dueDay), maxDay);
}

export function formatCalendarDate(
  year: number,
  month: number,
  day: number,
): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function subtractDaysFromCalendarDate(
  dateStr: string,
  offsetDays: number,
): string {
  const parts = dateStr.split("-").map(Number);
  let year = parts[0] ?? 1970;
  let month = parts[1] ?? 1;
  let day = (parts[2] ?? 1) - offsetDays;

  while (day < 1) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    day += getDaysInMonth(year, month);
  }

  return formatCalendarDate(year, month, day);
}

export function getCurrentAndNextCycleYearMonths(
  localDate: string,
): [string, string] {
  const parts = localDate.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;

  const currentCycle = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextCycle = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}`;

  return [currentCycle, nextCycle];
}
