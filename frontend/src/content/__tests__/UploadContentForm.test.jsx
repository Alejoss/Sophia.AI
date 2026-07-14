import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UploadContentForm from '../UploadContentForm';
import contentApi from '../../api/contentApi';
import { renderWithProviders } from '../../test/formTestUtils';

vi.mock('../../api/contentApi', () => ({
  default: {
    uploadContent: vi.fn(),
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
});
