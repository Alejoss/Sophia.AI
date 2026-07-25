import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPassword from '../ForgotPassword';
import { renderWithProviders, unauthenticatedAuth } from '../../test/formTestUtils';

const mockRequestPasswordReset = vi.fn();

vi.mock('../../api/profilesApi.js', () => ({
  requestPasswordReset: (...args) => mockRequestPasswordReset(...args),
}));

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation error for empty email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />, {
      auth: unauthenticatedAuth(),
      route: '/profiles/forgot-password',
    });

    await user.click(screen.getByRole('button', { name: /enviar enlace/i }));
    expect(await screen.findByText(/correo electrónico es requerido/i)).toBeInTheDocument();
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
  });

  it('submits email and shows success message', async () => {
    const user = userEvent.setup();
    mockRequestPasswordReset.mockResolvedValue({ detail: 'Password reset e-mail has been sent.' });

    renderWithProviders(<ForgotPassword />, {
      auth: unauthenticatedAuth(),
      route: '/profiles/forgot-password',
    });

    await user.type(screen.getByLabelText(/correo electrónico/i), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /enviar enlace/i }));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('alice@example.com');
    });
    expect(await screen.findByText(/si existe una cuenta/i)).toBeInTheDocument();
    expect(screen.getByText(/alice@example.com/i)).toBeInTheDocument();
  });

  it('links back to login', () => {
    renderWithProviders(<ForgotPassword />, {
      auth: unauthenticatedAuth(),
      route: '/profiles/forgot-password',
    });

    expect(screen.getByRole('link', { name: /volver a iniciar sesión/i })).toHaveAttribute(
      'href',
      '/profiles/login',
    );
  });
});
