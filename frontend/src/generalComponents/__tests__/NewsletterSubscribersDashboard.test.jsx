import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewsletterSubscribersDashboard from '../NewsletterSubscribersDashboard';
import { renderWithProviders } from '../../test/formTestUtils';

const mockFetch = vi.fn();
const mockUpdate = vi.fn();
const mockDownload = vi.fn();

vi.mock('../../api/profilesApi', () => ({
  fetchNewsletterSubscribers: (...args) => mockFetch(...args),
  updateNewsletterSubscriber: (...args) => mockUpdate(...args),
  downloadNewsletterSubscribers: (...args) => mockDownload(...args),
}));

const payload = {
  count: 1,
  active_count: 1,
  inactive_count: 0,
  results: [
    {
      id: 7,
      email: 'lector@example.com',
      source: 'frontend_subscribe',
      source_label: 'Página /unirme',
      is_active: true,
      created_at: '2026-11-03T15:00:00Z',
      unsubscribed_at: null,
      unsubscribe_url: 'https://www.academiablockchain.com/api/profiles/newsletter/unsubscribe/token-lector/',
    },
  ],
};

describe('NewsletterSubscribersDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(payload);
    mockUpdate.mockResolvedValue({ ...payload.results[0], is_active: false });
  });

  it('lists email subscribers and their unsubscribe link action', async () => {
    renderWithProviders(<NewsletterSubscribersDashboard />);

    expect(await screen.findByText('lector@example.com')).toBeInTheDocument();
    expect(screen.getByText('Página /unirme')).toBeInTheDocument();
    expect(screen.getByText('1 activos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar enlace de baja/i })).toBeInTheDocument();
    expect(screen.getByText('1–1 de 1')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith({ status: 'active', q: '', page: 1 });
  });

  it('filters to unsubscribed addresses', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation(async ({ status }) => (
      status === 'inactive'
        ? { count: 0, active_count: 1, inactive_count: 1, results: [] }
        : payload
    ));

    renderWithProviders(<NewsletterSubscribersDashboard />);
    await screen.findByText('lector@example.com');
    await user.click(screen.getByRole('button', { name: 'De baja' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith({ status: 'inactive', q: '', page: 1 });
    });
    expect(await screen.findByText(/no hay suscriptores/i)).toBeInTheDocument();
  });

  it('confirms a staff unsubscribe and updates the row', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewsletterSubscribersDashboard />);
    await screen.findByText('lector@example.com');

    await user.click(screen.getByRole('button', { name: 'Dar de baja' }));
    expect(await screen.findByText(/quitar a lector@example.com/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(7, false);
    });
  });
});
