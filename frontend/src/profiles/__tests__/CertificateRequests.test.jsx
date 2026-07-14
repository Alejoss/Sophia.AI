import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CertificateRequests from '../CertificateRequests';
import { renderWithProviders, mockAuthValue } from '../../test/formTestUtils';

const mockGetCertificateRequests = vi.fn();
const mockRejectCertificateRequest = vi.fn();

vi.mock('../../api/certificatesApi', () => ({
  default: {
    getCertificateRequests: (...args) => mockGetCertificateRequests(...args),
    approveCertificateRequest: vi.fn(),
    rejectCertificateRequest: (...args) => mockRejectCertificateRequest(...args),
    cancelCertificateRequest: vi.fn(),
  },
}));

const request = {
  id: 3,
  status: 'PENDING',
  knowledge_path_title: 'Camino de Ethereum',
  knowledge_path_author: 'testuser',
  requester: 'carol',
  requester_id: 9,
  request_date: '2024-02-01T00:00:00Z',
};

describe('CertificateRequests reject dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCertificateRequests.mockResolvedValue([request]);
  });

  const openRejectDialog = async (user) => {
    await user.click(await screen.findByRole('button', { name: /^rechazar$/i }));
    return screen.findByRole('dialog');
  };

  it('shows a validation error when no reason is provided and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CertificateRequests />, { auth: mockAuthValue });

    const dialog = await openRejectDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(await within(dialog).findByText(/motivo del rechazo es requerido/i)).toBeInTheDocument();
    expect(mockRejectCertificateRequest).not.toHaveBeenCalled();
  });

  it('rejects with a reason', async () => {
    const user = userEvent.setup();
    mockRejectCertificateRequest.mockResolvedValue({});
    mockGetCertificateRequests
      .mockResolvedValueOnce([request])
      .mockResolvedValueOnce([]);

    renderWithProviders(<CertificateRequests />, { auth: mockAuthValue });

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/motivo del rechazo/i), 'Documentación incompleta');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    await waitFor(() => {
      expect(mockRejectCertificateRequest).toHaveBeenCalledWith(3, 'Documentación incompleta');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockRejectCertificateRequest.mockRejectedValue({
      response: { data: { error: 'No se pudo rechazar la solicitud' } },
    });

    renderWithProviders(<CertificateRequests />, { auth: mockAuthValue });

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/motivo del rechazo/i), 'Motivo de prueba');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(await screen.findByText(/no se pudo rechazar la solicitud/i)).toBeInTheDocument();
  });
});
