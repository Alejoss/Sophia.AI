import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import { renderWithProviders } from '../../test/formTestUtils';

const {
  mockGatewayStatus,
  mockListPathPayments,
  mockCreatePathPayment,
  mockGetPaymentStatus,
  mockCreateBch,
  mockVerifyBch,
  mockFetchThread,
  mockSendMessage,
} = vi.hoisted(() => ({
  mockGatewayStatus: vi.fn(),
  mockListPathPayments: vi.fn(),
  mockCreatePathPayment: vi.fn(),
  mockGetPaymentStatus: vi.fn(),
  mockCreateBch: vi.fn(),
  mockVerifyBch: vi.fn(),
  mockFetchThread: vi.fn(),
  mockSendMessage: vi.fn(),
}));

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

vi.mock('../../api/messagesApi', () => ({
  fetchOrCreateThread: (...args) => mockFetchThread(...args),
  sendMessage: (...args) => mockSendMessage(...args),
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
      id: 12,
      address: 'bitcoincash:qptestaddress',
      expected_amount_bch: '0.20000000',
      expected_amount_sats: 20000000,
      usd_amount: 40,
      status: 'pending',
      seconds_remaining: 1800,
    });
    mockFetchThread.mockResolvedValue({ data: { id: 55 } });
    mockSendMessage.mockResolvedValue({});
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
    expect(screen.getByRole('button', { name: /Pagar con Monero/i })).toBeInTheDocument();
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

  it('opens the Monero message modal from the chooser', async () => {
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

    await user.click(await screen.findByRole('button', { name: /Pagar con Monero/i }));

    expect(
      await screen.findByText(
        'Para pagar con Monero, envíame un mensaje y te compartiré mi dirección de billetera.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar mensaje/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver a métodos de pago/i })).toBeInTheDocument();
  });

  it('opens the TXID support modal after a BCH verify failure', async () => {
    const user = userEvent.setup();
    mockVerifyBch.mockRejectedValue({
      error: 'No se pudo consultar la blockchain de BCH. Inténtelo más tarde.',
    });
    const onClose = vi.fn();
    renderWithProviders(
      <ProductPaymentCheckout
        open
        onClose={onClose}
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

    await user.click(await screen.findByRole('button', { name: /Bitcoin Cash directo/i }));
    expect(await screen.findByRole('button', { name: /Ya realicé el pago/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Ya realicé el pago/i }));

    expect(
      await screen.findByRole('button', { name: /^Enviar TXID a soporte$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Ya pagué — enviar TXID a soporte/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Enviar TXID a soporte$/i }));

    expect(await screen.findByText('Ya pagué — avisar a soporte')).toBeInTheDocument();
    expect(screen.getByLabelText(/ID de transacción/i)).toBeInTheDocument();
    expect(screen.getByText(/revisaremos el pago manualmente/i)).toBeInTheDocument();
  });
});
