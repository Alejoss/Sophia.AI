/**
 * Frontend Sentry env gating — mirrors acbc_app/academia_blockchain/sentry_config.py.
 * Report only from production/beta builds; never from local Vite / test modes.
 */

export const DISABLED_SENTRY_ENVIRONMENTS = Object.freeze([
  'development',
  'dev',
  'local',
  'test',
  'testing',
]);

/**
 * @param {object} options
 * @param {string|undefined|null} options.dsn
 * @param {string|undefined|null} options.mode Vite MODE (or VITE_SENTRY_ENVIRONMENT override)
 * @returns {boolean}
 */
export function shouldEnableSentry({ dsn, mode } = {}) {
  if (!dsn || !String(dsn).trim()) return false;
  const normalized = String(mode || 'development').trim().toLowerCase();
  return !DISABLED_SENTRY_ENVIRONMENTS.includes(normalized);
}

/**
 * Drop events from local browsers even if a production build is previewed on localhost.
 * @param {import('@sentry/react').Event} event
 * @returns {import('@sentry/react').Event | null}
 */
export function sentryBeforeSend(event) {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return null;
    }
  }
  return event;
}
