import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentSuggestionsManager from '../ContentSuggestionsManager';

const mockGetTopicContentSuggestions = vi.fn();
const mockRejectContentSuggestion = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    getTopicContentSuggestions: (...args) => mockGetTopicContentSuggestions(...args),
    acceptContentSuggestion: vi.fn(),
    rejectContentSuggestion: (...args) => mockRejectContentSuggestion(...args),
  },
}));

const suggestion = {
  id: 1,
  content: { original_title: 'Video sobre Bitcoin' },
  suggested_by: { username: 'ana' },
  message: '',
  status: 'PENDING',
  created_at: '2024-01-01',
  is_duplicate: false,
};

describe('ContentSuggestionsManager reject dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTopicContentSuggestions.mockResolvedValue([suggestion]);
  });

  const openRejectDialog = async (user) => {
    await user.click(await screen.findByRole('button', { name: /rechazar/i }));
    return screen.findByRole('dialog');
  };

  it('shows a validation error when no reason is provided and does not call the API', async () => {
    const user = userEvent.setup();
    render(<ContentSuggestionsManager topicId={5} />);

    const dialog = await openRejectDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(
      await screen.findByText(/debe proporcionar una razón para rechazar/i),
    ).toBeInTheDocument();
    expect(mockRejectContentSuggestion).not.toHaveBeenCalled();
  });

  it('rejects the suggestion with the provided reason', async () => {
    const user = userEvent.setup();
    mockRejectContentSuggestion.mockResolvedValue({});
    render(<ContentSuggestionsManager topicId={5} />);

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/razón de rechazo/i), 'No aplica al tema');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    await waitFor(() => {
      expect(mockRejectContentSuggestion).toHaveBeenCalledWith(5, 1, 'No aplica al tema');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockRejectContentSuggestion.mockRejectedValue({
      response: { data: { error: 'No se pudo rechazar la sugerencia' } },
    });
    render(<ContentSuggestionsManager topicId={5} />);

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/razón de rechazo/i), 'No aplica');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(
      await screen.findByText(/no se pudo rechazar la sugerencia/i),
    ).toBeInTheDocument();
  });
});
