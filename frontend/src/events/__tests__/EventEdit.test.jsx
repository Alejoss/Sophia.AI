import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventEdit from '../EventEdit';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockFetchEventById = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDeleteEvent = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ eventId: '12' }),
  };
});

vi.mock('../../api/eventsApi', () => ({
  fetchEventById: (...args) => mockFetchEventById(...args),
  updateEvent: (...args) => mockUpdateEvent(...args),
  deleteEvent: (...args) => mockDeleteEvent(...args),
}));

vi.mock('../EventDateTimeField', () => ({
  default: ({ label }) => <div data-testid={`date-field-${label}`} />,
}));

describe('EventEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchEventById.mockResolvedValue({
      id: 12,
      title: 'Evento original',
      description: 'Descripción original',
      event_type: 'LIVE_COURSE',
      platform: '',
      other_platform: '',
      reference_price: '0',
      date_start: '',
      date_end: '',
      schedule_description: '',
      is_visible: true,
      image: null,
    });
  });

  it('shows a title validation error and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EventEdit />);

    const titleField = await screen.findByDisplayValue('Evento original');
    await user.clear(titleField);
    await user.click(screen.getByRole('button', { name: /actualizar evento/i }));

    expect(await screen.findByText(/el título es obligatorio/i)).toBeInTheDocument();
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  it('submits a FormData payload with updated fields', async () => {
    const user = userEvent.setup();
    mockUpdateEvent.mockResolvedValue({ id: 12 });

    renderWithProviders(<EventEdit />);

    const titleField = await screen.findByDisplayValue('Evento original');
    await user.clear(titleField);
    await user.type(titleField, 'Evento actualizado');
    await user.click(screen.getByRole('button', { name: /actualizar evento/i }));

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
    });
    const [eventId, formData] = mockUpdateEvent.mock.calls[0];
    expect(eventId).toBe('12');
    expect(formData.get('title')).toBe('Evento actualizado');
    expect(await screen.findByText(/evento actualizado exitosamente/i)).toBeInTheDocument();
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockUpdateEvent.mockRejectedValue({
      response: { data: { error: 'No se pudo actualizar el evento' } },
    });

    renderWithProviders(<EventEdit />);

    const titleField = await screen.findByDisplayValue('Evento original');
    await user.clear(titleField);
    await user.type(titleField, 'Otro título');
    await user.click(screen.getByRole('button', { name: /actualizar evento/i }));

    expect(await screen.findByText(/no se pudo actualizar el evento/i)).toBeInTheDocument();
  });
});
