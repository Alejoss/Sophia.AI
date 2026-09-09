import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import BchOrderExpiryNotice from '../BchOrderExpiryNotice';
import {
  formatExpiryLocalTime,
  formatRemainingCountdown,
  secondsUntilExpiry,
} from '../bchOrderExpiry';

describe('bchOrderExpiry helpers', () => {
  it('computes remaining seconds from expires_at', () => {
    const now = Date.parse('2026-09-09T01:00:00.000Z');
    expect(
      secondsUntilExpiry('2026-09-09T01:25:50.000Z', now),
    ).toBe(25 * 60 + 50);
    expect(secondsUntilExpiry('2026-09-09T00:59:00.000Z', now)).toBe(0);
    expect(secondsUntilExpiry(null, now)).toBeNull();
  });

  it('formats countdown with zero-padded seconds', () => {
    expect(formatRemainingCountdown(25 * 60 + 50)).toBe('25m 50s');
    expect(formatRemainingCountdown(65)).toBe('1m 05s');
    expect(formatRemainingCountdown(0)).toBe('0m 00s');
  });

  it('formats local expiry time', () => {
    expect(formatExpiryLocalTime('2026-09-09T01:30:00.000Z')).toBeTruthy();
  });
});

describe('BchOrderExpiryNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T01:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks the countdown every second', () => {
    render(
      <BchOrderExpiryNotice
        bchOrder={{
          status: 'pending',
          expires_at: '2026-09-09T01:25:50.000Z',
        }}
      />,
    );
    expect(screen.getByText(/Tiempo restante: 25m 50s/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/Tiempo restante: 25m 49s/i)).toBeInTheDocument();
  });

  it('shows expiry message when the order has lapsed', () => {
    render(
      <BchOrderExpiryNotice
        bchOrder={{
          status: 'pending',
          expires_at: '2026-09-09T00:59:00.000Z',
        }}
      />,
    );
    expect(screen.getByText(/Esta orden expiró/i)).toBeInTheDocument();
  });

  it('falls back to a static 30-minute message without expires_at', () => {
    render(
      <BchOrderExpiryNotice
        bchOrder={{ status: 'pending' }}
        ttlMinutes={30}
      />,
    );
    expect(
      screen.getByText(/Tienes 30 minutos para realizar el pago/i),
    ).toBeInTheDocument();
  });
});
