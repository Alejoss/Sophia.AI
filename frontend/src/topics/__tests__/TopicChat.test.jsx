import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicChat from '../TopicChat';
import { renderWithProviders, mockAuthValue, unauthenticatedAuth } from '../../test/formTestUtils';

const mockListTopicChatQueries = vi.fn();
const mockGetTopicChatQuery = vi.fn();
const mockTopicChat = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    listTopicChatQueries: (...args) => mockListTopicChatQueries(...args),
    getTopicChatQuery: (...args) => mockGetTopicChatQuery(...args),
    topicChat: (...args) => mockTopicChat(...args),
  },
}));

describe('TopicChat component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTopicChatQueries.mockResolvedValue({
      count: 0,
      limit: 50,
      results: [],
    });
  });

  it('renders login prompt when not authenticated', () => {
    renderWithProviders(<TopicChat topicId={5} />, {
      auth: unauthenticatedAuth(),
    });

    expect(
      screen.getByText(/inicia sesión para consultar las transcripciones de este tema/i)
    ).toBeInTheDocument();
  });

  it('renders consultation response with text and video sources correctly linked', async () => {
    const user = userEvent.setup();
    mockTopicChat.mockResolvedValue({
      id: 101,
      topic_id: 5,
      question: '¿Qué es Bitcoin?',
      answer: 'Bitcoin es efectivo electrónico según el libro blanco [1] y los videos [2].',
      sources: [
        {
          index: 1,
          content_id: 42,
          title: 'Libro Blanco Bitcoin',
          media_type: 'TEXT',
          score: 0.95,
          excerpt: 'A purely peer-to-peer version of electronic cash...',
        },
        {
          index: 2,
          content_id: 88,
          title: 'Explicación en Video',
          media_type: 'VIDEO',
          score: 0.85,
          excerpt: 'En este video explicamos la red...',
        },
      ],
      created_at: '2026-09-02T12:00:00Z',
    });

    renderWithProviders(<TopicChat topicId={5} />, {
      auth: mockAuthValue,
    });

    const input = screen.getByPlaceholderText(/escribe tu pregunta/i);
    await user.type(input, '¿Qué es Bitcoin?');

    const submitBtn = screen.getByRole('button', { name: /consultar/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/bitcoin es efectivo electrónico/i)).toBeInTheDocument();
    });

    // Verify the text source links to the topic content path
    const textSourceLink = screen.getByRole('link', { name: /libro blanco bitcoin/i });
    expect(textSourceLink).toBeInTheDocument();
    expect(textSourceLink.getAttribute('href')).toBe('/content/42/topic/5');

    // Verify the video source links to the transcript page
    const videoSourceLink = screen.getByRole('link', { name: /explicación en video/i });
    expect(videoSourceLink).toBeInTheDocument();
    expect(videoSourceLink.getAttribute('href')).toBe('/content/88/transcript?context=topic&topicId=5');
  });
});
