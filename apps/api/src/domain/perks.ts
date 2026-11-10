import { formatCents, PerkPeriodName } from "@swipewise/shared";
import { subtractDaysFromCalendarDate } from "./dates/user-date.js";
import { resolvePerkPeriodWindow } from "./dates/perk-period.js";
import { GeneratedReminderCandidate, ReminderGenerator } from "./reminders.js";

export { resolvePerkPeriodWindow };

export interface PerkUsageLeftResult {
  amountCents: number;
  usedCents: number;
  leftCents: number;
  isUsed: boolean;
}

export function calculatePerkUsageLeft(
  amountCents: number,
  usedCents: number,
): PerkUsageLeftResult {
  if (usedCents > amountCents) {
    throw new Error("Usage cannot exceed perk amount");
  }
  const safeUsed = Math.max(0, usedCents);
  const leftCents = Math.max(0, amountCents - safeUsed);
  return {
    amountCents,
    usedCents: safeUsed,
    leftCents,
    isUsed: leftCents === 0,
  };
}

export function buildPerkEndingDedupeKey(
  walletCardId: string,
  perkId: string,
  periodKey: string,
): string {
  return `PERK_ENDING:${walletCardId}:${perkId}:${periodKey}`;
}

export interface PerkReminderCardInput {
  walletCardId: string;
  userId: string;
  cardDisplayName: string;
  perkId: string;
  perkName: string;
  amountCents: number;
  period: PerkPeriodName;
  periodKey: string;
  endDate: string;
  usedCents: number;
}

export interface GeneratePerkEndingRemindersInput {
  userId: string;
  localDate: string;
  cards: ReadonlyArray<PerkReminderCardInput>;
}

export function generatePerkEndingRemindersForCards({
  userId,
  localDate,
  cards,
}: GeneratePerkEndingRemindersInput): GeneratedReminderCandidate[] {
  const candidates: GeneratedReminderCandidate[] = [];

  for (const card of cards) {
    if (card.usedCents >= card.amountCents) {
      continue;
    }

    if (localDate > card.endDate) {
      continue;
    }

    const reminderDate5 = subtractDaysFromCalendarDate(card.endDate, 5);

    if (localDate >= reminderDate5 && localDate <= card.endDate) {
      const leftCents = card.amountCents - card.usedCents;
      const formattedLeft = formatCents(leftCents);
      const title = `${card.perkName} ends in 5 days`;
      const body = `${card.cardDisplayName} ${formattedLeft} ${card.perkName.toLowerCase()} resets soon.`;

      candidates.push({
        userId,
        type: "PERK_ENDING",
        title,
        body,
        dueDate: card.endDate,
        dedupeKey: buildPerkEndingDedupeKey(
          card.walletCardId,
          card.perkId,
          card.periodKey,
        ),
      });
    }
  }

  return candidates;
}

export function createPerkEndingReminderGenerator(
  loadCardsForUser: (
    userId: string,
  ) =>
    | Promise<ReadonlyArray<PerkReminderCardInput>>
    | ReadonlyArray<PerkReminderCardInput>,
): ReminderGenerator {
  return async ({ user, localDate }) => {
    const cards = await loadCardsForUser(user.id);
    return generatePerkEndingRemindersForCards({
      userId: user.id,
      localDate,
      cards,
    });
  };
}
