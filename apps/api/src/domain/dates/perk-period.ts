import { DateTime } from "luxon";
import { PerkPeriodName } from "@swipewise/shared";

export interface ResolvePerkPeriodWindowInput {
  now: Date;
  timeZone?: string;
  period: PerkPeriodName;
}

export interface PerkPeriodWindow {
  periodKey: string;
  startDate: string;
  endDate: string;
  daysLeft: number;
}

const DEFAULT_TIME_ZONE = "America/Los_Angeles";

function getSafeDateTime(now: Date, timeZone?: string): DateTime {
  const zone = timeZone || DEFAULT_TIME_ZONE;
  let dt = DateTime.fromJSDate(now).setZone(zone);
  if (!dt.isValid) {
    dt = DateTime.fromJSDate(now).setZone(DEFAULT_TIME_ZONE);
  }
  return dt;
}

export function resolvePerkPeriodWindow({
  now,
  timeZone,
  period,
}: ResolvePerkPeriodWindowInput): PerkPeriodWindow {
  const dt = getSafeDateTime(now, timeZone);
  let start: DateTime;
  let end: DateTime;
  let periodKey: string;

  switch (period) {
    case "MONTHLY": {
      start = dt.startOf("month");
      end = dt.endOf("month");
      periodKey = dt.toFormat("yyyy-MM");
      break;
    }
    case "QUARTERLY": {
      start = dt.startOf("quarter");
      end = dt.endOf("quarter");
      periodKey = `${dt.toFormat("yyyy")}-Q${dt.quarter}`;
      break;
    }
    case "SEMIANNUAL": {
      const half = dt.month <= 6 ? 1 : 2;
      if (half === 1) {
        start = dt.set({ month: 1, day: 1 }).startOf("day");
        end = dt.set({ month: 6, day: 30 }).endOf("day");
      } else {
        start = dt.set({ month: 7, day: 1 }).startOf("day");
        end = dt.set({ month: 12, day: 31 }).endOf("day");
      }
      periodKey = `${dt.toFormat("yyyy")}-H${half}`;
      break;
    }
    case "ANNUAL": {
      start = dt.startOf("year");
      end = dt.endOf("year");
      periodKey = dt.toFormat("yyyy");
      break;
    }
  }

  const startDate = start.toFormat("yyyy-MM-dd");
  const endDate = end.toFormat("yyyy-MM-dd");
  const localDate = dt.toFormat("yyyy-MM-dd");

  let daysLeft = 0;
  if (localDate <= endDate) {
    const startOfToday = DateTime.fromISO(localDate, { zone: dt.zone });
    const endDay = DateTime.fromISO(endDate, { zone: dt.zone });
    daysLeft = Math.max(0, Math.round(endDay.diff(startOfToday, "days").days));
  }

  return {
    periodKey,
    startDate,
    endDate,
    daysLeft,
  };
}
