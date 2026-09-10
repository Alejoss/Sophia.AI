import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileTokens from '../ProfileTokens';
import { renderWithProviders } from '../../test/formTestUtils';

const mockGetPackages = vi.fn();
const mockListPurchases = vi.fn();
const mockCreatePurchase = vi.fn();
const mockOnBalanceChange = vi.fn();

vi.mock('../../api/paymentsApi', () => ({
  getTokenPackages: (...args) => mockGetPackages(...args),
  listTokenPurchases: (...args) => mockListPurchases(...args),
  createTokenPurchase: (...args) => mockCreatePurchase(...args),
  createTokenPurchaseBchPayment: vi.fn(),
  verifyTokenPurchaseBchPayment: vi.fn(),
}));

vi.mock('../../payments/ProductPaymentCheckout', () => ({
  default: ({ open, title }) => (open ? <div>Checkout abierto: {title}</div> : null),
}));

const packages = [
  { id: 1, name: '100 tokens', token_amount: 100, usd_price: '1.00', is_active: true },
  { id: 2, name: '800 tokens', token_amount: 800, usd_price: '8.00', is_active: true },
];

describe('ProfileTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPackages.mockResolvedValue(packages);
    mockListPurchases.mockResolvedValue([]);
    mockCreatePurchase.mockResolvedValue({
      id: 77,
      package_id: 1,
      package_name: '100 tokens',
      token_amount: 100,
      usd_price: '1.00',
      payment_status: 'PENDING',
    });
    mockOnBalanceChange.mockResolvedValue();
  });

  it('shows empty balance copy and package cards', async () => {
    renderWithProviders(<ProfileTokens tokenBalance={0} onBalanceChange={mockOnBalanceChange} />);

    expect(await screen.findByText(/aún no tienes tokens/i)).toBeInTheDocument();
    expect(screen.getByText('100 tokens')).toBeInTheDocument();
    expect(screen.getByText('800 tokens')).toBeInTheDocument();
    expect(screen.queryByText('Mejor valor')).not.toBeInTheDocument();
    expect(screen.getByText(/1 token = \$0\.01 usd/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$0\.01 por token/i).length).toBeGreaterThan(0);
  });

  it('starts checkout when buying a package', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfileTokens tokenBalance={0} onBalanceChange={mockOnBalanceChange} />);

    const buyButtons = await screen.findAllByRole('button', { name: /^comprar$/i });
    await user.click(buyButtons[0]);

    await waitFor(() => {
      expect(mockCreatePurchase).toHaveBeenCalledWith(1);
    });
    expect(await screen.findByText(/checkout abierto: 100 tokens/i)).toBeInTheDocument();
  });

  it('resumes a pending purchase without creating another', async () => {
    mockListPurchases.mockResolvedValue([
      {
        id: 12,
        package_id: 1,
        package_name: '100 tokens',
        token_amount: 100,
        usd_price: '1.00',
        payment_status: 'PENDING',
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<ProfileTokens tokenBalance={12} onBalanceChange={mockOnBalanceChange} />);

    expect(await screen.findByText(/continuar pago/i)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continuar pago/i }));
    expect(mockCreatePurchase).not.toHaveBeenCalled();
    expect(await screen.findByText(/checkout abierto: 100 tokens/i)).toBeInTheDocument();
  });
});
