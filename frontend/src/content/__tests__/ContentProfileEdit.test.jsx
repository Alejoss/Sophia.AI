import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ContentProfileEdit from '../ContentProfileEdit';
import contentApi from '../../api/contentApi';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/contentApi', () => ({
  default: {
    getContentDetails: vi.fn(),
    checkContentModification: vi.fn(),
    updateContent: vi.fn(),
    updateContentProfile: vi.fn(),
    deleteContent: vi.fn(),
  },
}));

const baseContent = {
  id: 42,
  media_type: 'TEXT',
  created_at: '2026-05-14T12:00:00Z',
  url: 'https://example.com/article',
  is_original_uploader: true,
  has_file_available: true,
  original_title: 'Título',
  original_author: 'Autor',
  selected_profile: {
    id: 7,
    title: 'Título',
    author: 'Autor',
    personal_note: '',
    is_visible: true,
    is_producer: false,
  },
};

const renderEditPage = () =>
  render(
    <AuthContext.Provider value={{ authState: { user: { id: 1 } } }}>
      <MemoryRouter initialEntries={['/content/42/edit']}>
        <Routes>
          <Route path="/content/:contentId/edit" element={<ContentProfileEdit />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe('ContentProfileEdit URL actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentApi.getContentDetails.mockResolvedValue(baseContent);
    contentApi.checkContentModification.mockResolvedValue({
      can_modify: true,
      message: 'El contenido puede ser modificado',
    });
  });

  it('shows Borrar URL when content has an attached file', async () => {
    contentApi.getContentDetails.mockResolvedValue({
      ...baseContent,
      file_details: { file: '/media/files/doc.pdf', file_size: 1024 },
    });

    renderEditPage();

    expect(await screen.findByRole('button', { name: /borrar url/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cambiar url/i })).not.toBeInTheDocument();
  });

  it('shows Cambiar URL when content has URL but no attached file', async () => {
    contentApi.getContentDetails.mockResolvedValue({
      ...baseContent,
      has_file_available: false,
      file_details: null,
    });

    renderEditPage();

    expect(await screen.findByRole('button', { name: /cambiar url/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /borrar url/i })).not.toBeInTheDocument();
  });

  it('clears URL via content_update when Borrar URL is confirmed', async () => {
    const user = userEvent.setup();
    contentApi.getContentDetails
      .mockResolvedValueOnce({
        ...baseContent,
        file_details: { file: '/media/files/doc.pdf', file_size: 1024 },
      })
      .mockResolvedValueOnce({
        ...baseContent,
        url: null,
        file_details: { file: '/media/files/doc.pdf', file_size: 1024 },
      });
    contentApi.updateContent.mockResolvedValue({ id: 42, url: null });

    renderEditPage();

    await user.click(await screen.findByRole('button', { name: /^borrar url$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^borrar url$/i }));

    await waitFor(() => {
      expect(contentApi.checkContentModification).toHaveBeenCalledWith('42');
      expect(contentApi.updateContent).toHaveBeenCalledWith('42', { url: null });
    });
  });
});

describe('ContentProfileEdit form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentApi.getContentDetails.mockResolvedValue(baseContent);
    contentApi.checkContentModification.mockResolvedValue({
      can_modify: true,
      message: 'El contenido puede ser modificado',
    });
  });

  it('shows a title validation error and does not call the API', async () => {
    const user = userEvent.setup();
    renderEditPage();

    const titleField = await screen.findByLabelText(/^título$/i);
    await user.clear(titleField);
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(/el título es requerido/i)).toBeInTheDocument();
    expect(contentApi.updateContentProfile).not.toHaveBeenCalled();
  });

  it('saves the updated profile fields', async () => {
    const user = userEvent.setup();
    contentApi.updateContentProfile.mockResolvedValue({ id: 7 });
    renderEditPage();

    const titleField = await screen.findByLabelText(/^título$/i);
    await user.clear(titleField);
    await user.type(titleField, 'Nuevo título');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(contentApi.updateContentProfile).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ title: 'Nuevo título' }),
      );
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    contentApi.updateContentProfile.mockRejectedValue({
      response: { data: { error: 'No se pudo actualizar el contenido' } },
    });
    renderEditPage();

    const titleField = await screen.findByLabelText(/^título$/i);
    await user.clear(titleField);
    await user.type(titleField, 'Otro título');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(
      await screen.findByText(/no se pudo actualizar el contenido/i),
    ).toBeInTheDocument();
  });
});
