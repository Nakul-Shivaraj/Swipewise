import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  signupRequestSchema,
  SignupRequest,
  calculatePasswordStrength,
} from '@swipewise/shared';
import { ShieldCheck, Sparkles, Lock, CreditCard } from 'lucide-react';

export function SignUpPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<{
    code: string;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupRequest>({
    resolver: zodResolver(signupRequestSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password') || '';
  const strength = calculatePasswordStrength(passwordValue);

  const onSubmit = async (data: SignupRequest) => {
    setServerError(null);
    try {
      const response = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 409) {
          setServerError({
            code: 'EMAIL_ALREADY_EXISTS',
            message:
              errorData.error?.message ||
              'An account with this email already exists. Log in instead?',
          });
        } else if (response.status === 429) {
          setServerError({
            code: 'RATE_LIMIT_EXCEEDED',
            message:
              errorData.error?.message ||
              'Too many tries. Wait a minute and try again.',
          });
        } else {
          setServerError({
            code: 'SERVER_ERROR',
            message:
              errorData.error?.message || 'Something went wrong. Try again.',
          });
        }
        return;
      }

      // Success redirects to Wallet empty state
      navigate('/wallet');
    } catch (_err) {
      setServerError({
        code: 'NETWORK_ERROR',
        message: 'Something went wrong. Try again.',
      });
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-[#E7EED8] to-[#DCE6CB] text-[#1C2A1E] font-sans overflow-x-hidden selection:bg-[#2F7D4F]/20">
      {/* Background ambient blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-[#D6E8D9]/70 rounded-full blur-3xl opacity-70" />
      <div className="pointer-events-none absolute top-1/3 -right-20 w-[420px] h-[420px] bg-[#F2F7E4]/80 rounded-full blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 w-[500px] h-[500px] bg-[#CEE0CE]/60 rounded-full blur-3xl opacity-60" />

      {/* Website sticky glass top bar (1200px+) */}
      <header className="sticky top-0 z-40 w-full h-16 backdrop-blur-[22px] bg-white/45 border-b border-white/80 shadow-[0_4px_24px_rgba(47,125,79,0.04)] px-6 md:px-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2F7D4F] to-[#256640] flex items-center justify-center text-white shadow-sm ring-1 ring-white/50">
            <CreditCard className="w-5 h-5 text-white/95" />
          </div>
          <span className="font-bold text-lg tracking-tight text-[#1C2A1E]">
            SwipeWise
          </span>
        </Link>

        <div className="text-[15px]">
          <span className="text-[#5D6B5B] mr-1.5">Have an account?</span>
          <Link
            to="/login"
            className="text-[#2F7D4F] font-semibold hover:underline decoration-2 underline-offset-2"
          >
            Log in
          </Link>
        </div>
      </header>

      {/* Main container */}
      <main className="relative z-10 max-w-[1120px] mx-auto px-4 sm:px-6 py-8 md:py-16 flex flex-col lg:flex-row items-center lg:items-start justify-between gap-12">
        {/* Left column: Branding & Hero feature points (visible on desktop) */}
        <section className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left pt-2 lg:pt-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 border border-white/80 text-xs font-semibold text-[#2F7D4F] mb-4 shadow-sm backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Private Card Wallet</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#1C2A1E] leading-[1.15]">
            Every swipe,
            <br className="hidden sm:inline" /> the right card.
          </h1>

          <p className="mt-3 text-base sm:text-lg text-[#5D6B5B] max-w-md">
            The private wallet that points you to the best card at checkout and
            protects your rewards.
          </p>

          {/* Three Feature Points */}
          <div className="mt-8 space-y-4 text-left max-w-md w-full">
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/30 border border-white/60 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full bg-[#D6E8D9] flex items-center justify-center shrink-0 mt-0.5">
                <CreditCard className="w-4 h-4 text-[#2F7D4F]" />
              </div>
              <div>
                <h2 className="font-semibold text-[15px] text-[#1C2A1E]">
                  Best card at every checkout, automatically
                </h2>
                <p className="text-[13px] text-[#5D6B5B] leading-snug">
                  See maximum points, cash back, and fee savings in one tap.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/30 border border-white/60 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full bg-[#D6E8D9] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-[#2F7D4F]" />
              </div>
              <div>
                <h2 className="font-semibold text-[15px] text-[#1C2A1E]">
                  Never miss a quarterly bonus or annual perk
                </h2>
                <p className="text-[13px] text-[#5D6B5B] leading-snug">
                  Timely reminders before rotations expire or perks slip away.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/30 border border-white/60 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full bg-[#D6E8D9] flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-[#2F7D4F]" />
              </div>
              <div>
                <h2 className="font-semibold text-[15px] text-[#1C2A1E]">
                  Zero bank linking — your cards stay private
                </h2>
                <p className="text-[13px] text-[#5D6B5B] leading-snug">
                  No bank logins, balances, or CVVs required.
                </p>
              </div>
            </div>
          </div>

          {/* Floating Demo Card Art (Mockup aspect 1.586, rounded 14px, no card number) */}
          <div className="mt-8 hidden lg:block">
            <div className="relative w-[340px] h-[214px] rounded-[14px] bg-gradient-to-tr from-[#1B3B2B] via-[#2F7D4F] to-[#479D6D] text-white p-5 shadow-[0_20px_40px_rgba(27,59,43,0.22)] border border-white/40 overflow-hidden transform -rotate-1 hover:rotate-0 transition-transform duration-300">
              {/* Metallic shine reflection */}
              <div className="pointer-events-none absolute -inset-full bg-gradient-to-tr from-transparent via-white/20 to-transparent rotate-45 transform" />

              <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start">
                  <span className="text-xs uppercase tracking-widest font-semibold text-white/80">
                    SwipeWise Private
                  </span>
                  <div className="w-10 h-7 rounded bg-gradient-to-br from-[#E2B755] to-[#B88728] border border-white/30 shadow-inner flex items-center justify-center">
                    <div className="w-6 h-4 border border-black/20 rounded-sm opacity-50" />
                  </div>
                </div>

                <div>
                  <div className="text-lg font-bold tracking-wide drop-shadow-sm">
                    Demo Sapphire Reserve
                  </div>
                  <div className="text-xs text-white/75 mt-0.5 font-medium">
                    3x Dining &amp; Travel · Active
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right column: 440px Glass Form Card */}
        <section className="w-full max-w-[440px] shrink-0">
          <div className="rounded-[22px] bg-white/45 backdrop-blur-[22px] border border-white/80 shadow-[0_12px_40px_rgba(47,125,79,0.08)] p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-[#1C2A1E]">
                Create account
              </h2>
              <p className="text-sm text-[#5D6B5B] mt-1">
                Start with a private wallet tailored to your cards.
              </p>
            </div>

            {/* Error Banners */}
            {serverError && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[#B3261E] text-sm font-medium flex items-start gap-2.5"
              >
                <div className="shrink-0 mt-0.5">⚠️</div>
                <div className="flex-1">
                  {serverError.message}
                  {serverError.code === 'EMAIL_ALREADY_EXISTS' && (
                    <div className="mt-1">
                      <Link
                        to="/login"
                        className="underline font-semibold hover:text-[#911e17]"
                      >
                        Log in here
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* One glass group with thin dividers */}
              <div className="rounded-2xl bg-white/70 border border-white/90 shadow-sm overflow-hidden divide-y divide-gray-200/60">
                {/* Name */}
                <div className="p-3.5 focus-within:bg-white/90 transition-colors">
                  <label
                    htmlFor="signup-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#5D6B5B]"
                  >
                    Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Doe"
                    aria-describedby={errors.name ? 'name-error' : undefined}
                    aria-invalid={!!errors.name}
                    className="mt-1 block w-full bg-transparent text-[15px] font-medium text-[#1C2A1E] placeholder:text-[#5D6B5B]/50 focus:outline-none"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p
                      id="name-error"
                      role="alert"
                      aria-live="polite"
                      className="mt-1.5 text-xs font-medium text-[#B3261E]"
                    >
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="p-3.5 focus-within:bg-white/90 transition-colors">
                  <label
                    htmlFor="signup-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#5D6B5B]"
                  >
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="jane@example.com"
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    aria-invalid={!!errors.email}
                    className="mt-1 block w-full bg-transparent text-[15px] font-medium text-[#1C2A1E] placeholder:text-[#5D6B5B]/50 focus:outline-none"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p
                      id="email-error"
                      role="alert"
                      aria-live="polite"
                      className="mt-1.5 text-xs font-medium text-[#B3261E]"
                    >
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="p-3.5 focus-within:bg-white/90 transition-colors">
                  <label
                    htmlFor="signup-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#5D6B5B]"
                  >
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    aria-describedby={
                      errors.password ? 'password-error' : undefined
                    }
                    aria-invalid={!!errors.password}
                    className="mt-1 block w-full bg-transparent text-[15px] font-medium text-[#1C2A1E] placeholder:text-[#5D6B5B]/50 focus:outline-none"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p
                      id="password-error"
                      role="alert"
                      aria-live="polite"
                      className="mt-1.5 text-xs font-medium text-[#B3261E]"
                    >
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Confirm password */}
                <div className="p-3.5 focus-within:bg-white/90 transition-colors">
                  <label
                    htmlFor="signup-confirm-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#5D6B5B]"
                  >
                    Confirm password
                  </label>
                  <input
                    id="signup-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    aria-describedby={
                      errors.confirmPassword
                        ? 'confirm-password-error'
                        : undefined
                    }
                    aria-invalid={!!errors.confirmPassword}
                    className="mt-1 block w-full bg-transparent text-[15px] font-medium text-[#1C2A1E] placeholder:text-[#5D6B5B]/50 focus:outline-none"
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p
                      id="confirm-password-error"
                      role="alert"
                      aria-live="polite"
                      className="mt-1.5 text-xs font-medium text-[#B3261E]"
                    >
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              {/* 4-segment Password strength bar */}
              <div className="mt-3 px-1">
                <div className="flex items-center justify-between text-xs text-[#5D6B5B] mb-1.5 font-medium">
                  <span>Password strength</span>
                  <span
                    className={
                      strength.score >= 4
                        ? 'text-[#2F7D4F] font-semibold'
                        : strength.score >= 2
                        ? 'text-amber-700 font-semibold'
                        : 'text-[#B3261E]'
                    }
                  >
                    {strength.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
                  {[1, 2, 3, 4].map((seg) => (
                    <div
                      key={seg}
                      className={`h-full rounded-full transition-all duration-300 ${
                        strength.score >= seg
                          ? strength.score >= 4
                            ? 'bg-[#2F7D4F]'
                            : strength.score >= 2
                            ? 'bg-amber-500'
                            : 'bg-[#B3261E]'
                          : 'bg-black/10'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 w-full h-[50px] rounded-full bg-[#2F7D4F] hover:bg-[#256640] active:bg-[#1E5234] text-white font-semibold text-[16px] shadow-[0_4px_16px_rgba(47,125,79,0.25)] transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#2F7D4F] focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Creating account…</span>
                  </>
                ) : (
                  <span>Create account</span>
                )}
              </button>
            </form>

            {/* Bottom info */}
            <div className="mt-5 text-center">
              <p className="text-xs text-[#5D6B5B] flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#2F7D4F]" />
                <span>We never ask for card numbers.</span>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Website footer */}
      <footer className="mt-12 py-6 border-t border-white/60 bg-white/20 backdrop-blur-md text-center text-xs text-[#5D6B5B]">
        <div className="max-w-[1120px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} SwipeWise. All rights reserved.</div>
          <div className="flex gap-4">
            <span className="hover:underline cursor-pointer">Privacy</span>
            <span className="hover:underline cursor-pointer">Terms</span>
            <span className="hover:underline cursor-pointer">Help</span>
            <span>Not financial advice.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
