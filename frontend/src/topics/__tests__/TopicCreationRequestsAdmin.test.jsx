import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCreationRequestsAdmin from '../TopicCreationRequestsAdmin';
import { renderWithProviders, mockAuthValue } from '../../test/formTestUtils';

const mockGetAdminTopicCreationRequests = vi.fn();
const mockRejectTopicCreationRequest = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    getAdminTopicCreationRequests: (...args) => mockGetAdminTopicCreationRequests(...args),
    approveTopicCreationRequest: vi.fn(),
    rejectTopicCreationRequest: (...args) => mockRejectTopicCreationRequest(...args),
    finalizeTopicCreationRequest: vi.fn(),
  },
}));

const request = {
  id: 1,
  status: 'PENDING',
  proposed_title: 'Historia de las stablecoins',
  proposed_description: '',
  requested_by: { id: 2, username: 'bob' },
  created_at: '2024-01-01T00:00:00Z',
};

const staffAuth = {
  ...mockAuthValue,
  authState: {
    isAuthenticated: true,
    user: { id: 1, username: 'admin', is_staff: true },
  },
  authInitialized: true,
};

describe('TopicCreationRequestsAdmin reject dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminTopicCreationRequests.mockResolvedValue([request]);
  });

  const openRejectDialog = async (user) => {
    await user.click(await screen.findByRole('button', { name: /^rechazar$/i }));
    return screen.findByRole('dialog');
  };

  it('shows a validation error when no reason is provided and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TopicCreationRequestsAdmin embedded />, { auth: staffAuth });

    const dialog = await openRejectDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(
      await screen.findByText(/el motivo del rechazo es requerido/i),
    ).toBeInTheDocument();
    expect(mockRejectTopicCreationRequest).not.toHaveBeenCalled();
  });

  it('rejects the request with the provided reason', async () => {
    const user = userEvent.setup();
    mockRejectTopicCreationRequest.mockResolvedValue({});
    renderWithProviders(<TopicCreationRequestsAdmin embedded />, { auth: staffAuth });

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/motivo del rechazo/i), 'Título demasiado amplio');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    await waitFor(() => {
      expect(mockRejectTopicCreationRequest).toHaveBeenCalledWith(1, {
        rejection_reason: 'Título demasiado amplio',
      });
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockRejectTopicCreationRequest.mockRejectedValue({
      response: { data: { error: 'No se pudo rechazar la solicitud' } },
    });
    renderWithProviders(<TopicCreationRequestsAdmin embedded />, { auth: staffAuth });

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/motivo del rechazo/i), 'No aplica');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(
      await screen.findByText(/no se pudo rechazar la solicitud/i),
    ).toBeInTheDocument();
  });
});
