import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TokenBuyPage from '../TokenBuyPage';
import { renderWithProviders } from '../../test/formTestUtils';

const mockGetPackages = vi.fn();
const mockListPurchases = vi.fn();
const mockCreatePurchase = vi.fn();
const mockGetUserProfile = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/paymentsApi', () => ({
  getTokenPackages: (...args) => mockGetPackages(...args),
  listTokenPurchases: (...args) => mockListPurchases(...args),
  createTokenPurchase: (...args) => mockCreatePurchase(...args),
  createTokenPurchaseBchPayment: vi.fn(),
  verifyTokenPurchaseBchPayment: vi.fn(),
}));

vi.mock('../../api/profilesApi', () => ({
  getUserProfile: (...args) => mockGetUserProfile(...args),
}));

vi.mock('../../payments/TokenCheckout', () => ({
  default: ({ checkout }) => (
    checkout ? <div>Checkout abierto: {checkout.title}</div> : null
  ),
}));

const packages = [
  { id: 1, name: '300 tokens', token_amount: 300, bonus_tokens: 0, total_tokens: 300, usd_price: '3.00', is_active: true },
  {
    id: 2,
    name: '800 tokens + 50 bonus',
    token_amount: 800,
    bonus_tokens: 50,
    total_tokens: 850,
    usd_price: '8.00',
    is_active: true,
  },
  {
    id: 3,
    name: '1200 tokens + 200 bonus',
    token_amount: 1200,
    bonus_tokens: 200,
    total_tokens: 1400,
    usd_price: '12.00',
    is_active: true,
  },
];

describe('TokenBuyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPackages.mockResolvedValue(packages);
    mockListPurchases.mockResolvedValue([]);
    mockGetUserProfile.mockResolvedValue({ token_balance: 0 });
    mockCreatePurchase.mockResolvedValue({
      id: 77,
      package_id: 1,
      package_name: '300 tokens',
      token_amount: 300,
      bonus_tokens: 0,
      total_tokens: 300,
      usd_price: '3.00',
      payment_status: 'PENDING',
    });
  });

  it('describes benefits and shows packages with rewards', async () => {
    renderWithProviders(<TokenBuyPage />);

    expect(await screen.findByRole('heading', { name: /comprar tokens/i })).toBeInTheDocument();
    expect(screen.getByText(/pagas menos en contenidos de pago/i)).toBeInTheDocument();
    expect(screen.getByText('Caminos de conocimiento')).toBeInTheDocument();
    expect(screen.getByText('Consultas de temas')).toBeInTheDocument();
    expect(screen.getByText(/no viven en una blockchain/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a mi saldo/i })).toHaveAttribute(
      'href',
      '/profiles/my_profile?section=tokens',
    );
    expect(screen.getByRole('button', { name: /comprar 300 tokens/i })).toBeInTheDocument();
    expect(screen.getByText('Mejor valor')).toBeInTheDocument();
    expect(screen.getByText(/\+50 de recompensa/i)).toBeInTheDocument();
  });

  it('starts checkout when buying a package', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TokenBuyPage />);

    await user.click(await screen.findByRole('button', { name: /comprar 300 tokens/i }));

    await waitFor(() => {
      expect(mockCreatePurchase).toHaveBeenCalledWith(1);
    });
    expect(await screen.findByText(/checkout abierto: 300 tokens/i)).toBeInTheDocument();
  });

  it('resumes a pending purchase for the same package', async () => {
    mockListPurchases.mockResolvedValue([
      {
        id: 12,
        package_id: 1,
        package_name: '300 tokens',
        token_amount: 300,
        bonus_tokens: 0,
        total_tokens: 300,
        usd_price: '3.00',
        payment_status: 'PENDING',
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<TokenBuyPage />);

    await user.click(await screen.findByRole('button', { name: /comprar 300 tokens/i }));
    expect(mockCreatePurchase).not.toHaveBeenCalled();
    expect(await screen.findByText(/checkout abierto: 300 tokens/i)).toBeInTheDocument();
  });
});
