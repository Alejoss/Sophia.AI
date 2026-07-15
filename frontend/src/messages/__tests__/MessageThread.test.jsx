import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageThread from '../MessageThread';
import { renderWithProviders } from '../../test/formTestUtils';

const mockFetchOrCreateThread = vi.fn();
const mockFetchMessages = vi.fn();
const mockSendMessage = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ userId: '2' }),
  };
});

vi.mock('../../api/messagesApi', () => ({
  fetchOrCreateThread: (...args) => mockFetchOrCreateThread(...args),
  fetchMessages: (...args) => mockFetchMessages(...args),
  sendMessage: (...args) => mockSendMessage(...args),
}));

const thread = {
  id: 9,
  participant1: { id: 1, username: 'testuser' },
  participant2: { id: 2, username: 'bob' },
};

describe('MessageThread form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOrCreateThread.mockResolvedValue({ data: thread });
    mockFetchMessages.mockResolvedValue({ data: [] });
  });

  it('shows a validation error on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MessageThread />);

    await screen.findByText(/aún no hay mensajes/i);
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));

    expect(
      await screen.findByText(/escribe un mensaje antes de enviar/i),
    ).toBeInTheDocument();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('sends the message and reloads the thread', async () => {
    const user = userEvent.setup();
    mockSendMessage.mockResolvedValue({});
    renderWithProviders(<MessageThread />);

    await screen.findByText(/aún no hay mensajes/i);
    await user.type(
      screen.getByPlaceholderText(/escriba su mensaje/i),
      'Hola, ¿cómo estás?',
    );
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(9, 'Hola, ¿cómo estás?');
    });
    await waitFor(() => {
      expect(mockFetchMessages).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockSendMessage.mockRejectedValue({
      response: { data: { error: 'No se pudo enviar el mensaje' } },
    });
    renderWithProviders(<MessageThread />);

    await screen.findByText(/aún no hay mensajes/i);
    await user.type(screen.getByPlaceholderText(/escriba su mensaje/i), 'Hola');
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));

    expect(
      await screen.findByText(/no se pudo enviar el mensaje/i),
    ).toBeInTheDocument();
  });
});
