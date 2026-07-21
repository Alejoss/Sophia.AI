import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../Login';
import { renderWithProviders, unauthenticatedAuth } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockApiLogin = vi.fn();
const mockCheckAuth = vi.fn();
const mockUpdateAuthState = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null, pathname: '/profiles/login' }),
  };
});

vi.mock('../../api/profilesApi.js', () => ({
  apiLogin: (...args) => mockApiLogin(...args),
  checkAuth: (...args) => mockCheckAuth(...args),
  refreshToken: vi.fn(),
  getUserProfile: vi.fn(),
}));

vi.mock('../../components/SocialLogin', () => ({
  default: () => <div data-testid="social-login">SocialLogin</div>,
}));

vi.mock('../../context/localStorageUtils.js', () => ({
  getUserFromLocalStorage: () => null,
  setAuthenticationStatus: vi.fn(),
  isAuthenticated: () => false,
  getAccessTokenFromLocalStorage: () => null,
  setAccessTokenInLocalStorage: vi.fn(),
}));

describe('Login form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAuth.mockResolvedValue({ isAuthenticated: false, user: null });
  });

  it('shows field errors when submitting empty', async () => {
    const user = userEvent.setup();
    const auth = {
      ...unauthenticatedAuth(),
      updateAuthState: mockUpdateAuthState,
    };

    renderWithProviders(<Login />, { auth, route: '/profiles/login' });

    await screen.findByRole('button', { name: /iniciar sesión/i });
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText(/usuario o correo es requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/contraseña es requerida/i)).toBeInTheDocument();
    expect(mockApiLogin).not.toHaveBeenCalled();
  });

  it('logs in and navigates on success', async () => {
    const user = userEvent.setup();
    mockApiLogin.mockResolvedValue({
      data: {
        access_token: 'token-abc',
        id: 1,
        username: 'alice',
        email: 'a@b.com',
      },
    });

    const auth = {
      ...unauthenticatedAuth(),
      updateAuthState: mockUpdateAuthState,
    };

    renderWithProviders(<Login />, { auth, route: '/profiles/login' });

    await screen.findByLabelText(/usuario o correo/i);
    await user.type(screen.getByLabelText(/usuario o correo/i), 'alice');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'secret');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockApiLogin).toHaveBeenCalledWith({
        username: 'alice',
        password: 'secret',
      });
      expect(mockUpdateAuthState).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/profiles/login_successful');
    });
  });

  it('shows Spanish API error on failed login', async () => {
    const user = userEvent.setup();
    mockApiLogin.mockRejectedValue({
      response: { data: { error: 'Credenciales inválidas' } },
    });

    renderWithProviders(<Login />, {
      auth: { ...unauthenticatedAuth(), updateAuthState: mockUpdateAuthState },
      route: '/profiles/login',
    });

    await user.type(await screen.findByLabelText(/usuario o correo/i), 'alice');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'bad');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText(/credenciales inválidas/i)).toBeInTheDocument();
    expect(mockUpdateAuthState).not.toHaveBeenCalled();
  });
});
