import { DateTime, IANAZone } from "luxon";

export interface CalculateBonusProgressInput {
  now: Date;
  timeZone?: string;
  openedDate: Date | string | null;
  windowMonths: number;
  requiredSpendCents: number;
  spendEntries: Array<{
    amountCents: number;
    date: Date | string;
    note?: string | null;
  }>;
}

export type BonusTrackerStatus = "In progress" | "Earned" | "Missed";

export interface BonusOfferProgressResult {
  deadline: string | null;
  daysLeft: number | null;
  spentCents: number;
  requiredSpendCents: number;
  remainingCents: number;
  progressPercent: number;
  status: BonusTrackerStatus;
  requiresOpenDate: boolean;
}

const DEFAULT_TIME_ZONE = "America/Los_Angeles";

function getSafeZone(timeZone?: string): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  return IANAZone.isValidZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

function normalizeDateString(date: Date | string, zone: string): string {
  if (typeof date === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
      return date.slice(0, 10);
    }
    const parsed = DateTime.fromISO(date, { zone });
    if (parsed.isValid && parsed.toISODate()) return parsed.toISODate()!;
    return date.slice(0, 10);
  }
  // For @db.Date values from Prisma, the JS Date represents UTC midnight of the calendar date
  return date.toISOString().slice(0, 10);
}

export function calculateBonusProgress(
  input: CalculateBonusProgressInput,
): BonusOfferProgressResult {
  const zone = getSafeZone(input.timeZone);
  const nowDt = DateTime.fromJSDate(input.now).setZone(zone);
  const todayStr = nowDt.toISODate()!;

  // Handle case where wallet card has no open date
  if (!input.openedDate) {
    let rawSpent = 0;
    for (const entry of input.spendEntries) {
      rawSpent += entry.amountCents;
    }
    const remainingCents = Math.max(0, input.requiredSpendCents - rawSpent);
    const progressPercent =
      input.requiredSpendCents > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round((rawSpent / input.requiredSpendCents) * 100),
            ),
          )
        : 100;
    const isEarned = rawSpent >= input.requiredSpendCents;

    return {
      deadline: null,
      daysLeft: null,
      spentCents: rawSpent,
      requiredSpendCents: input.requiredSpendCents,
      remainingCents,
      progressPercent,
      status: isEarned ? "Earned" : "In progress",
      requiresOpenDate: true,
    };
  }

  // Calculate deadline: open date + window in months (Luxon handles month clamping)
  const openDateStr = normalizeDateString(input.openedDate, zone);
  const openDt = DateTime.fromISO(openDateStr, { zone });
  const deadlineDt = openDt.plus({ months: input.windowMonths });
  const deadlineStr = deadlineDt.toISODate()!;

  // Filter qualifying spending entries: spending dated after deadline doesn't count
  let spentCents = 0;
  for (const entry of input.spendEntries) {
    const entryDateStr = normalizeDateString(entry.date, zone);
    if (entryDateStr <= deadlineStr) {
      spentCents += entry.amountCents;
    }
  }

  const remainingCents = Math.max(0, input.requiredSpendCents - spentCents);
  const progressPercent =
    input.requiredSpendCents > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((spentCents / input.requiredSpendCents) * 100),
          ),
        )
      : 100;

  // Days left calculation
  let daysLeft = 0;
  if (todayStr <= deadlineStr) {
    const todayStart = DateTime.fromISO(todayStr, { zone });
    const deadlineDay = DateTime.fromISO(deadlineStr, { zone });
    daysLeft = Math.max(
      0,
      Math.round(deadlineDay.diff(todayStart, "days").days),
    );
  }

  // Determine status: "Earned", "Missed", or "In progress"
  let status: BonusTrackerStatus;
  if (spentCents >= input.requiredSpendCents) {
    status = "Earned";
  } else if (todayStr > deadlineStr) {
    status = "Missed";
  } else {
    status = "In progress";
  }

  return {
    deadline: deadlineStr,
    daysLeft,
    spentCents,
    requiredSpendCents: input.requiredSpendCents,
    remainingCents,
    progressPercent,
    status,
    requiresOpenDate: false,
  };
}
