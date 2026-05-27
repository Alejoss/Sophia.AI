import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EventsList from '../EventsList';
import { fetchEvents } from '../../api/eventsApi';

vi.mock('../../api/eventsApi', () => ({
  fetchEvents: vi.fn(),
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('EventsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders fetched events', async () => {
    fetchEvents.mockResolvedValue([
      {
        id: 1,
        title: 'Evento React',
        event_type: 'LIVE_COURSE',
        description: 'Aprende React desde cero',
        owner: { username: 'alejandro' },
        platform: 'zoom',
        date_start: '2026-01-15T18:00:00Z',
        date_end: '2026-01-15T20:00:00Z',
        reference_price: 0,
      },
    ]);

    renderWithRouter(<EventsList />);

    expect(await screen.findByText('Evento React')).toBeInTheDocument();
    expect(screen.getByText(/Curso en Vivo/i)).toBeInTheDocument();
    expect(screen.getByText(/Anfitrión:/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver Detalles/i })).toHaveAttribute(
      'href',
      '/events/1',
    );
  });

  it('renders empty state when no events', async () => {
    fetchEvents.mockResolvedValue([]);

    renderWithRouter(<EventsList />);

    expect(await screen.findByText('No se encontraron eventos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Crear tu Primer Evento/i })).toHaveAttribute(
      'href',
      '/events/create',
    );
  });

  it('shows error state and retries loading', async () => {
    fetchEvents
      .mockRejectedValueOnce({ detail: 'API temporalmente no disponible' })
      .mockResolvedValueOnce([]);

    const user = userEvent.setup();
    renderWithRouter(<EventsList />);

    expect(
      await screen.findByText('API temporalmente no disponible'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Intentar de nuevo/i }));

    await waitFor(() => {
      expect(fetchEvents).toHaveBeenCalledTimes(2);
    });
  });
});
