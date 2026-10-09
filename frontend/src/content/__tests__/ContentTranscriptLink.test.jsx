import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContentTranscriptLink from '../ContentTranscriptLink';
import contentApi from '../../api/contentApi';

const navigateMock = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    getContentTranscript: vi.fn(),
    getTranscriptGeneration: vi.fn(),
    createTranscriptGeneration: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('ContentTranscriptLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when transcript generation is not available', async () => {
    contentApi.getContentTranscript.mockResolvedValue(null);
    contentApi.getTranscriptGeneration.mockResolvedValue({
      can_request: false,
      has_transcript: false,
      request: null,
    });
    const { container } = render(
      <MemoryRouter>
        <ContentTranscriptLink contentId={46} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(contentApi.getContentTranscript).toHaveBeenCalledWith(46, { summary: true });
    });
    await waitFor(() => {
      expect(contentApi.getTranscriptGeneration).toHaveBeenCalledWith(46);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a one-dollar transcript when none exists', async () => {
    contentApi.getContentTranscript.mockResolvedValue(null);
    contentApi.getTranscriptGeneration.mockResolvedValue({
      can_request: true,
      has_transcript: false,
      price_usd: 1,
      price_tokens: 100,
      request: null,
    });
    render(
      <MemoryRouter>
        <ContentTranscriptLink contentId={46} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/aún no hay transcripción/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inicia sesión para generar/i })).toBeInTheDocument();
  });

  it('links to the dedicated transcript page when available', async () => {
    contentApi.getContentTranscript.mockResolvedValue({
      has_transcript: true,
      language: 'es',
      text_length: 1200,
      segment_count: 8,
    });

    render(
      <MemoryRouter>
        <ContentTranscriptLink contentId={46} context="library" />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Transcripción disponible')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver transcripción/i }));
    expect(navigateMock).toHaveBeenCalledWith('/content/46/transcript?context=library');
  });
});
