import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { WalletPage } from "./WalletPage.js";
import { setCachedCsrfToken } from "../api.js";

const MOCK_CATALOG = {
  cards: [
    {
      id: "card-1",
      name: "Mint Everyday",
      issuer: "Demo Bank",
      artColor: "#2F8C55",
      isDemo: true,
      annualFeeCents: 0,
      baseRateX100: 100,
      program: { name: "Cash Back", centsPer100Points: 100 },
      rates: [
        { category: "GROCERIES", rateX100: 400, capCents: null },
        { category: "DINING", rateX100: 200, capCents: null },
      ],
    },
    {
      id: "card-2",
      name: "Harbor Travel Plus",
      issuer: "Demo Bank",
      artColor: "#2F74D0",
      isDemo: true,
      annualFeeCents: 9500,
      baseRateX100: 100,
      program: { name: "Harbor Points", centsPer100Points: 125 },
      rates: [{ category: "TRAVEL", rateX100: 200, capCents: null }],
    },
  ],
};

const MOCK_WALLET = {
  walletCards: [
    {
      id: "wc-1",
      userId: "u-1",
      cardId: "card-1",
      nickname: "My Groceries",
      openedDate: "2024-01-10",
      createdAt: "2026-10-01T00:00:00Z",
      card: MOCK_CATALOG.cards[0],
    },
  ],
};

describe("WalletPage (US-02 / Issue #11)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setCachedCsrfToken("test-csrf-token");
  });

  it("AC4: displays empty state 'Add your first card to get started.' when wallet is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/v1/wallet/cards")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ walletCards: [] }),
          });
        }
        if (url.includes("/api/v1/catalog/cards")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MOCK_CATALOG),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }),
    );

    render(
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Add your first card to get started."),
      ).toBeInTheDocument();
    });
  });

  it("AC1 & AC5: displays existing wallet cards and handles add card", async () => {
    let walletState = [...MOCK_WALLET.walletCards];

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (
          url.includes("/api/v1/wallet/cards") &&
          (!init || init.method === "GET" || !init.method)
        ) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ walletCards: walletState }),
          });
        }
        if (url.includes("/api/v1/catalog/cards")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MOCK_CATALOG),
          });
        }
        if (url.includes("/api/v1/wallet/cards") && init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          const newCard = {
            id: "wc-2",
            userId: "u-1",
            cardId: body.cardId,
            nickname: body.nickname || null,
            openedDate: body.openedDate || null,
            createdAt: new Date().toISOString(),
            card: MOCK_CATALOG.cards.find((c) => c.id === body.cardId)!,
          };
          walletState = [newCard, ...walletState];
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ walletCard: newCard }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>,
    );

    // Should display existing card
    await waitFor(() => {
      expect(screen.getAllByText("Mint Everyday").length).toBeGreaterThan(0);
    });

    // Click "Add card"
    const addButtons = screen.getAllByRole("button", { name: /add card/i });
    await userEvent.click(addButtons[0]!);

    // Dialog / Sheet opens: select Harbor Travel Plus
    await waitFor(() => {
      expect(screen.getByText("Harbor Travel Plus")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Harbor Travel Plus"));

    // Enter optional nickname
    const nicknameInput = screen.getByLabelText(/nickname/i);
    await userEvent.type(nicknameInput, "Flight Card");

    // Click save/add button
    const saveButton = screen.getByRole("button", {
      name: /add to wallet|save card/i,
    });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/wallet/cards",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            cardId: "card-2",
            nickname: "Flight Card",
            openedDate: undefined,
          }),
        }),
      );
    });
  });

  it("AC2: asks for confirmation before removing a card", async () => {
    let walletState = [...MOCK_WALLET.walletCards];

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (
          url.includes("/api/v1/wallet/cards") &&
          (!init || init.method === "GET" || !init.method)
        ) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ walletCards: walletState }),
          });
        }
        if (url.includes("/api/v1/catalog/cards")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MOCK_CATALOG),
          });
        }
        if (
          url.includes("/api/v1/wallet/cards/wc-1") &&
          init?.method === "DELETE"
        ) {
          walletState = [];
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Mint Everyday").length).toBeGreaterThan(0);
    });

    // Find and click Remove button
    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await userEvent.click(removeButtons[0]!);

    // Confirmation modal should appear with "Remove Mint Everyday from your wallet?"
    await waitFor(() => {
      expect(
        screen.getByText(/Remove Mint Everyday from your wallet\?/i),
      ).toBeInTheDocument();
    });

    // Click Confirm Remove in dialog
    const dialog = screen.getByRole("dialog");
    const confirmRemoveBtn = within(dialog).getByRole("button", {
      name: /^remove$/i,
    });
    await userEvent.click(confirmRemoveBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/wallet/cards/wc-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("AC2 & AC3: allows renaming card and rejects card numbers in nickname input", async () => {
    let walletState = [...MOCK_WALLET.walletCards];

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (
          url.includes("/api/v1/wallet/cards") &&
          (!init || init.method === "GET" || !init.method)
        ) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ walletCards: walletState }),
          });
        }
        if (url.includes("/api/v1/catalog/cards")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MOCK_CATALOG),
          });
        }
        if (
          url.includes("/api/v1/wallet/cards/wc-1") &&
          init?.method === "PATCH"
        ) {
          const body = JSON.parse(init.body as string);
          walletState = [
            {
              ...walletState[0]!,
              nickname: body.nickname,
            },
          ];
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ walletCard: walletState[0] }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Mint Everyday").length).toBeGreaterThan(0);
    });

    // Click Edit button
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await userEvent.click(editButtons[0]!);

    // Dialog appears
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Rename card/i)).toBeInTheDocument();

    const input = within(dialog).getByLabelText(/nickname/i);

    // Try typing a card number -> should show rejection message
    await userEvent.clear(input);
    await userEvent.type(input, "4111111111111111");
    expect(
      within(dialog).getByText(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      ),
    ).toBeInTheDocument();

    // Type a valid nickname and save
    await userEvent.clear(input);
    await userEvent.type(input, "Groceries & Supermarket");
    const saveBtn = within(dialog).getByRole("button", { name: /save/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/wallet/cards/wc-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ nickname: "Groceries & Supermarket" }),
        }),
      );
    });
  });

  it("US-08 AC1 (Issue #20): displays due day and autopay on wallet card and saves updated payment settings", async () => {
    let walletState = [
      {
        ...MOCK_WALLET.walletCards[0]!,
        paymentSettings: { dueDay: 15, isAutopay: false },
      },
    ];

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (
          url.includes("/api/v1/wallet/cards") &&
          (!init || init.method === "GET" || !init.method)
        ) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ walletCards: walletState }),
          });
        }
        if (url.includes("/api/v1/catalog/cards")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MOCK_CATALOG),
          });
        }
        if (
          url === "/api/v1/wallet/cards/wc-1/payment-settings" &&
          init?.method === "PUT"
        ) {
          const body = JSON.parse(init.body as string) as {
            dueDay: number;
            isAutopay: boolean;
          };
          walletState = [
            {
              ...walletState[0]!,
              paymentSettings: {
                dueDay: body.dueDay,
                isAutopay: body.isAutopay,
              },
            },
          ];
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                walletCard: walletState[0],
                paymentSettings: walletState[0]!.paymentSettings,
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Day 15/i).length).toBeGreaterThan(0);
    });

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await userEvent.click(editButtons[0]!);

    const dialog = screen.getByRole("dialog");
    const dueDayInput = within(dialog).getByLabelText(/Payment due day/i);
    await userEvent.clear(dueDayInput);
    await userEvent.type(dueDayInput, "25");

    const autopaySwitch = within(dialog).getByRole("switch", {
      name: /Autopay/i,
    });
    await userEvent.click(autopaySwitch);

    const savePaymentBtn = within(dialog).getByRole("button", {
      name: /Update payment settings/i,
    });
    await userEvent.click(savePaymentBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/wallet/cards/wc-1/payment-settings",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ dueDay: 25, isAutopay: true }),
        }),
      );
    });
  });

  it("US-05 AC1 & AC2 (Issue #23): displays this and next quarter rotating categories and activates a quarter", async () => {
    let walletState = [
      {
        id: "wc-orbit",
        userId: "u-1",
        cardId: "card-orbit",
        nickname: null,
        openedDate: "2025-01-10",
        createdAt: "2026-10-01T00:00:00Z",
        activatedQuarters: [],
        rotatingQuarters: {
          currentQuarter: {
            quarter: "2026-Q4",
            isActivated: false,
            categories: [{ category: "GAS", rateX100: 500, capCents: 150000 }],
          },
          nextQuarter: {
            quarter: "2027-Q1",
            isActivated: false,
            categories: [
              { category: "GROCERIES", rateX100: 500, capCents: 150000 },
            ],
          },
        },
        card: {
          id: "card-orbit",
          name: "Orbit Quarterly",
          issuer: "Demo Bank",
          artColor: "#6C5CE7",
          isDemo: true,
          annualFeeCents: 0,
          baseRateX100: 100,
          program: { name: "Cash Back", centsPer100Points: 100 },
          rates: [],
        },
      },
    ];

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (
          url.includes("/api/v1/wallet/cards") &&
          (!init || init.method === "GET" || !init.method)
        ) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ walletCards: walletState }),
          });
        }
        if (url.includes("/api/v1/catalog/cards")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MOCK_CATALOG),
          });
        }
        if (
          url === "/api/v1/wallet/cards/wc-orbit/quarter-activations" &&
          init?.method === "POST"
        ) {
          const body = JSON.parse(init.body as string) as { quarter: string };
          walletState = [
            {
              ...walletState[0]!,
              activatedQuarters: [body.quarter],
              rotatingQuarters: {
                ...walletState[0]!.rotatingQuarters,
                currentQuarter: {
                  ...walletState[0]!.rotatingQuarters.currentQuarter,
                  isActivated: body.quarter === "2026-Q4",
                },
              },
            },
          ];
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                activation: {
                  walletCardId: "wc-orbit",
                  quarter: body.quarter,
                  activatedAt: new Date().toISOString(),
                },
                walletCard: walletState[0],
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/2026-Q4/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/2027-Q1/i).length).toBeGreaterThan(0);
    });

    const activateButtons = screen.getAllByRole("button", {
      name: /Activate 2026-Q4/i,
    });
    await userEvent.click(activateButtons[0]!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/wallet/cards/wc-orbit/quarter-activations",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ quarter: "2026-Q4" }),
        }),
      );
      expect(screen.getAllByText(/Activated/i).length).toBeGreaterThan(0);
    });
  });
});
