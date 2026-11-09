import { z } from "zod";
import { noCardNumberRefinement } from "./auth.js";

export const REMINDER_TYPES = [
  "PAYMENT_DUE",
  "PERK_ENDING",
  "ROTATING_CATEGORY",
  "POINTS_EXPIRY",
] as const;

export const reminderTypeSchema = z.enum(REMINDER_TYPES);
export type ReminderTypeName = z.infer<typeof reminderTypeSchema>;

export const notificationItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: reminderTypeSchema,
  title: z
    .string()
    .trim()
    .min(1)
    .refine(
      noCardNumberRefinement,
      "Don't enter card numbers. SwipeWise only needs the card name.",
    ),
  body: z
    .string()
    .trim()
    .min(1)
    .refine(
      noCardNumberRefinement,
      "Don't enter card numbers. SwipeWise only needs the card name.",
    ),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD."),
  dedupeKey: z.string().min(1),
  dismissedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type NotificationItem = z.infer<typeof notificationItemSchema>;

export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationItemSchema),
});

export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

export const notificationPreferenceItemSchema = z.object({
  type: reminderTypeSchema,
  enabled: z.boolean(),
});

export type NotificationPreferenceItem = z.infer<
  typeof notificationPreferenceItemSchema
>;

export const notificationPreferencesResponseSchema = z.object({
  preferences: z.array(notificationPreferenceItemSchema),
});

export type NotificationPreferencesResponse = z.infer<
  typeof notificationPreferencesResponseSchema
>;

export const singleNotificationPreferenceUpdateSchema =
  notificationPreferenceItemSchema;

export const bulkNotificationPreferencesUpdateSchema = z.object({
  preferences: z.array(notificationPreferenceItemSchema).min(1),
});

export const updateNotificationPreferencesRequestSchema = z.union([
  singleNotificationPreferenceUpdateSchema,
  bulkNotificationPreferencesUpdateSchema,
]);

export type UpdateNotificationPreferencesRequest = z.infer<
  typeof updateNotificationPreferencesRequestSchema
>;
