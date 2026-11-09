import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import MessagesLayout from '../MessagesLayout';
import { renderWithProviders } from '../../test/formTestUtils';

vi.mock('../../api/messagesApi', () => ({
  fetchThreads: vi.fn().mockResolvedValue({ data: [] }),
  fetchOrCreateThread: vi.fn().mockResolvedValue({
    data: {
      id: 9,
      participant1: { id: 1, username: 'testuser' },
      participant2: { id: 2, username: 'bob' },
    },
  }),
  fetchMessages: vi.fn().mockResolvedValue({ data: [] }),
  sendMessage: vi.fn(),
}));

function renderInbox(route) {
  return renderWithProviders(
    <Routes>
      <Route path="messages" element={<MessagesLayout />}>
        <Route path="thread/:userId" element={<div data-testid="thread-route">thread-route</div>} />
      </Route>
    </Routes>,
    { route },
  );
}

describe('MessagesLayout composition', () => {
  it('keeps the account link in the list column and the empty state in the thread pane', async () => {
    renderInbox('/messages');

    const list = screen.getByTestId('inbox-list');
    const thread = screen.getByTestId('inbox-thread');

    expect(list).toContainElement(screen.getByRole('link', { name: /testuser/i }));
    expect(await screen.findByText(/aún no hay conversaciones/i)).toBeInTheDocument();
    expect(list).toContainElement(screen.getByText(/aún no hay conversaciones/i));
    expect(thread).toContainElement(screen.getByText(/seleccione una conversación/i));
    expect(thread).not.toContainElement(screen.getByRole('link', { name: /testuser/i }));
    expect(screen.queryByTestId('thread-route')).not.toBeInTheDocument();
  });

  it('renders the open thread in the thread pane, not in the conversation list', async () => {
    renderInbox('/messages/thread/2');

    const route = await screen.findByTestId('thread-route');
    expect(screen.getByTestId('inbox-thread')).toContainElement(route);
    expect(screen.getByTestId('inbox-list')).not.toContainElement(route);
    expect(screen.queryByText(/seleccione una conversación/i)).not.toBeInTheDocument();
  });
});
