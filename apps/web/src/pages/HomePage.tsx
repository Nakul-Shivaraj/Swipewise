import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  CategoryName,
  DEFAULT_PURCHASE_AMOUNT_CENTS,
  MAX_PURCHASE_AMOUNT_CENTS,
  MIN_PURCHASE_AMOUNT_CENTS,
  RecommendationsResponse,
  StoreSearchResponse,
  StoreSearchResult,
  formatCents,
  isCardNumber,
  parseDollarsToCents,
} from "@swipewise/shared";
import {
  Bell,
  BarChart3,
  CreditCard,
  Home as HomeIcon,
  Search,
  Wallet as WalletIcon,
} from "lucide-react";
import { LiquidIcon } from "../components/LiquidIcon.js";
import { CardArt } from "../components/CardArt.js";
import { BestCardRow, formatCardRateLabel } from "../components/BestCardRow.js";
import { apiFetch } from "../api.js";

interface CategoryOption {
  id: CategoryName;
  label: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: "GROCERIES", label: "Groceries" },
  { id: "DINING", label: "Dining" },
  { id: "GAS", label: "Gas" },
  { id: "TRAVEL", label: "Travel" },
];

export function HomePage() {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suppressNextSearchRef = useRef(false);

  const [storeQuery, setStoreQuery] = useState("");
  const [storeSuggestions, setStoreSuggestions] = useState<StoreSearchResult[]>(
    [],
  );
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [hasSearchedStores, setHasSearchedStores] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreSearchResult | null>(
    null,
  );
  const [amountInput, setAmountInput] = useState("100");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryName | null>(
    null,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendationsResponse | null>(null);

  const resolveValidAmountCents = useCallback(
    (rawAmount: string): number | null => {
      if (isCardNumber(rawAmount)) {
        return null;
      }
      const parsed = parseDollarsToCents(rawAmount);
      if (
        parsed === null ||
        parsed < MIN_PURCHASE_AMOUNT_CENTS ||
        parsed > MAX_PURCHASE_AMOUNT_CENTS
      ) {
        return null;
      }
      return parsed;
    },
    [],
  );

  const fetchRecommendations = useCallback(
    async (category: CategoryName, amountCents: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/recommendations?category=${category}&amountCents=${amountCents}`,
        );
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          setError(
            errBody.error?.message || "Something went wrong. Try again.",
          );
          return;
        }
        const json = (await res.json()) as RecommendationsResponse;
        setData(json);
      } catch {
        setError("Something went wrong. Try again.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounced store search (250ms, triggers after 2 characters)
  useEffect(() => {
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }

    const trimmed = storeQuery.trim();
    if (trimmed.length < 2 || isCardNumber(storeQuery)) {
      setStoreSuggestions([]);
      setIsSuggestionsOpen(false);
      setHasSearchedStores(false);
      return;
    }

    let isCancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/stores/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (isCancelled || !res.ok) {
          return;
        }
        const json = (await res.json()) as StoreSearchResponse;
        if (isCancelled) {
          return;
        }
        const stores = json.stores ?? [];
        setStoreSuggestions(stores);
        setHasSearchedStores(true);

        if (stores.length === 0) {
          setIsSuggestionsOpen(false);
          setSelectedStore(null);
          return;
        }

        const lowerQuery = trimmed.toLowerCase();
        const exactMatch =
          stores.find(
            (s) =>
              s.name.toLowerCase() === lowerQuery ||
              s.aliases.some((a) => a.toLowerCase() === lowerQuery),
          ) ?? (stores.length === 1 ? stores[0]! : null);

        if (exactMatch) {
          setSelectedStore(exactMatch);
          setSelectedCategory(exactMatch.category);
        }
        setIsSuggestionsOpen(true);
      } catch {
        // Ignore transient search errors; manual category selection remains available
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [storeQuery]);

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }
    const validCents = resolveValidAmountCents(amountInput);
    if (validCents === null) {
      return;
    }
    void fetchRecommendations(selectedCategory, validCents);
  }, [
    selectedCategory,
    amountInput,
    resolveValidAmountCents,
    fetchRecommendations,
  ]);

  // Keyboard shortcuts: '/' focuses store search, 'Esc' closes active results sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "/" && !isEditable) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setIsSuggestionsOpen(false);
        setSelectedCategory(null);
        setSelectedStore(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectStore = (store: StoreSearchResult) => {
    if (storeQuery !== store.name) {
      suppressNextSearchRef.current = true;
    }
    setSelectedStore(store);
    setSelectedCategory(store.category);
    setStoreQuery(store.name);
    setIsSuggestionsOpen(false);
  };

  const handleSelectCategory = (category: CategoryName) => {
    setSelectedStore(null);
    setSelectedCategory(category);
    setIsSuggestionsOpen(false);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmountInput(val);

    if (isCardNumber(val)) {
      setAmountError(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      );
      return;
    }

    const cents = parseDollarsToCents(val);
    if (
      cents === null ||
      cents < MIN_PURCHASE_AMOUNT_CENTS ||
      cents > MAX_PURCHASE_AMOUNT_CENTS
    ) {
      setAmountError("Enter an amount between $0.01 and $1,000,000.00.");
    } else {
      setAmountError(null);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      navigate("/login");
    }
  };

  const activeCategoryLabel =
    CATEGORY_OPTIONS.find((c) => c.id === selectedCategory)?.label ?? "";
  const activeTargetLabel = selectedStore?.name ?? activeCategoryLabel;
  const activeAmountCents =
    resolveValidAmountCents(amountInput) ?? DEFAULT_PURCHASE_AMOUNT_CENTS;
  const formattedPurchaseAmount = formatCents(activeAmountCents);
  const bestCard = data?.rankedCards[0] ?? null;

  const hasCardNumberInSearch = isCardNumber(storeQuery);
  const hasNoStoreMatch =
    !hasCardNumberInSearch &&
    storeQuery.trim().length >= 2 &&
    hasSearchedStores &&
    storeSuggestions.length === 0;

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
              className="py-5 text-[15px] font-semibold text-ink border-b-[2.5px] border-primary"
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
            <span className="py-5 text-[15px] font-medium text-ink-muted/70 cursor-default">
              Alerts
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Alerts"
            className="w-10 h-10 rounded-full bg-glass/60 border border-glass/80 flex items-center justify-center text-ink-muted hover:text-ink transition-colors"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 h-9 rounded-full bg-glass/65 border border-glass/80 text-[13px] font-semibold text-ink hover:bg-glass/90 transition-colors cursor-pointer"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 w-full max-w-[1120px] mx-auto px-4 md:px-8 pt-6 md:pt-12 pb-8">
        {/* Hero / Search + Category Selector */}
        <section className="max-w-2xl mx-auto text-left md:text-center">
          {/* Mobile large title */}
          <div className="md:hidden flex items-center justify-between mb-4">
            <h1 className="text-[30px] font-bold tracking-tight text-ink leading-[1.15]">
              Pay smarter
            </h1>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 h-9 rounded-full bg-glass/65 backdrop-blur-[22px] border border-glass/80 text-[13px] font-semibold text-ink hover:bg-glass/90 transition-colors cursor-pointer"
            >
              Log out
            </button>
          </div>

          {/* Website hero title */}
          <div className="hidden md:block mb-6">
            <p className="text-[13px] font-medium text-ink-muted mb-1">
              Every swipe, the right card
            </p>
            <h1 className="text-[40px] lg:text-[44px] font-bold tracking-tight text-ink leading-[1.15]">
              Which card should you use?
            </h1>
          </div>

          {/* Search bar & Purchase Amount row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <label htmlFor="store-search" className="sr-only">
                Search a store
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2"
              />
              <input
                ref={searchInputRef}
                id="store-search"
                type="search"
                value={storeQuery}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setStoreQuery(nextVal);
                  if (
                    selectedStore &&
                    nextVal.trim().toLowerCase() !==
                      selectedStore.name.toLowerCase()
                  ) {
                    setSelectedStore(null);
                  }
                }}
                placeholder="Safeway"
                className="w-full h-[44px] pl-10 pr-28 rounded-full bg-glass/65 backdrop-blur-[22px] border border-glass/85 shadow-xs text-[15px] text-ink placeholder:text-ink-muted/70 focus:outline-2 focus:outline-primary"
              />
              <span
                aria-hidden="true"
                className="hidden md:inline-block pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-muted"
              >
                Press / to search
              </span>

              {isSuggestionsOpen && storeSuggestions.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="Store suggestions"
                  className="absolute left-0 right-0 top-[50px] z-30 rounded-[22px] bg-glass/95 backdrop-blur-[22px] border border-glass/85 shadow-lg divide-y divide-ink-muted/15 overflow-hidden text-left"
                >
                  {storeSuggestions.map((store) => {
                    const catLabel =
                      CATEGORY_OPTIONS.find((c) => c.id === store.category)
                        ?.label ?? store.category;
                    return (
                      <li
                        key={store.id}
                        role="option"
                        aria-selected={selectedStore?.id === store.id}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectStore(store)}
                          className="w-full px-4 py-2.5 flex items-center justify-between text-[15px] text-ink hover:bg-primary-tint/50 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold">{store.name}</span>
                          <span className="text-[13px] font-medium text-primary">
                            {catLabel}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Purchase amount pill */}
            <div className="flex items-center gap-2 px-4 h-[44px] rounded-full bg-glass/65 backdrop-blur-[22px] border border-glass/85 shadow-xs shrink-0">
              <label
                htmlFor="purchase-amount"
                className="text-[13px] font-medium text-ink-muted whitespace-nowrap"
              >
                Purchase amount
              </label>
              <div className="flex items-center">
                <span className="text-[15px] font-semibold text-ink mr-0.5">
                  $
                </span>
                <input
                  id="purchase-amount"
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={handleAmountChange}
                  aria-invalid={!!amountError}
                  aria-describedby={
                    amountError ? "purchase-amount-error" : undefined
                  }
                  className="w-20 bg-transparent text-[15px] font-semibold text-ink tabular-nums focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Validation / Store lookup feedback */}
          {hasCardNumberInSearch && (
            <p
              role="alert"
              aria-live="polite"
              className="mt-2 text-[13px] font-medium text-error"
            >
              Don&apos;t enter card numbers. SwipeWise only needs the card name.
            </p>
          )}

          {hasNoStoreMatch && (
            <p
              role="status"
              aria-live="polite"
              className="mt-2 text-[13px] font-medium text-ink-muted"
            >
              We don&apos;t know this store yet. Pick a category.
            </p>
          )}

          {amountError && (
            <p
              id="purchase-amount-error"
              role="alert"
              aria-live="polite"
              className="mt-2 text-[13px] font-medium text-error"
            >
              {amountError}
            </p>
          )}

          {/* Category selectors */}
          <div
            role="group"
            aria-label="Categories"
            className="mt-5 grid grid-cols-4 gap-3 md:flex md:items-center md:justify-center md:gap-3"
          >
            {CATEGORY_OPTIONS.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`group flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-2.5 md:px-4 md:py-2 md:rounded-full transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isSelected
                      ? "md:bg-glass/90 md:ring-2 md:ring-primary md:shadow-xs"
                      : "md:bg-glass/55 md:border md:border-glass/80 md:hover:bg-glass/80"
                  }`}
                >
                  <div className="md:hidden">
                    <LiquidIcon
                      category={cat.id}
                      size="home"
                      selected={isSelected}
                    />
                  </div>
                  <div className="hidden md:block">
                    <LiquidIcon
                      category={cat.id}
                      size="row"
                      selected={isSelected}
                    />
                  </div>
                  <span
                    className={`text-[13px] md:text-[15px] ${
                      isSelected
                        ? "font-bold text-ink"
                        : "font-medium text-ink-muted group-hover:text-ink"
                    }`}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Results Section */}
        <section aria-live="polite" className="mt-8 md:mt-10 max-w-4xl mx-auto">
          {!selectedCategory && (
            <div className="rounded-[22px] bg-glass/45 backdrop-blur-[22px] border border-glass/80 p-8 text-center shadow-xs">
              <p className="text-[15px] font-medium text-ink-muted">
                Search a store or pick a category.
              </p>
            </div>
          )}

          {selectedCategory && loading && (
            <div
              role="status"
              aria-label="Loading card recommendations"
              className="rounded-[22px] bg-glass/55 backdrop-blur-[22px] border border-glass/80 p-6 space-y-3 animate-pulse"
            >
              <div className="h-5 w-48 bg-ink-muted/20 rounded-md" />
              <div className="h-14 w-full bg-primary-tint/60 rounded-[16px]" />
              <div className="h-12 w-full bg-ink-muted/15 rounded-[16px]" />
              <div className="h-12 w-full bg-ink-muted/15 rounded-[16px]" />
            </div>
          )}

          {selectedCategory && !loading && error && (
            <div
              role="alert"
              className="rounded-[22px] bg-glass/60 backdrop-blur-[22px] border border-glass/85 p-6 text-center space-y-4 shadow-xs"
            >
              <p className="text-[15px] font-medium text-error">{error}</p>
              <button
                type="button"
                onClick={() =>
                  void fetchRecommendations(selectedCategory, activeAmountCents)
                }
                className="h-[50px] px-8 rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[15px] transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {selectedCategory && !loading && !error && data?.isEmptyWallet && (
            <div className="rounded-[34px] md:rounded-[22px] bg-glass/60 backdrop-blur-[22px] border border-glass/85 p-8 text-center space-y-4 shadow-sm">
              <div className="w-10 h-1.5 rounded-full bg-ink-muted/25 mx-auto mb-2 md:hidden" />
              <p className="text-[17px] font-semibold text-ink">
                Add cards to see your best pick
              </p>
              <p className="text-[13px] text-ink-muted max-w-sm mx-auto">
                Once you add cards to your wallet, SwipeWise ranks them by
                dollar reward for every category.
              </p>
              <div className="pt-1">
                <Link
                  to="/wallet"
                  className="inline-flex items-center justify-center h-[50px] px-8 rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold text-[15px] shadow-xs transition-colors"
                >
                  Go to Wallet
                </Link>
              </div>
            </div>
          )}

          {selectedCategory &&
            !loading &&
            !error &&
            data &&
            !data.isEmptyWallet &&
            data.rankedCards.length > 0 && (
              <>
                {/* Mobile Bottom Sheet view (under 768px) */}
                <div className="md:hidden rounded-[34px] bg-glass/65 backdrop-blur-[22px] border border-glass/85 p-4 shadow-lg">
                  <div
                    aria-hidden="true"
                    className="w-10 h-1.5 rounded-full bg-ink-muted/30 mx-auto mb-3"
                  />
                  <div className="flex items-baseline justify-between mb-3 px-1">
                    <h2 className="text-[17px] font-semibold text-ink">
                      Your cards at {activeTargetLabel}
                    </h2>
                    <span className="text-[13px] text-ink-muted tabular-nums">
                      on {formattedPurchaseAmount}
                    </span>
                  </div>

                  <div className="space-y-1.5 divide-y divide-ink-muted/10">
                    {data.rankedCards.map((card) => (
                      <BestCardRow
                        key={card.walletCardId}
                        card={card}
                        category={selectedCategory}
                      />
                    ))}
                  </div>
                </div>

                {/* Website Two-Column Results (768px and up) */}
                <div className="hidden md:grid md:grid-cols-12 md:gap-8 items-start">
                  {/* Left: Best Card Art & Hero Amount */}
                  {bestCard && (
                    <div className="md:col-span-5 space-y-3">
                      <p className="text-[13px] font-semibold text-primary">
                        Best at {activeTargetLabel}
                      </p>
                      <CardArt
                        name={bestCard.name}
                        issuer={bestCard.issuer}
                        artColor={bestCard.artColor}
                        isDemo={bestCard.isDemo}
                        rateBadgeText={formatCardRateLabel(
                          bestCard,
                          selectedCategory,
                        )}
                      />
                      <div className="pt-1 flex items-baseline gap-2">
                        <span className="text-[40px] font-bold text-ink tabular-nums leading-none">
                          {formatCents(bestCard.rewardCents)}
                        </span>
                        <span className="text-[13px] text-ink-muted">
                          back on a {formattedPurchaseAmount} purchase
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Right: All your cards table */}
                  <div className="md:col-span-7">
                    <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-ink-muted/15">
                      <h2 className="text-[20px] font-bold text-ink">
                        All your cards at {activeTargetLabel}
                      </h2>
                      <span className="text-[13px] text-ink-muted tabular-nums">
                        Based on a {formattedPurchaseAmount} purchase
                      </span>
                    </div>

                    <div className="divide-y divide-ink-muted/15">
                      {data.rankedCards.map((card) => (
                        <div key={card.walletCardId} className="py-1">
                          <BestCardRow
                            card={card}
                            category={selectedCategory}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
        </section>
      </main>

      {/* Mobile Floating Glass Tab Bar (under 768px) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-[22px] inset-x-4 z-40 h-[62px] rounded-full bg-glass/65 backdrop-blur-[22px] border border-glass/85 shadow-lg px-3 flex items-center justify-around"
      >
        <Link
          to="/"
          className="flex flex-col items-center justify-center px-5 py-1.5 rounded-full bg-glass/90 text-primary font-medium text-[11px] shadow-2xs"
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
        <span className="flex flex-col items-center justify-center px-5 py-1.5 rounded-full text-ink-muted/70 font-medium text-[11px]">
          <Bell className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Alerts</span>
        </span>
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
