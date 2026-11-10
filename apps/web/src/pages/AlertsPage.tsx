import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  NotificationItem,
  NotificationPreferenceItem,
  NotificationPreferencesResponse,
  NotificationsResponse,
  ReminderTypeName,
} from "@swipewise/shared";
import {
  Bell,
  BarChart3,
  Check,
  CreditCard,
  Home as HomeIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import { apiFetch } from "../api.js";

interface ReminderOptionMeta {
  type: ReminderTypeName;
  label: string;
  description: string;
}

const REMINDER_OPTION_METADATA: ReminderOptionMeta[] = [
  {
    type: "PAYMENT_DUE",
    label: "Payment due",
    description: "Remind me before a card payment is due",
  },
  {
    type: "PERK_ENDING",
    label: "Perk ending",
    description: "Remind me before a monthly or annual credit resets",
  },
  {
    type: "ROTATING_CATEGORY",
    label: "Rotating category",
    description: "Remind me to activate quarterly bonus categories",
  },
  {
    type: "POINTS_EXPIRY",
    label: "Points expiry",
    description: "Remind me before rewards points expire",
  },
];

const DEFAULT_PREFERENCES: NotificationPreferenceItem[] =
  REMINDER_OPTION_METADATA.map((item) => ({
    type: item.type,
    enabled: true,
  }));

export function AlertsPage() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] =
    useState<NotificationPreferenceItem[]>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingType, setTogglingType] = useState<ReminderTypeName | null>(
    null,
  );
  const [isDismissingAll, setIsDismissingAll] = useState(false);

  const fetchAlertsAndPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [notifRes, prefRes] = await Promise.all([
        fetch("/api/v1/notifications"),
        fetch("/api/v1/notification-preferences"),
      ]);

      if (!notifRes.ok || !prefRes.ok) {
        setError("Something went wrong. Try again.");
        return;
      }

      const notifData = (await notifRes.json()) as NotificationsResponse;
      const prefData =
        (await prefRes.json()) as NotificationPreferencesResponse;

      setNotifications(notifData.notifications || []);
      if (prefData.preferences && prefData.preferences.length > 0) {
        setPreferences(prefData.preferences);
      } else {
        setPreferences(DEFAULT_PREFERENCES);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlertsAndPreferences();
  }, [fetchAlertsAndPreferences]);

  const handleDismiss = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/notifications/${id}/dismiss`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("Something went wrong. Try again.");
        return;
      }
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    } catch {
      setError("Something went wrong. Try again.");
    }
  };

  const handleMarkPaid = async (item: NotificationItem) => {
    const parts = item.dedupeKey.split(":");
    const walletCardId = parts[1];
    const cycleCandidate = parts[2];
    const cycleYearMonth =
      cycleCandidate && /^\d{4}-\d{2}$/.test(cycleCandidate)
        ? cycleCandidate
        : item.dueDate.slice(0, 7);

    if (!walletCardId) {
      await handleDismiss(item.id);
      return;
    }

    try {
      const res = await apiFetch(
        `/api/v1/wallet/cards/${walletCardId}/paid-cycles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycleYearMonth }),
        },
      );
      if (!res.ok) {
        setError("Something went wrong. Try again.");
        return;
      }
      const prefix = `PAYMENT_DUE:${walletCardId}:${cycleYearMonth}:`;
      setNotifications((prev) =>
        prev.filter((n) => n.id !== item.id && !n.dedupeKey.startsWith(prefix)),
      );
    } catch {
      setError("Something went wrong. Try again.");
    }
  };

  const handleDismissAll = async () => {
    setIsDismissingAll(true);
    try {
      const res = await apiFetch("/api/v1/notifications/dismiss-all", {
        method: "POST",
      });
      if (!res.ok) {
        setError("Something went wrong. Try again.");
        return;
      }
      setNotifications([]);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsDismissingAll(false);
    }
  };

  const handleTogglePreference = async (
    type: ReminderTypeName,
    nextEnabled: boolean,
  ) => {
    setTogglingType(type);
    try {
      const res = await apiFetch("/api/v1/notification-preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type, enabled: nextEnabled }),
      });

      if (!res.ok) {
        setError("Something went wrong. Try again.");
        return;
      }

      const data = (await res.json()) as NotificationPreferencesResponse;
      if (data.preferences) {
        setPreferences(data.preferences);
      } else {
        setPreferences((prev) =>
          prev.map((p) =>
            p.type === type ? { ...p, enabled: nextEnabled } : p,
          ),
        );
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setTogglingType(null);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      navigate("/login");
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-background to-background-deep text-ink font-sans overflow-x-hidden flex flex-col pb-28 md:pb-0">
      {/* Background color blobs behind liquid glass */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-primary-tint/70 rounded-full blur-3xl opacity-75"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 -right-24 w-[420px] h-[420px] bg-background/85 rounded-full blur-3xl opacity-70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/4 w-[480px] h-[480px] bg-primary-tint/55 rounded-full blur-3xl opacity-65"
      />

      {/* Website sticky glass top bar (768px and up) */}
      <header className="hidden md:flex sticky top-0 z-40 w-full h-16 backdrop-blur-[22px] bg-glass/50 border-b border-glass/80 shadow-xs px-6 lg:px-12 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] bg-primary flex items-center justify-center text-on-primary shadow-xs ring-1 ring-glass/60">
              <CreditCard className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="font-bold text-[17px] tracking-tight text-ink">
              SwipeWise
            </span>
          </Link>

          <nav aria-label="Main navigation" className="flex items-center gap-6">
            <Link
              to="/"
              className="py-5 text-[15px] font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Home
            </Link>
            <Link
              to="/wallet"
              className="py-5 text-[15px] font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Wallet
            </Link>
            <span className="py-5 text-[15px] font-medium text-ink-muted/70 cursor-default">
              Tracker
            </span>
            <Link
              to="/alerts"
              className="py-5 text-[15px] font-semibold text-ink border-b-[2.5px] border-primary"
            >
              Alerts
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/alerts"
            aria-label="Alerts"
            className="w-10 h-10 rounded-full bg-glass/60 border border-glass/80 flex items-center justify-center text-primary transition-colors"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 h-9 rounded-full bg-glass/60 border border-glass/80 text-[13px] font-medium text-ink hover:bg-glass/90 transition-colors cursor-pointer"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-[720px] xl:max-w-[1120px] mx-auto px-4 md:px-6 pt-6 md:pt-12 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[30px] md:text-[42px] font-bold tracking-tight leading-[1.12] text-ink">
              Alerts
            </h1>
            <p className="text-[14px] text-ink-muted mt-1">
              In-app reminders for payments, perks, rotating categories, and
              points.
            </p>
          </div>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={handleDismissAll}
              disabled={isDismissingAll}
              className="px-4 h-10 rounded-full bg-glass/70 border border-glass/85 text-[14px] font-semibold text-primary hover:bg-glass/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isDismissingAll ? "Marking…" : "Mark all read"}
            </button>
          )}
        </div>

        {loading ? (
          <div
            role="status"
            aria-label="Loading notifications"
            className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 p-4 space-y-3"
          >
            <div className="h-16 rounded-[16px] bg-glass/70 animate-pulse" />
            <div className="h-16 rounded-[16px] bg-glass/70 animate-pulse" />
            <div className="h-16 rounded-[16px] bg-glass/70 animate-pulse" />
          </div>
        ) : error ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-[22px] bg-glass/65 backdrop-blur-[22px] border border-glass/85 p-6 text-center space-y-4"
          >
            <p className="text-[15px] text-error font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void fetchAlertsAndPreferences()}
              className="px-6 h-[44px] rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[15px] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            {/* Active notifications list */}
            <section
              aria-label="Active reminders"
              className="xl:col-span-7 space-y-3"
            >
              <h2 className="text-[18px] font-semibold text-ink mb-2">
                Unread reminders
              </h2>

              {notifications.length === 0 ? (
                <div className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 p-8 text-center space-y-4">
                  <p className="text-[15px] text-ink-muted">
                    You're all caught up. No new reminders.
                  </p>
                  <Link
                    to="/wallet"
                    className="inline-flex items-center justify-center px-6 h-[44px] rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[15px] transition-colors"
                  >
                    Go to wallet
                  </Link>
                </div>
              ) : (
                <div className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 divide-y divide-ink-muted/15 overflow-hidden">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex items-start justify-between gap-4 hover:bg-glass/40 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          aria-hidden="true"
                          className="mt-2 w-2.5 h-2.5 rounded-full bg-primary shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-ink">
                            {item.title}
                          </p>
                          <p className="text-[14px] text-ink-muted mt-0.5">
                            {item.body}
                          </p>
                          <p className="text-[12px] text-ink-muted mt-1">
                            Due {item.dueDate}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {item.type === "PAYMENT_DUE" && (
                          <button
                            type="button"
                            aria-label={`Mark paid for ${item.title}`}
                            onClick={() => void handleMarkPaid(item)}
                            className="px-3.5 h-[44px] rounded-full bg-primary hover:bg-primary-pressed text-[13px] font-semibold text-on-primary flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Check className="w-4 h-4" aria-hidden="true" />
                            <span>Mark paid</span>
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Dismiss ${item.title}`}
                          onClick={() => void handleDismiss(item.id)}
                          className="px-3.5 h-[44px] rounded-full bg-glass/75 hover:bg-glass border border-glass/90 text-[13px] font-semibold text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Check className="w-4 h-4" aria-hidden="true" />
                          <span>Dismiss</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Reminder settings toggles */}
            <section
              aria-label="Reminder settings"
              className="xl:col-span-5 space-y-3"
            >
              <h2 className="text-[18px] font-semibold text-ink mb-2">
                Reminder settings
              </h2>

              <div className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 divide-y divide-ink-muted/15 overflow-hidden">
                {REMINDER_OPTION_METADATA.map((option) => {
                  const found = preferences.find((p) => p.type === option.type);
                  const isEnabled = found ? found.enabled : true;
                  const isBusy = togglingType === option.type;

                  return (
                    <div
                      key={option.type}
                      className="p-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p
                          id={`pref-label-${option.type}`}
                          className="text-[15px] font-semibold text-ink"
                        >
                          {option.label}
                        </p>
                        <p className="text-[13px] text-ink-muted mt-0.5">
                          {option.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isEnabled}
                        aria-label={option.label}
                        disabled={isBusy}
                        onClick={() =>
                          void handleTogglePreference(option.type, !isEnabled)
                        }
                        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${
                          isEnabled
                            ? "bg-primary border-primary"
                            : "bg-ink-muted/30 border-ink-muted/40"
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-glass shadow-xs transition-transform ${
                            isEnabled ? "translate-x-7" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Mobile Floating Glass Tab Bar (under 768px) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-[22px] inset-x-4 z-40 h-[62px] rounded-full bg-glass/65 backdrop-blur-[22px] border border-glass/85 shadow-lg px-3 flex items-center justify-around"
      >
        <Link
          to="/"
          className="flex flex-col items-center justify-center px-5 py-1.5 rounded-full text-ink-muted hover:text-ink font-medium text-[11px]"
        >
          <HomeIcon className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Home</span>
        </Link>
        <Link
          to="/wallet"
          className="flex flex-col items-center justify-center px-5 py-1.5 rounded-full text-ink-muted hover:text-ink font-medium text-[11px]"
        >
          <WalletIcon className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Wallet</span>
        </Link>
        <span className="flex flex-col items-center justify-center px-5 py-1.5 rounded-full text-ink-muted/70 font-medium text-[11px]">
          <BarChart3 className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Tracker</span>
        </span>
        <Link
          to="/alerts"
          className="flex flex-col items-center justify-center px-5 py-1.5 rounded-full bg-glass/90 text-primary font-medium text-[11px] shadow-2xs"
        >
          <Bell className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Alerts</span>
        </Link>
      </nav>

      {/* Website Footer (768px and up) */}
      <footer className="hidden md:flex w-full h-[46px] bg-background-deep border-t border-ink-muted/15 px-6 lg:px-12 items-center justify-between text-[13px] text-ink-muted mt-auto">
        <div className="flex items-center gap-5">
          <span>© 2026 SwipeWise</span>
          <span>Privacy</span>
          <span>Terms</span>
          <span>Help</span>
        </div>
        <span>Not financial advice. Card terms can change.</span>
      </footer>
    </div>
  );
}
