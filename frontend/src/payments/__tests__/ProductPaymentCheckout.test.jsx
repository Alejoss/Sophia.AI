import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import { renderWithProviders } from '../../test/formTestUtils';

const mockGatewayStatus = vi.fn();
const mockListPathPayments = vi.fn();
const mockCreatePathPayment = vi.fn();
const mockGetPaymentStatus = vi.fn();
const mockCreateBch = vi.fn();
const mockVerifyBch = vi.fn();

vi.mock('../../api/paymentsApi', () => ({
  getPaymentGatewayStatus: (...args) => mockGatewayStatus(...args),
  listPathPurchasePayments: (...args) => mockListPathPayments(...args),
  createPathPurchasePayment: (...args) => mockCreatePathPayment(...args),
  getPaymentStatus: (...args) => mockGetPaymentStatus(...args),
  createRegistrationPayment: vi.fn(),
  listRegistrationPayments: vi.fn(),
  createAnchorRequestPayment: vi.fn(),
  listAnchorRequestPayments: vi.fn(),
}));

const waitingInvoice = {
  id: 77,
  payment_status: 'waiting',
  invoice_url: 'https://nowpayments.io/payment/?iid=77',
  is_paid: false,
};

describe('ProductPaymentCheckout method switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGatewayStatus.mockResolvedValue({
      enabled: true,
      methods: { nowpayments: true, bch_direct: true },
      bch_network: 'mainnet',
    });
    mockListPathPayments.mockResolvedValue([waitingInvoice]);
    mockGetPaymentStatus.mockResolvedValue(waitingInvoice);
    mockCreateBch.mockResolvedValue({
      address: 'bitcoincash:qptestaddress',
      expected_amount_bch: '0.20000000',
      expected_amount_sats: 20000000,
      usd_amount: 40,
      status: 'pending',
      seconds_remaining: 1800,
    });
  });

  it('returns to the chooser from NOWPayments and then starts BCH', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProductPaymentCheckout
        open
        onClose={vi.fn()}
        title="Ucronía Capítulo 33"
        priceUsd={40}
        productLabel="camino"
        offerNowpayments
        offerBch
        createBchPayment={mockCreateBch}
        verifyBchPayment={mockVerifyBch}
        nowpaymentsProps={{ pathPurchaseId: 9 }}
      />,
    );

    expect(await screen.findByRole('button', { name: /NOWPayments/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /NOWPayments/i }));

    expect(await screen.findByRole('button', { name: /Elegir otro método/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pagar en NOWPayments/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Elegir otro método/i }));

    expect(await screen.findByRole('button', { name: /Bitcoin Cash directo/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Bitcoin Cash directo/i }));

    await waitFor(() => {
      expect(mockCreateBch).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/Pago con Bitcoin Cash/i)).toBeInTheDocument();
    expect(screen.getByText('bitcoincash:qptestaddress')).toBeInTheDocument();
    expect(screen.queryByText(/Ya hay un pago NOWPayments en curso/i)).not.toBeInTheDocument();
  });
});
