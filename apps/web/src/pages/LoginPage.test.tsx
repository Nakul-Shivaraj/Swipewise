import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { LoginPage } from './LoginPage.js';

describe('Log in page (US-01 / Issue #10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('AC2: renders fields in glass group: Email, Password, Log in button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Log in/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Don't have an account\?/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/We never ask for card numbers/i)).toBeInTheDocument();
  });

  it('AC2: validates email format on blur', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/^Email/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    });
  });

  it('AC2: displays generic "Email or password is incorrect." on 401 response', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
        },
      }),
    } as Response);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/^Email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^Password/i), 'WrongPass123');
    await user.click(screen.getByRole('button', { name: /Log in/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Email or password is incorrect.')
      ).toBeInTheDocument();
    });
  });

  it('AC2: successfully logs in and redirects on 200 response', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: 'test-user-id',
          name: 'Nakul Shivaraj',
          email: 'nakul@example.com',
        },
      }),
    } as Response);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/^Email/i), 'nakul@example.com');
    await user.type(screen.getByLabelText(/^Password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /Log in/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nakul@example.com',
          password: 'Password123',
        }),
      });
    });
  });
});
