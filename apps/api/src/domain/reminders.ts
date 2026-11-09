import {
  NotificationPreferenceItem,
  REMINDER_TYPES,
  ReminderTypeName,
} from "@swipewise/shared";
import { resolveLocalCalendarDate } from "./dates/user-date.js";

export interface ReminderUserContext {
  id: string;
  timeZone: string;
}

export interface ReminderGeneratorInput {
  user: ReminderUserContext;
  now: Date;
  localDate: string;
}

export interface GeneratedReminderCandidate {
  userId: string;
  type: ReminderTypeName;
  title: string;
  body: string;
  dueDate: string;
  dedupeKey: string;
}

export type ReminderGenerator = (
  input: ReminderGeneratorInput,
) => GeneratedReminderCandidate[] | Promise<GeneratedReminderCandidate[]>;

export class ReminderGeneratorRegistry {
  private readonly generators = new Map<ReminderTypeName, ReminderGenerator>();

  register(type: ReminderTypeName, generator: ReminderGenerator): void {
    this.generators.set(type, generator);
  }

  unregister(type: ReminderTypeName): void {
    this.generators.delete(type);
  }

  get(type: ReminderTypeName): ReminderGenerator | undefined {
    return this.generators.get(type);
  }

  getAll(): ReadonlyMap<ReminderTypeName, ReminderGenerator> {
    return this.generators;
  }
}

export function createReminderGeneratorRegistry(): ReminderGeneratorRegistry {
  return new ReminderGeneratorRegistry();
}

export interface TestReminderGeneratorOptions {
  type?: ReminderTypeName;
  title?: string;
  body?: string;
  dueDate?: string;
}

export function createTestReminderGenerator(
  options: TestReminderGeneratorOptions = {},
): ReminderGenerator {
  const type = options.type ?? "PAYMENT_DUE";
  const title = options.title ?? "Payment due in 5 days";
  const body = options.body ?? "Mint Everyday payment is due soon.";

  return ({ user, localDate }) => {
    const dueDate = options.dueDate ?? localDate;
    return [
      {
        userId: user.id,
        type,
        title,
        body,
        dueDate,
        dedupeKey: `${type}:${user.id}:${dueDate}`,
      },
    ];
  };
}

export function isReminderTypeEnabled(
  savedPreferences: ReadonlyArray<NotificationPreferenceItem>,
  type: ReminderTypeName,
): boolean {
  const found = savedPreferences.find((pref) => pref.type === type);
  return found ? found.enabled : true;
}

export function resolveUserPreferences(
  savedPreferences: ReadonlyArray<NotificationPreferenceItem>,
): NotificationPreferenceItem[] {
  return REMINDER_TYPES.map((type) => ({
    type,
    enabled: isReminderTypeEnabled(savedPreferences, type),
  }));
}

export interface RunGeneratorsForUserInput {
  user: ReminderUserContext;
  savedPreferences: ReadonlyArray<NotificationPreferenceItem>;
  registry: ReminderGeneratorRegistry;
  now: Date;
}

export async function generateRemindersForUser({
  user,
  savedPreferences,
  registry,
  now,
}: RunGeneratorsForUserInput): Promise<GeneratedReminderCandidate[]> {
  const localDate = resolveLocalCalendarDate({
    now,
    timeZone: user.timeZone,
  });

  const allCandidates: GeneratedReminderCandidate[] = [];

  for (const [type, generator] of registry.getAll().entries()) {
    if (!isReminderTypeEnabled(savedPreferences, type)) {
      continue;
    }

    const generated = await generator({
      user,
      now,
      localDate,
    });
    allCandidates.push(...generated);
  }

  return filterNewReminderCandidates(allCandidates, new Set());
}

export function filterNewReminderCandidates(
  candidates: ReadonlyArray<GeneratedReminderCandidate>,
  existingDedupeKeys: ReadonlySet<string>,
): GeneratedReminderCandidate[] {
  const seen = new Set<string>(existingDedupeKeys);
  const result: GeneratedReminderCandidate[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.dedupeKey)) {
      continue;
    }
    seen.add(candidate.dedupeKey);
    result.push(candidate);
  }

  return result;
}
