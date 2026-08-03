import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ContentBitcoinAnchor from '../ContentBitcoinAnchor';
import contentApi from '../../api/contentApi';

vi.mock('../../api/contentApi', () => ({
  default: {
    getTranscriptAnchor: vi.fn(),
    getTranscriptAnchorRequest: vi.fn(),
    createTranscriptAnchorRequest: vi.fn(),
    broadcastTranscriptAnchor: vi.fn(),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  AuthContext: {
    Provider: ({ children }) => children,
    _currentValue: { authState: { isAuthenticated: false } },
  },
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: () => ({ authState: { isAuthenticated: false } }),
  };
});

vi.mock('../../events/CryptoPaymentModal', () => ({
  default: () => null,
}));

describe('ContentBitcoinAnchor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentApi.getTranscriptAnchorRequest.mockResolvedValue({
      request: null,
      price_usd: 1,
      is_mine: false,
    });
  });

  it('renders nothing when there is no on-chain txid and user is anonymous', async () => {
    contentApi.getTranscriptAnchor.mockResolvedValue({
      content_id: 3,
      can_certify: false,
      anchor: { status: 'pending', btc_txid: '' },
    });
    const { container } = render(<ContentBitcoinAnchor contentId={3} />);
    await waitFor(() => {
      expect(contentApi.getTranscriptAnchor).toHaveBeenCalledWith(3);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows hash, txid and mempool link when anchored', async () => {
    contentApi.getTranscriptAnchor.mockResolvedValue({
      content_id: 3,
      current_text_hash: '835afa37dfc4e8b615d8403426779cd03bb030304d77497f50dd4cf1b9c2f824',
      can_certify: false,
      anchor: {
        status: 'anchored',
        is_btc_confirmed: true,
        btc_network: 'signet',
        text_hash: '835afa37dfc4e8b615d8403426779cd03bb030304d77497f50dd4cf1b9c2f824',
        btc_txid: '47bf019be4de25908bf1302a5bf8360ba9cfd54d6a0a38a48909b90d61cdc2e3',
      },
    });

    render(<ContentBitcoinAnchor contentId={3} />);

    expect(await screen.findByText('Anclada en BTC')).toBeInTheDocument();
    expect(screen.getByText('text_hash (SHA-256)')).toBeInTheDocument();
    expect(
      screen.getByText('835afa37dfc4e8b615d8403426779cd03bb030304d77497f50dd4cf1b9c2f824'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver en mempool\.space/i })).toHaveAttribute(
      'href',
      'https://mempool.space/signet/tx/47bf019be4de25908bf1302a5bf8360ba9cfd54d6a0a38a48909b90d61cdc2e3',
    );
  });
});
