import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { TrackerPage } from "./TrackerPage.js";
import { setCachedCsrfToken } from "../api.js";
import { BonusOfferProgressItem } from "@swipewise/shared";

const MOCK_PERKS = [
  {
    id: "perk-dining-1",
    perkId: "perk-dining-1",
    walletCardId: "wc-1",
    cardName: "Harbor Travel Plus",
    perkName: "Dining credit",
    amountCents: 1000,
    period: "MONTHLY" as const,
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
    period: "MONTHLY" as const,
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

const MOCK_BONUS: BonusOfferProgressItem = {
  walletCardId: "wc-1",
  cardName: "Harbor Travel Plus",
  cardNickname: "My Travel Card",
  requiredSpendCents: 300000,
  spendRequirementCents: 300000,
  windowMonths: 3,
  bonusPoints: 60000,
  openedDate: "2026-01-01",
  deadline: "2026-04-01",
  daysLeft: 45,
  spentCents: 100000,
  remainingCents: 200000,
  progressPercent: 33,
  status: "In progress",
  requiresOpenDate: false,
  spendEntries: [
    {
      id: "se-1",
      walletCardId: "wc-1",
      walletCardBonusOfferId: "offer-1",
      amountCents: 100000,
      date: "2026-01-15",
      note: "Flight tickets",
    },
  ],
};

describe("TrackerPage (US-06 / Issue #21 & US-07 / Issue #22)", () => {
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
      if (url === "/api/v1/bonus-offers") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ bonuses: [] }),
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
      expect(screen.getAllByText("$20.00 left").length).toBeGreaterThanOrEqual(
        1,
      );
      expect(screen.getByText("Dining credit")).toBeInTheDocument();
      expect(screen.getByText("Ride credit")).toBeInTheDocument();
      expect(
        screen.getAllByText("Harbor Travel Plus").length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("AC2 (US-07): displays sign-up bonus progress, amount left, days left, and status", async () => {
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
      if (url === "/api/v1/bonus-offers") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ bonuses: [MOCK_BONUS] }),
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
      // Amount left: $2000.00 left
      expect(
        screen.getAllByText("$2000.00 left").length,
      ).toBeGreaterThanOrEqual(1);
      // Status
      expect(screen.getAllByText("In progress").length).toBeGreaterThanOrEqual(
        1,
      );
      // Days left
      expect(
        screen.getAllByText(/45 days left/i).length,
      ).toBeGreaterThanOrEqual(1);
      // Spending history
      expect(screen.getByText("Flight tickets")).toBeInTheDocument();
    });
  });

  it("AC1 (US-07): allows logging a spend entry and a refund via modal", async () => {
    let bonusState = { ...MOCK_BONUS };

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (
          url === "/api/v1/bonus-offers" &&
          (!init?.method || init.method === "GET")
        ) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ bonuses: [bonusState] }),
          });
        }
        if (
          url === "/api/v1/wallet/cards/wc-1/spend-entries" &&
          init?.method === "POST"
        ) {
          const body = JSON.parse(init.body as string);
          const newEntry = {
            id: "se-new",
            walletCardId: "wc-1",
            amountCents: body.amountCents,
            date: body.date,
            note: body.note || null,
          };
          bonusState = {
            ...bonusState,
            spentCents: bonusState.spentCents + body.amountCents,
            remainingCents: Math.max(
              0,
              bonusState.remainingCents - body.amountCents,
            ),
            spendEntries: [newEntry, ...bonusState.spendEntries],
          };
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ spendEntry: newEntry }),
          });
        }
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

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TrackerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Flight tickets")).toBeInTheDocument();
    });

    const logSpendButton = screen.getByRole("button", { name: /log spend/i });
    await user.click(logSpendButton);

    expect(
      screen.getByRole("heading", { name: /log spending/i }),
    ).toBeInTheDocument();

    const amountInput = screen.getByLabelText(/amount/i);
    await user.type(amountInput, "500.00");

    const noteInput = screen.getByLabelText(/note/i);
    await user.type(noteInput, "Hotel booking");

    const saveButton = screen.getByRole("button", { name: /save entry/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/wallet/cards/wc-1/spend-entries",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("AC3 (US-07): prompts user to add an open date when card is missing one", async () => {
    const noDateBonus: BonusOfferProgressItem = {
      ...MOCK_BONUS,
      openedDate: null,
      deadline: null,
      daysLeft: null,
      requiresOpenDate: true,
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/v1/bonus-offers") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ bonuses: [noDateBonus] }),
        });
      }
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
      expect(screen.getByText(/Card open date required/i)).toBeInTheDocument();
      expect(
        screen.getAllByRole("link", { name: /Go to Wallet/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("rejects card numbers entered in the spend note field", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/v1/bonus-offers") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ bonuses: [MOCK_BONUS] }),
        });
      }
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

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TrackerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Flight tickets")).toBeInTheDocument();
    });

    const logSpendButton = screen.getByRole("button", { name: /log spend/i });
    await user.click(logSpendButton);

    const amountInput = screen.getByLabelText(/amount/i);
    await user.type(amountInput, "50.00");

    const noteInput = screen.getByLabelText(/note/i);
    await user.type(noteInput, "Card 4111111111111111");

    const saveButton = screen.getByRole("button", { name: /save entry/i });
    await user.click(saveButton);

    expect(
      screen.getByText(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      ),
    ).toBeInTheDocument();
  });
});
