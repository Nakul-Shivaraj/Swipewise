import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (isMounted) {
          if (res.ok) {
            setAuthenticated(true);
          } else {
            setAuthenticated(false);
          }
        }
      } catch {
        if (isMounted) {
          setAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background-deep flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-3xl bg-glass/60 backdrop-blur-[22px] border border-glass/80 animate-pulse text-center space-y-4">
          <div className="w-12 h-12 bg-primary-tint rounded-full mx-auto" />
          <div className="h-6 bg-ink-muted/20 rounded-md w-3/4 mx-auto" />
          <div className="h-4 bg-ink-muted/15 rounded-md w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
