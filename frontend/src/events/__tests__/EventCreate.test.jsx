import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventCreate from '../EventCreate';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockCreateEvent = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/eventsApi', () => ({
  createEvent: (...args) => mockCreateEvent(...args),
}));

vi.mock('../EventDateTimeField', () => ({
  default: ({ label }) => <div data-testid={`date-field-${label}`} />,
}));

describe('EventCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation errors on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EventCreate />);

    await user.click(screen.getByRole('button', { name: /crear evento/i }));

    expect(await screen.findByText(/el título es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/la descripción es obligatoria/i)).toBeInTheDocument();
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('submits a FormData payload with the expected fields', async () => {
    const user = userEvent.setup();
    mockCreateEvent.mockResolvedValue({ id: 12 });

    renderWithProviders(<EventCreate />);

    await user.type(screen.getByLabelText(/título/i), 'Curso de Bitcoin');
    await user.type(screen.getByLabelText(/descripción \*/i), 'Un curso introductorio');
    // Event type is the first of the two MUI Selects on the page.
    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(await screen.findByRole('option', { name: /curso en vivo/i }));
    await user.click(screen.getByRole('button', { name: /crear evento/i }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    });
    const formData = mockCreateEvent.mock.calls[0][0];
    expect(formData.get('title')).toBe('Curso de Bitcoin');
    expect(formData.get('description')).toBe('Un curso introductorio');
    expect(formData.get('event_type')).toBe('LIVE_COURSE');
    expect(await screen.findByText(/evento creado exitosamente/i)).toBeInTheDocument();
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockCreateEvent.mockRejectedValue({
      response: { data: { error: 'No se pudo crear el evento' } },
    });

    renderWithProviders(<EventCreate />);

    await user.type(screen.getByLabelText(/título/i), 'Curso de Bitcoin');
    await user.type(screen.getByLabelText(/descripción \*/i), 'Un curso introductorio');
    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(await screen.findByRole('option', { name: /curso en vivo/i }));
    await user.click(screen.getByRole('button', { name: /crear evento/i }));

    expect(await screen.findByText(/no se pudo crear el evento/i)).toBeInTheDocument();
  });
});
