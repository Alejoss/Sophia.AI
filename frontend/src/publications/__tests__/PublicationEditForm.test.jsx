import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicationEditForm from '../PublicationEditForm';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockGetPublicationDetails = vi.fn();
const mockUpdatePublication = vi.fn();
const mockDeletePublication = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ publicationId: '5' }),
  };
});

vi.mock('../../api/contentApi', () => ({
  default: {
    getPublicationDetails: (...args) => mockGetPublicationDetails(...args),
    updatePublication: (...args) => mockUpdatePublication(...args),
    deletePublication: (...args) => mockDeletePublication(...args),
  },
}));

vi.mock('../../content/ContentSelector', () => ({
  default: () => <div data-testid="content-selector">ContentSelector</div>,
}));

describe('PublicationEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicationDetails.mockResolvedValue({
      text_content: 'Texto original',
      content: null,
    });
  });

  it('shows a validation error when the text is cleared and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublicationEditForm />);

    const field = await screen.findByDisplayValue('Texto original');
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: /actualizar publicación/i }));

    expect(await screen.findByText(/el contenido de texto es requerido/i)).toBeInTheDocument();
    expect(mockUpdatePublication).not.toHaveBeenCalled();
  });

  it('submits the expected payload and navigates on success', async () => {
    const user = userEvent.setup();
    mockUpdatePublication.mockResolvedValue({ id: 5 });

    renderWithProviders(<PublicationEditForm />);

    const field = await screen.findByDisplayValue('Texto original');
    await user.clear(field);
    await user.type(field, 'Texto actualizado');
    await user.click(screen.getByRole('button', { name: /actualizar publicación/i }));

    await waitFor(() => {
      expect(mockUpdatePublication).toHaveBeenCalledWith('5', {
        text_content: 'Texto actualizado',
        status: 'PUBLISHED',
        content_profile_id: null,
      });
      expect(mockNavigate).toHaveBeenCalledWith('/profiles/my_profile');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockUpdatePublication.mockRejectedValue({
      response: { data: { error: 'No se pudo actualizar la publicación' } },
    });

    renderWithProviders(<PublicationEditForm />);

    await screen.findByDisplayValue('Texto original');
    await user.click(screen.getByRole('button', { name: /actualizar publicación/i }));

    expect(
      await screen.findByText(/no se pudo actualizar la publicación/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
