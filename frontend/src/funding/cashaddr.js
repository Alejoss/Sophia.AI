const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const CHARSET_MAP = Object.fromEntries([...CHARSET].map((char, index) => [char, index]));
const GENERATORS = [
  0x98f2bc8e61n,
  0x79b76d99e2n,
  0xf33e5fb3c4n,
  0xae2eabe2a8n,
  0x1e4f43e470n,
];
const HASH_SIZES = {
  0: 20, 1: 24, 2: 28, 3: 32, 4: 40, 5: 48, 6: 56, 7: 64,
};
const PREFIXES = new Set(['bitcoincash', 'bchtest', 'bchreg']);

function polymod(values) {
  let chk = 1n;
  for (const value of values) {
    const top = chk >> 35n;
    chk = ((chk & 0x07ffffffffn) << 5n) ^ BigInt(value);
    for (let index = 0n; index < 5n; index += 1n) {
      if ((top >> index) & 1n) chk ^= GENERATORS[index];
    }
  }
  return chk ^ 1n;
}

function prefixExpand(prefix) {
  return [...prefix].map((char) => char.charCodeAt(0) & 0x1f).concat(0);
}

function convertBits(data) {
  let acc = 0;
  let bits = 0;
  const converted = [];
  const maxValue = (1 << 8) - 1;
  for (const value of data) {
    if (value < 0 || value >> 5) return null;
    acc = (acc << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      converted.push((acc >> bits) & maxValue);
    }
  }
  if (bits >= 5 || ((acc << (8 - bits)) & maxValue)) return null;
  return converted;
}

/** True when the address is a prefixed Bitcoin Cash P2PKH or P2SH CashAddr. */
export function isValidCashAddr(address) {
  const raw = String(address || '').trim();
  if (!raw.includes(':')) return false;
  const lower = raw.toLowerCase();
  if (raw !== lower && raw !== raw.toUpperCase()) return false;
  const splitAt = lower.indexOf(':');
  const prefix = lower.slice(0, splitAt);
  const payload = lower.slice(splitAt + 1);
  if (!PREFIXES.has(prefix) || !payload || lower.slice(splitAt + 1).includes(':')) return false;

  const data = [];
  for (const char of payload) {
    if (!(char in CHARSET_MAP)) return false;
    data.push(CHARSET_MAP[char]);
  }
  if (polymod(prefixExpand(prefix).concat(data)) !== 0n) return false;

  const decoded = convertBits(data.slice(0, -8));
  if (!decoded || decoded.length < 2) return false;
  const version = decoded[0];
  const hashLength = HASH_SIZES[version & 0x07];
  if (hashLength !== decoded.length - 1) return false;
  const addressType = version >> 3;
  return addressType >= 0 && addressType <= 3;
}
