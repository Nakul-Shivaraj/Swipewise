import { PrismaClient } from "@prisma/client";
import {
  NotificationItem,
  NotificationPreferenceItem,
  ReminderTypeName,
} from "@swipewise/shared";
import { prisma as defaultPrisma } from "../db.js";
import { GeneratedReminderCandidate } from "../domain/reminders.js";

export interface ReminderUserWithPreferences {
  id: string;
  timeZone: string;
  preferences: NotificationPreferenceItem[];
}

export class NotificationRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = defaultPrisma) {
    this.prisma = prisma;
  }

  private mapNotification(row: {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    dueDate: Date;
    dedupeKey: string;
    dismissedAt: Date | null;
    createdAt: Date;
  }): NotificationItem {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type as ReminderTypeName,
      title: row.title,
      body: row.body,
      dueDate: row.dueDate.toISOString().slice(0, 10),
      dedupeKey: row.dedupeKey,
      dismissedAt: row.dismissedAt ? row.dismissedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async findUsersForReminderJob(): Promise<ReminderUserWithPreferences[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        timeZone: true,
        notificationPreferences: {
          select: {
            type: true,
            enabled: true,
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      timeZone: u.timeZone,
      preferences: u.notificationPreferences.map((p) => ({
        type: p.type as ReminderTypeName,
        enabled: p.enabled,
      })),
    }));
  }

  async createNotificationsSkippingDuplicates(
    candidates: GeneratedReminderCandidate[],
  ): Promise<number> {
    if (candidates.length === 0) {
      return 0;
    }

    const result = await this.prisma.notification.createMany({
      data: candidates.map((c) => ({
        userId: c.userId,
        type: c.type,
        title: c.title,
        body: c.body,
        dueDate: new Date(`${c.dueDate}T00:00:00.000Z`),
        dedupeKey: c.dedupeKey,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  async findActiveNotificationsByUserId(
    userId: string,
  ): Promise<NotificationItem[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        dismissedAt: null,
      },
      orderBy: [{ createdAt: "desc" }, { dueDate: "asc" }],
    });

    return rows.map((r) => this.mapNotification(r));
  }

  async dismissNotification(
    id: string,
    userId: string,
    dismissedAt: Date,
  ): Promise<NotificationItem | null> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existing) {
      return null;
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        dismissedAt: existing.dismissedAt ?? dismissedAt,
      },
    });

    return this.mapNotification(updated);
  }

  async dismissAllNotifications(
    userId: string,
    dismissedAt: Date,
  ): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        dismissedAt: null,
      },
      data: {
        dismissedAt,
      },
    });

    return result.count;
  }

  async findPreferencesByUserId(
    userId: string,
  ): Promise<NotificationPreferenceItem[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    return rows.map((r) => ({
      type: r.type as ReminderTypeName,
      enabled: r.enabled,
    }));
  }

  async upsertPreferences(
    userId: string,
    updates: NotificationPreferenceItem[],
  ): Promise<NotificationPreferenceItem[]> {
    for (const upd of updates) {
      await this.prisma.notificationPreference.upsert({
        where: {
          userId_type: {
            userId,
            type: upd.type,
          },
        },
        update: {
          enabled: upd.enabled,
        },
        create: {
          userId,
          type: upd.type,
          enabled: upd.enabled,
        },
      });
    }

    return this.findPreferencesByUserId(userId);
  }
}

export const notificationRepo = new NotificationRepository();
