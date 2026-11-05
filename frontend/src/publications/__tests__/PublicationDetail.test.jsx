import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import PublicationDetail from '../PublicationDetail';
import { renderWithProviders, unauthenticatedAuth } from '../../test/formTestUtils';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ publicationId: '4' }),
  };
});

vi.mock('../../api/contentApi', () => ({
  default: {
    getPublicationDetails: vi.fn(),
  },
}));

vi.mock('../../api/profilesApi', () => ({
  getProfileById: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../content/ContentDisplay', () => ({
  default: () => <div data-testid="content-display" />,
}));

vi.mock('../../bookmarks/BookmarkButton', () => ({
  default: () => <button type="button">Guardar</button>,
}));

vi.mock('../../votes/VoteComponent', () => ({
  default: () => <div data-testid="vote" />,
}));

vi.mock('../../profiles/ProfileHeader', () => ({
  default: () => null,
}));

vi.mock('../../components/AddToLibraryModal', () => ({
  default: () => null,
}));

import contentApi from '../../api/contentApi';

describe('PublicationDetail edit access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the edit action to the author', async () => {
    contentApi.getPublicationDetails.mockResolvedValue({
      id: 4,
      user_id: 1,
      text_content: 'Publicación propia',
      published_at: '2026-01-01T00:00:00Z',
      content: null,
    });

    renderWithProviders(<PublicationDetail />);

    expect(await screen.findByRole('button', { name: /editar publicación/i })).toBeInTheDocument();
    expect(screen.getByText('Publicación propia')).toBeInTheDocument();
  });

  it('hides the edit action from other signed-in users', async () => {
    contentApi.getPublicationDetails.mockResolvedValue({
      id: 4,
      user_id: 99,
      text_content: 'Publicación ajena',
      published_at: '2026-01-01T00:00:00Z',
      content: null,
    });

    renderWithProviders(<PublicationDetail />);

    expect(await screen.findByText('Publicación ajena')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar publicación/i })).not.toBeInTheDocument();
  });

  it('hides the edit action from anonymous visitors', async () => {
    contentApi.getPublicationDetails.mockResolvedValue({
      id: 4,
      user_id: 1,
      text_content: 'Publicación pública',
      published_at: '2026-01-01T00:00:00Z',
      content: null,
    });

    renderWithProviders(<PublicationDetail />, { auth: unauthenticatedAuth() });

    expect(await screen.findByText('Publicación pública')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar publicación/i })).not.toBeInTheDocument();
  });
});
