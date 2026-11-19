import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FundingDetail from '../FundingDetail';
import { renderWithProviders, unauthenticatedAuth } from '../../test/formTestUtils';

const mockThread = vi.fn();
const mockSend = vi.fn();

vi.mock('../../api/messagesApi', () => ({
  fetchOrCreateThread: (...args) => mockThread(...args),
  sendMessage: (...args) => mockSend(...args),
}));

const mockGetProposal = vi.fn();
const mockFindOpenWallet = vi.hoisted(() => vi.fn());
const wizardMock = vi.hoisted(() => ({
  state: 'disconnected',
  manager: null,
  error: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('@wizardconnect/react', () => ({
  useWizardConnect: () => wizardMock,
  WizardConnectQRDialog: () => null,
}));

vi.mock('../buildCampaignTx', async () => {
  const actual = await vi.importActual('../buildCampaignTx');
  return {
    ...actual,
    findOpenWallet: (...args) => mockFindOpenWallet(...args),
  };
});

vi.mock('../../api/pathFundingApi', () => ({
  default: {
    getProposal: (...args) => mockGetProposal(...args),
    getBchUsdRate: () => Promise.resolve({ usd_per_bch: '500' }),
  },
}));

vi.mock('../../api/knowledgePathsApi', () => ({
  default: {
    getUserKnowledgePaths: vi.fn().mockResolvedValue({ results: [] }),
  },
}));

function proposal(overrides = {}) {
  return {
    id: 4,
    status: 'open',
    title: 'Crowdfunded investigation',
    pitch: 'A pitch',
    goal_sats: 12000000,
    raised_sats: 0,
    deadline: '2099-01-01T04:59:00.000Z',
    author: 'Vincent',
    author_payout_address: 'bitcoincash:qzh0xfkuh6qgxmeqt3vqwjjm3qs4ga0gpvffh7kag2',
    network_prefix: 'bitcoincash',
    knowledge_path_id: null,
    pledges: [],
    ...overrides,
  };
}

function renderInvestigation() {
  return renderWithProviders(
    <Routes>
      <Route path="/knowledge_path/funding/:proposalId" element={<FundingDetail />} />
      <Route path="/messages/thread/:userId" element={<div>thread</div>} />
    </Routes>,
    { route: '/knowledge_path/funding/4' },
  );
}

describe('FundingDetail without a wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wizardMock.state = 'disconnected';
    wizardMock.manager = null;
    localStorage.setItem('user', JSON.stringify({ username: 'Vincent' }));
  });

  it('fills the receive address from the one already saved', async () => {
    const saved = 'bitcoincash:qzh0xfkuh6qgxmeqt3vqwjjm3qs4ga0gpvffh7kag2';
    wizardMock.state = 'connected';
    wizardMock.manager = { on: vi.fn(), off: vi.fn() };
    mockFindOpenWallet.mockResolvedValue({
      address: 'bitcoincash:qr9uthgsq5m8j20tleq27xvlqmerallnscwtj5fac7',
      index: 0,
      picked: { utxo: { txid: 'ab', vout: 0, satoshis: 5000 } },
    });
    mockGetProposal.mockResolvedValue(proposal({
      status: 'draft',
      author: 'Vincent',
      author_payout_address: saved,
    }));
    renderInvestigation();
    expect(await screen.findByLabelText('Dirección de recepción')).toHaveValue(saved);
  });

  it('shows the cover image the same way a knowledge path does', async () => {
    mockGetProposal.mockResolvedValue(proposal({
      image: 'http://localhost/media/cover.jpg',
      image_preview: 'http://localhost/media/cover-preview.webp',
      image_focal_x: 0.2,
      image_focal_y: 0.8,
    }));
    renderInvestigation();
    const cover = await screen.findByRole('img', { name: 'Crowdfunded investigation' });
    expect(cover).toHaveAttribute('src', 'http://localhost/media/cover.jpg');
    expect(cover).toHaveStyle({ objectPosition: '20.0% 80.0%' });
  });

  it('offers a pledge while the deadline is still ahead', async () => {
    mockGetProposal.mockResolvedValue(proposal({ pending_sats: 10000 }));
    renderInvestigation();
    expect(await screen.findByRole('button', { name: 'Aportar' })).toBeInTheDocument();
    expect(screen.getByText(/10000 sats esperan una confirmación/)).toBeInTheDocument();
    expect(screen.getByText(/meta de unos/i)).toBeInTheDocument();
    expect(screen.getByText(/60,00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar aportes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar' })).toBeInTheDocument();
  });

  it('closes pledges when the deadline passed and the goal was missed', async () => {
    mockGetProposal.mockResolvedValue(proposal({
      deadline: '2020-01-01T04:59:00.000Z',
      raised_sats: 0,
    }));
    renderInvestigation();
    expect(await screen.findByRole('button', { name: 'Cerrar aportes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aportar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cobrar el fondo' })).not.toBeInTheDocument();
  });

  it('tells a pledger to reclaim after pledges are closed', async () => {
    mockGetProposal.mockResolvedValue(proposal({
      status: 'expired',
      raised_sats: 0,
      pending_sats: 10000,
    }));
    renderInvestigation();
    expect(await screen.findByText(/puedes recuperar el aporte/)).toBeInTheDocument();
    expect(screen.queryByText(/pulsa Aportar/)).not.toBeInTheDocument();
  });

  it('shows a reclaimed pledge as finished', async () => {
    mockGetProposal.mockResolvedValue(proposal({
      status: 'expired',
      raised_sats: 0,
      pledges: [{
        id: 2,
        amount_sats: 10000,
        status: 'refunded',
        wallet_address: 'bitcoincash:qr9uthgsq5m8j20tleq27xvlqmerallnscwtj5fac7',
      }],
    }));
    renderInvestigation();
    const reclaimed = await screen.findByRole('button', { name: 'El aporte fue recuperado.' });
    expect(reclaimed).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Recuperar aporte' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contactar soporte' })).toBeInTheDocument();
  });

  it('sends a support message about this investigation to user 2', async () => {
    mockThread.mockResolvedValue({ data: { id: 9 } });
    mockSend.mockResolvedValue({});
    mockGetProposal.mockResolvedValue(proposal({ status: 'expired' }));
    renderInvestigation();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Contactar soporte' }));
    await user.type(screen.getByLabelText('Mensaje'), 'El aporte no aparece');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(mockThread).toHaveBeenCalledWith(2));
    expect(mockSend).toHaveBeenCalledWith(
      9,
      expect.stringContaining('Crowdfunded investigation'),
    );
    expect(mockSend.mock.calls[0][1]).toContain('El aporte no aparece');
  });

  it('hides contact support until someone is signed in', async () => {
    mockGetProposal.mockResolvedValue(proposal({ status: 'expired' }));
    renderWithProviders(
      <Routes>
        <Route path="/knowledge_path/funding/:proposalId" element={<FundingDetail />} />
      </Routes>,
      { route: '/knowledge_path/funding/4', auth: unauthenticatedAuth() },
    );
    expect(await screen.findByText('Crowdfunded investigation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Contactar soporte' })).not.toBeInTheDocument();
  });

  it('lets the owner claim once the goal is reached', async () => {
    mockGetProposal.mockResolvedValue(proposal({
      status: 'funded',
      raised_sats: 12000000,
    }));
    renderInvestigation();
    expect(await screen.findByRole('button', { name: 'Cobrar el fondo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aportar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar aportes' })).not.toBeInTheDocument();
  });

  it('hides the pledge wallet after the pool is claimed', async () => {
    mockGetProposal.mockResolvedValue(proposal({
      status: 'claimed',
      raised_sats: 10000,
      goal_sats: 10000,
    }));
    renderInvestigation();
    expect(await screen.findByText('Crowdfunded investigation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conectar billetera' })).not.toBeInTheDocument();
    expect(screen.queryByText('Billetera del aporte')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aportar' })).not.toBeInTheDocument();
  });

  it('hides the claim from a visitor', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'Ada' }));
    mockGetProposal.mockResolvedValue(proposal({
      status: 'funded',
      raised_sats: 12000000,
    }));
    renderInvestigation();
    expect(await screen.findByText('Crowdfunded investigation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cobrar el fondo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
  });
});
