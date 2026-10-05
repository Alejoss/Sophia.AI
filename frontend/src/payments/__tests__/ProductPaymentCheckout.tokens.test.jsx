import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import { renderWithProviders } from '../../test/formTestUtils';
import { PRODUCT_KINDS } from '../productCatalog';

const {
  mockGatewayStatus,
  mockPayWithTokens,
} = vi.hoisted(() => ({
  mockGatewayStatus: vi.fn(),
  mockPayWithTokens: vi.fn(),
}));

vi.mock('../../api/paymentsApi', () => ({
  getPaymentGatewayStatus: (...args) => mockGatewayStatus(...args),
  listPathPurchasePayments: vi.fn(),
  createPathPurchasePayment: vi.fn(),
  getPaymentStatus: vi.fn(),
  createRegistrationPayment: vi.fn(),
  listRegistrationPayments: vi.fn(),
  createAnchorRequestPayment: vi.fn(),
  listAnchorRequestPayments: vi.fn(),
  createTokenPurchasePayment: vi.fn(),
  listTokenPurchasePayments: vi.fn(),
}));

vi.mock('../../api/messagesApi', () => ({
  fetchOrCreateThread: vi.fn(),
  sendMessage: vi.fn(),
}));

describe('ProductPaymentCheckout token method (anchor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGatewayStatus.mockResolvedValue({
      enabled: true,
      methods: { nowpayments: true, bch_direct: true, platform_tokens: true },
      bch_network: 'mainnet',
    });
    mockPayWithTokens.mockResolvedValue({ token_balance: 50, request: { id: 1 } });
  });

  it('offers tokens via catalog and confirms payment', async () => {
    const user = userEvent.setup();
    const onPaid = vi.fn();
    renderWithProviders(
      <ProductPaymentCheckout
        open
        onClose={vi.fn()}
        title="Transcript title"
        priceUsd={1}
        productKind={PRODUCT_KINDS.ANCHOR}
        priceTokens={100}
        tokenBalance={150}
        payWithTokens={mockPayWithTokens}
        paymentTarget={{ kind: PRODUCT_KINDS.ANCHOR, purchaseId: 42 }}
        onPaid={onPaid}
      />,
    );

    expect(await screen.findByText('Elige cómo pagar')).toBeInTheDocument();
    const tokenBtn = await screen.findByRole('button', { name: /Pagar con tokens \(100\)/i });
    expect(tokenBtn).toBeEnabled();
    await user.click(tokenBtn);

    expect(await screen.findByText(/Se descontarán 100 tokens/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Confirmar pago/i }));

    await waitFor(() => {
      expect(mockPayWithTokens).toHaveBeenCalledTimes(1);
      expect(onPaid).toHaveBeenCalled();
    });
    expect(await screen.findByText(/Pago con tokens recibido/i)).toBeInTheDocument();
  });

  it('disables token pay when balance is insufficient', async () => {
    renderWithProviders(
      <ProductPaymentCheckout
        open
        onClose={vi.fn()}
        title="Transcript title"
        priceUsd={1}
        productKind={PRODUCT_KINDS.ANCHOR}
        priceTokens={100}
        tokenBalance={0}
        payWithTokens={mockPayWithTokens}
      />,
    );

    const tokenBtn = await screen.findByRole('button', { name: /Pagar con tokens \(100\)/i });
    expect(tokenBtn).toBeDisabled();
    expect(screen.getByText(/Necesitas 100 tokens/i)).toBeInTheDocument();
  });
});
