import { describe, it, expect, afterEach, vi } from 'vitest';
import { shouldEnableSentry, sentryBeforeSend } from '../sentryEnv';

describe('shouldEnableSentry', () => {
  it('is off without a DSN', () => {
    expect(shouldEnableSentry({ dsn: '', mode: 'production' })).toBe(false);
    expect(shouldEnableSentry({ dsn: undefined, mode: 'production' })).toBe(false);
    expect(shouldEnableSentry({ dsn: '   ', mode: 'production' })).toBe(false);
  });

  it('is off in local / test Vite modes even with a DSN', () => {
    for (const mode of ['development', 'dev', 'local', 'test', 'testing', 'DEVELOPMENT']) {
      expect(shouldEnableSentry({ dsn: 'https://example@o.ingest.sentry.io/1', mode })).toBe(
        false,
      );
    }
  });

  it('is on for production and beta when DSN is set', () => {
    expect(
      shouldEnableSentry({ dsn: 'https://example@o.ingest.sentry.io/1', mode: 'production' }),
    ).toBe(true);
    expect(
      shouldEnableSentry({ dsn: 'https://example@o.ingest.sentry.io/1', mode: 'beta' }),
    ).toBe(true);
  });

  it('defaults mode to development when omitted', () => {
    expect(shouldEnableSentry({ dsn: 'https://example@o.ingest.sentry.io/1' })).toBe(false);
  });
});

describe('sentryBeforeSend', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('drops events from localhost', () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    expect(sentryBeforeSend({ message: 'x' })).toBeNull();
  });

  it('drops events from 127.0.0.1 and IPv6 loopback', () => {
    vi.stubGlobal('window', { location: { hostname: '127.0.0.1' } });
    expect(sentryBeforeSend({ message: 'x' })).toBeNull();
    vi.stubGlobal('window', { location: { hostname: '[::1]' } });
    expect(sentryBeforeSend({ message: 'x' })).toBeNull();
  });

  it('keeps events from non-local hosts', () => {
    const event = { message: 'prod-error' };
    vi.stubGlobal('window', { location: { hostname: 'academia-blockchain.com' } });
    expect(sentryBeforeSend(event)).toBe(event);
  });
});
