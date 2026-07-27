import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MainSearch from '../MainSearch';
import { renderWithProviders } from '../../test/formTestUtils';

const mockSearch = vi.fn();
const mockGetPublicCollections = vi.fn();
const mockGetFeaturedTextThumbnails = vi.fn();

vi.mock('../../api/generalApi', () => ({
  default: {
    search: (...args) => mockSearch(...args),
  },
}));

vi.mock('../../api/contentApi', () => ({
  default: {
    getPublicCollections: (...args) => mockGetPublicCollections(...args),
    getFeaturedTextThumbnails: (...args) => mockGetFeaturedTextThumbnails(...args),
  },
}));

describe('MainSearch form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicCollections.mockResolvedValue({ results: [] });
    mockGetFeaturedTextThumbnails.mockResolvedValue({ results: [] });
  });

  it('shows validation error on empty submit and does not call the search API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MainSearch />);

    await user.click(screen.getByRole('button', { name: /^buscar$/i }));

    expect(await screen.findByText(/escribe algo para buscar/i)).toBeInTheDocument();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('calls the search API with the query, type and page', async () => {
    const user = userEvent.setup();
    mockSearch.mockResolvedValue({ results: [], current_page: 1, total_pages: 1, count: 0 });

    renderWithProviders(<MainSearch />);

    await user.type(
      screen.getByPlaceholderText(/buscar contenido, temas/i),
      'bitcoin',
    );
    await user.click(screen.getByRole('button', { name: /^buscar$/i }));

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('bitcoin', 'all', 1);
    });
  });

  it('shows a Spanish alert when the search API fails', async () => {
    const user = userEvent.setup();
    mockSearch.mockRejectedValue(new Error('network error'));

    renderWithProviders(<MainSearch />);

    await user.type(
      screen.getByPlaceholderText(/buscar contenido, temas/i),
      'bitcoin',
    );
    await user.click(screen.getByRole('button', { name: /^buscar$/i }));

    expect(
      await screen.findByText(/no se pudo completar la búsqueda/i),
    ).toBeInTheDocument();
  });

  it('shows featured book covers under collections before searching', async () => {
    mockGetFeaturedTextThumbnails.mockResolvedValue({
      results: [
        {
          id: 7,
          content_id: 54,
          title: 'El Secuestro de Bitcoin',
          thumbnail_preview: 'https://cdn.example.com/cover.webp',
          thumbnail: 'https://cdn.example.com/cover.jpg',
          media_type: 'TEXT',
        },
      ],
    });

    renderWithProviders(<MainSearch />);

    expect(
      await screen.findByText(/algunos de los libros disponibles son:/i),
    ).toBeInTheDocument();
    expect(await screen.findByText(/el secuestro de bitcoin/i)).toBeInTheDocument();
    expect(mockGetFeaturedTextThumbnails).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
    });
  });

  it('paginates featured books with next page control', async () => {
    const user = userEvent.setup();
    mockGetFeaturedTextThumbnails
      .mockResolvedValueOnce({
        results: [
          {
            id: 7,
            content_id: 54,
            title: 'El Secuestro de Bitcoin',
            thumbnail_preview: 'https://cdn.example.com/cover.webp',
            thumbnail: 'https://cdn.example.com/cover.jpg',
            media_type: 'TEXT',
          },
        ],
        current_page: 1,
        total_pages: 2,
        count: 25,
      })
      .mockResolvedValueOnce({
        results: [
          {
            id: 8,
            content_id: 55,
            title: 'Segundo Libro Destacado',
            thumbnail_preview: 'https://cdn.example.com/cover2.webp',
            thumbnail: 'https://cdn.example.com/cover2.jpg',
            media_type: 'TEXT',
          },
        ],
        current_page: 2,
        total_pages: 2,
        count: 25,
      });

    renderWithProviders(<MainSearch />);

    expect(await screen.findByText(/el secuestro de bitcoin/i)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /siguientes 20/i }));
    expect(await screen.findByText(/segundo libro destacado/i)).toBeInTheDocument();
    expect(mockGetFeaturedTextThumbnails).toHaveBeenLastCalledWith({
      page: 2,
      page_size: 20,
    });
  });
});
