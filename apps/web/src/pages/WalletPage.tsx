import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  WalletCardsResponse,
  WalletCardItem,
  CatalogCardsResponse,
  CatalogCard,
  formatCents,
  isCardNumber,
} from "@swipewise/shared";
import {
  CreditCard,
  Plus,
  PlusCircle,
  Home as HomeIcon,
  Wallet as WalletIcon,
  BarChart3,
  Bell,
  Trash2,
  Edit2,
  X,
  Search,
  Check,
} from "lucide-react";
import { CardArt } from "../components/CardArt.js";
import {
  WalletCardPaymentForm,
  WalletCardPaymentSummary,
} from "../components/WalletCardPaymentSettings.js";
import { WalletCardRotatingCategories } from "../components/WalletCardRotatingCategories.js";
import { apiFetch } from "../api.js";

function getBestCategoryLabel(card: CatalogCard): string {
  const isCashBack = card.program.name.toLowerCase() === "cash back";
  if (!card.rates || card.rates.length === 0) {
    const baseNum = card.baseRateX100 / 100;
    const baseStr = Number.isInteger(baseNum)
      ? String(baseNum)
      : baseNum.toFixed(2).replace(/0$/, "");
    return isCashBack
      ? `${baseStr}% on everything`
      : `${baseStr}x on everything`;
  }

  const bestRate = [...card.rates].sort((a, b) => b.rateX100 - a.rateX100)[0];
  if (!bestRate) return "Base rate";

  const rateNum = bestRate.rateX100 / 100;
  const rateStr = Number.isInteger(rateNum)
    ? String(rateNum)
    : rateNum.toFixed(2).replace(/0$/, "");
  const catName =
    bestRate.category.charAt(0) + bestRate.category.slice(1).toLowerCase();

  return isCashBack ? `${rateStr}% ${catName}` : `${rateStr}x ${catName}`;
}

export function WalletPage() {
  const navigate = useNavigate();

  const [walletCards, setWalletCards] = useState<WalletCardItem[]>([]);
  const [catalogCards, setCatalogCards] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded card in mobile view
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Add Card Modal / Sheet state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogCard, setSelectedCatalogCard] =
    useState<CatalogCard | null>(null);
  const [newNickname, setNewNickname] = useState("");
  const [newNicknameError, setNewNicknameError] = useState<string | null>(null);
  const [newOpenedDate, setNewOpenedDate] = useState("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Nickname Modal state
  const [editingCard, setEditingCard] = useState<WalletCardItem | null>(null);
  const [editingNickname, setEditingNickname] = useState("");
  const [editingNicknameError, setEditingNicknameError] = useState<
    string | null
  >(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Remove Card Confirmation state
  const [cardToRemove, setCardToRemove] = useState<WalletCardItem | null>(null);
  const [isSubmittingRemove, setIsSubmittingRemove] = useState(false);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [walletRes, catalogRes] = await Promise.all([
        fetch("/api/v1/wallet/cards"),
        fetch("/api/v1/catalog/cards"),
      ]);

      if (!walletRes.ok) {
        setError("Something went wrong. Try again.");
        return;
      }
      const walletData = (await walletRes.json()) as WalletCardsResponse;
      setWalletCards(walletData.walletCards || []);

      if (catalogRes.ok) {
        const catalogData = (await catalogRes.json()) as CatalogCardsResponse;
        setCatalogCards(catalogData.cards || []);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const handleLogout = async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      navigate("/login");
    }
  };

  // Keyboard shortcut: Esc closes any modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsAddOpen(false);
        setEditingCard(null);
        setCardToRemove(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const openAddModal = () => {
    setSelectedCatalogCard(null);
    setCatalogSearch("");
    setNewNickname("");
    setNewNicknameError(null);
    setNewOpenedDate("");
    setIsAddOpen(true);
  };

  const handleNewNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewNickname(val);
    if (isCardNumber(val)) {
      setNewNicknameError(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      );
    } else {
      setNewNicknameError(null);
    }
  };

  const handleEditingNicknameChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const val = e.target.value;
    setEditingNickname(val);
    if (isCardNumber(val)) {
      setEditingNicknameError(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      );
    } else {
      setEditingNicknameError(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalogCard) return;

    if (newNickname && isCardNumber(newNickname)) {
      setNewNicknameError(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      );
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await apiFetch("/api/v1/wallet/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: selectedCatalogCard.id,
          nickname: newNickname.trim() || undefined,
          openedDate: newOpenedDate.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setNewNicknameError(
          errData.error?.message || "Something went wrong. Try again.",
        );
        return;
      }

      const json = await res.json();
      if (json.walletCard) {
        setWalletCards((prev) => [json.walletCard, ...prev]);
      }
      setIsAddOpen(false);
    } catch {
      setNewNicknameError("Something went wrong. Try again.");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;

    if (editingNickname && isCardNumber(editingNickname)) {
      setEditingNicknameError(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      );
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const res = await apiFetch(`/api/v1/wallet/cards/${editingCard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: editingNickname.trim() || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setEditingNicknameError(
          errData.error?.message || "Something went wrong. Try again.",
        );
        return;
      }

      const json = await res.json();
      if (json.walletCard) {
        setWalletCards((prev) =>
          prev.map((c) => (c.id === editingCard.id ? json.walletCard : c)),
        );
      }
      setEditingCard(null);
    } catch {
      setEditingNicknameError("Something went wrong. Try again.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!cardToRemove) return;

    setIsSubmittingRemove(true);
    try {
      const res = await apiFetch(`/api/v1/wallet/cards/${cardToRemove.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Something went wrong removing the card.");
        return;
      }

      setWalletCards((prev) => prev.filter((c) => c.id !== cardToRemove.id));
      if (expandedCardId === cardToRemove.id) {
        setExpandedCardId(null);
      }
      setCardToRemove(null);
    } catch {
      alert("Something went wrong removing the card.");
    } finally {
      setIsSubmittingRemove(false);
    }
  };

  const filteredCatalogCards = catalogCards.filter((c) => {
    if (!catalogSearch.trim()) return true;
    const q = catalogSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.issuer.toLowerCase().includes(q) ||
      c.program.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background-deep text-ink flex flex-col">
      {/* Website Sticky Top Bar (768px and up) */}
      <header className="hidden md:flex sticky top-0 z-30 w-full h-16 bg-glass/65 backdrop-blur-[22px] border-b border-glass/80 px-6 lg:px-12 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-primary flex items-center justify-center text-on-primary shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="font-bold text-[18px] tracking-tight">
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
              className="py-5 text-[15px] font-semibold text-ink border-b-[2.5px] border-primary"
            >
              Wallet
            </Link>
            <Link
              to="/points"
              className="py-5 text-[15px] font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Points
            </Link>
            <span className="py-5 text-[15px] font-medium text-ink-muted/70 cursor-default">
              Tracker
            </span>
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
            className="w-10 h-10 rounded-full bg-glass/60 border border-glass/80 flex items-center justify-center text-ink-muted hover:text-ink transition-colors"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 h-9 rounded-full bg-glass/65 border border-glass/80 text-[13px] font-semibold text-ink hover:bg-glass/90 transition-colors cursor-pointer"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 w-full max-w-[1120px] mx-auto px-4 md:px-8 pt-6 md:pt-10 pb-28 md:pb-12">
        {/* Mobile Header: Large title + round glass '+' and Log out buttons */}
        <div className="md:hidden flex items-center justify-between mb-6">
          <h1 className="text-[30px] font-bold tracking-tight text-ink">
            Wallet
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 h-10 rounded-full bg-glass/75 backdrop-blur-[22px] border border-glass/90 shadow-sm text-[13px] font-semibold text-ink hover:bg-glass transition-colors cursor-pointer"
            >
              Log out
            </button>
            <button
              type="button"
              onClick={openAddModal}
              aria-label="Add card"
              className="w-10 h-10 rounded-full bg-glass/75 backdrop-blur-[22px] border border-glass/90 shadow-sm flex items-center justify-center text-primary hover:bg-glass transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Website Header: "Your wallet" + "Add card" button */}
        <div className="hidden md:flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[32px] font-bold tracking-tight text-ink">
              Your wallet
            </h1>
            <p className="text-[15px] text-ink-muted mt-1">
              Manage your cards and nicknames. SwipeWise never asks for card
              numbers.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="h-[46px] px-6 rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[15px] shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add card</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-full aspect-[1.586] rounded-[14px] bg-glass/40 border border-glass/60"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="rounded-[22px] bg-glass/65 backdrop-blur-[22px] border border-glass/85 p-8 text-center max-w-md mx-auto shadow-sm">
            <p className="text-[15px] font-medium text-error mb-4">{error}</p>
            <button
              onClick={() => void fetchWallet()}
              className="h-[44px] px-6 rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[14px] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && walletCards.length === 0 && (
          <div className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/85 p-10 text-center max-w-lg mx-auto shadow-sm my-8">
            <div className="w-16 h-16 rounded-full bg-primary-tint flex items-center justify-center mx-auto text-primary mb-4">
              <PlusCircle className="w-8 h-8" />
            </div>
            <h2 className="text-[20px] font-bold text-ink mb-2">
              Your wallet is empty
            </h2>
            <p className="text-[15px] text-ink-muted mb-6">
              Add your first card to get started.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="h-[50px] px-8 rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[15px] shadow-xs transition-colors cursor-pointer"
            >
              Add a card
            </button>
          </div>
        )}

        {/* Populated Wallet State */}
        {!loading && !error && walletCards.length > 0 && (
          <div className="space-y-10">
            {/* Mobile Stacked View (under 768px) */}
            <div className="md:hidden space-y-4">
              <div className="relative pt-2 pb-6 flex flex-col gap-3">
                {walletCards.map((wc, idx) => {
                  const isExpanded = expandedCardId === wc.id;
                  return (
                    <div
                      key={wc.id}
                      className="rounded-[18px] bg-glass/65 backdrop-blur-[22px] border border-glass/85 p-4 shadow-sm transition-all"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCardId(isExpanded ? null : wc.id)
                        }
                        className="w-full text-left cursor-pointer focus:outline-hidden"
                      >
                        <CardArt
                          name={wc.card.name}
                          issuer={wc.card.issuer}
                          artColor={wc.card.artColor}
                          isDemo={wc.card.isDemo}
                          rateBadgeText={getBestCategoryLabel(wc.card)}
                        />
                      </button>

                      {/* Card meta summary */}
                      <div className="mt-3 flex items-center justify-between px-1 text-[13px]">
                        <div>
                          <p className="font-semibold text-ink">
                            {wc.nickname || wc.card.name}
                          </p>
                          {wc.nickname && (
                            <p className="text-ink-muted text-[11px]">
                              {wc.card.name}
                            </p>
                          )}
                          <div className="mt-0.5">
                            <WalletCardPaymentSummary card={wc} />
                          </div>
                        </div>
                        <span className="text-ink-muted text-[11px]">
                          {wc.openedDate
                            ? `Opened ${wc.openedDate}`
                            : `Card #${walletCards.length - idx}`}
                        </span>
                      </div>

                      <WalletCardRotatingCategories
                        card={wc}
                        onUpdated={(updated) =>
                          setWalletCards((prev) =>
                            prev.map((c) =>
                              c.id === updated.id ? updated : c,
                            ),
                          )
                        }
                      />

                      {/* Expanded actions and details */}
                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-ink-muted/15 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCard(wc);
                              setEditingNickname(wc.nickname || "");
                              setEditingNicknameError(null);
                            }}
                            className="flex-1 h-9 rounded-full bg-glass/80 border border-glass/90 text-ink text-[13px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs hover:bg-glass"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-primary" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCardToRemove(wc)}
                            className="flex-1 h-9 rounded-full bg-glass/80 border border-error/30 text-error text-[13px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs hover:bg-error/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Website View: 4-Column Grid + Details Table (768px and up) */}
            <div className="hidden md:block space-y-10">
              {/* 4-Column Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {walletCards.map((wc) => (
                  <div key={wc.id} className="flex flex-col group">
                    <CardArt
                      name={wc.card.name}
                      issuer={wc.card.issuer}
                      artColor={wc.card.artColor}
                      isDemo={wc.card.isDemo}
                      rateBadgeText={getBestCategoryLabel(wc.card)}
                    />
                    <div className="mt-2.5 px-1 flex items-baseline justify-between">
                      <div>
                        <p className="font-semibold text-[14px] text-ink truncate">
                          {wc.nickname || wc.card.name}
                        </p>
                        {wc.nickname && (
                          <p className="text-[12px] text-ink-muted truncate">
                            {wc.card.name}
                          </p>
                        )}
                        <div className="mt-0.5">
                          <WalletCardPaymentSummary card={wc} />
                        </div>
                      </div>
                      <span className="text-[12px] text-ink-muted shrink-0">
                        {wc.card.annualFeeCents === 0
                          ? "$0 fee"
                          : `${formatCents(wc.card.annualFeeCents)}/yr`}
                      </span>
                    </div>
                    <WalletCardRotatingCategories
                      card={wc}
                      onUpdated={(updated) =>
                        setWalletCards((prev) =>
                          prev.map((c) => (c.id === updated.id ? updated : c)),
                        )
                      }
                    />
                  </div>
                ))}

                {/* Dashed 'Add a card' tile */}
                <button
                  type="button"
                  onClick={openAddModal}
                  className="w-full aspect-[1.586] rounded-[14px] border-2 border-dashed border-ink-muted/30 hover:border-primary/60 bg-glass/30 hover:bg-glass/50 transition-colors flex flex-col items-center justify-center text-ink-muted hover:text-primary gap-2 cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-glass/80 border border-glass flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Plus className="w-5 h-5 text-primary stroke-[2.5]" />
                  </div>
                  <span className="text-[14px] font-semibold">Add a card</span>
                </button>
              </div>

              {/* Card Details Table */}
              <div className="rounded-[22px] bg-glass/65 backdrop-blur-[22px] border border-glass/85 p-6 shadow-xs">
                <h2 className="text-[20px] font-bold text-ink mb-4">
                  Card details
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr className="border-b border-ink-muted/15 text-[12px] font-semibold text-ink-muted uppercase tracking-wider">
                        <th className="py-3 px-4">Card</th>
                        <th className="py-3 px-4">Nickname</th>
                        <th className="py-3 px-4">Annual fee</th>
                        <th className="py-3 px-4">Best category</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-muted/10">
                      {walletCards.map((wc) => (
                        <tr
                          key={wc.id}
                          className="hover:bg-glass/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <CardArt
                                name={wc.card.name}
                                artColor={wc.card.artColor}
                                variant="thumbnail"
                              />
                              <div>
                                <p className="font-semibold text-ink">
                                  {wc.card.name}
                                </p>
                                <p className="text-[12px] text-ink-muted">
                                  {wc.card.issuer}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-ink-muted font-medium">
                            {wc.nickname || "—"}
                          </td>
                          <td className="py-3.5 px-4 tabular-nums text-ink">
                            {formatCents(wc.card.annualFeeCents)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary-tint/80 text-primary text-[12px] font-semibold">
                              {getBestCategoryLabel(wc.card)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCard(wc);
                                  setEditingNickname(wc.nickname || "");
                                  setEditingNicknameError(null);
                                }}
                                className="px-3 py-1.5 rounded-full bg-glass/80 hover:bg-glass border border-glass/90 text-[13px] font-semibold text-ink transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setCardToRemove(wc)}
                                className="px-3 py-1.5 rounded-full bg-glass/80 hover:bg-error/15 border border-error/30 text-[13px] font-semibold text-error transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Card Modal (Bottom Sheet on mobile, Centered Dialog on desktop) */}
      {isAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-card-title"
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink/30 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full md:max-w-xl max-h-[90vh] flex flex-col rounded-t-[34px] md:rounded-[28px] bg-glass/95 backdrop-blur-[24px] border border-glass/80 shadow-2xl overflow-hidden">
            {/* Sheet/Modal Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-ink-muted/15">
              <h2
                id="add-card-title"
                className="text-[20px] font-bold text-ink"
              >
                Add a card
              </h2>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-glass/70 flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sheet/Modal Content */}
            <form
              onSubmit={handleAddSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {/* Step 1: Catalog Card Search & Selection */}
              <div>
                <label
                  htmlFor="catalog-search"
                  className="block text-[13px] font-semibold text-ink mb-1.5"
                >
                  Choose a card from the catalog
                </label>
                <div className="relative mb-3">
                  <Search
                    aria-hidden="true"
                    className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <input
                    id="catalog-search"
                    type="search"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search cards (e.g. Mint Everyday, Harbor)..."
                    className="w-full h-10 pl-10 pr-4 rounded-full bg-glass/80 border border-glass/90 text-[14px] text-ink placeholder:text-ink-muted/60 focus:outline-2 focus:outline-primary"
                  />
                </div>

                {/* Catalog Card Options List */}
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {filteredCatalogCards.length === 0 ? (
                    <p className="text-[13px] text-ink-muted py-3 text-center">
                      No cards found in catalog.
                    </p>
                  ) : (
                    filteredCatalogCards.map((card) => {
                      const isSelected = selectedCatalogCard?.id === card.id;
                      return (
                        <div
                          key={card.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedCatalogCard(card)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedCatalogCard(card);
                            }
                          }}
                          className={`flex items-center justify-between p-3 rounded-[16px] cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-primary-tint/80 border-primary shadow-xs"
                              : "bg-glass/60 border-glass/80 hover:bg-glass/85"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <CardArt
                              name={card.name}
                              artColor={card.artColor}
                              variant="thumbnail"
                            />
                            <div>
                              <p className="font-semibold text-[14px] text-ink">
                                {card.name}
                              </p>
                              <p className="text-[12px] text-ink-muted">
                                {card.issuer} · {getBestCategoryLabel(card)}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Step 2: Optional Nickname */}
              <div>
                <label
                  htmlFor="card-nickname"
                  className="block text-[13px] font-semibold text-ink mb-1"
                >
                  Nickname{" "}
                  <span className="font-normal text-ink-muted">(optional)</span>
                </label>
                <input
                  id="card-nickname"
                  type="text"
                  value={newNickname}
                  onChange={handleNewNicknameChange}
                  placeholder="e.g. Everyday Groceries"
                  className="w-full h-11 px-4 rounded-xl bg-glass/80 border border-glass/90 text-[14px] text-ink placeholder:text-ink-muted/60 focus:outline-2 focus:outline-primary"
                />
                {newNicknameError && (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="text-[12px] text-error mt-1"
                  >
                    {newNicknameError}
                  </p>
                )}
              </div>

              {/* Step 3: Optional Open Date */}
              <div>
                <label
                  htmlFor="card-open-date"
                  className="block text-[13px] font-semibold text-ink mb-1"
                >
                  Account open date{" "}
                  <span className="font-normal text-ink-muted">(optional)</span>
                </label>
                <input
                  id="card-open-date"
                  type="date"
                  value={newOpenedDate}
                  onChange={(e) => setNewOpenedDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-glass/80 border border-glass/90 text-[14px] text-ink focus:outline-2 focus:outline-primary"
                />
              </div>

              {/* Footer actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-5 h-11 rounded-full bg-glass/80 hover:bg-glass text-[14px] font-semibold text-ink-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedCatalogCard || isSubmittingAdd}
                  className="px-7 h-11 rounded-full bg-primary hover:bg-primary-pressed disabled:opacity-50 text-[14px] font-semibold text-on-primary transition-colors cursor-pointer shadow-xs"
                >
                  {isSubmittingAdd ? "Adding…" : "Add to wallet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Nickname Modal Dialog */}
      {editingCard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-nickname-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-[24px] bg-glass/95 backdrop-blur-[24px] border border-glass/80 p-6 shadow-2xl">
            <h2
              id="edit-nickname-title"
              className="text-[18px] font-bold text-ink mb-1"
            >
              Rename card
            </h2>
            <p className="text-[13px] text-ink-muted mb-4">
              Set a nickname for {editingCard.card.name}.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="edit-nickname-input"
                  className="block text-[13px] font-semibold text-ink mb-1"
                >
                  Nickname
                </label>
                <input
                  id="edit-nickname-input"
                  type="text"
                  value={editingNickname}
                  onChange={handleEditingNicknameChange}
                  placeholder="e.g. My Primary Card"
                  className="w-full h-11 px-4 rounded-xl bg-glass/80 border border-glass/90 text-[14px] text-ink placeholder:text-ink-muted/60 focus:outline-2 focus:outline-primary"
                />
                {editingNicknameError && (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="text-[12px] text-error mt-1"
                  >
                    {editingNicknameError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-4 h-10 rounded-full bg-glass/80 hover:bg-glass text-[14px] font-semibold text-ink-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-6 h-10 rounded-full bg-primary hover:bg-primary-pressed disabled:opacity-50 text-[14px] font-semibold text-on-primary transition-colors cursor-pointer shadow-xs"
                >
                  {isSubmittingEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </form>

            <WalletCardPaymentForm
              card={editingCard}
              onUpdated={(updated) => {
                setWalletCards((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c)),
                );
                setEditingCard(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Remove Card Confirmation Dialog */}
      {cardToRemove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-card-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-[24px] bg-glass/95 backdrop-blur-[24px] border border-glass/80 p-6 shadow-2xl">
            <h2
              id="remove-card-title"
              className="text-[18px] font-bold text-ink mb-2"
            >
              Remove {cardToRemove.card.name} from your wallet?
            </h2>
            <p className="text-[14px] text-ink-muted mb-6">
              You can add it back from the catalog at any time.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCardToRemove(null)}
                className="px-5 h-10 rounded-full bg-glass/80 hover:bg-glass text-[14px] font-semibold text-ink-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isSubmittingRemove}
                className="px-6 h-10 rounded-full bg-error hover:bg-error/90 disabled:opacity-50 text-[14px] font-semibold text-white transition-colors cursor-pointer shadow-xs"
              >
                {isSubmittingRemove ? "Removing…" : "Remove"}
              </button>
            </div>
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
          className="flex flex-col items-center justify-center px-5 py-1.5 rounded-full text-ink-muted hover:text-ink font-medium text-[11px]"
        >
          <HomeIcon className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Home</span>
        </Link>
        <Link
          to="/wallet"
          className="flex flex-col items-center justify-center px-5 py-1.5 rounded-full bg-glass/90 text-primary font-medium text-[11px] shadow-2xs"
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
          className="flex flex-col items-center justify-center px-5 py-1.5 rounded-full text-ink-muted hover:text-ink font-medium text-[11px]"
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
