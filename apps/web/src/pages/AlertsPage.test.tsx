import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { AlertsPage } from "./AlertsPage.js";
import { setCachedCsrfToken } from "../api.js";

const MOCK_NOTIFICATIONS = [
  {
    id: "11111111-1111-4111-8111-000000000001",
    userId: "11111111-1111-4111-8111-111111111111",
    type: "PAYMENT_DUE" as const,
    title: "Payment due in 5 days",
    body: "Mint Everyday payment is due soon.",
    dueDate: "2026-11-15",
    dedupeKey: "PAYMENT_DUE:u1:2026-11-15",
    dismissedAt: null,
    createdAt: "2026-11-10T09:00:00.000Z",
  },
  {
    id: "11111111-1111-4111-8111-000000000002",
    userId: "11111111-1111-4111-8111-111111111111",
    type: "PERK_ENDING" as const,
    title: "Ride credit ends in 5 days",
    body: "Harbor Travel Plus $15.00 ride credit resets soon.",
    dueDate: "2026-11-30",
    dedupeKey: "PERK_ENDING:u1:2026-11-30",
    dismissedAt: null,
    createdAt: "2026-11-10T08:00:00.000Z",
  },
];

const MOCK_PREFERENCES = [
  { type: "PAYMENT_DUE" as const, enabled: true },
  { type: "PERK_ENDING" as const, enabled: true },
  { type: "ROTATING_CATEGORY" as const, enabled: true },
  { type: "POINTS_EXPIRY" as const, enabled: false },
];

describe("AlertsPage (US-05..09 / Issue #19)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setCachedCsrfToken("test-csrf-token");
  });

  it("AC2: displays active notifications and dismisses one when clicked", async () => {
    let activeList = [...MOCK_NOTIFICATIONS];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (
          url === "/api/v1/notifications" &&
          (!init?.method || init.method === "GET")
        ) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ notifications: activeList }),
          });
        }
        if (url === "/api/v1/notification-preferences") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ preferences: MOCK_PREFERENCES }),
          });
        }
        if (
          url.includes("/api/v1/notifications/") &&
          url.endsWith("/dismiss") &&
          init?.method === "POST"
        ) {
          const id = url.split("/api/v1/notifications/")[1]?.split("/")[0];
          const dismissed = activeList.find((n) => n.id === id);
          activeList = activeList.filter((n) => n.id !== id);
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                notification: {
                  ...dismissed,
                  dismissedAt: "2026-11-10T10:00:00.000Z",
                },
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Payment due in 5 days")).toBeInTheDocument();
      expect(
        screen.getByText("Ride credit ends in 5 days"),
      ).toBeInTheDocument();
    });

    const dismissBtn = screen.getByRole("button", {
      name: /Dismiss Payment due in 5 days/i,
    });
    await user.click(dismissBtn);

    await waitFor(() => {
      expect(
        screen.queryByText("Payment due in 5 days"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("Ride credit ends in 5 days")).toBeInTheDocument();
  });

  it("AC3: displays reminder settings toggles and updates a reminder preference when toggled", async () => {
    let prefsState = [...MOCK_PREFERENCES];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/v1/notifications") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ notifications: [] }),
          });
        }
        if (
          url === "/api/v1/notification-preferences" &&
          (!init?.method || init.method === "GET")
        ) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ preferences: prefsState }),
          });
        }
        if (
          url === "/api/v1/notification-preferences" &&
          init?.method === "PATCH"
        ) {
          const body = JSON.parse(init.body as string) as {
            type: (typeof MOCK_PREFERENCES)[number]["type"];
            enabled: boolean;
          };
          prefsState = prefsState.map((p) =>
            p.type === body.type ? { ...p, enabled: body.enabled } : p,
          );
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ preferences: prefsState }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("You're all caught up. No new reminders."),
      ).toBeInTheDocument();
    });

    const paymentSwitch = screen.getByRole("switch", { name: "Payment due" });
    expect(paymentSwitch).toHaveAttribute("aria-checked", "true");

    const pointsSwitch = screen.getByRole("switch", { name: "Points expiry" });
    expect(pointsSwitch).toHaveAttribute("aria-checked", "false");

    await user.click(paymentSwitch);

    await waitFor(() => {
      expect(
        screen.getByRole("switch", { name: "Payment due" }),
      ).toHaveAttribute("aria-checked", "false");
    });
  });

  it("AC2: Mark all read dismisses all notifications and shows empty state", async () => {
    let activeList = [...MOCK_NOTIFICATIONS];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (
          url === "/api/v1/notifications" &&
          (!init?.method || init.method === "GET")
        ) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ notifications: activeList }),
          });
        }
        if (url === "/api/v1/notification-preferences") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ preferences: MOCK_PREFERENCES }),
          });
        }
        if (
          url === "/api/v1/notifications/dismiss-all" &&
          init?.method === "POST"
        ) {
          const count = activeList.length;
          activeList = [];
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ dismissedCount: count }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Payment due in 5 days")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    await waitFor(() => {
      expect(
        screen.getByText("You're all caught up. No new reminders."),
      ).toBeInTheDocument();
    });
  });

  it("displays error state with Retry button when API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }),
    );

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Something went wrong. Try again."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });
  });

  it("US-08 AC4 (Issue #20): shows 'Mark paid' button on PAYMENT_DUE reminders and marks the cycle paid", async () => {
    const paymentNotification = {
      id: "11111111-1111-4111-8111-000000000099",
      userId: "11111111-1111-4111-8111-111111111111",
      type: "PAYMENT_DUE" as const,
      title: "Payment due in 5 days",
      body: "Mint Everyday payment is due on 2026-11-15.",
      dueDate: "2026-11-15",
      dedupeKey: "PAYMENT_DUE:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:2026-11:5",
      dismissedAt: null,
      createdAt: "2026-11-10T09:00:00.000Z",
    };

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (
          url === "/api/v1/notifications" &&
          (!init?.method || init.method === "GET")
        ) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                notifications: [paymentNotification, MOCK_NOTIFICATIONS[1]!],
              }),
          });
        }
        if (url === "/api/v1/notification-preferences") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ preferences: MOCK_PREFERENCES }),
          });
        }
        if (
          url ===
            "/api/v1/wallet/cards/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/paid-cycles" &&
          init?.method === "POST"
        ) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                paidCycle: {
                  walletCardId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  cycleYearMonth: "2026-11",
                  paidAt: "2026-11-10T10:00:00.000Z",
                },
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Payment due in 5 days")).toBeInTheDocument();
    });

    const markPaidBtn = screen.getByRole("button", {
      name: /Mark paid/i,
    });
    await user.click(markPaidBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/wallet/cards/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/paid-cycles",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ cycleYearMonth: "2026-11" }),
        }),
      );
      expect(
        screen.queryByText("Payment due in 5 days"),
      ).not.toBeInTheDocument();
    });
  });
});
