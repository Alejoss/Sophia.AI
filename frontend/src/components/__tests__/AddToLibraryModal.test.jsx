import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddToLibraryModal from '../AddToLibraryModal';
import { renderWithProviders } from '../../test/formTestUtils';

const mockCreateContentProfile = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    createContentProfile: (...args) => mockCreateContentProfile(...args),
  },
}));

const content = {
  id: 10,
  title: 'Un gran artículo',
  author: 'Autor Original',
};

describe('AddToLibraryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation error when the title is cleared and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddToLibraryModal content={content} />);

    await user.click(screen.getByRole('button', { name: /agregar a mi biblioteca/i }));
    const dialog = await screen.findByRole('dialog');
    const titleField = within(dialog).getByLabelText(/título/i);
    await user.clear(titleField);
    await user.click(within(dialog).getByRole('button', { name: /agregar a mi biblioteca/i }));

    expect(await screen.findByText(/el título es requerido/i)).toBeInTheDocument();
    expect(mockCreateContentProfile).not.toHaveBeenCalled();
  });

  it('submits the expected payload using the prefilled title/author', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockCreateContentProfile.mockResolvedValue({ id: 1 });

    renderWithProviders(<AddToLibraryModal content={content} onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: /agregar a mi biblioteca/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/nota personal/i), 'Muy interesante');
    await user.click(within(dialog).getByRole('button', { name: /agregar a mi biblioteca/i }));

    await waitFor(() => {
      expect(mockCreateContentProfile).toHaveBeenCalledWith(10, {
        title: 'Un gran artículo',
        author: 'Autor Original',
        personalNote: 'Muy interesante',
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockCreateContentProfile.mockRejectedValue({
      response: { data: { error: 'Ya tienes este contenido en tu biblioteca' } },
    });

    renderWithProviders(<AddToLibraryModal content={content} />);

    await user.click(screen.getByRole('button', { name: /agregar a mi biblioteca/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /agregar a mi biblioteca/i }));

    expect(
      await screen.findByText(/ya tienes este contenido en tu biblioteca/i),
    ).toBeInTheDocument();
  });
});
