import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MoneroPaymentModal from '../MoneroPaymentModal';
import { renderWithProviders, mockAuthValue } from '../../test/formTestUtils';
import {
  MONERO_CONTACT_USER_ID,
  MONERO_PAYMENT_DESCRIPTION,
  buildMoneroPaymentMessage,
} from '../moneroPayment';

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

describe('MoneroPaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOrCreateThread.mockResolvedValue({ data: { id: 44 } });
    mockSendMessage.mockResolvedValue({ data: { id: 90 } });
  });

  it('shows the Monero instructions and a prefilled message', async () => {
    renderWithProviders(
      <MoneroPaymentModal
        open
        onClose={vi.fn()}
        title="Ucronía Capítulo 33"
        priceUsd={40}
        productLabel="camino"
      />,
    );

    expect(screen.getByText('Pagar con Monero')).toBeInTheDocument();
    expect(screen.getByText(MONERO_PAYMENT_DESCRIPTION)).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        buildMoneroPaymentMessage({
          title: 'Ucronía Capítulo 33',
          priceUsd: 40,
          productLabel: 'camino',
        }),
      ),
    ).toBeInTheDocument();
  });

  it('sends the message to user 2 and opens the thread', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <MoneroPaymentModal
        open
        onClose={onClose}
        title="Consultas Bitcoin"
        priceUsd={2}
        productLabel="consultas del tema"
      />,
    );

    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    await waitFor(() => {
      expect(mockFetchOrCreateThread).toHaveBeenCalledWith(MONERO_CONTACT_USER_ID);
    });
    expect(mockSendMessage).toHaveBeenCalledWith(
      44,
      buildMoneroPaymentMessage({
        title: 'Consultas Bitcoin',
        priceUsd: 2,
        productLabel: 'consultas del tema',
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(`/messages/thread/${MONERO_CONTACT_USER_ID}`);
  });

  it('shows an API error without navigating', async () => {
    const user = userEvent.setup();
    mockFetchOrCreateThread.mockRejectedValue({
      response: { data: { error: 'No se pudo abrir la conversación' } },
    });
    renderWithProviders(
      <MoneroPaymentModal open onClose={vi.fn()} title="Camino" priceUsd={8} />,
    );

    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    expect(await screen.findByText(/no se pudo abrir la conversación/i)).toBeInTheDocument();
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not message yourself when the current user is #2', () => {
    renderWithProviders(
      <MoneroPaymentModal open onClose={vi.fn()} title="Camino" priceUsd={8} />,
      {
        auth: {
          ...mockAuthValue,
          authState: {
            isAuthenticated: true,
            user: { id: 2, username: 'owner' },
          },
          user: { id: 2, username: 'owner' },
        },
      },
    );

    expect(screen.getByRole('button', { name: /enviar mensaje/i })).toBeDisabled();
    expect(screen.getByText(/esta opción envía un mensaje a tu propia cuenta/i)).toBeInTheDocument();
  });
});
