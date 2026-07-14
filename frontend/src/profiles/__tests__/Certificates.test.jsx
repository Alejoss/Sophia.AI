import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Certificates from '../Certificates';
import { renderWithProviders } from '../../test/formTestUtils';

const mockGetCertificates = vi.fn();
const mockGetCertificateRequests = vi.fn();
const mockRejectCertificateRequest = vi.fn();

vi.mock('../../api/certificatesApi', () => ({
  default: {
    getCertificates: (...args) => mockGetCertificates(...args),
    getUserCertificatesById: vi.fn(),
    getCertificateRequests: (...args) => mockGetCertificateRequests(...args),
    approveCertificateRequest: vi.fn(),
    rejectCertificateRequest: (...args) => mockRejectCertificateRequest(...args),
    cancelCertificateRequest: vi.fn(),
  },
}));

const request = {
  id: 1,
  status: 'PENDING',
  knowledge_path_title: 'Camino de Bitcoin',
  knowledge_path_author: 'testuser',
  requester: 'bob',
  requester_id: 2,
  request_date: '2024-01-01T00:00:00Z',
};

describe('Certificates reject dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCertificates.mockResolvedValue([]);
    mockGetCertificateRequests.mockResolvedValue([request]);
  });

  const openRejectDialog = async (user) => {
    await user.click(await screen.findByRole('tab', { name: /solicitudes de certificados/i }));
    await user.click(await screen.findByRole('button', { name: /^rechazar$/i }));
    return screen.findByRole('dialog');
  };

  it('shows a validation error when no reason is provided and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Certificates isOwnProfile />);

    const dialog = await openRejectDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(
      await screen.findByText(/el motivo del rechazo es requerido/i),
    ).toBeInTheDocument();
    expect(mockRejectCertificateRequest).not.toHaveBeenCalled();
  });

  it('rejects the request with the provided reason', async () => {
    const user = userEvent.setup();
    mockRejectCertificateRequest.mockResolvedValue({});
    renderWithProviders(<Certificates isOwnProfile />);

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/motivo del rechazo/i), 'Faltan requisitos');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    await waitFor(() => {
      expect(mockRejectCertificateRequest).toHaveBeenCalledWith(1, 'Faltan requisitos');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockRejectCertificateRequest.mockRejectedValue({
      response: { data: { error: 'No se pudo rechazar la solicitud' } },
    });
    renderWithProviders(<Certificates isOwnProfile />);

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/motivo del rechazo/i), 'No aplica');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(
      await screen.findByText(/no se pudo rechazar la solicitud/i),
    ).toBeInTheDocument();
  });
});
