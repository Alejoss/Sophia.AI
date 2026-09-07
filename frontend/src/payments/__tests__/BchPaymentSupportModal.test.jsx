import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BchPaymentSupportModal from '../BchPaymentSupportModal';
import { renderWithProviders } from '../../test/formTestUtils';
import {
  BCH_SUPPORT_DESCRIPTION,
  PAYMENT_SUPPORT_USER_ID,
  buildBchVerifyHelpMessage,
} from '../bchPaymentSupport';

const mockNavigate = vi.fn();
const mockFetchOrCreateThread = vi.fn();
const mockSendMessage = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/messagesApi', () => ({
  fetchOrCreateThread: (...args) => mockFetchOrCreateThread(...args),
  sendMessage: (...args) => mockSendMessage(...args),
  fetchThreads: vi.fn(),
  fetchMessages: vi.fn(),
  deleteMessage: vi.fn(),
}));

const sampleOrder = {
  id: 12,
  address: 'bitcoincash:qptestaddress',
  expected_amount_bch: '0.20000000',
  expected_amount_sats: 20000000,
  usd_amount: 40,
};

const validTxid = 'ab'.repeat(32);

describe('BchPaymentSupportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOrCreateThread.mockResolvedValue({ data: { id: 55 } });
    mockSendMessage.mockResolvedValue({ data: { id: 91 } });
  });

  it('shows comfort copy and requires a TXID', async () => {
    renderWithProviders(
      <BchPaymentSupportModal
        open
        onClose={vi.fn()}
        title="Ucronía Capítulo 33"
        priceUsd={40}
        productLabel="camino"
        bchOrder={sampleOrder}
        verifyError="No se pudo consultar la blockchain de BCH."
      />,
    );

    expect(screen.getByText('Ya pagué — avisar a soporte')).toBeInTheDocument();
    expect(screen.getByText(BCH_SUPPORT_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByLabelText(/ID de transacción/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Enviar TXID a soporte/i }),
    ).toBeDisabled();
  });

  it('sends the TXID message to support and opens the thread', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <BchPaymentSupportModal
        open
        onClose={onClose}
        title="Ucronía Capítulo 33"
        priceUsd={40}
        productLabel="camino"
        bchOrder={sampleOrder}
        verifyError="No se pudo consultar la blockchain de BCH."
      />,
    );

    await user.type(screen.getByLabelText(/ID de transacción/i), validTxid);
    await user.type(screen.getByLabelText(/Nota opcional/i), 'Desde Electron Cash');
    await user.click(screen.getByRole('button', { name: /Enviar TXID a soporte/i }));

    await waitFor(() => {
      expect(mockFetchOrCreateThread).toHaveBeenCalledWith(PAYMENT_SUPPORT_USER_ID);
    });
    expect(mockSendMessage).toHaveBeenCalledWith(
      55,
      buildBchVerifyHelpMessage({
        title: 'Ucronía Capítulo 33',
        priceUsd: 40,
        productLabel: 'camino',
        bchOrder: sampleOrder,
        error: 'No se pudo consultar la blockchain de BCH.',
        txid: validTxid,
        note: 'Desde Electron Cash',
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(`/messages/thread/${PAYMENT_SUPPORT_USER_ID}`);
  });

  it('rejects an invalid TXID without messaging', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BchPaymentSupportModal
        open
        onClose={vi.fn()}
        title="Camino"
        priceUsd={8}
        bchOrder={sampleOrder}
      />,
    );

    await user.type(screen.getByLabelText(/ID de transacción/i), 'not-a-txid');
    await user.click(screen.getByRole('button', { name: /Enviar TXID a soporte/i }));

    expect(
      await screen.findByText(/64 caracteres hexadecimales/i),
    ).toBeInTheDocument();
    expect(mockFetchOrCreateThread).not.toHaveBeenCalled();
  });
});
