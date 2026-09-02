import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicsConversationDashboard, { conversationStatus } from '../TopicsConversationDashboard';
import { renderWithProviders, mockAuthValue } from '../../test/formTestUtils';

const mockGetAdminTopics = vi.fn();
const mockUpdateTopic = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    getAdminTopics: (...args) => mockGetAdminTopics(...args),
    updateTopic: (...args) => mockUpdateTopic(...args),
  },
}));

const staffAuth = {
  ...mockAuthValue,
  authState: {
    isAuthenticated: true,
    user: { id: 1, username: 'admin', is_staff: true },
  },
  authInitialized: true,
};

const topicsPayload = {
  count: 3,
  results: [
    {
      id: 1,
      title: 'Bitcoin',
      is_public: true,
      chat_enabled: true,
      chat_can_enable: true,
      indexed_transcript_count: 4,
    },
    {
      id: 2,
      title: 'Lightning',
      is_public: true,
      chat_enabled: false,
      chat_can_enable: true,
      indexed_transcript_count: 2,
    },
    {
      id: 3,
      title: 'Tema vacio',
      is_public: true,
      chat_enabled: false,
      chat_can_enable: false,
      indexed_transcript_count: 0,
    },
  ],
};

describe('TopicsConversationDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminTopics.mockResolvedValue(topicsPayload);
  });

  it('lists topics with conversation status from Qdrant embeddings', async () => {
    renderWithProviders(<TopicsConversationDashboard />, { auth: staffAuth });

    expect(await screen.findByText('Conversación con los archivos')).toBeInTheDocument();
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
    expect(
      screen.getByText(/consultas de usuarios.*chunks y embeddings.*Qdrant/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Lightning')).toBeInTheDocument();
    expect(screen.getByText('Tema vacio')).toBeInTheDocument();
    expect(screen.getByText('Visible')).toBeInTheDocument();
    expect(screen.getByText('Listo para activar')).toBeInTheDocument();
    expect(screen.getByText('1 visibles')).toBeInTheDocument();
  });

  it('filters to topics ready to enable conversation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TopicsConversationDashboard />, { auth: staffAuth });
    await screen.findByText('Bitcoin');

    await user.click(screen.getByRole('button', { name: /^listos$/i }));

    expect(screen.getByText('Lightning')).toBeInTheDocument();
    expect(screen.queryByText('Bitcoin')).not.toBeInTheDocument();
    expect(screen.queryByText('Tema vacio')).not.toBeInTheDocument();
  });

  it('enables conversation on a topic that already has embeddings', async () => {
    const user = userEvent.setup();
    mockUpdateTopic.mockResolvedValue({
      ...topicsPayload.results[1],
      chat_enabled: true,
    });
    renderWithProviders(<TopicsConversationDashboard />, { auth: staffAuth });
    await screen.findByText('Lightning');

    const switches = screen.getAllByRole('checkbox');
    await user.click(switches[1]);

    await waitFor(() => {
      expect(mockUpdateTopic).toHaveBeenCalledWith(2, { chat_enabled: true });
    });
  });
});

describe('conversationStatus', () => {
  it('marks indexed+enabled topics as visible', () => {
    expect(conversationStatus({ chat_enabled: true, chat_can_enable: true })).toBe('visible');
  });

  it('marks indexed but off topics as ready', () => {
    expect(conversationStatus({ chat_enabled: false, indexed_transcript_count: 1 })).toBe('ready');
  });
});
