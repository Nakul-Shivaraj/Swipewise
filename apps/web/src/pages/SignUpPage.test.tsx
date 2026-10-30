import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SignUpPage } from './SignUpPage.js';

describe('Sign up page (US-01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('AC2: renders fields in one glass group: Name, Email, Password, Confirm password', () => {
    render(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Create account/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/We never ask for card numbers/i)).toBeInTheDocument();
  });

  it('AC2: validates fields on blur and on submit with exact error messages', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/Name/i);
    await user.click(nameInput);
    await user.tab(); // blur

    await waitFor(() => {
      expect(screen.getByText('Enter your name.')).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/^Email/i);
    await user.type(emailInput, 'invalid');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/^Password/i);
    await user.type(passwordInput, 'short');
    await user.tab();

    await waitFor(() => {
      expect(
        screen.getByText('Use 8 or more characters with at least one number.')
      ).toBeInTheDocument();
    });

    const confirmPasswordInput = screen.getByLabelText(/Confirm password/i);
    await user.type(confirmPasswordInput, 'different');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    });
  });

  it('AC2: updates password strength bar and helper text as user types', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText(/^Password/i);
    await user.type(passwordInput, 'abc');
    expect(screen.getByText(/Weak/i)).toBeInTheDocument();

    await user.type(passwordInput, '12345');
    expect(screen.getByText(/Okay/i)).toBeInTheDocument();

    await user.type(passwordInput, 'A!');
    expect(screen.getByText(/Strong password/i)).toBeInTheDocument();
  });

  it('AC3: handles 409 conflict: "An account with this email already exists. Log in instead?"', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists. Log in instead?',
        },
      }),
    });

    render(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/Name/i), 'Nakul');
    await user.type(screen.getByLabelText(/^Email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^Password/i), 'Password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/An account with this email already exists/i)
      ).toBeInTheDocument();
    });
  });
});
