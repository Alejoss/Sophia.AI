import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BchPaymentsDashboard from '../BchPaymentsDashboard';
import { renderWithProviders, mockAuthValue } from '../../test/formTestUtils';

const mockGetCatalog = vi.fn();
const mockUpdatePath = vi.fn();
const mockUpdateTopic = vi.fn();

vi.mock('../../api/paymentsApi', () => ({
  getAdminBchCatalog: (...args) => mockGetCatalog(...args),
  updateKnowledgePathBch: (...args) => mockUpdatePath(...args),
  updateTopicBch: (...args) => mockUpdateTopic(...args),
}));

const staffAuth = {
  ...mockAuthValue,
  authState: {
    isAuthenticated: true,
    user: { id: 1, username: 'admin', is_staff: true },
  },
  authInitialized: true,
};

const catalog = {
  bch_direct_configured: true,
  bch_network: 'chipnet',
  knowledge_paths: [
    {
      id: 11,
      title: 'Camino de pago',
      author: 'ana',
      is_visible: true,
      reference_price: 8,
      is_paid_path: true,
      bch_direct_enabled: false,
    },
  ],
  topics: [
    {
      id: 22,
      title: 'Tema Bitcoin',
      creator: 'ana',
      is_public: true,
      chat_enabled: true,
      reference_price: 2,
      is_paid_topic: true,
      bch_direct_enabled: false,
    },
  ],
};

describe('BchPaymentsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCatalog.mockResolvedValue(catalog);
  });

  it('lists knowledge paths and topics for staff', async () => {
    renderWithProviders(<BchPaymentsDashboard />, { auth: staffAuth });

    expect(await screen.findByText('Pagos Bitcoin Cash')).toBeInTheDocument();
    expect(screen.getByText('Camino de pago')).toBeInTheDocument();
    expect(screen.getByText('Tema Bitcoin')).toBeInTheDocument();
    expect(screen.getByText(/BCH servidor/)).toBeInTheDocument();
  });

  it('activates BCH on a paid knowledge path', async () => {
    const user = userEvent.setup();
    mockUpdatePath.mockResolvedValue({
      ...catalog.knowledge_paths[0],
      bch_direct_enabled: true,
      bch_direct_available: true,
    });
    renderWithProviders(<BchPaymentsDashboard />, { auth: staffAuth });
    await screen.findByText('Camino de pago');

    const switches = screen.getAllByRole('checkbox');
    await user.click(switches[0]);

    await waitFor(() => {
      expect(mockUpdatePath).toHaveBeenCalledWith(11, { bch_direct_enabled: true });
    });
  });
});
