import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicChat from '../TopicChat';
import { renderWithProviders, mockAuthValue, unauthenticatedAuth } from '../../test/formTestUtils';

const mockListTopicChatQueries = vi.fn();
const mockGetTopicChatQuery = vi.fn();
const mockTopicChat = vi.fn();
const mockListTopicChatSources = vi.fn();
const mockListPublicTopicChatQueries = vi.fn();
const mockPinTopicChatQuery = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    listTopicChatQueries: (...args) => mockListTopicChatQueries(...args),
    listTopicChatSources: (...args) => mockListTopicChatSources(...args),
    getTopicChatQuery: (...args) => mockGetTopicChatQuery(...args),
    topicChat: (...args) => mockTopicChat(...args),
    listPublicTopicChatQueries: (...args) => mockListPublicTopicChatQueries(...args),
    pinTopicChatQuery: (...args) => mockPinTopicChatQuery(...args),
    unpinTopicChatQuery: vi.fn(),
  },
}));

vi.mock('../../votes/VoteComponent', () => ({
  default: function VoteStub() {
    return <span>vote</span>;
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
    mockListPublicTopicChatQueries.mockResolvedValue({
      count: 0,
      limit: 50,
      results: [],
    });
  });

  it('renders login prompt when not authenticated', async () => {
    renderWithProviders(<TopicChat topicId={5} />, {
      auth: unauthenticatedAuth(),
    });

    expect(
      screen.getByText(/inicia sesión para consultar los contenidos de este tema/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/nadie ha fijado una consulta en este tema todavía/i)
    ).toBeInTheDocument();
  });

  it('starts with no transcript chosen and lets the user pick one before consulting', async () => {
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
      expect(screen.getByText(/contenido a consultar/i)).toBeInTheDocument();
    });

    const firstRadio = screen.getByRole('radio', { name: /libro blanco bitcoin/i });
    const secondRadio = screen.getByRole('radio', { name: /explicación en video/i });
    expect(firstRadio).not.toBeChecked();
    expect(secondRadio).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /^todas$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(secondRadio);
    expect(secondRadio).toBeChecked();
    expect(firstRadio).not.toBeChecked();

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

    expect(screen.getByText(/contenido consultado/i)).toBeInTheDocument();
    const videoSourceLinks = screen.getAllByRole('link', { name: /explicación en video/i });
    expect(videoSourceLinks.length).toBeGreaterThanOrEqual(1);
    expect(videoSourceLinks[0].getAttribute('href')).toBe(
      '/content/88/transcript?context=topic&topicId=5'
    );
  });

  it('keeps only the latest transcript selected', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TopicChat topicId={5} />, {
      auth: mockAuthValue,
    });

    const firstRadio = await screen.findByRole('radio', { name: /libro blanco bitcoin/i });
    const secondRadio = screen.getByRole('radio', { name: /explicación en video/i });

    await user.click(firstRadio);
    expect(firstRadio).toBeChecked();
    expect(secondRadio).not.toBeChecked();

    await user.click(secondRadio);
    expect(secondRadio).toBeChecked();
    expect(firstRadio).not.toBeChecked();
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
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
      expect(screen.getByRole('radio', { name: /libro blanco bitcoin/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('radio', { name: /libro blanco bitcoin/i }));

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
      expect(screen.getByRole('radio', { name: /libro blanco bitcoin/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('radio', { name: /libro blanco bitcoin/i }));

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

  it('shows pinned consultations to a guest', async () => {
    mockListPublicTopicChatQueries.mockResolvedValue({
      count: 1,
      limit: 50,
      results: [
        {
          id: 7,
          topic_id: 5,
          author_username: 'ana',
          question: '¿Qué dice el libro sobre los bloques?',
          answer: 'El libro describe un límite de tamaño [1].',
          sources: [],
          pinned_content_ids: [42],
          vote_count: 3,
          user_vote: 0,
          can_unpin: false,
        },
      ],
    });

    renderWithProviders(<TopicChat topicId={5} />, {
      auth: unauthenticatedAuth(),
    });

    expect(
      screen.getByText(/inicia sesión para consultar los contenidos de este tema/i)
    ).toBeInTheDocument();
    expect(await screen.findByText(/qué dice el libro sobre los bloques/i)).toBeInTheDocument();
    expect(screen.getByText(/fijada por ana/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/escribe tu pregunta/i)).not.toBeInTheDocument();
  });

  it('pins the open consultation onto a selected text', async () => {
    const user = userEvent.setup();
    mockTopicChat.mockResolvedValue({
      id: 101,
      topic_id: 5,
      question: '¿Qué es Bitcoin?',
      answer: 'Bitcoin es efectivo electrónico según el video [1].',
      sources: [],
      selected_content_ids: [88],
      pinned_content_ids: [],
      created_at: '2026-09-02T12:00:00Z',
    });
    mockPinTopicChatQuery.mockResolvedValue({
      id: 101,
      topic_id: 5,
      question: '¿Qué es Bitcoin?',
      answer: 'Bitcoin es efectivo electrónico según el video [1].',
      sources: [],
      selected_content_ids: [88],
      pinned_content_ids: [88],
      vote_count: 0,
      user_vote: 0,
      can_unpin: true,
    });

    renderWithProviders(<TopicChat topicId={5} />, {
      auth: mockAuthValue,
    });

    await user.click(await screen.findByRole('radio', { name: /explicación en video/i }));
    await user.type(screen.getByPlaceholderText(/escribe tu pregunta/i), '¿Qué es Bitcoin?');
    await user.click(screen.getByRole('button', { name: /^consultar$/i }));

    await user.click(await screen.findByRole('button', { name: /^fijar$/i }));

    await waitFor(() => {
      expect(mockPinTopicChatQuery).toHaveBeenCalledWith(5, 101, [88]);
    });
    expect(await screen.findByText(/consulta fijada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quitar pin/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /actualizar textos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar del texto/i })).not.toBeInTheDocument();
  });
});
