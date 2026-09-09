import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { NotificationsProvider, useNotifications } from '../NotificationsContext';

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  authInitialized: true,
}));

vi.mock('../AuthContext.jsx', () => ({
  useAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    authInitialized: authState.authInitialized,
  }),
}));

vi.mock('../../api/profilesApi', () => ({
  getUnreadNotificationsCount: vi.fn(),
}));

import { getUnreadNotificationsCount } from '../../api/profilesApi';

function UnreadProbe() {
  const { unreadCount } = useNotifications();
  return <div data-testid="unread-count">{unreadCount}</div>;
}

describe('NotificationsProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    authState.authInitialized = true;
    getUnreadNotificationsCount.mockResolvedValue(3);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches unread count once on auth ready and does not poll on an interval', async () => {
    render(
      <NotificationsProvider>
        <UnreadProbe />
      </NotificationsProvider>,
    );

    await waitFor(() => {
      expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('unread-count')).toHaveTextContent('3');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(1);
  });

  it('refreshes unread count when the tab becomes visible again', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    render(
      <NotificationsProvider>
        <UnreadProbe />
      </NotificationsProvider>,
    );

    await waitFor(() => {
      expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(1);
    });

    getUnreadNotificationsCount.mockResolvedValue(5);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(1);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId('unread-count')).toHaveTextContent('5');
  });
});
