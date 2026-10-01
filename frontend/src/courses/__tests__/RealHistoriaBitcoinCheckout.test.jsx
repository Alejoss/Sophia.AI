import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RealHistoriaBitcoinCheckout from '../RealHistoriaBitcoinCheckout.jsx';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    authInitialized: true,
    authState: {
      isAuthenticated: true,
      user: { id: 1, username: 'buyer', email: 'buyer@example.com' },
    },
  }),
}));

vi.mock('../../api/paymentsApi.js', () => ({
  getCourse: vi.fn(),
  createOrGetCoursePurchase: vi.fn(),
}));

vi.mock('../../payments/adapters/CourseCheckout.jsx', () => ({
  default: ({ open, title }) => (
    open ? <div data-testid="course-checkout-modal">Pago: {title}</div> : null
  ),
}));

import { getCourse, createOrGetCoursePurchase } from '../../api/paymentsApi.js';

describe('RealHistoriaBitcoinCheckout', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getCourse.mockReset();
    createOrGetCoursePurchase.mockReset();
    getCourse.mockResolvedValue({
      code: 'real-historia-bitcoin',
      title: 'La real historia de Bitcoin',
      price_usd: 35,
      is_for_sale: true,
    });
  });

  it('asks for receipt email before opening payment methods', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RealHistoriaBitcoinCheckout />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText(/correo para el recibo/i)).toHaveValue('buyer@example.com');
    expect(screen.queryByTestId('course-checkout-modal')).not.toBeInTheDocument();
    expect(screen.getByText(/1\.\s*Correo/i)).toBeInTheDocument();

    createOrGetCoursePurchase.mockResolvedValue({
      id: 9,
      title: 'La real historia de Bitcoin',
      price_amount: 35,
      payment_status: 'PENDING',
      is_paid: false,
      receipt_email: 'buyer@example.com',
    });

    await user.click(screen.getByRole('button', { name: /continuar al pago/i }));

    await waitFor(() => {
      expect(createOrGetCoursePurchase).toHaveBeenCalledWith(
        'real-historia-bitcoin',
        { receiptEmail: 'buyer@example.com' },
      );
    });
    expect(await screen.findByTestId('course-checkout-modal')).toHaveTextContent(
      /La real historia de Bitcoin/i,
    );
  });

  it('blocks continue when email is invalid', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RealHistoriaBitcoinCheckout />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText(/correo para el recibo/i);
    await user.clear(input);
    await user.type(input, 'no-es-correo');
    await user.click(screen.getByRole('button', { name: /continuar al pago/i }));

    expect(await screen.findByText(/correo electrónico válido/i)).toBeInTheDocument();
    expect(createOrGetCoursePurchase).not.toHaveBeenCalled();
    expect(screen.queryByTestId('course-checkout-modal')).not.toBeInTheDocument();
  });
});
