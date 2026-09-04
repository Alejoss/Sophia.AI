import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UploadContentForm from '../UploadContentForm';
import contentApi from '../../api/contentApi';
import { renderWithProviders } from '../../test/formTestUtils';

vi.mock('../../api/contentApi', () => ({
  default: {
    uploadContent: vi.fn(),
    uploadContentViaS3: vi.fn(),
    createContentProfile: vi.fn(),
    fetchUrlMetadata: vi.fn(),
  },
}));

vi.mock('../../api/axiosConfig', () => ({
  default: {
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

describe('UploadContentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call the upload API when file mode has no file', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadContentForm initialUrlMode={false} showModeToggle={false} />);

    await user.click(screen.getByRole('button', { name: /guardar contenido/i }));

    await waitFor(() => {
      expect(contentApi.uploadContent).not.toHaveBeenCalled();
    });
  });

  it('shows Spanish validation when submitting URL mode without URL', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadContentForm initialUrlMode showModeToggle={false} />);

    await user.click(screen.getByRole('button', { name: /guardar contenido/i }));

    expect(await screen.findByText(/la url es requerida/i)).toBeInTheDocument();
    expect(contentApi.uploadContent).not.toHaveBeenCalled();
  });

  it('uploads in URL mode after filling required fields', async () => {
    const user = userEvent.setup();
    const onContentUploaded = vi.fn();
    contentApi.fetchUrlMetadata.mockResolvedValue({
      title: 'Artículo',
      siteName: 'Example',
      type: 'article',
    });
    contentApi.uploadContent.mockResolvedValue({
      id: 55,
      title: 'Artículo',
      selected_profile: { id: 9 },
    });

    renderWithProviders(
      <UploadContentForm
        initialUrlMode
        showModeToggle={false}
        onContentUploaded={onContentUploaded}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: /^url$/i }), 'https://example.com/article');

    await user.click(screen.getByLabelText(/tipo de contenido/i));
    await user.click(await screen.findByRole('option', { name: /texto/i }));

    await user.click(screen.getByRole('button', { name: /guardar contenido/i }));

    await waitFor(() => {
      expect(contentApi.uploadContent).toHaveBeenCalled();
    });
  });

  it('accepts EPUB files as TEXT and uploads via S3', async () => {
    const user = userEvent.setup();
    const onContentUploaded = vi.fn();
    contentApi.uploadContentViaS3.mockResolvedValue({
      content_id: 42,
      content_profile: { id: 7, title: 'Libro Prueba' },
    });

    renderWithProviders(
      <UploadContentForm
        initialUrlMode={false}
        showModeToggle={false}
        onContentUploaded={onContentUploaded}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]');
    const epub = new File(['epub-bytes'], 'Libro_Prueba.epub', {
      type: 'application/epub+zip',
    });
    await user.upload(fileInput, epub);

    await user.click(screen.getByRole('button', { name: /guardar contenido/i }));

    await waitFor(() => {
      expect(contentApi.uploadContentViaS3).toHaveBeenCalled();
    });

    const [uploadedFile, payload] = contentApi.uploadContentViaS3.mock.calls[0];
    expect(uploadedFile.name).toBe('Libro_Prueba.epub');
    expect(payload.media_type).toBe('TEXT');
    expect(screen.queryByText(/tipo de archivo no soportado/i)).not.toBeInTheDocument();
  });

  it('rejects unsupported archives instead of treating them as TEXT', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <UploadContentForm initialUrlMode={false} showModeToggle={false} />,
    );

    const fileInput = document.querySelector('input[type="file"]');
    const zip = new File(['zip'], 'archive.zip', { type: 'application/zip' });
    await user.upload(fileInput, zip);
    await user.click(screen.getByRole('button', { name: /guardar contenido/i }));

    expect(await screen.findByText(/tipo de archivo no soportado/i)).toBeInTheDocument();
    expect(contentApi.uploadContentViaS3).not.toHaveBeenCalled();
  });

  it('keeps media type after filling other fields in URL mode', async () => {
    const user = userEvent.setup();
    contentApi.fetchUrlMetadata.mockResolvedValue({
      title: '',
      siteName: 'Example',
      type: 'article',
    });

    renderWithProviders(
      <UploadContentForm initialUrlMode showModeToggle={false} />,
    );

    await user.type(screen.getByRole('textbox', { name: /^url$/i }), 'https://example.com/article');
    await user.click(screen.getByLabelText(/tipo de contenido/i));
    await user.click(await screen.findByRole('option', { name: /texto/i }));

    await user.type(screen.getByRole('textbox', { name: /^autor$/i }), 'Satoshi');
    await user.type(screen.getByRole('textbox', { name: /^título$/i }), 'Artículo');

    expect(screen.getByLabelText(/tipo de contenido/i)).toHaveTextContent(/texto/i);
  });
});
