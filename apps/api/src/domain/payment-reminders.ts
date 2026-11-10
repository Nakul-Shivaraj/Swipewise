import {
  clampDayToMonth,
  formatCalendarDate,
  getCurrentAndNextCycleYearMonths,
  subtractDaysFromCalendarDate,
} from "./dates/user-date.js";
import { GeneratedReminderCandidate, ReminderGenerator } from "./reminders.js";

export type PaymentReminderOffset = 5 | 1 | 3;

export interface PaymentReminderCardInput {
  walletCardId: string;
  userId: string;
  cardDisplayName: string;
  dueDay: number;
  isAutopay: boolean;
  paidCycles: ReadonlyArray<string>;
}

export interface GeneratePaymentDueRemindersInput {
  userId: string;
  localDate: string;
  cards: ReadonlyArray<PaymentReminderCardInput>;
}

export function resolveDueDateForCycle(
  cycleYearMonth: string,
  dueDay: number,
): string {
  const parts = cycleYearMonth.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const clampedDay = clampDayToMonth(year, month, dueDay);
  return formatCalendarDate(year, month, clampedDay);
}

export function buildPaymentDueDedupeKey(
  walletCardId: string,
  cycleYearMonth: string,
  offset: PaymentReminderOffset,
): string {
  return `PAYMENT_DUE:${walletCardId}:${cycleYearMonth}:${offset}`;
}

export function generatePaymentDueRemindersForCards({
  userId,
  localDate,
  cards,
}: GeneratePaymentDueRemindersInput): GeneratedReminderCandidate[] {
  const candidateCycles = getCurrentAndNextCycleYearMonths(localDate);
  const candidates: GeneratedReminderCandidate[] = [];

  for (const card of cards) {
    if (card.dueDay < 1 || card.dueDay > 31) {
      continue;
    }

    const paidCycleSet = new Set(card.paidCycles);

    for (const cycleYearMonth of candidateCycles) {
      if (paidCycleSet.has(cycleYearMonth)) {
        continue;
      }

      const dueDate = resolveDueDateForCycle(cycleYearMonth, card.dueDay);

      // Reminders are only created before the due date
      if (localDate >= dueDate) {
        continue;
      }

      if (card.isAutopay) {
        const reminderDate3 = subtractDaysFromCalendarDate(dueDate, 3);
        if (localDate >= reminderDate3 && localDate < dueDate) {
          candidates.push({
            userId,
            type: "PAYMENT_DUE",
            title: "Payment due in 3 days (autopay on)",
            body: `${card.cardDisplayName} autopay is scheduled for ${dueDate}.`,
            dueDate,
            dedupeKey: buildPaymentDueDedupeKey(
              card.walletCardId,
              cycleYearMonth,
              3,
            ),
          });
        }
      } else {
        const reminderDate5 = subtractDaysFromCalendarDate(dueDate, 5);
        const reminderDate1 = subtractDaysFromCalendarDate(dueDate, 1);

        if (localDate >= reminderDate1 && localDate < dueDate) {
          candidates.push({
            userId,
            type: "PAYMENT_DUE",
            title: "Payment due in 1 day",
            body: `${card.cardDisplayName} payment is due on ${dueDate}.`,
            dueDate,
            dedupeKey: buildPaymentDueDedupeKey(
              card.walletCardId,
              cycleYearMonth,
              1,
            ),
          });
        } else if (localDate >= reminderDate5 && localDate < reminderDate1) {
          candidates.push({
            userId,
            type: "PAYMENT_DUE",
            title: "Payment due in 5 days",
            body: `${card.cardDisplayName} payment is due on ${dueDate}.`,
            dueDate,
            dedupeKey: buildPaymentDueDedupeKey(
              card.walletCardId,
              cycleYearMonth,
              5,
            ),
          });
        }
      }
    }
  }

  return candidates;
}

export function createPaymentDueReminderGenerator(
  loadCardsForUser: (
    userId: string,
  ) =>
    | Promise<ReadonlyArray<PaymentReminderCardInput>>
    | ReadonlyArray<PaymentReminderCardInput>,
): ReminderGenerator {
  return async ({ user, localDate }) => {
    const cards = await loadCardsForUser(user.id);
    return generatePaymentDueRemindersForCards({
      userId: user.id,
      localDate,
      cards,
    });
  };
}
