import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FundingCreate, { deadlineWithTimezone } from '../FundingCreate';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockCreateProposal = vi.fn();
const mockGetBchUsdRate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/pathFundingApi', () => ({
  default: {
    createProposal: (...args) => mockCreateProposal(...args),
    getBchUsdRate: (...args) => mockGetBchUsdRate(...args),
  },
}));

describe('FundingCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBchUsdRate.mockResolvedValue({ usd_per_bch: '500' });
  });

  it('shows the default goal in USD from the Bitcoin Cash price', async () => {
    renderWithProviders(<FundingCreate />);
    expect(await screen.findByText(/60,00/)).toBeInTheDocument();
    expect(screen.queryByText(/bitcoincash:/i)).not.toBeInTheDocument();
  });

  it('shows field errors on an empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FundingCreate />);

    await user.clear(screen.getByLabelText(/meta \(satoshis\)/i));
    await user.click(screen.getByRole('button', { name: /guardar borrador/i }));

    expect(await screen.findByText(/el título es requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/la descripción es requerida/i)).toBeInTheDocument();
    expect(screen.getByText(/la meta es requerida/i)).toBeInTheDocument();
    expect(screen.getByText(/la fecha límite es requerida/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/dirección de cobro/i)).not.toBeInTheDocument();
    expect(mockCreateProposal).not.toHaveBeenCalled();
  });

  it('rejects a goal that is not a positive integer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FundingCreate />);

    await user.clear(screen.getByLabelText(/meta \(satoshis\)/i));
    await user.type(screen.getByLabelText(/meta \(satoshis\)/i), '12.5');
    await user.click(screen.getByRole('button', { name: /guardar borrador/i }));

    expect(await screen.findByText(/número entero de satoshis/i)).toBeInTheDocument();
    expect(mockCreateProposal).not.toHaveBeenCalled();
  });

  it('submits a timezone-aware draft and navigates to it', async () => {
    const user = userEvent.setup();
    mockCreateProposal.mockResolvedValue({ id: 9 });
    renderWithProviders(<FundingCreate />);

    await user.type(screen.getByLabelText(/^título/i), 'Historia del dinero');
    await user.type(screen.getByLabelText(/^descripción/i), 'Un recorrido por el efectivo digital.');

    await user.click(screen.getByLabelText(/fecha límite/i));
    await user.keyboard('25122027');

    await user.click(screen.getByRole('button', { name: /guardar borrador/i }));

    await waitFor(() => {
      expect(mockCreateProposal).toHaveBeenCalledTimes(1);
    });
    const payload = mockCreateProposal.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: 'Historia del dinero',
      pitch: 'Un recorrido por el efectivo digital.',
      goal_sats: 12000000,
    });
    expect(payload.author_payout_address).toBeUndefined();
    expect(payload.deadline).toBe(deadlineWithTimezone('2027-12-25'));
    expect(payload.deadline).toContain('T23:59:00');
    expect(mockNavigate).toHaveBeenCalledWith('/knowledge_path/funding/9');
  });

  it('shows the API error in an alert', async () => {
    const user = userEvent.setup();
    mockCreateProposal.mockRejectedValue({
      response: { data: { error: 'Deadline must be in the future.' } },
    });
    renderWithProviders(<FundingCreate />);

    await user.type(screen.getByLabelText(/^título/i), 'Historia del dinero');
    await user.type(screen.getByLabelText(/^descripción/i), 'Un recorrido por el efectivo digital.');
    await user.click(screen.getByLabelText(/fecha límite/i));
    await user.keyboard('25122027');
    await user.click(screen.getByRole('button', { name: /guardar borrador/i }));

    expect(await screen.findByText('Deadline must be in the future.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
