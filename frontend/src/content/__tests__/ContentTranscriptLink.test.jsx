import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContentTranscriptLink from '../ContentTranscriptLink';
import contentApi from '../../api/contentApi';

const navigateMock = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    getContentTranscript: vi.fn(),
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

  it('renders nothing when there is no transcript', async () => {
    contentApi.getContentTranscript.mockResolvedValue(null);
    const { container } = render(
      <MemoryRouter>
        <ContentTranscriptLink contentId={46} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(contentApi.getContentTranscript).toHaveBeenCalledWith(46, { summary: true });
    });
    expect(container).toBeEmptyDOMElement();
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
