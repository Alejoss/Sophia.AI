import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewsletterSubscribe from '../NewsletterSubscribe';
import { renderWithProviders } from '../../test/formTestUtils';

const mockSubmitNewsletterSubscription = vi.fn();

vi.mock('../../api/profilesApi', () => ({
  submitNewsletterSubscription: (...args) => mockSubmitNewsletterSubscription(...args),
}));

describe('NewsletterSubscribe form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation error on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewsletterSubscribe />);

    await user.click(screen.getByRole('button', { name: /quiero suscribirme/i }));

    expect(await screen.findByText(/el correo electrónico es requerido/i)).toBeInTheDocument();
    expect(mockSubmitNewsletterSubscription).not.toHaveBeenCalled();
  });

  it('submits the trimmed email and shows a success message', async () => {
    const user = userEvent.setup();
    mockSubmitNewsletterSubscription.mockResolvedValue({});

    renderWithProviders(<NewsletterSubscribe />);

    await user.type(screen.getByLabelText(/email/i), 'persona@example.com');
    await user.click(screen.getByRole('button', { name: /quiero suscribirme/i }));

    await waitFor(() => {
      expect(mockSubmitNewsletterSubscription).toHaveBeenCalledWith('persona@example.com');
    });
    expect(await screen.findByText(/gracias por suscribirte/i)).toBeInTheDocument();
  });

  it('shows the rate-limit message once when the API returns detail', async () => {
    const user = userEvent.setup();
    mockSubmitNewsletterSubscription.mockRejectedValue({
      response: { data: { detail: 'Demasiados intentos. Inténtalo de nuevo más tarde.' } },
    });

    renderWithProviders(<NewsletterSubscribe />);

    await user.type(screen.getByLabelText(/email/i), 'persona@example.com');
    await user.click(screen.getByRole('button', { name: /quiero suscribirme/i }));

    expect(
      await screen.findByText(/demasiados intentos/i),
    ).toBeInTheDocument();
  });

  it('shows a field error once when detail repeats the email message', async () => {
    const user = userEvent.setup();
    const message = 'Introduce un email válido.';
    mockSubmitNewsletterSubscription.mockRejectedValue({
      response: { data: { detail: message, email: [message] } },
    });

    renderWithProviders(<NewsletterSubscribe />);

    await user.type(screen.getByLabelText(/email/i), 'persona@example.com');
    await user.click(screen.getByRole('button', { name: /quiero suscribirme/i }));

    expect(await screen.findAllByText(message)).toHaveLength(1);
  });
});
