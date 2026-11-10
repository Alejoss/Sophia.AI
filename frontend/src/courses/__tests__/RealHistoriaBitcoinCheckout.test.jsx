import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RealHistoriaBitcoinCheckout from '../RealHistoriaBitcoinCheckout.jsx';

const { authSnapshot } = vi.hoisted(() => ({
  authSnapshot: {
    authInitialized: true,
    authState: {
      isAuthenticated: true,
      user: { id: 1, username: 'buyer', email: 'buyer@example.com' },
    },
  },
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => authSnapshot,
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
    authSnapshot.authInitialized = true;
    authSnapshot.authState = {
      isAuthenticated: true,
      user: { id: 1, username: 'buyer', email: 'buyer@example.com' },
    };
    getCourse.mockReset();
    createOrGetCoursePurchase.mockReset();
    getCourse.mockResolvedValue({
      code: 'real-historia-bitcoin',
      title: 'La Real Historia de Bitcoin y la Guerra por las Criptomonedas',
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

    expect(await screen.findByRole('heading', { name: /finalizar compra/i })).toBeInTheDocument();
    expect(await screen.findByLabelText(/correo para el recibo/i)).toHaveValue('buyer@example.com');
    expect(screen.queryByTestId('course-checkout-modal')).not.toBeInTheDocument();
    expect(screen.getByText(/1\.\s*Correo/i)).toBeInTheDocument();
    expect(
      screen.getByText(/La Real Historia de Bitcoin y la Guerra por las Criptomonedas/i),
    ).toBeInTheDocument();

    createOrGetCoursePurchase.mockResolvedValue({
      id: 9,
      title: 'La Real Historia de Bitcoin y la Guerra por las Criptomonedas',
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
      /Guerra por las Criptomonedas/i,
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
    fireEvent.change(input, { target: { value: 'no-es-correo' } });
    expect(input).toHaveValue('no-es-correo');
    await user.click(screen.getByRole('button', { name: /continuar al pago/i }));

    expect(await screen.findByText(/correo electrónico válido/i)).toBeInTheDocument();
    expect(createOrGetCoursePurchase).not.toHaveBeenCalled();
    expect(screen.queryByTestId('course-checkout-modal')).not.toBeInTheDocument();
  });

  it('lets a visitor pay with an email and without an account', async () => {
    authSnapshot.authState = { isAuthenticated: false, user: null };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RealHistoriaBitcoinCheckout />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /finalizar compra/i })).toBeInTheDocument();
    expect(screen.getByText(/no necesitas crear una cuenta/i)).toBeInTheDocument();
    const input = screen.getByLabelText(/correo para el recibo/i);
    expect(input).toHaveValue('');

    await user.type(input, 'visita@example.com');
    createOrGetCoursePurchase.mockResolvedValue({
      id: 11,
      title: 'La Real Historia de Bitcoin y la Guerra por las Criptomonedas',
      price_amount: 35,
      payment_status: 'PENDING',
      is_paid: false,
      receipt_email: 'visita@example.com',
      checkout_token: 'guest-token',
    });
    await user.click(screen.getByRole('button', { name: /continuar al pago/i }));

    await waitFor(() => {
      expect(createOrGetCoursePurchase).toHaveBeenCalledWith(
        'real-historia-bitcoin',
        { receiptEmail: 'visita@example.com' },
      );
    });
    expect(await screen.findByTestId('course-checkout-modal')).toBeInTheDocument();
  });
});
