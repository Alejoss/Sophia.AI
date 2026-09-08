import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BchPaymentsDashboard from '../BchPaymentsDashboard';
import { renderWithProviders, mockAuthValue } from '../../test/formTestUtils';

const mockGetCatalog = vi.fn();
const mockGetOrders = vi.fn();
const mockConfirmOrder = vi.fn();
const mockUpdatePath = vi.fn();
const mockUpdateTopic = vi.fn();

vi.mock('../../api/paymentsApi', () => ({
  getAdminBchCatalog: (...args) => mockGetCatalog(...args),
  getAdminBchOrders: (...args) => mockGetOrders(...args),
  confirmAdminBchOrder: (...args) => mockConfirmOrder(...args),
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

const expiredOrder = {
  id: 44,
  product_type: 'path',
  product_id: 11,
  product_title: 'Camino de pago',
  buyer_username: 'bchbuyer',
  expected_amount_bch: '0.04000000',
  expected_amount_sats: 4000000,
  usd_amount: 8,
  address: 'bitcoincash:qptestaddress',
  status: 'expired',
};

describe('BchPaymentsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCatalog.mockResolvedValue(catalog);
    mockGetOrders.mockResolvedValue({ orders: [expiredOrder], bch_network: 'chipnet' });
  });

  it('lists knowledge paths and topics for staff', async () => {
    renderWithProviders(<BchPaymentsDashboard />, { auth: staffAuth });

    expect(await screen.findByText('Pagos Bitcoin Cash')).toBeInTheDocument();
    expect(screen.getByText('Camino de pago')).toBeInTheDocument();
    expect(screen.getByText('Tema Bitcoin')).toBeInTheDocument();
    expect(screen.getByText(/BCH servidor/)).toBeInTheDocument();
    expect(screen.getByText('Confirmar pagos reportados')).toBeInTheDocument();
    expect(screen.getByText('bchbuyer')).toBeInTheDocument();
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

  it('confirms an expired order with a pasted TXID', async () => {
    const user = userEvent.setup();
    const txid = 'ab'.repeat(32);
    mockConfirmOrder.mockResolvedValue({
      detail: 'Pago BCH confirmado. El acceso quedó desbloqueado.',
      payment: { ...expiredOrder, status: 'paid', payment_txid: txid },
    });
    renderWithProviders(<BchPaymentsDashboard />, { auth: staffAuth });
    await screen.findByText('bchbuyer');

    await user.type(screen.getByPlaceholderText(/TXID/i), txid);
    await user.click(screen.getByRole('button', { name: /Confirmar pago/i }));

    await waitFor(() => {
      expect(mockConfirmOrder).toHaveBeenCalledWith(44, txid);
    });
    expect(
      await screen.findByText(/Pago BCH confirmado/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('bchbuyer')).not.toBeInTheDocument();
  });

  it('prefills a buyer-reported TXID in the staff inbox', async () => {
    const txid = 'cd'.repeat(32);
    mockGetOrders.mockResolvedValue({
      orders: [{ ...expiredOrder, reported_txid: txid, reported_note: 'Electron Cash' }],
      bch_network: 'chipnet',
    });
    renderWithProviders(<BchPaymentsDashboard />, { auth: staffAuth });
    expect(await screen.findByText('TXID reportado')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/TXID/i)).toHaveValue(txid);
  });
});
