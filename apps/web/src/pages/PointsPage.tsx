import React from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell,
  BarChart3,
  CreditCard,
  Home as HomeIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import { PointsBalancesPanel } from "../components/PointsBalancesPanel.js";
import { apiFetch } from "../api.js";

export function PointsPage() {
  const navigate = useNavigate();

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
            <Link
              to="/points"
              className="py-5 text-[15px] font-semibold text-ink border-b-[2.5px] border-primary"
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
            className="px-4 h-9 rounded-full bg-glass/60 border border-glass/80 text-[13px] font-medium text-ink hover:bg-glass/90 transition-colors cursor-pointer"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-[720px] xl:max-w-[1120px] mx-auto px-4 md:px-6 pt-6 md:pt-12 pb-12">
        <div className="mb-6">
          <h1 className="text-[30px] md:text-[42px] font-bold tracking-tight leading-[1.12] text-ink">
            Points balances
          </h1>
          <p className="text-[14px] text-ink-muted mt-1">
            Track your rewards balances, see their dollar value, and get
            reminded 30 and 7 days before they expire.
          </p>
        </div>

        <PointsBalancesPanel />
      </main>

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
          to="/points"
          className="flex flex-col items-center justify-center px-4 py-1.5 rounded-full bg-glass/90 text-primary font-medium text-[11px] shadow-2xs"
        >
          <BarChart3 className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Points</span>
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
