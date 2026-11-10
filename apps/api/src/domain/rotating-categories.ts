import {
  getCurrentAndNextQuarters,
  getQuarterStartDate,
  subtractDaysFromCalendarDate,
} from "./dates/user-date.js";
import { GeneratedReminderCandidate, ReminderGenerator } from "./reminders.js";

export interface RotatingReminderCardInput {
  walletCardId: string;
  userId: string;
  cardDisplayName: string;
  rotatingQuarters: ReadonlyArray<string>;
  activatedQuarters: ReadonlyArray<string>;
}

export interface GenerateRotatingCategoryRemindersInput {
  userId: string;
  localDate: string;
  cards: ReadonlyArray<RotatingReminderCardInput>;
}

export function buildRotatingCategoryDedupeKey(
  walletCardId: string,
  nextQuarter: string,
): string {
  return `ROTATING_CATEGORY:${walletCardId}:${nextQuarter}`;
}

export function generateRotatingCategoryRemindersForCards({
  userId,
  localDate,
  cards,
}: GenerateRotatingCategoryRemindersInput): GeneratedReminderCandidate[] {
  const [, nextQuarter] = getCurrentAndNextQuarters(localDate);
  const nextQuarterStartDate = getQuarterStartDate(nextQuarter);
  const reminderStartDate = subtractDaysFromCalendarDate(
    nextQuarterStartDate,
    7,
  );

  if (localDate < reminderStartDate || localDate >= nextQuarterStartDate) {
    return [];
  }

  const candidates: GeneratedReminderCandidate[] = [];

  for (const card of cards) {
    if (!card.rotatingQuarters.includes(nextQuarter)) {
      continue;
    }

    if (card.activatedQuarters.includes(nextQuarter)) {
      continue;
    }

    candidates.push({
      userId,
      type: "ROTATING_CATEGORY",
      title: `Activate ${nextQuarter} bonus categories`,
      body: `Activate ${card.cardDisplayName} for ${nextQuarter} before ${nextQuarterStartDate} to earn bonus rewards.`,
      dueDate: nextQuarterStartDate,
      dedupeKey: buildRotatingCategoryDedupeKey(card.walletCardId, nextQuarter),
    });
  }

  return candidates;
}

export function createRotatingCategoryReminderGenerator(
  loadCardsForUser: (
    userId: string,
  ) =>
    | Promise<ReadonlyArray<RotatingReminderCardInput>>
    | ReadonlyArray<RotatingReminderCardInput>,
): ReminderGenerator {
  return async ({ user, localDate }) => {
    const cards = await loadCardsForUser(user.id);
    return generateRotatingCategoryRemindersForCards({
      userId: user.id,
      localDate,
      cards,
    });
  };
}
