import { Request, Response, NextFunction } from "express";
import { updateNotificationPreferencesRequestSchema } from "@swipewise/shared";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { ReminderGeneratorRegistry } from "../domain/reminders.js";
import {
  NotificationRepository,
  notificationRepo as defaultNotificationRepo,
} from "../repositories/notification.repository.js";
import {
  defaultReminderRegistry,
  NotificationService,
} from "../services/notification.service.js";

function getNotificationService(req: Request): NotificationService {
  const repo =
    (req.app.get("notificationRepo") as NotificationRepository) ||
    defaultNotificationRepo;
  const registry =
    (req.app.get("reminderRegistry") as ReminderGeneratorRegistry) ||
    defaultReminderRegistry;
  const nowProvider =
    (req.app.get("nowProvider") as (() => Date) | undefined) ||
    (() => new Date());
  return new NotificationService(repo, registry, nowProvider);
}

export async function runReminderCronHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const configuredSecret =
      (req.app.get("cronSecret") as string | undefined) ??
      process.env.CRON_SECRET;

    const authHeader = req.headers.authorization;
    const expectedHeader = configuredSecret
      ? `Bearer ${configuredSecret}`
      : null;

    if (!expectedHeader || authHeader !== expectedHeader) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or missing cron secret.",
        },
      });
      return;
    }

    const service = getNotificationService(req);
    const result = await service.runDailyReminderJob();
    res.status(200).json({
      status: "ok",
      createdCount: result.createdCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function getNotificationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const service = getNotificationService(req);
    const notifications = await service.getActiveNotifications(authReq.user.id);
    res.status(200).json({ notifications });
  } catch (err) {
    next(err);
  }
}

export async function dismissNotificationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id || typeof id !== "string") {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Notification ID is required.",
        },
      });
      return;
    }

    const service = getNotificationService(req);
    const result = await service.dismissNotification(authReq.user.id, id);

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.status(200).json({ notification: result.notification });
  } catch (err) {
    next(err);
  }
}

export async function dismissAllNotificationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const service = getNotificationService(req);
    const result = await service.dismissAllNotifications(authReq.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getNotificationPreferencesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const service = getNotificationService(req);
    const preferences = await service.getPreferences(authReq.user.id);
    res.status(200).json({ preferences });
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationPreferencesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const parseResult = updateNotificationPreferencesRequestSchema.safeParse(
      req.body,
    );
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            parseResult.error.issues[0]?.message ||
            "Invalid preference update data.",
        },
      });
      return;
    }

    const service = getNotificationService(req);
    const preferences = await service.updatePreferences(
      authReq.user.id,
      parseResult.data,
    );
    res.status(200).json({ preferences });
  } catch (err) {
    next(err);
  }
}
