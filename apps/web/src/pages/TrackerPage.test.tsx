import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { TrackerPage } from "./TrackerPage.js";
import { setCachedCsrfToken } from "../api.js";

const MOCK_PERKS = [
  {
    id: "perk-dining-1",
    perkId: "perk-dining-1",
    walletCardId: "wc-1",
    cardName: "Harbor Travel Plus",
    perkName: "Dining credit",
    amountCents: 1000,
    period: "MONTHLY",
    periodKey: "2026-11",
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    usedCents: 0,
    leftCents: 1000,
    daysLeft: 5,
    isUsed: false,
  },
  {
    id: "perk-ride-1",
    perkId: "perk-ride-1",
    walletCardId: "wc-1",
    cardName: "Harbor Travel Plus",
    perkName: "Ride credit",
    amountCents: 1500,
    period: "MONTHLY",
    periodKey: "2026-11",
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    usedCents: 500,
    leftCents: 1000,
    daysLeft: 5,
    isUsed: false,
  },
];

const MOCK_SUMMARY = {
  totalAmountCents: 2500,
  totalUsedCents: 500,
  totalLeftCents: 2000,
};

describe("TrackerPage (US-06 / Issue #21)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setCachedCsrfToken("test-csrf-token");
  });

  it("AC1: displays perks left stats, widgets, and 'Coming up' table", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/v1/perks") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              perks: MOCK_PERKS,
              summary: MOCK_SUMMARY,
            }),
        });
      }
      if (url === "/api/v1/wallet/cards") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ walletCards: [] }),
        });
      }
      if (url === "/api/v1/points-balances") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ programs: [] }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <TrackerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Tracker" }),
      ).toBeInTheDocument();
      // Stats summary: $20.00 left out of $25.00
      expect(screen.getAllByText("$20.00 left").length).toBeGreaterThanOrEqual(
        1,
      );
      // Perk items
      expect(screen.getByText("Dining credit")).toBeInTheDocument();
      expect(screen.getByText("Ride credit")).toBeInTheDocument();
      expect(
        screen.getAllByText("Harbor Travel Plus").length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("AC2: allows marking a perk as fully used via Mark used button", async () => {
    let perksState = [...MOCK_PERKS];

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (
          url === "/api/v1/perks" &&
          (!init?.method || init.method === "GET")
        ) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                perks: perksState,
                summary: MOCK_SUMMARY,
              }),
          });
        }
        if (
          url === "/api/v1/wallet/cards/wc-1/perks/perk-dining-1/usage" &&
          init?.method === "POST"
        ) {
          const updated = {
            ...perksState[0]!,
            usedCents: 1000,
            leftCents: 0,
            isUsed: true,
          };
          perksState = [updated, perksState[1]!];
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ perk: updated }),
          });
        }
        if (url === "/api/v1/wallet/cards") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ walletCards: [] }),
          });
        }
        if (url === "/api/v1/points-balances") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ programs: [] }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TrackerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dining credit")).toBeInTheDocument();
    });

    const markUsedButtons = screen.getAllByRole("button", {
      name: /mark used/i,
    });
    expect(markUsedButtons.length).toBeGreaterThan(0);

    await user.click(markUsedButtons[0]!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/wallet/cards/wc-1/perks/perk-dining-1/usage",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  it("handles empty perks state with friendly empty message and action", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/v1/perks") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              perks: [],
              summary: {
                totalAmountCents: 0,
                totalUsedCents: 0,
                totalLeftCents: 0,
              },
            }),
        });
      }
      if (url === "/api/v1/wallet/cards") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ walletCards: [] }),
        });
      }
      if (url === "/api/v1/points-balances") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ programs: [] }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <TrackerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/No active perks to track/i)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Go to wallet/i }),
      ).toBeInTheDocument();
    });
  });
});
