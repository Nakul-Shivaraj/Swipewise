import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { HomePage } from "./HomePage.js";

const MOCK_GROCERIES_RESPONSE = {
  category: "GROCERIES",
  amountCents: 10000,
  isEmptyWallet: false,
  rankedCards: [
    {
      walletCardId: "wc-1",
      cardId: "c-1",
      name: "Mint Everyday",
      issuer: "Demo Bank",
      artColor: "#2F8C55",
      isDemo: true,
      nickname: null,
      annualFeeCents: 0,
      programName: "Cash Back",
      centsPer100Points: 100,
      appliedRateX100: 400,
      baseRateX100: 100,
      usedBaseRate: false,
      capCents: null,
      isCapExceeded: false,
      rewardCents: 400,
      rank: 1,
      isBestPick: true,
    },
    {
      walletCardId: "wc-2",
      cardId: "c-2",
      name: "Basic Flat",
      issuer: "Demo Bank",
      artColor: "#958C7B",
      isDemo: true,
      nickname: null,
      annualFeeCents: 0,
      programName: "Cash Back",
      centsPer100Points: 100,
      appliedRateX100: 150,
      baseRateX100: 150,
      usedBaseRate: true,
      capCents: null,
      isCapExceeded: false,
      rewardCents: 150,
      rank: 2,
      isBestPick: false,
    },
    {
      walletCardId: "wc-3",
      cardId: "c-3",
      name: "Harbor Travel Plus",
      issuer: "Demo Bank",
      artColor: "#2F74D0",
      isDemo: true,
      nickname: null,
      annualFeeCents: 9500,
      programName: "Harbor Points",
      centsPer100Points: 125,
      appliedRateX100: 100,
      baseRateX100: 100,
      usedBaseRate: true,
      capCents: null,
      isCapExceeded: false,
      rewardCents: 125,
      rank: 3,
      isBestPick: false,
    },
  ],
};

describe("HomePage — Best card by category (US-03 / Issue #12)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC1 & AC2: choosing a category fetches and displays ranked wallet cards with Best pick and Demo labels", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_GROCERIES_RESPONSE,
    } as Response);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Search a store or pick a category\./i),
    ).toBeInTheDocument();

    const groceriesButtons = screen.getAllByRole("button", {
      name: /Groceries/i,
    });
    await user.click(groceriesButtons[0]!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/recommendations?category=GROCERIES&amountCents=10000",
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("Mint Everyday").length).toBeGreaterThan(0);
      expect(screen.getAllByText("$4.00").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Basic Flat").length).toBeGreaterThan(0);
      expect(screen.getAllByText("$1.50").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Harbor Travel Plus").length).toBeGreaterThan(
        0,
      );
      expect(screen.getAllByText("$1.25").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Best pick/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/^Demo$/i).length).toBeGreaterThan(0);
    });
  });

  it("AC3: changing the purchase amount re-queries the server with updated amountCents", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_GROCERIES_RESPONSE,
    } as Response);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const amountInput = screen.getByLabelText(/Purchase amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "250");

    const groceriesButtons = screen.getAllByRole("button", {
      name: /Groceries/i,
    });
    await user.click(groceriesButtons[0]!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/recommendations?category=GROCERIES&amountCents=25000",
      );
    });
  });

  it('AC5: with an empty wallet, shows "Add cards to see your best pick" with a link to /wallet', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        category: "DINING",
        amountCents: 10000,
        isEmptyWallet: true,
        rankedCards: [],
      }),
    } as Response);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const diningButtons = screen.getAllByRole("button", { name: /Dining/i });
    await user.click(diningButtons[0]!);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Add cards to see your best pick/i).length,
      ).toBeGreaterThan(0);
    });

    const walletLinks = screen.getAllByRole("link", {
      name: /Go to Wallet|Add cards|Wallet/i,
    });
    expect(
      walletLinks.some((link) => link.getAttribute("href") === "/wallet"),
    ).toBe(true);
  });

  it('shows error state with "Something went wrong. Try again." and a Retry button when request fails', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong. Try again.",
        },
      }),
    } as Response);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const gasButtons = screen.getAllByRole("button", { name: /Gas/i });
    await user.click(gasButtons[0]!);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Something went wrong\. Try again\./i).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole("button", { name: /Retry/i }).length,
      ).toBeGreaterThan(0);
    });
  });
});

describe("HomePage — Store search (US-04 / Issue #13)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["SAFEWAY", "safeway", "safeway.com"])(
    'AC1 & AC2: searching "%s" finds Safeway (Groceries) and ranks Mint Everyday first at $4.00 on $100 with Demo labels',
    async (query) => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.startsWith("/api/v1/stores/search")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              stores: [
                {
                  id: "store-safeway",
                  name: "Safeway",
                  category: "GROCERIES",
                  aliases: ["Safeway Grocery", "safeway.com"],
                },
              ],
            }),
          } as Response;
        }
        if (url.startsWith("/api/v1/recommendations")) {
          return {
            ok: true,
            status: 200,
            json: async () => MOCK_GROCERIES_RESPONSE,
          } as Response;
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );

      const searchInput = screen.getByLabelText(/Search a store/i);
      await user.clear(searchInput);
      await user.type(searchInput, query);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/v1/stores/search?q=${encodeURIComponent(query)}`,
        );
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/v1/recommendations?category=GROCERIES&amountCents=10000",
        );
      });

      await waitFor(() => {
        expect(
          screen.getAllByText(
            /Your cards at Safeway|All your cards at Safeway/i,
          ).length,
        ).toBeGreaterThan(0);
        expect(screen.getAllByText("Mint Everyday").length).toBeGreaterThan(0);
        expect(screen.getAllByText("$4.00").length).toBeGreaterThan(0);
        expect(screen.getAllByText(/^Demo$/i).length).toBeGreaterThan(0);
      });
    },
  );

  it('AC3: a search with no match shows "We don\'t know this store yet. Pick a category." and lets the user pick a category manually', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith("/api/v1/stores/search")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ stores: [] }),
        } as Response;
      }
      if (url.startsWith("/api/v1/recommendations")) {
        return {
          ok: true,
          status: 200,
          json: async () => MOCK_GROCERIES_RESPONSE,
        } as Response;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const searchInput = screen.getByLabelText(/Search a store/i);
    await user.type(searchInput, "UnknownMart");

    await waitFor(() => {
      expect(
        screen.getByText(/We don't know this store yet\. Pick a category\./i),
      ).toBeInTheDocument();
    });

    const groceriesButtons = screen.getAllByRole("button", {
      name: /Groceries/i,
    });
    await user.click(groceriesButtons[0]!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/recommendations?category=GROCERIES&amountCents=10000",
      );
      expect(screen.getAllByText("Mint Everyday").length).toBeGreaterThan(0);
      expect(screen.getAllByText("$4.00").length).toBeGreaterThan(0);
    });
  });

  it("AC5: pressing '/' on the page focuses the store search input", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const searchInput = screen.getByLabelText(/Search a store/i);
    expect(searchInput).not.toHaveFocus();

    await user.keyboard("/");
    expect(searchInput).toHaveFocus();
  });
});
