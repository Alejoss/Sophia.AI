import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileTokens from '../ProfileTokens';
import { renderWithProviders } from '../../test/formTestUtils';

const mockListPurchases = vi.fn();
const mockOnBalanceChange = vi.fn();

vi.mock('../../api/paymentsApi', () => ({
  listTokenPurchases: (...args) => mockListPurchases(...args),
  createTokenPurchaseBchPayment: vi.fn(),
  verifyTokenPurchaseBchPayment: vi.fn(),
}));

vi.mock('../../payments/TokenCheckout', () => ({
  default: ({ checkout }) => (
    checkout ? <div>Checkout abierto: {checkout.title}</div> : null
  ),
}));

describe('ProfileTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPurchases.mockResolvedValue([]);
    mockOnBalanceChange.mockResolvedValue();
  });

  it('shows wallet copy and links to the buy page', async () => {
    renderWithProviders(<ProfileTokens tokenBalance={0} onBalanceChange={mockOnBalanceChange} />);

    expect(await screen.findByText(/aún no tienes tokens/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /comprar tokens/i })).toHaveAttribute('href', '/acbc-tokens');
    expect(screen.getByRole('link', { name: /elige un paquete/i })).toHaveAttribute('href', '/acbc-tokens');
    expect(screen.getByText(/1 token = \$0\.01 usd/i)).toBeInTheDocument();
    expect(screen.getByText(/actividad/i)).toBeInTheDocument();
  });

  it('lets the user resume a pending purchase from activity', async () => {
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
    renderWithProviders(<ProfileTokens tokenBalance={12} onBalanceChange={mockOnBalanceChange} />);

    expect(await screen.findByText(/continuar pago/i)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/pago pendiente/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continuar pago/i }));
    expect(await screen.findByText(/checkout abierto: 300 tokens/i)).toBeInTheDocument();
  });
});
