/**
 * Client-side remaining seconds until a BCH order expires.
 * ``expires_at`` is an ISO timestamp from the API (computed once at create);
 * we tick locally so the checkout UI is not a frozen snapshot.
 */
export function secondsUntilExpiry(expiresAtIso, nowMs = Date.now()) {
  if (!expiresAtIso) return null;
  const end = Date.parse(expiresAtIso);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.floor((end - nowMs) / 1000));
}

export function formatRemainingCountdown(totalSeconds) {
  if (totalSeconds == null) return null;
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/** Local time string for "válida hasta …" fallback copy. */
export function formatExpiryLocalTime(expiresAtIso) {
  if (!expiresAtIso) return null;
  const end = Date.parse(expiresAtIso);
  if (Number.isNaN(end)) return null;
  try {
    return new Date(end).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return new Date(end).toISOString();
  }
}
