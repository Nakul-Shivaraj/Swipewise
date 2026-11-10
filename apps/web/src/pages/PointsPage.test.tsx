import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { PointsPage } from "./PointsPage.js";
import { setCachedCsrfToken } from "../api.js";

const MOCK_PROGRAMS = [
  {
    programId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    programName: "Harbor Points",
    centsPer100Points: 125,
    balanceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    pointsBalance: 10000,
    valueCents: 12500,
    expiryDate: "2026-12-31",
  },
  {
    programId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    programName: "Cash Back",
    centsPer100Points: 100,
    balanceId: null,
    pointsBalance: null,
    valueCents: null,
    expiryDate: null,
  },
];

describe("PointsPage (US-09 / Issue #24)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setCachedCsrfToken("test-csrf-token");
  });

  it("AC1 & AC2: shows balance dollar value and expiry date, and saves an updated balance and expiry date", async () => {
    let programsState = [...MOCK_PROGRAMS];

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (
          url === "/api/v1/points-balances" &&
          (!init?.method || init.method === "GET")
        ) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ programs: programsState }),
          });
        }
        if (
          url === `/api/v1/points-balances/${MOCK_PROGRAMS[1]!.programId}` &&
          init?.method === "PUT"
        ) {
          const body = JSON.parse(init.body as string) as {
            pointsBalance: number;
            expiryDate: string;
          };
          const updated = {
            ...MOCK_PROGRAMS[1]!,
            balanceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            pointsBalance: body.pointsBalance,
            valueCents: body.pointsBalance,
            expiryDate: body.expiryDate,
          };
          programsState = [programsState[0]!, updated];
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ programBalance: updated }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PointsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Harbor Points")).toBeInTheDocument();
      expect(screen.getByText("$125.00")).toBeInTheDocument();
      expect(screen.getByText(/Expires 2026-12-31/i)).toBeInTheDocument();
      expect(screen.getByText("Cash Back")).toBeInTheDocument();
    });

    const cashBackBalanceInput = screen.getByLabelText(
      /Points balance for Cash Back/i,
    );
    const cashBackExpiryInput = screen.getByLabelText(
      /Expiry date for Cash Back/i,
    );

    await user.clear(cashBackBalanceInput);
    await user.type(cashBackBalanceInput, "5000");
    await user.clear(cashBackExpiryInput);
    await user.type(cashBackExpiryInput, "2027-06-30");

    const saveCashBackBtn = screen.getByRole("button", {
      name: /Save balance for Cash Back/i,
    });
    await user.click(saveCashBackBtn);

    await waitFor(() => {
      expect(screen.getByText("$50.00")).toBeInTheDocument();
      expect(screen.getByText(/Expires 2027-06-30/i)).toBeInTheDocument();
    });
  });

  it("displays empty state with link to wallet when user has no wallet cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ programs: [] }),
      }),
    );

    render(
      <MemoryRouter>
        <PointsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Add a card to your wallet to track points balances/i),
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
        <PointsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Something went wrong. Try again."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });
  });
});
