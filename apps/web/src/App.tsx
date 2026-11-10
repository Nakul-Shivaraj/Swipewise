import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { SignUpPage } from "./pages/SignUpPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { HomePage } from "./pages/HomePage.js";
import { WalletPage } from "./pages/WalletPage.js";
import { PointsPage } from "./pages/PointsPage.js";
import { TrackerPage } from "./pages/TrackerPage.js";
import { AlertsPage } from "./pages/AlertsPage.js";
import { AuthGuard } from "./components/AuthGuard.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AuthGuard>
              <HomePage />
            </AuthGuard>
          }
        />
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
        <Route
          path="/points"
          element={
            <AuthGuard>
              <PointsPage />
            </AuthGuard>
          }
        />
        <Route
          path="/tracker"
          element={
            <AuthGuard>
              <TrackerPage />
            </AuthGuard>
          }
        />
        <Route
          path="/alerts"
          element={
            <AuthGuard>
              <AlertsPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
