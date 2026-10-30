import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router';
import { SignUpPage } from './pages/SignUpPage.js';
import { CreditCard, PlusCircle } from 'lucide-react';

function WalletPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E7EED8] to-[#DCE6CB] text-[#1C2A1E] p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#2F7D4F] flex items-center justify-center text-white">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl">SwipeWise</span>
          </Link>
          <Link to="/signup" className="text-sm font-semibold text-[#2F7D4F] hover:underline">
            Log out
          </Link>
        </header>

        <div className="rounded-[22px] bg-white/45 backdrop-blur-[22px] border border-white/80 p-8 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#D6E8D9] flex items-center justify-center mx-auto text-[#2F7D4F] mb-4">
            <PlusCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Your wallet is ready</h1>
          <p className="text-[#5D6B5B] text-base mb-6">
            Add your first card to get started.
          </p>
          <button className="h-[50px] px-8 rounded-full bg-[#2F7D4F] hover:bg-[#256640] text-white font-semibold shadow-sm transition-colors">
            Add a card
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E7EED8] to-[#DCE6CB] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[22px] bg-white/45 backdrop-blur-[22px] border border-white/80 p-8 shadow-sm text-center">
        <h1 className="text-2xl font-bold mb-2">Log in</h1>
        <p className="text-sm text-[#5D6B5B] mb-6">
          Access your private card wallet.
        </p>
        <div className="text-sm text-[#5D6B5B]">
          Don't have an account?{' '}
          <Link to="/signup" className="text-[#2F7D4F] font-semibold underline">
            Sign up
          </Link>
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
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
