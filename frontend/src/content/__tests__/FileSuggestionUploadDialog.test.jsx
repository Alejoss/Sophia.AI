import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileSuggestionUploadDialog from '../FileSuggestionUploadDialog';

const mockUploadFileSuggestionViaS3 = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    uploadFileSuggestionViaS3: (...args) => mockUploadFileSuggestionViaS3(...args),
  },
}));

describe('FileSuggestionUploadDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a validation error when no file is selected and does not call the API', async () => {
    const user = userEvent.setup();
    render(
      <FileSuggestionUploadDialog open contentId="42" onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /sugerir archivo/i }));

    expect(await screen.findByText(/debes seleccionar un archivo/i)).toBeInTheDocument();
    expect(mockUploadFileSuggestionViaS3).not.toHaveBeenCalled();
  });

  it('uploads the selected file with the message and closes the dialog', async () => {
    const user = userEvent.setup();
    mockUploadFileSuggestionViaS3.mockResolvedValue({});
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <FileSuggestionUploadDialog
        open
        contentId="42"
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    const file = new File(['contenido'], 'documento.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByText(/seleccionar archivo/i).querySelector('input');
    await user.upload(fileInput, file);
    await user.type(screen.getByLabelText(/mensaje \(opcional\)/i), 'Aquí está el archivo');
    await user.click(screen.getByRole('button', { name: /sugerir archivo/i }));

    await waitFor(() => {
      expect(mockUploadFileSuggestionViaS3).toHaveBeenCalledWith(
        '42',
        file,
        'Aquí está el archivo',
        expect.any(Function),
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockUploadFileSuggestionViaS3.mockRejectedValue({
      response: { data: { error: 'No se pudo enviar la sugerencia de archivo' } },
    });
    const onClose = vi.fn();
    render(
      <FileSuggestionUploadDialog open contentId="42" onClose={onClose} onSuccess={vi.fn()} />,
    );

    const file = new File(['contenido'], 'documento.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByText(/seleccionar archivo/i).querySelector('input');
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: /sugerir archivo/i }));

    expect(
      await screen.findByText(/no se pudo enviar la sugerencia de archivo/i),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
