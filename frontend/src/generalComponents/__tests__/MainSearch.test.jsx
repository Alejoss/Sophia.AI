import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MainSearch from '../MainSearch';
import { renderWithProviders } from '../../test/formTestUtils';

const mockSearch = vi.fn();
const mockGetPublicCollections = vi.fn();

vi.mock('../../api/generalApi', () => ({
  default: {
    search: (...args) => mockSearch(...args),
  },
}));

vi.mock('../../api/contentApi', () => ({
  default: {
    getPublicCollections: (...args) => mockGetPublicCollections(...args),
  },
}));

describe('MainSearch form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicCollections.mockResolvedValue({ results: [] });
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
});
