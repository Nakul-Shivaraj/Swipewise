import React, { useState } from "react";
import { WalletCardItem } from "@swipewise/shared";
import { apiFetch } from "../api.js";

export interface WalletCardPaymentSummaryProps {
  card: WalletCardItem;
}

export function WalletCardPaymentSummary({
  card,
}: WalletCardPaymentSummaryProps) {
  const settings = card.paymentSettings;
  if (!settings) {
    return (
      <span className="text-[12px] text-ink-muted">
        Payment due day not set
      </span>
    );
  }

  return (
    <span className="text-[12px] text-ink-muted">
      Due: Day {settings.dueDay} ·{" "}
      {settings.isAutopay ? "Autopay on" : "Autopay off"}
    </span>
  );
}

export interface WalletCardPaymentFormProps {
  card: WalletCardItem;
  onUpdated: (updatedCard: WalletCardItem) => void;
}

export function WalletCardPaymentForm({
  card,
  onUpdated,
}: WalletCardPaymentFormProps) {
  const [dueDayText, setDueDayText] = useState(
    card.paymentSettings ? String(card.paymentSettings.dueDay) : "",
  );
  const [isAutopay, setIsAutopay] = useState(
    card.paymentSettings?.isAutopay ?? false,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = Number(dueDayText.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
      setError("Due day must be between 1 and 31.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetch(
        `/api/v1/wallet/cards/${card.id}/payment-settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dueDay: parsed,
            isAutopay,
          }),
        },
      );

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(errData.error?.message || "Something went wrong. Try again.");
        return;
      }

      const data = (await res.json()) as { walletCard?: WalletCardItem };
      if (data.walletCard) {
        onUpdated(data.walletCard);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSavePaymentSettings}
      className="mt-5 pt-4 border-t border-ink-muted/15 space-y-3"
    >
      <h3 className="text-[14px] font-semibold text-ink">Payment reminders</h3>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <label
            htmlFor="edit-due-day-input"
            className="block text-[13px] font-semibold text-ink mb-1"
          >
            Payment due day (1–31)
          </label>
          <input
            id="edit-due-day-input"
            type="number"
            min={1}
            max={31}
            value={dueDayText}
            onChange={(e) => setDueDayText(e.target.value)}
            placeholder="15"
            className="w-full h-10 px-3.5 rounded-xl bg-glass/80 border border-glass/90 text-[14px] text-ink placeholder:text-ink-muted/60 focus:outline-2 focus:outline-primary"
          />
        </div>

        <div className="pt-5 flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-ink">Autopay</span>
          <button
            type="button"
            role="switch"
            aria-checked={isAutopay}
            aria-label="Autopay"
            onClick={() => setIsAutopay((prev) => !prev)}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
              isAutopay
                ? "bg-primary border-primary"
                : "bg-ink-muted/30 border-ink-muted/40"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-glass shadow-xs transition-transform ${
                isAutopay ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" aria-live="polite" className="text-[12px] text-error">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 h-10 rounded-full bg-glass/85 hover:bg-glass border border-glass/95 text-[13px] font-semibold text-primary disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isSaving ? "Updating…" : "Update payment settings"}
        </button>
      </div>
    </form>
  );
}
