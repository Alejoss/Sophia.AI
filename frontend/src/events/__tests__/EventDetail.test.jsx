import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React, { StrictMode } from 'react';
import EventDetail from '../EventDetail';
import { AuthContext } from '../../context/AuthContext';

import { resetEventDetailSession } from '../../api/eventDetailSession';

const mockEvent = {
  id: 2,
  title: 'Evento de prueba',
  event_type: 'LIVE_COURSE',
  description: 'Descripción del evento',
  owner: { id: 99, username: 'otro_usuario' },
  platform: 'zoom',
  date_start: '2026-12-01T18:00:00Z',
  reference_price: 0,
};

const fetchEventById = vi.fn();
const peekEventDetailCache = vi.fn();
const getUserEventRegistrations = vi.fn();

vi.mock('../../api/eventsApi', () => ({
  fetchEventById: (...args) => fetchEventById(...args),
  peekEventDetailCache: (...args) => peekEventDetailCache(...args),
  getUserEventRegistrations: (...args) => getUserEventRegistrations(...args),
  registerForEvent: vi.fn(),
  cancelEventRegistration: vi.fn(),
}));

const renderEventDetail = ({
  authState = { isAuthenticated: false, user: null },
  strict = true,
} = {}) => {
  const ui = (
    <AuthContext.Provider
      value={{
        authState,
        setAuthState: vi.fn(),
        updateAuthState: vi.fn(),
        clearAuthState: vi.fn(),
        user: authState.user,
        isAuthenticated: authState.isAuthenticated,
        authInitialized: true,
      }}
    >
      <MemoryRouter initialEntries={['/events/2']}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

  return render(strict ? <StrictMode>{ui}</StrictMode> : ui);
};

describe('EventDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEventDetailSession('2');
    peekEventDetailCache.mockReturnValue(null);
    getUserEventRegistrations.mockResolvedValue([]);
    fetchEventById.mockImplementation(
      () => new Promise((resolve) => {
        setTimeout(() => resolve(mockEvent), 10);
      }),
    );
  });

  it('loads the event once and leaves the loading state', async () => {
    renderEventDetail();

    expect(screen.getByText('Cargando evento...')).toBeInTheDocument();

    expect(await screen.findByText('Evento de prueba')).toBeInTheDocument();
    expect(screen.queryByText('Cargando evento...')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchEventById).toHaveBeenCalledTimes(1);
    });
    expect(fetchEventById).toHaveBeenCalledWith('2');
  });

  it('uses cached event data without refetching', async () => {
    peekEventDetailCache.mockReturnValue(mockEvent);

    renderEventDetail();

    expect(await screen.findByText('Evento de prueba')).toBeInTheDocument();
    expect(fetchEventById).not.toHaveBeenCalled();
  });

  it('issues only one request under StrictMode double mount', async () => {
    renderEventDetail({ strict: true });

    expect(await screen.findByText('Evento de prueba')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchEventById).toHaveBeenCalledTimes(1);
    });
  });

  it('does not refetch when auth state updates after load', async () => {
    const authState = { isAuthenticated: true, user: { id: 5, username: 'owner' } };
    const { rerender } = renderEventDetail({ authState, strict: false });

    expect(await screen.findByText('Evento de prueba')).toBeInTheDocument();
    expect(fetchEventById).toHaveBeenCalledTimes(1);

    rerender(
      <AuthContext.Provider
        value={{
          authState: { isAuthenticated: true, user: { id: 5, username: 'owner' } },
          setAuthState: vi.fn(),
          updateAuthState: vi.fn(),
          clearAuthState: vi.fn(),
          user: { id: 5, username: 'owner' },
          isAuthenticated: true,
          authInitialized: true,
        }}
      >
        <MemoryRouter initialEntries={['/events/2']}>
          <Routes>
            <Route path="/events/:eventId" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(fetchEventById).toHaveBeenCalledTimes(1);
    });
  });

  it('skips registration lookup for the event owner', async () => {
    peekEventDetailCache.mockReturnValue({
      ...mockEvent,
      owner: { id: 5, username: 'owner' },
    });

    renderEventDetail({
      authState: { isAuthenticated: true, user: { id: 5, username: 'owner' } },
      strict: false,
    });

    expect(await screen.findByText('Evento de prueba')).toBeInTheDocument();
    expect(getUserEventRegistrations).not.toHaveBeenCalled();
  });
});
