import {
  NotificationItem,
  NotificationPreferenceItem,
  UpdateNotificationPreferencesRequest,
} from "@swipewise/shared";
import {
  createReminderGeneratorRegistry,
  filterNewReminderCandidates,
  GeneratedReminderCandidate,
  generateRemindersForUser,
  ReminderGeneratorRegistry,
  resolveUserPreferences,
} from "../domain/reminders.js";
import {
  NotificationRepository,
  notificationRepo as defaultNotificationRepo,
} from "../repositories/notification.repository.js";
import { walletRepo as defaultWalletRepo } from "../repositories/wallet.repository.js";
import { createPaymentDueReminderGenerator } from "../domain/payment-reminders.js";

export const defaultReminderRegistry = createReminderGeneratorRegistry();
defaultReminderRegistry.register(
  "PAYMENT_DUE",
  createPaymentDueReminderGenerator((userId) =>
    defaultWalletRepo.findPaymentReminderCardsByUserId(userId),
  ),
);

export class NotificationService {
  private repo: NotificationRepository;
  private registry: ReminderGeneratorRegistry;
  private nowProvider: () => Date;

  constructor(
    repoInstance: NotificationRepository = defaultNotificationRepo,
    registryInstance: ReminderGeneratorRegistry = defaultReminderRegistry,
    nowProvider: () => Date = () => new Date(),
  ) {
    this.repo = repoInstance;
    this.registry = registryInstance;
    this.nowProvider = nowProvider;
  }

  async runDailyReminderJob(): Promise<{ createdCount: number }> {
    const now = this.nowProvider();
    const users = await this.repo.findUsersForReminderJob();
    const allCandidates: GeneratedReminderCandidate[] = [];

    for (const user of users) {
      const candidates = await generateRemindersForUser({
        user: {
          id: user.id,
          timeZone: user.timeZone,
        },
        savedPreferences: user.preferences,
        registry: this.registry,
        now,
      });
      allCandidates.push(...candidates);
    }

    const uniqueCandidates = filterNewReminderCandidates(
      allCandidates,
      new Set(),
    );
    const createdCount =
      await this.repo.createNotificationsSkippingDuplicates(uniqueCandidates);

    return { createdCount };
  }

  async getActiveNotifications(userId: string): Promise<NotificationItem[]> {
    return this.repo.findActiveNotificationsByUserId(userId);
  }

  async dismissNotification(
    userId: string,
    notificationId: string,
  ): Promise<
    | { notification: NotificationItem; error?: undefined }
    | {
        notification?: undefined;
        error: { code: "NOT_FOUND"; message: string };
      }
  > {
    const dismissed = await this.repo.dismissNotification(
      notificationId,
      userId,
      this.nowProvider(),
    );

    if (!dismissed) {
      return {
        error: {
          code: "NOT_FOUND",
          message: "Notification not found.",
        },
      };
    }

    return { notification: dismissed };
  }

  async dismissAllNotifications(
    userId: string,
  ): Promise<{ dismissedCount: number }> {
    const dismissedCount = await this.repo.dismissAllNotifications(
      userId,
      this.nowProvider(),
    );
    return { dismissedCount };
  }

  async getPreferences(userId: string): Promise<NotificationPreferenceItem[]> {
    const saved = await this.repo.findPreferencesByUserId(userId);
    return resolveUserPreferences(saved);
  }

  async updatePreferences(
    userId: string,
    input: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferenceItem[]> {
    const updates: NotificationPreferenceItem[] =
      "preferences" in input ? input.preferences : [input];
    const saved = await this.repo.upsertPreferences(userId, updates);
    return resolveUserPreferences(saved);
  }
}
