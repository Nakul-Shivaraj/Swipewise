import React, { useState } from "react";
import {
  CategoryName,
  WalletCardItem,
  WalletCardQuarterView,
} from "@swipewise/shared";
import { apiFetch } from "../api.js";

const CATEGORY_DISPLAY: Record<CategoryName, string> = {
  GROCERIES: "Groceries",
  DINING: "Dining",
  GAS: "Gas",
  TRAVEL: "Travel",
};

function formatQuarterCategories(quarterView: WalletCardQuarterView): string {
  if (quarterView.categories.length === 0) {
    return "None scheduled";
  }
  return quarterView.categories
    .map((c) => {
      const rateNum = c.rateX100 / 100;
      const rateStr = Number.isInteger(rateNum)
        ? String(rateNum)
        : rateNum.toFixed(2).replace(/0$/, "");
      return `${rateStr}% ${CATEGORY_DISPLAY[c.category]}`;
    })
    .join(", ");
}

export interface WalletCardRotatingCategoriesProps {
  card: WalletCardItem;
  onUpdated: (updatedCard: WalletCardItem) => void;
}

export function WalletCardRotatingCategories({
  card,
  onUpdated,
}: WalletCardRotatingCategoriesProps) {
  const [activatingQuarter, setActivatingQuarter] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const schedule = card.rotatingQuarters;
  if (
    !schedule ||
    (schedule.currentQuarter.categories.length === 0 &&
      schedule.nextQuarter.categories.length === 0)
  ) {
    return null;
  }

  const handleActivate = async (quarter: string) => {
    setError(null);
    setActivatingQuarter(quarter);
    try {
      const res = await apiFetch(
        `/api/v1/wallet/cards/${card.id}/quarter-activations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quarter }),
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
      setActivatingQuarter(null);
    }
  };

  const rows: Array<{ label: string; view: WalletCardQuarterView }> = [
    {
      label: `This quarter (${schedule.currentQuarter.quarter})`,
      view: schedule.currentQuarter,
    },
    {
      label: `Next quarter (${schedule.nextQuarter.quarter})`,
      view: schedule.nextQuarter,
    },
  ];

  return (
    <div className="mt-2 pt-2 border-t border-ink-muted/15 space-y-1.5 text-[12px]">
      {rows.map(({ label, view }) => (
        <div
          key={view.quarter}
          className="flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <span className="font-semibold text-ink">{label}:</span>{" "}
            <span className="text-ink-muted">
              {formatQuarterCategories(view)}
            </span>
          </div>
          {view.isActivated ? (
            <span className="px-2.5 py-0.5 rounded-full bg-primary-tint text-primary font-semibold text-[11px] shrink-0">
              Activated
            </span>
          ) : (
            <button
              type="button"
              disabled={activatingQuarter === view.quarter}
              aria-label={`Activate ${view.quarter}`}
              onClick={() => void handleActivate(view.quarter)}
              className="px-2.5 py-0.5 rounded-full bg-primary hover:bg-primary-pressed disabled:opacity-50 text-on-primary font-semibold text-[11px] shrink-0 transition-colors cursor-pointer"
            >
              {activatingQuarter === view.quarter ? "Activating…" : "Activate"}
            </button>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" aria-live="polite" className="text-[11px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
