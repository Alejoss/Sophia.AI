import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecuritySection } from '../Profile';

const mockChangePassword = vi.fn();

vi.mock('../../api/profilesApi', () => ({
  getUserProfile: vi.fn(),
  getProfileById: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  changePassword: (...args) => mockChangePassword(...args),
}));

describe('SecuritySection (change password form)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation errors on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    render(<SecuritySection />);

    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    expect(await screen.findByText(/la contraseña actual es requerida/i)).toBeInTheDocument();
    expect(screen.getByText(/confirma la nueva contraseña/i)).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('changes the password and shows a success message', async () => {
    const user = userEvent.setup();
    mockChangePassword.mockResolvedValue({});
    render(<SecuritySection />);

    await user.type(screen.getByLabelText(/contraseña actual/i), 'OldPass123!');
    await user.type(screen.getByLabelText(/^nueva contraseña$/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/confirmar nueva contraseña/i), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith('OldPass123!', 'NewPass123!', 'NewPass123!');
    });
    expect(
      await screen.findByText(/¡contraseña cambiada exitosamente!/i),
    ).toBeInTheDocument();
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockChangePassword.mockRejectedValue({
      response: { data: { error: 'La contraseña actual es incorrecta' } },
    });
    render(<SecuritySection />);

    await user.type(screen.getByLabelText(/contraseña actual/i), 'WrongPass123!');
    await user.type(screen.getByLabelText(/^nueva contraseña$/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/confirmar nueva contraseña/i), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    expect(
      await screen.findByText(/la contraseña actual es incorrecta/i),
    ).toBeInTheDocument();
  });
});
