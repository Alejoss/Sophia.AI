import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ManageEvent from '../ManageEvent';
import { renderWithProviders } from '../../test/formTestUtils';

const mockFetchEventById = vi.fn();
const mockGetEventParticipants = vi.fn();
const mockUpdateParticipantStatus = vi.fn();
const mockGetPaymentGatewayStatus = vi.fn();
const mockGenerateEventCertificate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ eventId: '1' }),
  };
});

vi.mock('../../api/eventsApi', () => ({
  fetchEventById: (...args) => mockFetchEventById(...args),
  getEventParticipants: (...args) => mockGetEventParticipants(...args),
  updateParticipantStatus: (...args) => mockUpdateParticipantStatus(...args),
}));

vi.mock('../../api/paymentsApi', () => ({
  getPaymentGatewayStatus: (...args) => mockGetPaymentGatewayStatus(...args),
}));

vi.mock('../../api/certificatesApi', () => ({
  default: {
    generateEventCertificate: (...args) => mockGenerateEventCertificate(...args),
  },
}));

const event = {
  id: 1,
  title: 'Curso de Bitcoin',
  event_type: 'LIVE_COURSE',
  date_start: '2024-01-01T00:00:00Z',
  date_end: '2024-01-02T00:00:00Z',
  platform: 'Zoom',
  reference_price: 0,
};

const participant = {
  id: 10,
  user: { id: 5, username: 'bob' },
  user_email: 'bob@example.com',
  registration_status: 'REGISTERED',
  payment_status: 'PAID',
  registered_at: '2024-01-01T00:00:00Z',
  has_certificate: false,
};

describe('ManageEvent certificate dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchEventById.mockResolvedValue(event);
    mockGetEventParticipants.mockResolvedValue([participant]);
    mockGetPaymentGatewayStatus.mockResolvedValue({ enabled: false });
  });

  const openCertificateDialog = async (user) => {
    await user.click(await screen.findByRole('button', { name: /enviar certificado/i }));
    return screen.findByRole('dialog');
  };

  it('sends the certificate with an optional personal note', async () => {
    const user = userEvent.setup();
    mockGenerateEventCertificate.mockResolvedValue({});
    renderWithProviders(<ManageEvent />);

    const dialog = await openCertificateDialog(user);
    await user.type(
      within(dialog).getByLabelText(/mensaje personal/i),
      '¡Felicidades por completar el curso!',
    );
    await user.click(within(dialog).getByRole('button', { name: /^enviar certificado$/i }));

    await waitFor(() => {
      expect(mockGenerateEventCertificate).toHaveBeenCalledWith(
        '1',
        10,
        { note: '¡Felicidades por completar el curso!' },
      );
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockGenerateEventCertificate.mockRejectedValue({
      response: { data: { error: 'No se pudo generar el certificado' } },
    });
    renderWithProviders(<ManageEvent />);

    const dialog = await openCertificateDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^enviar certificado$/i }));

    await waitFor(() => {
      expect(mockGenerateEventCertificate).toHaveBeenCalled();
    });

    await waitFor(() => {
      const matches = screen.getAllByText(/no se pudo generar el certificado|error al generar el certificado/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});
