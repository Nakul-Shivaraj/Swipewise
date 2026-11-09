import {
  NotificationPreferenceItem,
  ReminderTypeName,
} from "@swipewise/shared";

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
  register(_type: ReminderTypeName, _generator: ReminderGenerator): void {}

  unregister(_type: ReminderTypeName): void {}

  get(_type: ReminderTypeName): ReminderGenerator | undefined {
    return undefined;
  }

  getAll(): ReadonlyMap<ReminderTypeName, ReminderGenerator> {
    return new Map();
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
  _options: TestReminderGeneratorOptions = {},
): ReminderGenerator {
  return () => [];
}

export function isReminderTypeEnabled(
  _savedPreferences: ReadonlyArray<NotificationPreferenceItem>,
  _type: ReminderTypeName,
): boolean {
  return false;
}

export function resolveUserPreferences(
  _savedPreferences: ReadonlyArray<NotificationPreferenceItem>,
): NotificationPreferenceItem[] {
  return [];
}

export interface RunGeneratorsForUserInput {
  user: ReminderUserContext;
  savedPreferences: ReadonlyArray<NotificationPreferenceItem>;
  registry: ReminderGeneratorRegistry;
  now: Date;
}

export async function generateRemindersForUser(
  _input: RunGeneratorsForUserInput,
): Promise<GeneratedReminderCandidate[]> {
  return [];
}

export function filterNewReminderCandidates(
  _candidates: ReadonlyArray<GeneratedReminderCandidate>,
  _existingDedupeKeys: ReadonlySet<string>,
): GeneratedReminderCandidate[] {
  return [];
}
