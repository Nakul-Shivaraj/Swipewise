import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { AdminPage } from "./AdminPage.js";

describe("AdminPage (US-10 / Issue #25)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders admin tabs: Cards, Stores, and Audit Log for admin users", async () => {
    // Mock fetch for admin me, cards, stores, audit-logs
    vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: {
                id: "admin-id",
                name: "Admin User",
                email: "admin@swipewise.local",
                role: "ADMIN",
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes("/api/v1/admin/cards")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              cards: [
                {
                  id: "card-1",
                  name: "Emerald Horizon Demo",
                  issuer: "Horizon Bank",
                  artColor: "#2F7D4F",
                  isDemo: true,
                  annualFeeCents: 9500,
                  baseRateX100: 100,
                  isRetired: false,
                  program: { name: "Horizon Rewards", centsPer100Points: 100 },
                  rewardRules: [],
                  perks: [],
                  bonusOffer: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes("/api/v1/admin/stores")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              stores: [
                {
                  id: "store-1",
                  name: "Trader Demo Grocery",
                  category: "GROCERIES",
                  aliases: [{ id: "alias-1", alias: "TD Grocery" }],
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes("/api/v1/admin/audit-logs")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              auditLogs: [
                {
                  id: "log-1",
                  userId: "admin-id",
                  userEmail: "admin@swipewise.local",
                  action: "CREATE_CARD",
                  entityType: "CARD",
                  entityId: "card-1",
                  before: null,
                  after: { name: "Emerald Horizon Demo" },
                  createdAt: "2026-11-12T18:00:00.000Z",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    // Cards tab is default
    expect(
      await screen.findByRole("heading", { name: /Admin/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cards/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stores/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Audit Log/i }),
    ).toBeInTheDocument();

    // Emerald Horizon Demo is listed
    expect(await screen.findByText("Emerald Horizon Demo")).toBeInTheDocument();
    expect(screen.getByText("Horizon Bank")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retire/i })).toBeInTheDocument();
  });

  it("switches to Audit Log tab and displays entries", async () => {
    const user = userEvent.setup();

    vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: {
                id: "admin-id",
                name: "Admin User",
                email: "admin@swipewise.local",
                role: "ADMIN",
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes("/api/v1/admin/cards")) {
        return Promise.resolve(
          new Response(JSON.stringify({ cards: [] }), { status: 200 }),
        );
      }
      if (url.includes("/api/v1/admin/stores")) {
        return Promise.resolve(
          new Response(JSON.stringify({ stores: [] }), { status: 200 }),
        );
      }
      if (url.includes("/api/v1/admin/audit-logs")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              auditLogs: [
                {
                  id: "log-1",
                  userId: "admin-id",
                  userEmail: "admin@swipewise.local",
                  action: "CREATE_CARD",
                  entityType: "CARD",
                  entityId: "card-1",
                  before: null,
                  after: { name: "Emerald Horizon Demo" },
                  createdAt: "2026-11-12T18:00:00.000Z",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    const auditTab = await screen.findByRole("button", { name: /Audit Log/i });
    await user.click(auditTab);

    expect(await screen.findByText("CREATE_CARD")).toBeInTheDocument();
    expect(screen.getByText("admin@swipewise.local")).toBeInTheDocument();
    expect(screen.getByText(/CARD \(/)).toBeInTheDocument();
  });
});
