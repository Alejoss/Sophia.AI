import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicationCreationForm from '../PublicationCreationForm';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockCreatePublication = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/contentApi', () => ({
  default: {
    createPublication: (...args) => mockCreatePublication(...args),
  },
}));

vi.mock('../../content/ContentSelector', () => ({
  default: () => <div data-testid="content-selector">ContentSelector</div>,
}));

describe('PublicationCreationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a validation error on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublicationCreationForm />);

    await user.click(screen.getByRole('button', { name: /crear publicación/i }));

    expect(await screen.findByText(/el contenido de texto es requerido/i)).toBeInTheDocument();
    expect(mockCreatePublication).not.toHaveBeenCalled();
  });

  it('submits the expected payload and navigates on success', async () => {
    const user = userEvent.setup();
    mockCreatePublication.mockResolvedValue({ id: 1 });

    renderWithProviders(<PublicationCreationForm />);

    await user.type(screen.getByLabelText(/contenido de texto/i), 'Mi primera publicación');
    await user.click(screen.getByRole('button', { name: /crear publicación/i }));

    await waitFor(() => {
      expect(mockCreatePublication).toHaveBeenCalledWith({
        text_content: 'Mi primera publicación',
        status: 'PUBLISHED',
        content_profile_id: null,
      });
      expect(mockNavigate).toHaveBeenCalledWith('/profiles/my_profile');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockCreatePublication.mockRejectedValue({
      response: { data: { error: 'No se pudo crear la publicación' } },
    });

    renderWithProviders(<PublicationCreationForm />);

    await user.type(screen.getByLabelText(/contenido de texto/i), 'Otra publicación');
    await user.click(screen.getByRole('button', { name: /crear publicación/i }));

    expect(await screen.findByText(/no se pudo crear la publicación/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
