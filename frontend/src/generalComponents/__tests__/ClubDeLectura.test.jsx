import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClubDeLectura from '../ClubDeLectura';
import { renderWithProviders } from '../../test/formTestUtils';

const mockSubmitNewsletterSubscription = vi.fn();

vi.mock('../../api/profilesApi', () => ({
  submitNewsletterSubscription: (...args) => mockSubmitNewsletterSubscription(...args),
}));

describe('ClubDeLectura form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation error on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClubDeLectura />);

    await user.click(screen.getByRole('button', { name: /quiero participar/i }));

    expect(await screen.findByText(/el correo electrónico es requerido/i)).toBeInTheDocument();
    expect(mockSubmitNewsletterSubscription).not.toHaveBeenCalled();
  });

  it('submits the trimmed email with the club_de_lectura source and shows success', async () => {
    const user = userEvent.setup();
    mockSubmitNewsletterSubscription.mockResolvedValue({});

    renderWithProviders(<ClubDeLectura />);

    await user.type(screen.getByLabelText(/email/i), 'lector@example.com');
    await user.click(screen.getByRole('button', { name: /quiero participar/i }));

    await waitFor(() => {
      expect(mockSubmitNewsletterSubscription).toHaveBeenCalledWith(
        'lector@example.com',
        'club_de_lectura',
      );
    });
    expect(await screen.findByText(/te avisaremos sobre el club de lectura/i)).toBeInTheDocument();
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockSubmitNewsletterSubscription.mockRejectedValue({
      response: { data: { error: 'No se ha podido registrar tu email.' } },
    });

    renderWithProviders(<ClubDeLectura />);

    await user.type(screen.getByLabelText(/email/i), 'lector@example.com');
    await user.click(screen.getByRole('button', { name: /quiero participar/i }));

    expect(await screen.findByText(/no se ha podido registrar tu email/i)).toBeInTheDocument();
  });
});
