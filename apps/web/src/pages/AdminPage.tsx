import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CreditCard, Shield, Plus, X, AlertTriangle } from "lucide-react";
import {
  formatCents,
  parseDollarsToCents,
  isCardNumber,
} from "@swipewise/shared";
import { apiFetch } from "../api.js";
import { CardArt } from "../components/CardArt.js";

interface AdminCard {
  id: string;
  name: string;
  issuer: string;
  artColor: string;
  isDemo: boolean;
  annualFeeCents: number;
  baseRateX100: number;
  isRetired: boolean;
  program: {
    id: string;
    name: string;
    centsPer100Points: number;
  };
  rewardRules: Array<{
    id: string;
    category: "GROCERIES" | "DINING" | "GAS" | "TRAVEL";
    rateX100: number;
    capCents: number | null;
  }>;
  perks: Array<{
    id: string;
    name: string;
    amountCents: number;
    period: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
  }>;
  bonusOffer: {
    id: string;
    spendRequirementCents: number;
    windowMonths: number;
    bonusPoints: number;
  } | null;
}

interface AdminStore {
  id: string;
  name: string;
  category: "GROCERIES" | "DINING" | "GAS" | "TRAVEL";
  aliases: Array<{
    id: string;
    alias: string;
  }>;
}

interface AdminAuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  createdAt: string;
}

type TabKey = "cards" | "stores" | "audit";

const NO_CARD_NUMBER_ERR =
  "Don't enter card numbers. SwipeWise only needs the card name.";

export function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("cards");

  const [cards, setCards] = useState<AdminCard[]>([]);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [storeToEdit, setStoreToEdit] = useState<AdminStore | null>(null);

  // Form states
  const [cardName, setCardName] = useState("");
  const [cardIssuer, setCardIssuer] = useState("");
  const [cardArtColor, setCardArtColor] = useState("#2F7D4F");
  const [cardFeeDollars, setCardFeeDollars] = useState("0");
  const [cardBaseRate, setCardBaseRate] = useState("1");
  const [cardProgramId, setCardProgramId] = useState("");
  const [cardFormError, setCardFormError] = useState<string | null>(null);
  const [cardSubmitting, setCardSubmitting] = useState(false);

  // Store form states
  const [storeName, setStoreName] = useState("");
  const [storeCategory, setStoreCategory] = useState<
    "GROCERIES" | "DINING" | "GAS" | "TRAVEL"
  >("GROCERIES");
  const [storeAliases, setStoreAliases] = useState("");
  const [storeFormError, setStoreFormError] = useState<string | null>(null);
  const [storeSubmitting, setStoreSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [cardsRes, storesRes, auditRes] = await Promise.all([
        apiFetch("/api/v1/admin/cards"),
        apiFetch("/api/v1/admin/stores"),
        apiFetch("/api/v1/admin/audit-logs"),
      ]);

      if (!cardsRes.ok || !storesRes.ok || !auditRes.ok) {
        throw new Error("Failed to load admin data.");
      }

      const cardsData = (await cardsRes.json()) as { cards: AdminCard[] };
      const storesData = (await storesRes.json()) as { stores: AdminStore[] };
      const auditData = (await auditRes.json()) as {
        auditLogs: AdminAuditLog[];
      };

      setCards(cardsData.cards || []);
      setStores(storesData.stores || []);
      setAuditLogs(auditData.auditLogs || []);

      if (cardsData.cards?.[0]?.program?.id) {
        setCardProgramId(cardsData.cards[0].program.id);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleLogout() {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      navigate("/login");
    }
  }

  async function handleRetireCard(cardId: string) {
    try {
      const res = await apiFetch(`/api/v1/admin/cards/${cardId}/retire`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        alert(body?.error?.message || "Failed to retire card.");
        return;
      }
      await loadData();
    } catch {
      alert("Failed to retire card.");
    }
  }

  async function handleCreateCard(e: React.FormEvent) {
    e.preventDefault();
    setCardFormError(null);

    if (isCardNumber(cardName) || isCardNumber(cardIssuer)) {
      setCardFormError(NO_CARD_NUMBER_ERR);
      return;
    }

    if (!cardName.trim() || !cardIssuer.trim()) {
      setCardFormError("Please fill in card name and issuer.");
      return;
    }

    let programId = cardProgramId;
    if (!programId && cards[0]?.program?.id) {
      programId = cards[0].program.id;
    }

    if (!programId) {
      setCardFormError("No rewards program available.");
      return;
    }

    setCardSubmitting(true);
    try {
      const annualFeeCents = parseDollarsToCents(cardFeeDollars);
      const baseRateX100 = Math.round(parseFloat(cardBaseRate || "1") * 100);

      const res = await apiFetch("/api/v1/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cardName.trim(),
          issuer: cardIssuer.trim(),
          artColor: cardArtColor,
          isDemo: true,
          annualFeeCents,
          baseRateX100,
          programId,
          rewardRules: [],
          perks: [],
          bonusOffer: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setCardFormError(data?.error?.message || "Failed to create card.");
        return;
      }

      setShowAddCardModal(false);
      setCardName("");
      setCardIssuer("");
      setCardFeeDollars("0");
      setCardBaseRate("1");
      await loadData();
    } catch {
      setCardFormError("Something went wrong. Try again.");
    } finally {
      setCardSubmitting(false);
    }
  }

  async function handleSaveStore(e: React.FormEvent) {
    e.preventDefault();
    setStoreFormError(null);

    const aliases = storeAliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    if (isCardNumber(storeName) || aliases.some((a) => isCardNumber(a))) {
      setStoreFormError(NO_CARD_NUMBER_ERR);
      return;
    }

    if (!storeName.trim()) {
      setStoreFormError("Please enter a store name.");
      return;
    }

    setStoreSubmitting(true);
    try {
      const url = storeToEdit
        ? `/api/v1/admin/stores/${storeToEdit.id}`
        : "/api/v1/admin/stores";
      const method = storeToEdit ? "PATCH" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storeName.trim(),
          category: storeCategory,
          aliases,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setStoreFormError(data?.error?.message || "Failed to save store.");
        return;
      }

      setShowAddStoreModal(false);
      setStoreToEdit(null);
      setStoreName("");
      setStoreAliases("");
      await loadData();
    } catch {
      setStoreFormError("Something went wrong. Try again.");
    } finally {
      setStoreSubmitting(false);
    }
  }

  function openEditStore(store: AdminStore) {
    setStoreToEdit(store);
    setStoreName(store.name);
    setStoreCategory(store.category);
    setStoreAliases(store.aliases.map((a) => a.alias).join(", "));
    setStoreFormError(null);
    setShowAddStoreModal(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background-deep text-ink flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full h-16 bg-glass/65 backdrop-blur-[22px] border-b border-glass/80 px-6 lg:px-12 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-primary flex items-center justify-center text-on-primary shadow-xs">
              <CreditCard className="w-4 h-4" aria-hidden="true" />
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
              className="py-5 text-[15px] font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Tracker
            </Link>
            <Link
              to="/alerts"
              className="py-5 text-[15px] font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Alerts
            </Link>
            <Link
              to="/admin"
              className="py-5 text-[15px] font-semibold text-ink border-b-[2.5px] border-primary"
            >
              Admin
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[30px] font-bold tracking-tight text-ink flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" aria-hidden="true" />
              Admin
            </h1>
            <p className="text-ink-muted text-[15px] mt-1">
              Manage card catalog, stores, and inspect the transactional audit
              log.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 bg-glass/40 border border-glass/60 rounded-full w-fit mb-8">
          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={`px-5 py-2 rounded-full text-[14px] font-semibold transition-all ${
              activeTab === "cards"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stores")}
            className={`px-5 py-2 rounded-full text-[14px] font-semibold transition-all ${
              activeTab === "stores"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Stores
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-5 py-2 rounded-full text-[14px] font-semibold transition-all ${
              activeTab === "audit"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Audit Log
          </button>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-16 rounded-2xl bg-glass/60 border border-glass/80 animate-pulse"
              />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="p-8 rounded-3xl bg-glass/65 border border-glass/80 text-center">
            <AlertTriangle className="w-10 h-10 text-error mx-auto mb-3" />
            <p className="text-[15px] font-medium text-ink mb-4">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="px-6 h-10 rounded-full bg-primary text-on-primary font-semibold text-[14px] hover:bg-primary-pressed transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Cards Tab */}
        {!loading && !error && activeTab === "cards" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-semibold text-ink">
                  Catalog cards
                </h2>
                <p className="text-ink-muted text-[13px]">
                  Cards available for users to add to their wallet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCardFormError(null);
                  setShowAddCardModal(true);
                }}
                className="px-5 h-10 rounded-full bg-primary text-on-primary font-semibold text-[14px] hover:bg-primary-pressed transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add card
              </button>
            </div>

            <div className="bg-glass/65 backdrop-blur-[22px] border border-glass/80 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-glass/80 bg-glass/30 text-ink-muted font-medium text-[12px]">
                    <th className="py-3 px-4">Card</th>
                    <th className="py-3 px-4">Issuer</th>
                    <th className="py-3 px-4">Annual fee</th>
                    <th className="py-3 px-4">Base rate</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass/60 text-ink">
                  {cards.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-glass/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold">
                        <div className="flex items-center gap-3">
                          <CardArt
                            name={c.name}
                            artColor={c.artColor}
                            variant="thumbnail"
                          />
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-ink-muted">{c.issuer}</td>
                      <td className="py-3.5 px-4 tabular-nums">
                        {formatCents(c.annualFeeCents)}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums">
                        {c.baseRateX100 / 100}%
                      </td>
                      <td className="py-3.5 px-4">
                        {c.isRetired ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ink-muted/15 text-ink-muted text-[11px] font-medium">
                            No longer updated
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-tint text-primary text-[11px] font-semibold">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!c.isRetired && (
                          <button
                            type="button"
                            onClick={() => handleRetireCard(c.id)}
                            className="px-3 py-1 rounded-full bg-glass border border-glass/80 text-[12px] font-medium text-error hover:bg-error/10 transition-colors cursor-pointer"
                          >
                            Retire
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {cards.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-ink-muted"
                      >
                        No cards found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stores Tab */}
        {!loading && !error && activeTab === "stores" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-semibold text-ink">
                  Stores & aliases
                </h2>
                <p className="text-ink-muted text-[13px]">
                  Configured merchants and category mappings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStoreToEdit(null);
                  setStoreName("");
                  setStoreAliases("");
                  setStoreCategory("GROCERIES");
                  setStoreFormError(null);
                  setShowAddStoreModal(true);
                }}
                className="px-5 h-10 rounded-full bg-primary text-on-primary font-semibold text-[14px] hover:bg-primary-pressed transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add store
              </button>
            </div>

            <div className="bg-glass/65 backdrop-blur-[22px] border border-glass/80 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-glass/80 bg-glass/30 text-ink-muted font-medium text-[12px]">
                    <th className="py-3 px-4">Store name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Aliases</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass/60 text-ink">
                  {stores.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-glass/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold">{s.name}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-tint/80 text-primary text-[11px] font-semibold">
                          {s.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {s.aliases.map((a) => (
                            <span
                              key={a.id}
                              className="px-2 py-0.5 rounded-md bg-glass/80 border border-glass/60 text-[11px] text-ink-muted"
                            >
                              {a.alias}
                            </span>
                          ))}
                          {s.aliases.length === 0 && (
                            <span className="text-ink-muted text-[12px]">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditStore(s)}
                          className="px-3 py-1 rounded-full bg-glass border border-glass/80 text-[12px] font-medium text-ink hover:bg-glass/90 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {stores.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-ink-muted"
                      >
                        No stores found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {!loading && !error && activeTab === "audit" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[20px] font-semibold text-ink">Audit log</h2>
              <p className="text-ink-muted text-[13px]">
                Every administrative change is recorded in an immutable audit
                trail.
              </p>
            </div>

            <div className="bg-glass/65 backdrop-blur-[22px] border border-glass/80 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-glass/80 bg-glass/30 text-ink-muted font-medium text-[11px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Admin</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass/60 text-ink">
                  {auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-glass/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-medium">
                        {log.userEmail}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-tint text-primary text-[11px] font-semibold font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-ink-muted font-mono text-[11px]">
                        {log.entityType} ({log.entityId.slice(0, 8)}…)
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="max-w-md text-[11px] font-mono text-ink-muted truncate">
                          {log.after
                            ? (log.after.name as string) ||
                              JSON.stringify(log.after)
                            : "—"}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-ink-muted"
                      >
                        No audit log entries recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg p-6 bg-glass/95 backdrop-blur-[24px] border border-glass/80 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-bold text-ink">Add card</h3>
              <button
                type="button"
                onClick={() => setShowAddCardModal(false)}
                className="w-8 h-8 rounded-full bg-glass flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cardFormError && (
              <p
                role="alert"
                aria-live="polite"
                className="text-[12px] text-error font-medium"
              >
                {cardFormError}
              </p>
            )}

            <form onSubmit={handleCreateCard} className="space-y-4 text-[14px]">
              <div>
                <label className="block text-[12px] font-semibold text-ink-muted mb-1">
                  Card name
                </label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="e.g. Sapphire Preferred Demo"
                  className="w-full h-10 px-3.5 rounded-xl bg-glass border border-glass/80 text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-muted mb-1">
                    Issuer
                  </label>
                  <input
                    type="text"
                    value={cardIssuer}
                    onChange={(e) => setCardIssuer(e.target.value)}
                    placeholder="e.g. Chase Demo"
                    className="w-full h-10 px-3.5 rounded-xl bg-glass border border-glass/80 text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-muted mb-1">
                    Art color
                  </label>
                  <input
                    type="text"
                    value={cardArtColor}
                    onChange={(e) => setCardArtColor(e.target.value)}
                    placeholder="#2F7D4F"
                    className="w-full h-10 px-3.5 rounded-xl bg-glass border border-glass/80 text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/40 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-muted mb-1">
                    Annual fee ($)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={cardFeeDollars}
                    onChange={(e) => setCardFeeDollars(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-glass border border-glass/80 text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-muted mb-1">
                    Base rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={cardBaseRate}
                    onChange={(e) => setCardBaseRate(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-glass border border-glass/80 text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCardModal(false)}
                  className="px-4 h-10 rounded-full bg-glass border border-glass/80 text-ink font-medium hover:bg-glass/90"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cardSubmitting}
                  className="px-6 h-10 rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-pressed transition-colors cursor-pointer disabled:opacity-50"
                >
                  {cardSubmitting ? "Creating…" : "Save card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Store Modal */}
      {showAddStoreModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-xs"
        >
          <div className="w-full max-w-md p-6 bg-glass/95 backdrop-blur-[24px] border border-glass/80 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-bold text-ink">
                {storeToEdit ? "Edit store" : "Add store"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStoreModal(false)}
                className="w-8 h-8 rounded-full bg-glass flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {storeFormError && (
              <p
                role="alert"
                aria-live="polite"
                className="text-[12px] text-error font-medium"
              >
                {storeFormError}
              </p>
            )}

            <form onSubmit={handleSaveStore} className="space-y-4 text-[14px]">
              <div>
                <label className="block text-[12px] font-semibold text-ink-muted mb-1">
                  Store name
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Trader Joe Demo"
                  className="w-full h-10 px-3.5 rounded-xl bg-glass border border-glass/80 text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-ink-muted mb-1">
                  Category
                </label>
                <select
                  value={storeCategory}
                  onChange={(e) =>
                    setStoreCategory(
                      e.target.value as
                        | "GROCERIES"
                        | "DINING"
                        | "GAS"
                        | "TRAVEL",
                    )
                  }
                  className="w-full h-10 px-3.5 rounded-xl bg-glass border border-glass/80 text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                >
                  <option value="GROCERIES">Groceries</option>
                  <option value="DINING">Dining</option>
                  <option value="GAS">Gas</option>
                  <option value="TRAVEL">Travel</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-ink-muted mb-1">
                  Aliases (comma-separated)
                </label>
                <input
                  type="text"
                  value={storeAliases}
                  onChange={(e) => setStoreAliases(e.target.value)}
                  placeholder="e.g. TJ Demo, Trader Joes Demo"
                  className="w-full h-10 px-3.5 rounded-xl bg-glass border border-glass/80 text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStoreModal(false)}
                  className="px-4 h-10 rounded-full bg-glass border border-glass/80 text-ink font-medium hover:bg-glass/90"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={storeSubmitting}
                  className="px-6 h-10 rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-pressed transition-colors cursor-pointer disabled:opacity-50"
                >
                  {storeSubmitting ? "Saving…" : "Save store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
