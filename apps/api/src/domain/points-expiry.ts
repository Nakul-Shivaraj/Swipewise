import { formatCents } from "@swipewise/shared";
import { subtractDaysFromCalendarDate } from "./dates/user-date.js";
import { GeneratedReminderCandidate, ReminderGenerator } from "./reminders.js";

export type PointsExpiryReminderOffset = 30 | 7;

export interface PointsBalanceReminderInput {
  balanceId: string;
  userId: string;
  programId: string;
  programName: string;
  centsPer100Points: number;
  pointsBalance: number;
  expiryDate: string;
}

export interface GeneratePointsExpiryRemindersInput {
  userId: string;
  localDate: string;
  balances: ReadonlyArray<PointsBalanceReminderInput>;
}

/**
 * Pure points value calculation per AGENTS.md §6:
 * Dollar value in integer cents = pointsBalance × centsPer100Points / 100,
 * rounded half up once using BigInt integer arithmetic.
 */
export function calculatePointsValueCents(
  pointsBalance: number,
  centsPer100Points: number,
): number {
  if (pointsBalance <= 0) {
    return 0;
  }
  const pointsBig = BigInt(pointsBalance);
  const rateBig = BigInt(centsPer100Points);
  const numerator = pointsBig * rateBig;
  return Number((numerator + 50n) / 100n);
}

export function buildPointsExpiryDedupeKey(
  balanceId: string,
  expiryDate: string,
  offset: PointsExpiryReminderOffset,
): string {
  return `POINTS_EXPIRY:${balanceId}:${expiryDate}:${offset}`;
}

export function generatePointsExpiryRemindersForBalances({
  userId,
  localDate,
  balances,
}: GeneratePointsExpiryRemindersInput): GeneratedReminderCandidate[] {
  const candidates: GeneratedReminderCandidate[] = [];

  for (const balance of balances) {
    if (balance.pointsBalance <= 0) {
      continue;
    }

    // Reminders are only created before the expiry date
    if (localDate >= balance.expiryDate) {
      continue;
    }

    const reminderDate30 = subtractDaysFromCalendarDate(balance.expiryDate, 30);
    const reminderDate7 = subtractDaysFromCalendarDate(balance.expiryDate, 7);
    const valueCents = calculatePointsValueCents(
      balance.pointsBalance,
      balance.centsPer100Points,
    );
    const formattedValue = formatCents(valueCents);
    const formattedPoints = balance.pointsBalance.toLocaleString("en-US");

    if (localDate >= reminderDate7 && localDate < balance.expiryDate) {
      candidates.push({
        userId,
        type: "POINTS_EXPIRY",
        title: "Points expire in 7 days",
        body: `${formattedPoints} ${balance.programName} points (${formattedValue}) expire on ${balance.expiryDate}.`,
        dueDate: balance.expiryDate,
        dedupeKey: buildPointsExpiryDedupeKey(
          balance.balanceId,
          balance.expiryDate,
          7,
        ),
      });
    } else if (localDate >= reminderDate30 && localDate < reminderDate7) {
      candidates.push({
        userId,
        type: "POINTS_EXPIRY",
        title: "Points expire in 30 days",
        body: `${formattedPoints} ${balance.programName} points (${formattedValue}) expire on ${balance.expiryDate}.`,
        dueDate: balance.expiryDate,
        dedupeKey: buildPointsExpiryDedupeKey(
          balance.balanceId,
          balance.expiryDate,
          30,
        ),
      });
    }
  }

  return candidates;
}

export function createPointsExpiryReminderGenerator(
  loadBalancesForUser: (
    userId: string,
  ) =>
    | Promise<ReadonlyArray<PointsBalanceReminderInput>>
    | ReadonlyArray<PointsBalanceReminderInput>,
): ReminderGenerator {
  return async ({ user, localDate }) => {
    const balances = await loadBalancesForUser(user.id);
    return generatePointsExpiryRemindersForBalances({
      userId: user.id,
      localDate,
      balances,
    });
  };
}
