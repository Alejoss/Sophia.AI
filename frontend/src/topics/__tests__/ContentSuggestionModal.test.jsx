import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentSuggestionModal from '../ContentSuggestionModal';
import { renderWithProviders } from '../../test/formTestUtils';

const mockCreateContentSuggestion = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    createContentSuggestion: (...args) => mockCreateContentSuggestion(...args),
  },
}));

vi.mock('../../content/LibrarySelectMultiple', () => ({
  default: ({ onSelectionChange, onSave }) => (
    <button
      type="button"
      onClick={() => {
        onSelectionChange([{ id: 1, content: { id: 99 } }]);
        onSave();
      }}
    >
      Seleccionar contenido mock
    </button>
  ),
}));

vi.mock('../../content/UploadContentForm', () => ({
  default: ({ onContentUploaded }) => (
    <form
      data-testid="upload-content-form"
      onSubmit={(e) => {
        e.preventDefault();
        onContentUploaded?.({ id: 55, content: { id: 88 }, title: 'Uploaded via URL' });
      }}
    >
      <button type="submit">Guardar Contenido</button>
    </form>
  ),
}));

const goToMessageStep = async (user) => {
  await user.click(await screen.findByRole('button', { name: /elegir de la biblioteca/i }));
  await user.click(await screen.findByRole('button', { name: /seleccionar contenido mock/i }));
  await screen.findByLabelText(/mensaje para moderadores/i);
};

describe('ContentSuggestionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the suggestion with the selected content and message', async () => {
    const user = userEvent.setup();
    mockCreateContentSuggestion.mockResolvedValue({});
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <ContentSuggestionModal open topicId={7} onClose={onClose} onSuccess={onSuccess} />,
    );

    await goToMessageStep(user);
    await user.type(
      screen.getByLabelText(/mensaje para moderadores/i),
      'Muy relevante para el tema',
    );
    await user.click(screen.getByRole('button', { name: /sugerir contenido/i }));

    await waitFor(() => {
      expect(mockCreateContentSuggestion).toHaveBeenCalledWith(
        7,
        99,
        'Muy relevante para el tema',
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockCreateContentSuggestion.mockRejectedValue({
      response: { data: { error: 'No se pudo crear la sugerencia' } },
    });
    const onClose = vi.fn();

    renderWithProviders(
      <ContentSuggestionModal open topicId={7} onClose={onClose} onSuccess={vi.fn()} />,
    );

    await goToMessageStep(user);
    await user.click(screen.getByRole('button', { name: /sugerir contenido/i }));

    expect(
      await screen.findByText(/no se pudo crear la sugerencia/i),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not nest UploadContentForm inside another form (upload can save to library)', async () => {
    const user = userEvent.setup();
    mockCreateContentSuggestion.mockResolvedValue({});
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <ContentSuggestionModal open topicId={7} onClose={onClose} onSuccess={onSuccess} />,
    );

    await user.click(await screen.findByRole('button', { name: /desde url/i }));
    const uploadForm = await screen.findByTestId('upload-content-form');
    expect(uploadForm.tagName).toBe('FORM');
    // Nested forms are invalid HTML; upload form must be the only ancestor form.
    expect(uploadForm.parentElement?.closest('form')).toBeNull();
    expect(document.querySelectorAll('[data-testid="upload-content-form"]').length).toBe(1);

    await user.click(screen.getByRole('button', { name: /guardar contenido/i }));
    await screen.findByLabelText(/mensaje para moderadores/i);
    await user.click(screen.getByRole('button', { name: /sugerir contenido/i }));

    await waitFor(() => {
      expect(mockCreateContentSuggestion).toHaveBeenCalledWith(7, 88, '');
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
