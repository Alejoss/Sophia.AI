import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Register from '../Register';
import { renderWithProviders, unauthenticatedAuth } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockApiRegister = vi.fn();
const mockUpdateAuthState = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/profilesApi', () => ({
  apiRegister: (...args) => mockApiRegister(...args),
}));

vi.mock('../../components/SocialLogin', () => ({
  default: () => <div data-testid="social-login">SocialLogin</div>,
}));

describe('Register form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation errors for empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />, {
      auth: { ...unauthenticatedAuth(), updateAuthState: mockUpdateAuthState },
      route: '/profiles/register',
    });

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/nombre de usuario es requerido/i)).toBeInTheDocument();
    expect(mockApiRegister).not.toHaveBeenCalled();
  });

  it('does not send confirmPassword and auths on success', async () => {
    const user = userEvent.setup();
    mockApiRegister.mockResolvedValue({
      data: {
        access_token: 'tok',
        id: 9,
        username: 'newuser',
        email: 'n@e.com',
      },
    });

    renderWithProviders(<Register />, {
      auth: { ...unauthenticatedAuth(), updateAuthState: mockUpdateAuthState },
      route: '/profiles/register',
    });

    await user.type(screen.getByLabelText(/nombre de usuario/i), 'newuser');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'n@e.com');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'Str0ng!pass');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'Str0ng!pass');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(mockApiRegister).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'n@e.com',
        password: 'Str0ng!pass',
      });
      expect(mockUpdateAuthState).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/profiles/login_successful');
    });
  });

  it('maps duplicate email API error to field helperText', async () => {
    const user = userEvent.setup();
    mockApiRegister.mockRejectedValue({
      response: {
        data: { email: ['A user with this email already exists.'] },
      },
    });

    renderWithProviders(<Register />, {
      auth: { ...unauthenticatedAuth(), updateAuthState: mockUpdateAuthState },
      route: '/profiles/register',
    });

    await user.type(screen.getByLabelText(/nombre de usuario/i), 'newuser');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'taken@e.com');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'Str0ng!pass');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'Str0ng!pass');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(
      await screen.findByText(/ya existe un usuario con ese correo electrónico/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
