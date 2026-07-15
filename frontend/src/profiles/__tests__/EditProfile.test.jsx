import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditProfile from '../EditProfile';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockGetUserProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockUpdateAuthState = vi.fn();
const mockGetAccessTokenFromLocalStorage = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/profilesApi', () => ({
  getUserProfile: (...args) => mockGetUserProfile(...args),
  updateProfile: (...args) => mockUpdateProfile(...args),
}));

vi.mock('../../context/localStorageUtils', () => ({
  getAccessTokenFromLocalStorage: (...args) => mockGetAccessTokenFromLocalStorage(...args),
}));

const baseProfile = {
  user: { username: 'alice' },
  profile_description: 'Hola',
  external_url: '',
  interests: 'crypto, blockchain',
  username_change_count: 0,
  profile_picture: null,
};

describe('EditProfile form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserProfile.mockResolvedValue(baseProfile);
  });

  it('shows a username validation error and does not call the API', async () => {
    const user = userEvent.setup();
    const auth = { updateAuthState: mockUpdateAuthState };
    renderWithProviders(<EditProfile />, { auth });

    const usernameField = await screen.findByDisplayValue('alice');
    await user.clear(usernameField);
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(
      await screen.findByText(/el nombre de usuario es requerido/i),
    ).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('submits a FormData payload and navigates on success', async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValue({ user: null });
    const auth = { updateAuthState: mockUpdateAuthState };
    renderWithProviders(<EditProfile />, { auth });

    await screen.findByDisplayValue('alice');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    });
    const [formData] = mockUpdateProfile.mock.calls[0];
    expect(formData.get('profile_description')).toBe('Hola');
    expect(mockNavigate).toHaveBeenCalledWith('/profiles/my_profile');
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockRejectedValue({
      response: { data: { error: 'No se pudo actualizar el perfil' } },
    });
    const auth = { updateAuthState: mockUpdateAuthState };
    renderWithProviders(<EditProfile />, { auth });

    await screen.findByDisplayValue('alice');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(
      await screen.findByText(/no se pudo actualizar el perfil/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
