import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router';
import { SignUpPage } from './pages/SignUpPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { AuthGuard } from './components/AuthGuard.js';
import { CreditCard, PlusCircle } from 'lucide-react';

function WalletPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background-deep text-ink p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl">SwipeWise</span>
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm font-semibold text-primary hover:underline cursor-pointer"
          >
            Log out
          </button>
        </header>

        <div className="rounded-lg bg-glass/45 backdrop-blur-[22px] border border-glass/80 p-8 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-full bg-primary-tint flex items-center justify-center mx-auto text-primary mb-4">
            <PlusCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Your wallet is ready</h1>
          <p className="text-ink-muted text-base mb-6">
            Add your first card to get started.
          </p>
          <button className="h-[50px] px-8 rounded-full bg-primary hover:bg-primary-pressed text-on-primary font-semibold shadow-sm transition-colors cursor-pointer">
            Add a card
          </button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/wallet"
          element={
            <AuthGuard>
              <WalletPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
