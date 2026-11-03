import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginRequestSchema, LoginRequest } from '@swipewise/shared';
import { ShieldCheck, Sparkles, Lock, CreditCard } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<{
    code: string;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginRequest) => {
    setServerError(null);
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setServerError({
            code: 'INVALID_CREDENTIALS',
            message:
              errorData.error?.message || 'Email or password is incorrect.',
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

      // Success redirects to prior destination or /wallet
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/wallet';
      navigate(from, { replace: true });
    } catch {
      setServerError({
        code: 'NETWORK_ERROR',
        message: 'Something went wrong. Try again.',
      });
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-background to-background-deep text-ink font-sans overflow-x-hidden selection:bg-primary/20">
      {/* Background ambient blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-primary-tint/70 rounded-full blur-3xl opacity-70" />
      <div className="pointer-events-none absolute top-1/3 -right-20 w-[420px] h-[420px] bg-background/80 rounded-full blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 w-[500px] h-[500px] bg-primary-tint/50 rounded-full blur-3xl opacity-60" />

      {/* Website sticky glass top bar (1200px+) */}
      <header className="sticky top-0 z-40 w-full h-16 backdrop-blur-[22px] bg-glass/45 border-b border-glass/80 shadow-sm px-6 md:px-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-pressed flex items-center justify-center text-on-primary shadow-sm ring-1 ring-glass/50">
            <CreditCard className="w-5 h-5 text-on-primary/95" />
          </div>
          <span className="font-bold text-lg tracking-tight text-ink">
            SwipeWise
          </span>
        </Link>

        <div className="text-[15px]">
          <span className="text-ink-muted mr-1.5">Don't have an account?</span>
          <Link
            to="/signup"
            className="text-primary font-semibold hover:underline decoration-2 underline-offset-2"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* Main container */}
      <main className="relative z-10 max-w-[1120px] mx-auto px-4 sm:px-6 py-8 md:py-16 flex flex-col lg:flex-row items-center lg:items-start justify-between gap-12">
        {/* Left column: Branding & Hero feature points (visible on desktop) */}
        <section className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left pt-2 lg:pt-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-glass/60 border border-glass/80 text-xs font-semibold text-primary mb-4 shadow-sm backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Private Card Wallet</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-ink leading-[1.15]">
            Every swipe,
            <br className="hidden sm:inline" /> the right card.
          </h1>

          <p className="mt-3 text-base sm:text-lg text-ink-muted max-w-md">
            The private wallet that points you to the best card at checkout and
            protects your rewards.
          </p>

          {/* Three Feature Points */}
          <div className="mt-8 space-y-4 text-left max-w-md w-full">
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-glass/30 border border-glass/60 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full bg-primary-tint flex items-center justify-center shrink-0 mt-0.5">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  Best card for every purchase
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Instant smart rankings by store or category with zero guesswork.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-glass/30 border border-glass/60 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full bg-primary-tint flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  Automatic perk & bonus tracking
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Never leave cash back, points, credits, or deadlines on the table.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-glass/30 border border-glass/60 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full bg-primary-tint flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  Private and secure
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  No bank credentials, no full card numbers, and zero transaction access.
                </p>
              </div>
            </div>
          </div>

          {/* Floating demo card art */}
          <div className="relative mt-10 w-full max-w-md hidden sm:block">
            <div className="w-72 h-44 rounded-2xl bg-gradient-to-tr from-primary to-[#48BB78] p-5 text-on-primary shadow-xl shadow-primary/20 ring-1 ring-white/20 transform -rotate-3 transition-transform hover:rotate-0 duration-300">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium tracking-wider uppercase opacity-80">
                  Demo Card
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20">
                  4% Groceries
                </span>
              </div>
              <div className="mt-10 font-bold text-lg tracking-wide">
                Mint Everyday
              </div>
              <div className="mt-4 flex justify-between items-center text-xs opacity-75">
                <span>SwipeWise Wallet</span>
                <span>$0 Annual fee</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right column: Form card (440px) */}
        <section className="w-full max-w-[440px] shrink-0">
          <div className="rounded-3xl bg-glass/60 backdrop-blur-[22px] border border-glass/80 p-6 sm:p-8 shadow-xl shadow-ink/5">
            <div className="mb-6 text-left">
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                Log in
              </h1>
              <p className="text-sm text-ink-muted mt-1">
                Access your private card wallet.
              </p>
            </div>

            {/* Server Error Alert */}
            {serverError && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-5 p-3.5 rounded-xl bg-error/10 border border-error/25 text-error text-sm font-medium flex items-start gap-2.5"
              >
                <div className="shrink-0 mt-0.5">⚠️</div>
                <div className="flex-1">
                  <p>{serverError.message}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* One glass group with thin dividers */}
              <div className="rounded-2xl bg-glass/70 border border-glass/90 shadow-sm overflow-hidden divide-y divide-ink-muted/15">
                {/* Email */}
                <div className="p-3.5 focus-within:bg-glass/90 transition-colors">
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-ink-muted"
                  >
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="jane@example.com"
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    aria-invalid={!!errors.email}
                    className="mt-1 block w-full bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-muted/50 focus:outline-none"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p
                      id="email-error"
                      role="alert"
                      aria-live="polite"
                      className="mt-1.5 text-xs font-medium text-error"
                    >
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="p-3.5 focus-within:bg-glass/90 transition-colors">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-ink-muted"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-describedby={
                      errors.password ? 'password-error' : undefined
                    }
                    aria-invalid={!!errors.password}
                    className="mt-1 block w-full bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-muted/50 focus:outline-none"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p
                      id="password-error"
                      role="alert"
                      aria-live="polite"
                      className="mt-1.5 text-xs font-medium text-error"
                    >
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Green Pill Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 w-full h-[50px] rounded-full bg-primary hover:bg-primary-pressed active:scale-[0.99] text-on-primary font-semibold text-base shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-on-primary"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
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
                    <span>Logging in…</span>
                  </>
                ) : (
                  <span>Log in</span>
                )}
              </button>
            </form>

            {/* Bottom link: Don't have an account? Sign up */}
            <div className="mt-5 text-center text-sm text-ink-muted">
              <span>Don't have an account? </span>
              <Link
                to="/signup"
                className="text-primary font-semibold hover:underline decoration-2 underline-offset-2"
              >
                Sign up
              </Link>
            </div>

            {/* Footer security note */}
            <div className="mt-6 pt-5 border-t border-ink-muted/15 text-center text-xs text-ink-muted">
              <span>We never ask for card numbers.</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
