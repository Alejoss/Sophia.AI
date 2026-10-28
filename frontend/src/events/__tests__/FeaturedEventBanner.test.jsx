import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import FeaturedEventBanner from '../FeaturedEventBanner';
import { renderWithProviders } from '../../test/formTestUtils';

const mockFetchCurrentFeaturedEvent = vi.fn();

vi.mock('../../api/eventsApi', () => ({
  fetchCurrentFeaturedEvent: (...args) => mockFetchCurrentFeaturedEvent(...args),
}));

describe('FeaturedEventBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the wide banner and links to the event', async () => {
    mockFetchCurrentFeaturedEvent.mockResolvedValue({
      event_id: 2,
      title: 'Curso ligado a la landing',
      image: 'http://localhost/banner.jpg',
      path: '/events/2',
      date_start: '2026-11-16T12:00:00Z',
      date_start_has_time: false,
      date_end: '2027-01-11T12:00:00Z',
      date_end_has_time: false,
    });

    renderWithProviders(<FeaturedEventBanner />);

    const link = await screen.findByRole('link', { name: /curso ligado a la landing/i });
    expect(link).toHaveAttribute('href', '/events/2');
    expect(screen.getByText(/próximo evento/i)).toBeInTheDocument();
    expect(link.querySelector('img')).toHaveAttribute('src', 'http://localhost/banner.jpg');
  });

  it('renders nothing when no event is featured', async () => {
    mockFetchCurrentFeaturedEvent.mockResolvedValue(null);
    renderWithProviders(<FeaturedEventBanner />);

    await waitFor(() => {
      expect(mockFetchCurrentFeaturedEvent).toHaveBeenCalled();
    });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
