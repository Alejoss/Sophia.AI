import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicChat from '../TopicChat';
import { renderWithProviders, mockAuthValue, unauthenticatedAuth } from '../../test/formTestUtils';

const mockListTopicChatQueries = vi.fn();
const mockGetTopicChatQuery = vi.fn();
const mockTopicChat = vi.fn();
const mockListTopicChatSources = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    listTopicChatQueries: (...args) => mockListTopicChatQueries(...args),
    listTopicChatSources: (...args) => mockListTopicChatSources(...args),
    getTopicChatQuery: (...args) => mockGetTopicChatQuery(...args),
    topicChat: (...args) => mockTopicChat(...args),
  },
}));

const indexedSources = [
  {
    content_id: 42,
    title: 'Libro Blanco Bitcoin',
    media_type: 'VIDEO',
    original_author: 'Satoshi',
    chunk_count: 3,
  },
  {
    content_id: 88,
    title: 'Explicación en Video',
    media_type: 'VIDEO',
    original_author: '',
    chunk_count: 5,
  },
];

describe('TopicChat component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTopicChatQueries.mockResolvedValue({
      count: 0,
      limit: 50,
      results: [],
    });
    mockListTopicChatSources.mockResolvedValue({
      count: indexedSources.length,
      results: indexedSources,
    });
  });

  it('renders login prompt when not authenticated', () => {
    renderWithProviders(<TopicChat topicId={5} />, {
      auth: unauthenticatedAuth(),
    });

    expect(
      screen.getByText(/inicia sesión para consultar los contenidos de este tema/i)
    ).toBeInTheDocument();
  });

  it('starts with all transcripts unchecked and lets the user pick before consulting', async () => {
    const user = userEvent.setup();
    mockTopicChat.mockResolvedValue({
      id: 101,
      topic_id: 5,
      question: '¿Qué es Bitcoin?',
      answer: 'Bitcoin es efectivo electrónico según el video [1].',
      sources: [
        {
          index: 1,
          content_id: 88,
          title: 'Explicación en Video',
          media_type: 'VIDEO',
          score: 0.85,
          excerpt: 'En este video explicamos la red...',
        },
      ],
      selected_content_ids: [88],
      created_at: '2026-09-02T12:00:00Z',
    });

    renderWithProviders(<TopicChat topicId={5} />, {
      auth: mockAuthValue,
    });

    await waitFor(() => {
      expect(screen.getByText(/contenidos a consultar/i)).toBeInTheDocument();
    });

    const firstCheckbox = screen.getByRole('checkbox', { name: /libro blanco bitcoin/i });
    const secondCheckbox = screen.getByRole('checkbox', { name: /explicación en video/i });
    expect(firstCheckbox).not.toBeChecked();
    expect(secondCheckbox).not.toBeChecked();
    expect(
      screen.queryByText(/procesa demasiado contenido/i)
    ).not.toBeInTheDocument();

    await user.click(secondCheckbox);
    expect(secondCheckbox).toBeChecked();

    const input = screen.getByPlaceholderText(/escribe tu pregunta/i);
    await user.type(input, '¿Qué es Bitcoin?');

    const submitBtn = screen.getByRole('button', { name: /consultar/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockTopicChat).toHaveBeenCalledWith(5, {
        message: '¿Qué es Bitcoin?',
        contentIds: [88],
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/bitcoin es efectivo electrónico/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/archivos seleccionados \(1\)/i)).toBeInTheDocument();
    const videoSourceLinks = screen.getAllByRole('link', { name: /explicación en video/i });
    expect(videoSourceLinks.length).toBeGreaterThanOrEqual(1);
    expect(videoSourceLinks[0].getAttribute('href')).toBe(
      '/content/88/transcript?context=topic&topicId=5'
    );
  });

  it('warns when all transcripts are selected', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TopicChat topicId={5} />, {
      auth: mockAuthValue,
    });

    await waitFor(() => {
      expect(screen.getByText(/contenidos a consultar \(0\/2\)/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^todas$/i }));

    expect(screen.getByRole('checkbox', { name: /libro blanco bitcoin/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /explicación en video/i })).toBeChecked();
    expect(
      screen.getByText(/procesa demasiado contenido/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^ninguna$/i }));
    expect(
      screen.queryByText(/procesa demasiado contenido/i)
    ).not.toBeInTheDocument();
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
      selected_content_ids: [42, 88],
      created_at: '2026-09-02T12:00:00Z',
    });

    renderWithProviders(<TopicChat topicId={5} />, {
      auth: mockAuthValue,
    });

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /libro blanco bitcoin/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /libro blanco bitcoin/i }));
    await user.click(screen.getByRole('checkbox', { name: /explicación en video/i }));

    const input = screen.getByPlaceholderText(/escribe tu pregunta/i);
    await user.type(input, '¿Qué es Bitcoin?');

    const submitBtn = screen.getByRole('button', { name: /consultar/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/bitcoin es efectivo electrónico/i)).toBeInTheDocument();
    });

    const textSourceLink = screen.getAllByRole('link', { name: /libro blanco bitcoin/i })[0];
    expect(textSourceLink).toBeInTheDocument();
    expect(textSourceLink.getAttribute('href')).toBe('/content/42/topic/5');

    const videoSourceLink = screen.getAllByRole('link', { name: /explicación en video/i })[0];
    expect(videoSourceLink).toBeInTheDocument();
    expect(videoSourceLink.getAttribute('href')).toBe(
      '/content/88/transcript?context=topic&topicId=5'
    );
  });

  it('shows the daily free-tier limit from history payload', async () => {
    mockListTopicChatQueries.mockResolvedValue({
      count: 0,
      limit: 50,
      daily_limit: 3,
      daily_used: 1,
      daily_remaining: 2,
      results: [],
    });

    renderWithProviders(<TopicChat topicId={5} />, {
      auth: mockAuthValue,
    });

    await waitFor(() => {
      expect(screen.getByText(/límite gratuito: 3 consultas por día/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/\(2 restantes hoy\)/i)).toBeInTheDocument();
  });

  it('surfaces the daily limit error from the API', async () => {
    const user = userEvent.setup();
    mockTopicChat.mockRejectedValue({
      response: {
        status: 429,
        data: {
          error:
            'Has alcanzado el límite de 3 consultas gratuitas por día. Compra tokens ACBC para seguir creando consultas.',
          code: 'daily_consultation_limit',
          daily_limit: 3,
          daily_used: 3,
          daily_remaining: 0,
          tokens_url: '/profiles/my_profile?section=tokens',
        },
      },
    });

    renderWithProviders(<TopicChat topicId={5} />, {
      auth: mockAuthValue,
    });

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /libro blanco bitcoin/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /libro blanco bitcoin/i }));
    await user.click(screen.getByRole('checkbox', { name: /explicación en video/i }));

    const input = screen.getByPlaceholderText(/escribe tu pregunta/i);
    await user.type(input, '¿Qué es Bitcoin?');
    await user.click(screen.getByRole('button', { name: /consultar/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/has alcanzado el límite de 3 consultas gratuitas por día/i)
      ).toBeInTheDocument();
    });
    const tokensLink = screen.getByRole('link', { name: /ir a mis tokens/i });
    expect(tokensLink).toBeInTheDocument();
    expect(tokensLink.getAttribute('href')).toBe('/profiles/my_profile?section=tokens');
  });

  it('prompts tokens purchase when the daily quota is already exhausted', async () => {
    mockListTopicChatQueries.mockResolvedValue({
      count: 3,
      limit: 50,
      daily_limit: 3,
      daily_used: 3,
      daily_remaining: 0,
      tokens_url: '/profiles/my_profile?section=tokens',
      results: [],
    });

    renderWithProviders(<TopicChat topicId={5} />, {
      auth: mockAuthValue,
    });

    await waitFor(() => {
      expect(
        screen.getByText(/compra tokens acbc para seguir creando consultas/i)
      ).toBeInTheDocument();
    });
    const tokensLink = screen.getByRole('link', { name: /ir a mis tokens/i });
    expect(tokensLink.getAttribute('href')).toBe('/profiles/my_profile?section=tokens');
    expect(screen.getByRole('button', { name: /nueva consulta/i })).toBeDisabled();
  });
});
