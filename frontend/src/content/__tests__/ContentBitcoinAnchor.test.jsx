import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentBitcoinAnchor from '../ContentBitcoinAnchor';
import contentApi from '../../api/contentApi';

vi.mock('../../api/contentApi', () => ({
  default: {
    getTranscriptAnchor: vi.fn(),
    broadcastTranscriptAnchor: vi.fn(),
  },
}));

describe('ContentBitcoinAnchor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there is no on-chain txid and user cannot certify', async () => {
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
    expect(screen.getByText('Bitcoin txid')).toBeInTheDocument();
    expect(
      screen.getByText('47bf019be4de25908bf1302a5bf8360ba9cfd54d6a0a38a48909b90d61cdc2e3'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver en mempool\.space/i })).toHaveAttribute(
      'href',
      'https://mempool.space/signet/tx/47bf019be4de25908bf1302a5bf8360ba9cfd54d6a0a38a48909b90d61cdc2e3',
    );
  });

  it('shows fee-too-high message from broadcast API', async () => {
    const user = userEvent.setup();
    contentApi.getTranscriptAnchor.mockResolvedValue({
      content_id: 3,
      can_certify: true,
      anchor: null,
    });
    contentApi.broadcastTranscriptAnchor.mockRejectedValue({
      response: {
        status: 503,
        data: {
          code: 'fee_too_high',
          error:
            'Las comisiones por transacción están muy altas por el momento, por favor vuelve a intentarlo más tarde',
        },
      },
    });

    render(<ContentBitcoinAnchor contentId={3} />);

    await user.click(await screen.findByRole('button', { name: /anclar en bitcoin/i }));

    expect(
      await screen.findByText(
        /las comisiones por transacción están muy altas por el momento/i,
      ),
    ).toBeInTheDocument();
  });
});
