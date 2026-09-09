/**
 * BIP21-style CashAddr payload for QR codes.
 * Address only — no ``amount=`` (wallet fee/rounding made amount-in-QR unreliable).
 */
export function bchAddressQrValue(address) {
  const raw = (address || '').trim();
  if (!raw) return '';
  return raw;
}
