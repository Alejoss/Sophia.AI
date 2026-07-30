import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentTranscriptPage, {
  formatMs,
  plainTextFromSegments,
} from '../ContentTranscriptPage';
import { renderWithProviders } from '../../test/formTestUtils';

const mockGetContentDetails = vi.fn();
const mockGetContentTranscript = vi.fn();
const mockGetTranscriptAnchor = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    getContentDetails: (...args) => mockGetContentDetails(...args),
    getContentTranscript: (...args) => mockGetContentTranscript(...args),
    getTranscriptAnchor: (...args) => mockGetTranscriptAnchor(...args),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ contentId: '50' }),
    useSearchParams: () => [new URLSearchParams('context=topic&topicId=2')],
  };
});

describe('formatMs / plainTextFromSegments', () => {
  it('formats milliseconds as m:ss or h:mm:ss', () => {
    expect(formatMs(0)).toBe('0:00');
    expect(formatMs(15000)).toBe('0:15');
    expect(formatMs(3661000)).toBe('1:01:01');
  });

  it('joins segment texts for continuous reading', () => {
    expect(
      plainTextFromSegments([
        { text: 'hola amigos' },
        { text: ' del mundo' },
      ]),
    ).toBe('hola amigos del mundo');
  });
});

describe('ContentTranscriptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContentDetails.mockResolvedValue({
      id: 50,
      original_title: 'Video de prueba',
    });
    mockGetTranscriptAnchor.mockResolvedValue({
      content_id: 50,
      anchor: null,
    });
  });

  it('shows Bitcoin hash, txid and explorer link when the transcript is anchored', async () => {
    mockGetContentTranscript.mockResolvedValue({
      language: 'es',
      text: 'texto anclado',
      text_length: 13,
      segments: [],
    });
    mockGetTranscriptAnchor.mockResolvedValue({
      content_id: 50,
      current_text_hash: 'abc123hash',
      anchor: {
        status: 'anchored',
        is_btc_confirmed: true,
        btc_network: 'signet',
        text_hash: 'abc123hash',
        btc_txid: 'deadbeeftxid',
      },
    });

    renderWithProviders(<ContentTranscriptPage />);

    expect(await screen.findByText('Anclada en BTC')).toBeInTheDocument();
    expect(screen.getByText('abc123hash')).toBeInTheDocument();
    expect(screen.getByText('deadbeeftxid')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver en mempool\.space/i })).toBeInTheDocument();
  });

  it('shows timed segments by default when segments exist, with a view toggle', async () => {
    const user = userEvent.setup();
    mockGetContentTranscript.mockResolvedValue({
      language: 'es',
      text: 'hola amigos del mundo',
      text_length: 21,
      segments: [
        { index: 0, start_ms: 0, text: 'hola amigos' },
        { index: 1, start_ms: 3000, text: 'del mundo' },
      ],
    });

    renderWithProviders(<ContentTranscriptPage />);

    expect(await screen.findByText('hola amigos')).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('0:03')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /con tiempos/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /texto continuo/i }));

    await waitFor(() => {
      expect(screen.queryByText('0:00')).not.toBeInTheDocument();
    });
    expect(screen.getByText('hola amigos del mundo')).toBeInTheDocument();
  });

  it('shows plain text without inventing timestamps when there are no segments', async () => {
    mockGetContentTranscript.mockResolvedValue({
      language: 'es',
      text: '[musica] Hola, amigos del mundo de las cadenas de bloques',
      text_length: 56,
      segments: [],
    });

    renderWithProviders(<ContentTranscriptPage />);

    expect(
      await screen.findByText(/\[musica\] Hola, amigos del mundo/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/texto continuo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /con tiempos/i })).not.toBeInTheDocument();
    expect(screen.queryByText('0:00')).not.toBeInTheDocument();
  });
});
