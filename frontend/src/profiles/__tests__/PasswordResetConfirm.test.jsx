import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import PasswordResetConfirm from '../PasswordResetConfirm';
import { renderWithProviders, unauthenticatedAuth } from '../../test/formTestUtils';

const mockConfirmPasswordReset = vi.fn();

vi.mock('../../api/profilesApi.js', () => ({
  confirmPasswordReset: (...args) => mockConfirmPasswordReset(...args),
}));

function renderConfirm(route = '/profiles/password-reset/confirm/uid123/token-abc') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/profiles/password-reset/confirm/:uid/:token"
        element={<PasswordResetConfirm />}
      />
    </Routes>,
    {
      auth: unauthenticatedAuth(),
      route,
    },
  );
}

describe('PasswordResetConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits new password with uid and token from the URL', async () => {
    const user = userEvent.setup();
    mockConfirmPasswordReset.mockResolvedValue({ detail: 'Password has been reset with the new password.' });

    renderConfirm();

    const password = 'SecurePass1!';
    await user.type(screen.getByLabelText(/^nueva contraseña$/i), password);
    await user.type(screen.getByLabelText(/confirmar nueva contraseña/i), password);
    await user.click(screen.getByRole('button', { name: /restablecer contraseña/i }));

    await waitFor(() => {
      expect(mockConfirmPasswordReset).toHaveBeenCalledWith({
        uid: 'uid123',
        token: 'token-abc',
        newPassword1: password,
        newPassword2: password,
      });
    });
    expect(await screen.findByText(/se actualizó correctamente/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a iniciar sesión/i })).toHaveAttribute(
      'href',
      '/profiles/login',
    );
  });

  it('shows API error when token is invalid', async () => {
    const user = userEvent.setup();
    mockConfirmPasswordReset.mockRejectedValue({
      response: { data: { token: ['Invalid value'] } },
    });

    renderConfirm();

    const password = 'SecurePass1!';
    await user.type(screen.getByLabelText(/^nueva contraseña$/i), password);
    await user.type(screen.getByLabelText(/confirmar nueva contraseña/i), password);
    await user.click(screen.getByRole('button', { name: /restablecer contraseña/i }));

    expect(await screen.findByText(/enlace no es válido o ha caducado/i)).toBeInTheDocument();
  });
});
