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

  it('shows the desktop and mobile banners and links to the event', async () => {
    mockFetchCurrentFeaturedEvent.mockResolvedValue({
      event_id: 2,
      title: 'Curso ligado a la landing',
      desktop_image: 'http://localhost/banner-desktop.jpg',
      mobile_image: 'http://localhost/banner-mobile.jpg',
      path: '/events/2',
      date_start: '2026-11-16T12:00:00Z',
      date_start_has_time: false,
      date_end: '2027-01-11T12:00:00Z',
      date_end_has_time: false,
    });

    renderWithProviders(<FeaturedEventBanner />);

    const link = await screen.findByRole('link', { name: /curso ligado a la landing/i });
    expect(link).toHaveAttribute('href', '/events/2');
    expect(screen.queryByText(/próximo evento/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Curso ligado a la landing')).not.toBeInTheDocument();
    expect(screen.getByText(/16 nov 2026/i)).toBeInTheDocument();
    expect(link.querySelector('img')).toHaveAttribute('src', 'http://localhost/banner-desktop.jpg');
    const mobileSource = link.querySelector('picture source');
    expect(mobileSource).toHaveAttribute('srcset', 'http://localhost/banner-mobile.jpg');
    expect(mobileSource).toHaveAttribute('media', '(max-width: 899.95px)');
  });

  it('renders nothing when a banner image is missing', async () => {
    mockFetchCurrentFeaturedEvent.mockResolvedValue({
      event_id: 2,
      title: 'Sin imagen móvil',
      desktop_image: 'http://localhost/banner-desktop.jpg',
      mobile_image: null,
      path: '/events/2',
    });
    renderWithProviders(<FeaturedEventBanner />);

    await waitFor(() => {
      expect(mockFetchCurrentFeaturedEvent).toHaveBeenCalled();
    });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
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
