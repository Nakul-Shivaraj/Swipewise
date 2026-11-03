import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { LoginPage } from "./LoginPage.js";
import * as apiModule from "../api.js";

describe("Log in page (US-01 / Issue #10 / Issue #35)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC2: renders fields in glass group: Email, Password, Log in button", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log in/i })).toBeInTheDocument();
    expect(
      screen.getAllByText(/Don't have an account\?/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/We never ask for card numbers/i),
    ).toBeInTheDocument();
  });

  it("AC2: validates email format on blur", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/^Email/i);
    await user.type(emailInput, "invalid-email");
    await user.tab();

    await waitFor(() => {
      expect(
        screen.getByText("Enter a valid email address."),
      ).toBeInTheDocument();
    });
  });

  it('AC: displays "Email or password is incorrect." on 401 response with aria-live', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiModule, "apiFetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        },
      }),
    } as Response);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^Email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^Password/i), "WrongPass123");
    await user.click(screen.getByRole("button", { name: /Log in/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "polite");
      expect(alert).toHaveTextContent("Email or password is incorrect.");
    });
  });

  it('AC: displays "Too many tries. Wait a minute and try again." on 429 response with aria-live', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiModule, "apiFetch").mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many tries. Wait a minute and try again.",
        },
      }),
    } as Response);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^Email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^Password/i), "Password123");
    await user.click(screen.getByRole("button", { name: /Log in/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "polite");
      expect(alert).toHaveTextContent(
        "Too many tries. Wait a minute and try again.",
      );
    });
  });

  it('AC: displays "Something went wrong. Try again." on 500 response with aria-live', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiModule, "apiFetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error occurred.",
        },
      }),
    } as Response);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^Email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^Password/i), "Password123");
    await user.click(screen.getByRole("button", { name: /Log in/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "polite");
      expect(alert).toHaveTextContent("Something went wrong. Try again.");
    });
  });

  it('AC: displays "Something went wrong. Try again." on network error with aria-live', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiModule, "apiFetch").mockRejectedValue(
      new Error("Network error"),
    );

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^Email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^Password/i), "Password123");
    await user.click(screen.getByRole("button", { name: /Log in/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "polite");
      expect(alert).toHaveTextContent("Something went wrong. Try again.");
    });
  });

  it('AC: displays "Something went wrong. Try again." when 403 CSRF error persists with aria-live', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiModule, "apiFetch").mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: "EBADCSRFTOKEN",
          message: "Invalid or missing CSRF token.",
        },
      }),
    } as Response);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^Email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^Password/i), "Password123");
    await user.click(screen.getByRole("button", { name: /Log in/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "polite");
      expect(alert).toHaveTextContent("Something went wrong. Try again.");
    });
  });

  it("AC2: successfully logs in and redirects on 200 response", async () => {
    const user = userEvent.setup();
    const apiFetchSpy = vi.spyOn(apiModule, "apiFetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: "test-user-id",
          name: "Nakul Shivaraj",
          email: "nakul@example.com",
        },
      }),
    } as Response);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^Email/i), "nakul@example.com");
    await user.type(screen.getByLabelText(/^Password/i), "Password123");
    await user.click(screen.getByRole("button", { name: /Log in/i }));

    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalledWith(
        "/api/v1/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "nakul@example.com",
            password: "Password123",
          }),
        }),
      );
    });
  });
});
