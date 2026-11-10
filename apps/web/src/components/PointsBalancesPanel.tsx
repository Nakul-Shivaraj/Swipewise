import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import {
  formatCents,
  MAX_POINTS_BALANCE,
  PointsBalancesResponse,
  ProgramPointsBalanceItem,
  UpsertPointsBalanceResponse,
} from "@swipewise/shared";
import { apiFetch } from "../api.js";

interface ProgramFormDraft {
  pointsBalance: string;
  expiryDate: string;
  saving: boolean;
  error: string | null;
}

export function PointsBalancesPanel() {
  const [programs, setPrograms] = useState<ProgramPointsBalanceItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProgramFormDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/points-balances");
      if (!res.ok) {
        setError("Something went wrong. Try again.");
        return;
      }
      const data = (await res.json()) as PointsBalancesResponse;
      const items = data.programs || [];
      setPrograms(items);
      const nextDrafts: Record<string, ProgramFormDraft> = {};
      for (const item of items) {
        nextDrafts[item.programId] = {
          pointsBalance:
            item.pointsBalance !== null ? String(item.pointsBalance) : "",
          expiryDate: item.expiryDate ?? "",
          saving: false,
          error: null,
        };
      }
      setDrafts(nextDrafts);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  const updateDraft = (
    programId: string,
    patch: Partial<ProgramFormDraft>,
  ): void => {
    setDrafts((prev) => {
      const current = prev[programId] ?? {
        pointsBalance: "",
        expiryDate: "",
        saving: false,
        error: null,
      };
      return {
        ...prev,
        [programId]: { ...current, ...patch },
      };
    });
  };

  const handleSave = async (
    e: React.FormEvent,
    item: ProgramPointsBalanceItem,
  ) => {
    e.preventDefault();
    const draft = drafts[item.programId];
    if (!draft) return;

    const trimmedPoints = draft.pointsBalance.trim();
    const parsedPoints = Number(trimmedPoints);
    if (
      !trimmedPoints ||
      !Number.isInteger(parsedPoints) ||
      parsedPoints < 0 ||
      parsedPoints > MAX_POINTS_BALANCE
    ) {
      updateDraft(item.programId, {
        error: "Enter a whole number from 0 to 1,000,000,000.",
      });
      return;
    }

    const trimmedExpiry = draft.expiryDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedExpiry)) {
      updateDraft(item.programId, {
        error: "Enter a valid expiry date (YYYY-MM-DD).",
      });
      return;
    }

    updateDraft(item.programId, { saving: true, error: null });
    try {
      const res = await apiFetch(`/api/v1/points-balances/${item.programId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointsBalance: parsedPoints,
          expiryDate: trimmedExpiry,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        updateDraft(item.programId, {
          saving: false,
          error:
            (errBody as { error?: { message?: string } }).error?.message ||
            "Something went wrong. Try again.",
        });
        return;
      }

      const data = (await res.json()) as UpsertPointsBalanceResponse;
      if (data.programBalance) {
        setPrograms((prev) =>
          prev.map((p) =>
            p.programId === item.programId ? data.programBalance : p,
          ),
        );
        updateDraft(item.programId, {
          pointsBalance:
            data.programBalance.pointsBalance !== null
              ? String(data.programBalance.pointsBalance)
              : "",
          expiryDate: data.programBalance.expiryDate ?? "",
          saving: false,
          error: null,
        });
      } else {
        updateDraft(item.programId, { saving: false });
      }
    } catch {
      updateDraft(item.programId, {
        saving: false,
        error: "Something went wrong. Try again.",
      });
    }
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading points balances"
        className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 p-4 space-y-3"
      >
        <div className="h-20 rounded-[16px] bg-glass/70 animate-pulse" />
        <div className="h-20 rounded-[16px] bg-glass/70 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="rounded-[22px] bg-glass/65 backdrop-blur-[22px] border border-glass/85 p-6 text-center space-y-4"
      >
        <p className="text-[15px] text-error font-medium">{error}</p>
        <button
          type="button"
          onClick={() => void fetchBalances()}
          className="px-6 h-[44px] rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[15px] transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 p-8 text-center space-y-4">
        <p className="text-[15px] text-ink-muted">
          Add a card to your wallet to track points balances and expiry dates.
        </p>
        <Link
          to="/wallet"
          className="inline-flex items-center justify-center px-6 h-[44px] rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[15px] transition-colors"
        >
          Go to wallet
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {programs.map((item) => {
        const draft = drafts[item.programId] ?? {
          pointsBalance:
            item.pointsBalance !== null ? String(item.pointsBalance) : "",
          expiryDate: item.expiryDate ?? "",
          saving: false,
          error: null,
        };
        const balanceInputId = `points-balance-${item.programId}`;
        const expiryInputId = `points-expiry-${item.programId}`;

        return (
          <div
            key={item.programId}
            className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 p-5 space-y-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-[18px] font-semibold text-ink">
                  {item.programName}
                </h2>
                <p className="text-[13px] text-ink-muted">
                  Valued at {(item.centsPer100Points / 100).toFixed(2)}¢ per
                  point
                </p>
              </div>

              {item.pointsBalance !== null && item.valueCents !== null && (
                <div className="text-right">
                  <p className="text-[24px] font-semibold text-ink tabular-nums leading-tight">
                    {formatCents(item.valueCents)}
                  </p>
                  <p className="text-[13px] text-ink-muted tabular-nums">
                    {item.pointsBalance.toLocaleString("en-US")} pts · Expires{" "}
                    {item.expiryDate}
                  </p>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => void handleSave(e, item)}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
            >
              <div className="md:col-span-5">
                <label
                  htmlFor={balanceInputId}
                  className="block text-[13px] font-semibold text-ink mb-1"
                >
                  Points balance
                </label>
                <input
                  id={balanceInputId}
                  aria-label={`Points balance for ${item.programName}`}
                  type="number"
                  min={0}
                  max={MAX_POINTS_BALANCE}
                  step={1}
                  value={draft.pointsBalance}
                  onChange={(e) =>
                    updateDraft(item.programId, {
                      pointsBalance: e.target.value,
                      error: null,
                    })
                  }
                  placeholder="e.g. 10000"
                  className="w-full h-11 px-4 rounded-[16px] bg-glass/80 border border-glass/90 text-[15px] text-ink tabular-nums focus:outline-2 focus:outline-primary"
                />
              </div>

              <div className="md:col-span-4">
                <label
                  htmlFor={expiryInputId}
                  className="block text-[13px] font-semibold text-ink mb-1"
                >
                  Expiry date
                </label>
                <input
                  id={expiryInputId}
                  aria-label={`Expiry date for ${item.programName}`}
                  type="date"
                  value={draft.expiryDate}
                  onChange={(e) =>
                    updateDraft(item.programId, {
                      expiryDate: e.target.value,
                      error: null,
                    })
                  }
                  className="w-full h-11 px-4 rounded-[16px] bg-glass/80 border border-glass/90 text-[15px] text-ink focus:outline-2 focus:outline-primary"
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  aria-label={`Save balance for ${item.programName}`}
                  disabled={draft.saving}
                  className="w-full h-11 px-5 rounded-full bg-primary hover:bg-primary-pressed disabled:opacity-50 text-on-primary font-semibold text-[15px] transition-colors cursor-pointer"
                >
                  {draft.saving ? "Saving…" : "Save balance"}
                </button>
              </div>

              {draft.error && (
                <p
                  role="alert"
                  className="md:col-span-12 text-[13px] text-error mt-1"
                >
                  {draft.error}
                </p>
              )}
            </form>
          </div>
        );
      })}
    </div>
  );
}
