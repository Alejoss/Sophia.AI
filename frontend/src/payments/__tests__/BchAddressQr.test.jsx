import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BchAddressQr from '../BchAddressQr';
import { bchAddressQrValue } from '../bchAddressQr';

describe('bchAddressQrValue', () => {
  it('returns the trimmed CashAddr with no amount query', () => {
    const addr = 'bitcoincash:qpnq74gum4tstjat4803zav9lr37v5wqaqyqrh9wjd';
    expect(bchAddressQrValue(`  ${addr}  `)).toBe(addr);
    expect(bchAddressQrValue(addr)).not.toMatch(/amount=/i);
    expect(bchAddressQrValue(addr)).not.toContain('?');
  });

  it('returns empty for missing address', () => {
    expect(bchAddressQrValue('')).toBe('');
    expect(bchAddressQrValue(null)).toBe('');
  });
});

describe('BchAddressQr', () => {
  it('renders an SVG QR whose payload is address-only', () => {
    const addr = 'bitcoincash:qpnq74gum4tstjat4803zav9lr37v5wqaqyqrh9wjd';
    render(<BchAddressQr address={addr} />);
    const wrap = screen.getByTestId('bch-address-qr');
    expect(wrap).toHaveAttribute('data-qr-value', addr);
    expect(wrap.getAttribute('data-qr-value')).not.toMatch(/amount=/i);
    expect(wrap.querySelector('svg')).toBeTruthy();
    expect(screen.getByText(/Escanea la dirección \(sin monto\)/i)).toBeInTheDocument();
  });

  it('renders nothing without an address', () => {
    const { container } = render(<BchAddressQr address="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
