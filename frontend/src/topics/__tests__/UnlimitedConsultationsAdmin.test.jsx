import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UnlimitedConsultationsAdmin from '../UnlimitedConsultationsAdmin';
import { renderWithProviders, mockAuthValue } from '../../test/formTestUtils';

const mockGetUnlimited = vi.fn();
const mockAddUnlimited = vi.fn();
const mockRemoveUnlimited = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    getUnlimitedConsultationUsers: (...args) => mockGetUnlimited(...args),
    addUnlimitedConsultationUser: (...args) => mockAddUnlimited(...args),
    removeUnlimitedConsultationUser: (...args) => mockRemoveUnlimited(...args),
  },
}));

const staffAuth = {
  ...mockAuthValue,
  authState: {
    isAuthenticated: true,
    user: { id: 2, username: 'admin', is_staff: true },
  },
  authInitialized: true,
};

describe('UnlimitedConsultationsAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUnlimited.mockResolvedValue({
      count: 0,
      daily_default_limit: 3,
      results: [],
    });
  });

  it('lists allowlisted users and adds by user ID', async () => {
    const user = userEvent.setup();
    mockAddUnlimited.mockResolvedValue({
      id: 1,
      user_id: 5,
      username: 'tester',
      email: 'tester@example.com',
      note: 'qa',
      added_by_id: 2,
      added_by_username: 'admin',
      created_at: '2026-10-01T12:00:00Z',
    });

    renderWithProviders(<UnlimitedConsultationsAdmin />, { auth: staffAuth });

    expect(await screen.findByText('Usuarios sin límite diario')).toBeInTheDocument();
    expect(
      screen.getByText(/ningún usuario tiene consultas ilimitadas/i),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/user id/i), '5');
    await user.type(screen.getByLabelText(/nota/i), 'qa');
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    await waitFor(() => {
      expect(mockAddUnlimited).toHaveBeenCalledWith({ user_id: 5, note: 'qa' });
    });
    expect(await screen.findByText('tester')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('removes a user from the allowlist', async () => {
    const user = userEvent.setup();
    mockGetUnlimited.mockResolvedValue({
      count: 1,
      daily_default_limit: 3,
      results: [
        {
          id: 1,
          user_id: 7,
          username: 'alice',
          email: 'alice@example.com',
          note: '',
          added_by_id: 2,
          added_by_username: 'admin',
          created_at: '2026-10-01T12:00:00Z',
        },
      ],
    });
    mockRemoveUnlimited.mockResolvedValue(undefined);

    renderWithProviders(<UnlimitedConsultationsAdmin />, { auth: staffAuth });
    expect(await screen.findByText('alice')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /quitar ilimitado a user 7/i }));

    await waitFor(() => {
      expect(mockRemoveUnlimited).toHaveBeenCalledWith(7);
    });
    expect(screen.queryByText('alice')).not.toBeInTheDocument();
  });
});
