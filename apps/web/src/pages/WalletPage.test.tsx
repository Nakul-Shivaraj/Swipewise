import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { WalletPage } from "./WalletPage.js";

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

    // Click Confirm Remove
    const confirmRemoveBtn = screen.getByRole("button", { name: /^remove$/i });
    await userEvent.click(confirmRemoveBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/wallet/cards/wc-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
