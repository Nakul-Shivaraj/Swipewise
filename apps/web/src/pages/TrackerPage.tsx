import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  WalletCardPerkItem,
  WalletCardPerksResponse,
  formatCents,
  parseDollarsToCents,
} from "@swipewise/shared";
import {
  BarChart3,
  Bell,
  Check,
  Clock,
  Coins,
  CreditCard,
  Gift,
  Home as HomeIcon,
  RefreshCw,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { apiFetch } from "../api.js";

interface ProgramBalanceItem {
  programId: string;
  programName: string;
  pointsBalance: number | null;
  valueCents: number | null;
  expiryDate: string | null;
}

interface WalletCardItem {
  id: string;
  nickname: string | null;
  card: {
    name: string;
    artColor: string;
  };
  paymentSetting?: {
    dueDay: number;
    isAutopay: boolean;
  } | null;
}

export function TrackerPage() {
  const navigate = useNavigate();

  const [perks, setPerks] = useState<WalletCardPerkItem[]>([]);
  const [summary, setSummary] = useState({
    totalAmountCents: 0,
    totalUsedCents: 0,
    totalLeftCents: 0,
  });
  const [walletCards, setWalletCards] = useState<WalletCardItem[]>([]);
  const [programs, setPrograms] = useState<ProgramBalanceItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Partial usage modal state
  const [activeModalPerk, setActiveModalPerk] =
    useState<WalletCardPerkItem | null>(null);
  const [customDollars, setCustomDollars] = useState("");
  const [isSubmittingUsage, setIsSubmittingUsage] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perksRes, cardsRes, pointsRes] = await Promise.all([
        fetch("/api/v1/perks"),
        fetch("/api/v1/wallet/cards"),
        fetch("/api/v1/points-balances"),
      ]);

      if (!perksRes.ok) {
        if (perksRes.status === 401) {
          navigate("/login");
          return;
        }
        setError("Something went wrong. Try again.");
        return;
      }

      const perksData = (await perksRes.json()) as WalletCardPerksResponse;
      setPerks(perksData.perks || []);
      if (perksData.summary) {
        setSummary(perksData.summary);
      }

      if (cardsRes.ok) {
        const cardsData = (await cardsRes.json()) as {
          walletCards?: WalletCardItem[];
        };
        setWalletCards(cardsData.walletCards || []);
      }

      if (pointsRes.ok) {
        const pointsData = (await pointsRes.json()) as {
          programs?: ProgramBalanceItem[];
        };
        setPrograms(pointsData.programs || []);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleMarkFullUsed = async (perk: WalletCardPerkItem) => {
    try {
      const res = await apiFetch(
        `/api/v1/wallet/cards/${perk.walletCardId}/perks/${perk.perkId}/usage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFull: true }),
        },
      );

      if (!res.ok) {
        setError("Something went wrong. Try again.");
        return;
      }

      const data = (await res.json()) as { perk: WalletCardPerkItem };
      setPerks((prev) =>
        prev.map((p) =>
          p.perkId === perk.perkId && p.walletCardId === perk.walletCardId
            ? data.perk
            : p,
        ),
      );

      // Update summary
      const delta = data.perk.usedCents - perk.usedCents;
      setSummary((prev) => ({
        ...prev,
        totalUsedCents: prev.totalUsedCents + delta,
        totalLeftCents: Math.max(0, prev.totalLeftCents - delta),
      }));
    } catch {
      setError("Something went wrong. Try again.");
    }
  };

  const handleSaveCustomUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalPerk) return;

    setModalError(null);
    const cents = parseDollarsToCents(customDollars);
    if (cents === null || cents < 0) {
      setModalError("Enter a valid dollar amount.");
      return;
    }

    if (cents > activeModalPerk.amountCents) {
      setModalError(
        `Amount cannot exceed ${formatCents(activeModalPerk.amountCents)}.`,
      );
      return;
    }

    setIsSubmittingUsage(true);
    try {
      const res = await apiFetch(
        `/api/v1/wallet/cards/${activeModalPerk.walletCardId}/perks/${activeModalPerk.perkId}/usage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usedCents: cents }),
        },
      );

      if (!res.ok) {
        setModalError("Something went wrong. Try again.");
        return;
      }

      const data = (await res.json()) as { perk: WalletCardPerkItem };
      setPerks((prev) =>
        prev.map((p) =>
          p.perkId === activeModalPerk.perkId &&
          p.walletCardId === activeModalPerk.walletCardId
            ? data.perk
            : p,
        ),
      );

      const delta = data.perk.usedCents - activeModalPerk.usedCents;
      setSummary((prev) => ({
        ...prev,
        totalUsedCents: prev.totalUsedCents + delta,
        totalLeftCents: Math.max(0, prev.totalLeftCents - delta),
      }));

      setActiveModalPerk(null);
      setCustomDollars("");
    } catch {
      setModalError("Something went wrong. Try again.");
    } finally {
      setIsSubmittingUsage(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      navigate("/login");
    }
  };

  // Next upcoming payment card
  const upcomingPaymentCard = walletCards.find(
    (c) => c.paymentSetting && c.paymentSetting.dueDay > 0,
  );

  // Total points value
  const totalPointsValueCents = programs.reduce(
    (acc, p) => acc + (p.valueCents ?? 0),
    0,
  );

  // Coming up events
  interface ComingUpItem {
    id: string;
    type: "perk" | "payment" | "points";
    title: string;
    subtitle: string;
    dueDate: string;
    daysLeftText: string;
    amountFormatted?: string;
    perkRef?: WalletCardPerkItem;
  }

  const comingUpItems: ComingUpItem[] = [];

  for (const p of perks) {
    if (!p.isUsed) {
      comingUpItems.push({
        id: `perk-${p.walletCardId}-${p.perkId}`,
        type: "perk",
        title: `${p.perkName} credit`,
        subtitle: p.cardName,
        dueDate: p.endDate,
        daysLeftText:
          p.daysLeft === 0 ? "Ends today" : `${p.daysLeft} days left`,
        amountFormatted: `${formatCents(p.leftCents)} left`,
        perkRef: p,
      });
    }
  }

  for (const prog of programs) {
    if (prog.expiryDate && prog.pointsBalance && prog.pointsBalance > 0) {
      comingUpItems.push({
        id: `points-${prog.programId}`,
        type: "points",
        title: `${prog.programName} expiry`,
        subtitle: `${prog.pointsBalance.toLocaleString()} points`,
        dueDate: prog.expiryDate,
        daysLeftText: `Expires ${prog.expiryDate}`,
        amountFormatted: prog.valueCents
          ? formatCents(prog.valueCents)
          : undefined,
      });
    }
  }

  comingUpItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="min-h-screen bg-background text-ink flex flex-col font-sans selection:bg-primary/20">
      {/* Sticky Glass Top Bar */}
      <header className="sticky top-0 z-30 w-full h-[64px] bg-glass/65 backdrop-blur-[22px] border-b border-glass/85 px-4 lg:px-8 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-ink hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-black text-sm shadow-xs">
              S
            </div>
            <span>SwipeWise</span>
          </Link>

          {/* Desktop Nav Links */}
          <nav
            aria-label="Main navigation"
            className="hidden md:flex items-center gap-6"
          >
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
            <Link
              to="/points"
              className="py-5 text-[15px] font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Points
            </Link>
            <Link
              to="/tracker"
              className="py-5 text-[15px] font-semibold text-ink border-b-[2.5px] border-primary"
            >
              Tracker
            </Link>
            <Link
              to="/alerts"
              className="py-5 text-[15px] font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Alerts
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/alerts"
            aria-label="Alerts"
            className="p-2 rounded-full hover:bg-glass/80 text-ink transition-colors"
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="text-[14px] font-medium text-ink-muted hover:text-ink transition-colors px-2 py-1 rounded-md"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-12">
        {/* Page Title */}
        <div className="mb-6">
          <p className="text-[13px] font-medium text-ink-muted uppercase tracking-wider mb-1">
            This month
          </p>
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <h1 className="text-[32px] sm:text-[36px] font-bold tracking-tight text-ink">
              Tracker
            </h1>
            <p className="text-[15px] text-ink-muted hidden md:block">
              Your month so far
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div aria-label="Loading tracker" className="space-y-6 animate-pulse">
            <div className="h-28 rounded-[22px] bg-glass/60 border border-glass/80" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-40 rounded-[22px] bg-glass/60 border border-glass/80" />
              <div className="h-40 rounded-[22px] bg-glass/60 border border-glass/80" />
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="rounded-[22px] bg-glass/70 border border-glass/90 p-8 text-center space-y-4 shadow-sm">
            <p className="text-[16px] font-medium text-ink">{error}</p>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="inline-flex items-center justify-center px-6 h-[44px] rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[15px] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Main Tracker View */}
        {!loading && !error && (
          <div className="space-y-8">
            {/* Website Stats Row (768px and up) */}
            <section
              aria-label="Month summary stats"
              className="hidden md:grid grid-cols-3 rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 p-6 shadow-sm divide-x divide-ink-muted/15 text-center"
            >
              {/* Perks Left */}
              <div className="px-4 space-y-1">
                <p className="text-[13px] font-medium text-ink-muted flex items-center justify-center gap-1.5">
                  <Gift className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Perks left</span>
                </p>
                <p className="text-[28px] font-bold text-ink">
                  {formatCents(summary.totalLeftCents)} left
                </p>
                <p className="text-[12px] text-ink-muted">
                  {formatCents(summary.totalUsedCents)} of{" "}
                  {formatCents(summary.totalAmountCents)} used
                </p>
              </div>

              {/* Payment Due */}
              <div className="px-4 space-y-1">
                <p className="text-[13px] font-medium text-ink-muted flex items-center justify-center gap-1.5">
                  <CreditCard
                    className="w-4 h-4 text-primary"
                    aria-hidden="true"
                  />
                  <span>Payment due</span>
                </p>
                <p className="text-[28px] font-bold text-ink">
                  {upcomingPaymentCard?.paymentSetting
                    ? `Day ${upcomingPaymentCard.paymentSetting.dueDay}`
                    : "No due dates"}
                </p>
                <p className="text-[12px] text-ink-muted">
                  {upcomingPaymentCard?.nickname ||
                    upcomingPaymentCard?.card.name ||
                    "Autopay & due days in wallet"}
                </p>
              </div>

              {/* Points Value */}
              <div className="px-4 space-y-1">
                <p className="text-[13px] font-medium text-ink-muted flex items-center justify-center gap-1.5">
                  <Coins className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Points balance</span>
                </p>
                <p className="text-[28px] font-bold text-ink">
                  {formatCents(totalPointsValueCents)}
                </p>
                <p className="text-[12px] text-ink-muted">
                  {programs.length} active programs
                </p>
              </div>
            </section>

            {/* Mobile Widgets Grid (under 768px) */}
            <section
              aria-label="Mobile widgets"
              className="md:hidden grid grid-cols-1 gap-3.5"
            >
              {/* Perks Widget */}
              <div className="rounded-[22px] bg-glass/65 backdrop-blur-[22px] border border-glass/85 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                      <Gift className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <span className="text-[14px] font-semibold text-ink">
                      Perks
                    </span>
                  </div>
                  <span className="text-[12px] text-ink-muted">
                    {perks.filter((p) => !p.isUsed).length} active
                  </span>
                </div>
                <div>
                  <p className="text-[26px] font-bold text-ink">
                    {formatCents(summary.totalLeftCents)} left
                  </p>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    {formatCents(summary.totalUsedCents)} of{" "}
                    {formatCents(summary.totalAmountCents)} used this period
                  </p>
                </div>
                {/* Progress bar */}
                {summary.totalAmountCents > 0 && (
                  <div className="w-full h-2 rounded-full bg-ink-muted/15 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (summary.totalUsedCents /
                              summary.totalAmountCents) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Payment Due Widget */}
              <div className="rounded-[22px] bg-glass/65 backdrop-blur-[22px] border border-glass/85 p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                      <CreditCard className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <span className="text-[14px] font-semibold text-ink">
                      Payment due
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[20px] font-bold text-ink">
                    {upcomingPaymentCard?.paymentSetting
                      ? `Day ${upcomingPaymentCard.paymentSetting.dueDay} of month`
                      : "No payment due set"}
                  </p>
                  <p className="text-[13px] text-ink-muted">
                    {upcomingPaymentCard?.nickname ||
                      upcomingPaymentCard?.card.name ||
                      "Set payment settings in Wallet"}
                  </p>
                </div>
              </div>
            </section>

            {/* Perks Tracker Details Section */}
            <section aria-label="Perks tracker" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[20px] font-bold text-ink">Card perks</h2>
                  <p className="text-[14px] text-ink-muted">
                    Monthly and periodic card credits that reset automatically
                  </p>
                </div>
                {summary.totalAmountCents > 0 && (
                  <span className="hidden sm:inline-block text-[13px] font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {formatCents(summary.totalLeftCents)} left
                  </span>
                )}
              </div>

              {perks.length === 0 ? (
                <div className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 p-8 text-center space-y-4">
                  <p className="text-[16px] font-semibold text-ink">
                    No active perks to track
                  </p>
                  <p className="text-[14px] text-ink-muted max-w-md mx-auto">
                    Add cards with periodic credits to your wallet (like Harbor
                    Travel Plus) to track monthly and annual credits here.
                  </p>
                  <Link
                    to="/wallet"
                    className="inline-flex items-center justify-center px-6 h-[44px] rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[15px] transition-colors"
                  >
                    Go to wallet
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {perks.map((item) => (
                    <div
                      key={`${item.walletCardId}-${item.perkId}`}
                      className="rounded-[22px] bg-glass/65 backdrop-blur-[22px] border border-glass/85 p-5 shadow-sm flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block text-[11px] font-semibold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-md mb-1">
                              {item.period}
                            </span>
                            <h3 className="text-[17px] font-bold text-ink">
                              {item.perkName}
                            </h3>
                            <p className="text-[13px] text-ink-muted">
                              {item.cardName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[18px] font-bold text-ink">
                              {formatCents(item.leftCents)} left
                            </p>
                            <p className="text-[12px] text-ink-muted">
                              of {formatCents(item.amountCents)}
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-ink-muted/15 overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (item.usedCents / item.amountCents) * 100,
                                ),
                              )}%`,
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[12px] text-ink-muted pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {item.daysLeft === 0
                                ? "Ends today"
                                : `${item.daysLeft} days left this period`}
                            </span>
                          </span>
                          <span>Resets {item.endDate}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-ink-muted/15 flex items-center justify-between gap-2">
                        {item.isUsed ? (
                          <div className="flex items-center gap-1.5 text-primary text-[13px] font-semibold">
                            <Check className="w-4 h-4" aria-hidden="true" />
                            <span>Fully used this period</span>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveModalPerk(item);
                                setCustomDollars(
                                  (item.leftCents / 100).toFixed(2),
                                );
                              }}
                              className="text-[13px] font-medium text-ink-muted hover:text-ink cursor-pointer"
                            >
                              Partly used?
                            </button>
                            <button
                              type="button"
                              aria-label={`Mark used ${item.perkName}`}
                              onClick={() => void handleMarkFullUsed(item)}
                              className="px-4 h-[40px] rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[13px] flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Check className="w-4 h-4" aria-hidden="true" />
                              <span>Mark used</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Website "Coming up" Table */}
            <section aria-label="Coming up schedule" className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[20px] font-bold text-ink">Coming up</h2>
                  <p className="text-[14px] text-ink-muted">
                    Upcoming due dates, perk resets, and expirations, sorted
                    soonest first
                  </p>
                </div>
              </div>

              {comingUpItems.length === 0 ? (
                <div className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 p-6 text-center text-ink-muted text-[14px]">
                  Nothing coming up right now. You're all caught up!
                </div>
              ) : (
                <div className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 overflow-hidden shadow-sm divide-y divide-ink-muted/15">
                  {comingUpItems.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-glass/40 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          {event.type === "perk" && (
                            <Gift className="w-4 h-4" aria-hidden="true" />
                          )}
                          {event.type === "points" && (
                            <Coins className="w-4 h-4" aria-hidden="true" />
                          )}
                          {event.type === "payment" && (
                            <CreditCard
                              className="w-4 h-4"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-ink truncate">
                            {event.title}
                          </p>
                          <p className="text-[13px] text-ink-muted truncate">
                            {event.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          {event.amountFormatted && (
                            <p className="text-[14px] font-semibold text-ink">
                              {event.amountFormatted}
                            </p>
                          )}
                          <p className="text-[12px] text-ink-muted">
                            {event.daysLeftText}
                          </p>
                        </div>

                        {event.perkRef && !event.perkRef.isUsed && (
                          <button
                            type="button"
                            aria-label={`Mark used ${event.perkRef.perkName}`}
                            onClick={() =>
                              void handleMarkFullUsed(event.perkRef!)
                            }
                            className="hidden sm:inline-flex px-3.5 h-[36px] rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[12px] items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Mark used</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Partial Usage Modal Dialog */}
      {activeModalPerk && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="usage-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-[24px] bg-glass/95 backdrop-blur-[24px] border border-glass/90 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3
                id="usage-modal-title"
                className="text-[18px] font-bold text-ink"
              >
                Record perk usage
              </h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setActiveModalPerk(null);
                  setModalError(null);
                }}
                className="p-1 rounded-full text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-[13px] text-ink-muted">
              {activeModalPerk.cardName} &bull; {activeModalPerk.perkName} (
              {formatCents(activeModalPerk.amountCents)} total)
            </p>

            <form
              onSubmit={(e) => void handleSaveCustomUsage(e)}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="used-amount-input"
                  className="block text-[13px] font-medium text-ink mb-1"
                >
                  Used amount ($)
                </label>
                <input
                  id="used-amount-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={customDollars}
                  onChange={(e) => setCustomDollars(e.target.value)}
                  className="w-full h-[44px] rounded-xl bg-glass/80 border border-ink-muted/30 px-3 text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {modalError && (
                <p
                  className="text-[12px] text-primary font-medium"
                  role="alert"
                >
                  {modalError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModalPerk(null);
                    setModalError(null);
                  }}
                  className="px-4 h-[40px] rounded-full text-[14px] font-semibold text-ink-muted hover:text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUsage}
                  className="px-5 h-[40px] rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[14px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingUsage ? "Saving..." : "Save usage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Floating Glass Tab Bar (under 768px) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-[22px] inset-x-4 z-40 h-[62px] rounded-full bg-glass/65 backdrop-blur-[22px] border border-glass/85 shadow-lg px-3 flex items-center justify-around"
      >
        <Link
          to="/"
          className="flex flex-col items-center justify-center px-4 py-1.5 rounded-full text-ink-muted hover:text-ink font-medium text-[11px]"
        >
          <HomeIcon className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Home</span>
        </Link>
        <Link
          to="/wallet"
          className="flex flex-col items-center justify-center px-4 py-1.5 rounded-full text-ink-muted hover:text-ink font-medium text-[11px]"
        >
          <WalletIcon className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Wallet</span>
        </Link>
        <Link
          to="/tracker"
          className="flex flex-col items-center justify-center px-4 py-1.5 rounded-full bg-glass/90 text-primary font-medium text-[11px] shadow-2xs"
        >
          <BarChart3 className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Tracker</span>
        </Link>
        <Link
          to="/alerts"
          className="flex flex-col items-center justify-center px-4 py-1.5 rounded-full text-ink-muted hover:text-ink font-medium text-[11px]"
        >
          <Bell className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Alerts</span>
        </Link>
      </nav>

      {/* Website Footer (768px and up) */}
      <footer className="hidden md:flex w-full h-[46px] bg-background-deep border-t border-ink-muted/15 px-6 lg:px-12 items-center justify-between text-[13px] text-ink-muted mt-auto">
        <div className="flex items-center gap-5">
          <span>&copy; 2026 SwipeWise</span>
          <span>Privacy</span>
          <span>Terms</span>
          <span>Help</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Perks Tracker</span>
        </div>
      </footer>
    </div>
  );
}
