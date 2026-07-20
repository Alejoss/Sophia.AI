import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClubDeLectura from '../ClubDeLectura';
import bookClubsApi from '../../api/bookClubsApi';
import { renderWithProviders, unauthenticatedAuth } from '../../test/formTestUtils';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/bookClubsApi', () => ({
  default: {
    listClubs: vi.fn(),
    joinClub: vi.fn(),
  },
}));

describe('ClubDeLectura landing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links to the latest active club and does not show the email waitlist form', async () => {
    bookClubsApi.listClubs.mockResolvedValue([
      {
        id: 1,
        title: 'Club Viejo',
        slug: 'club-viejo',
        status: 'active',
        created_at: '2026-06-01T00:00:00Z',
        is_member: false,
      },
      {
        id: 2,
        title: 'El Secuestro de Bitcoin',
        slug: 'el-secuestro-de-bitcoin',
        status: 'active',
        created_at: '2026-07-10T00:00:00Z',
        is_member: false,
      },
    ]);

    renderWithProviders(<ClubDeLectura />, { auth: unauthenticatedAuth() });

    expect(
      await screen.findByRole('heading', { name: /el club de lectura ya comenzó/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/inició el 20 de Julio/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía puedes unirte/i)).toBeInTheDocument();
    expect(screen.getByText(/El Secuestro de Bitcoin/)).toBeInTheDocument();
    expect(screen.queryByText(/Club Viejo/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quiero participar/i })).not.toBeInTheDocument();

    expect(await screen.findByRole('button', { name: /entrar al club/i })).toBeInTheDocument();
  });

  it('navigates into the latest active club when the CTA is clicked', async () => {
    const user = userEvent.setup();
    bookClubsApi.listClubs.mockResolvedValue([
      {
        id: 2,
        title: 'El Secuestro de Bitcoin',
        slug: 'el-secuestro-de-bitcoin',
        status: 'active',
        created_at: '2026-07-10T00:00:00Z',
        is_member: false,
      },
    ]);

    renderWithProviders(<ClubDeLectura />, {
      auth: unauthenticatedAuth(),
    });

    await user.click(await screen.findByRole('button', { name: /entrar al club/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/club-de-lectura/el-secuestro-de-bitcoin');
    });
  });
});
