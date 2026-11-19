import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import FundingDetail from '../FundingDetail';
import { renderWithProviders } from '../../test/formTestUtils';

const mockGetProposal = vi.fn();

vi.mock('@wizardconnect/react', () => ({
  useWizardConnect: () => ({
    state: 'disconnected',
    manager: null,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  WizardConnectQRDialog: () => null,
}));

vi.mock('../../api/pathFundingApi', () => ({
  default: {
    getProposal: (...args) => mockGetProposal(...args),
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
    </Routes>,
    { route: '/knowledge_path/funding/4' },
  );
}

describe('FundingDetail without a wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ username: 'Vincent' }));
  });

  it('offers a pledge while the deadline is still ahead', async () => {
    mockGetProposal.mockResolvedValue(proposal());
    renderInvestigation();
    expect(await screen.findByRole('button', { name: 'Aportar' })).toBeInTheDocument();
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
