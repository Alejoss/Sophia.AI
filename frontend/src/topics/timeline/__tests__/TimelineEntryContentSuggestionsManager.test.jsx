import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimelineEntryContentSuggestionsManager from '../TimelineEntryContentSuggestionsManager';

const mockGetTopicTimelineEntryContentSuggestions = vi.fn();
const mockRejectTopicTimelineEntryContentSuggestion = vi.fn();

vi.mock('../../../api/contentApi', () => ({
  default: {
    getTopicTimelineEntryContentSuggestions: (...args) =>
      mockGetTopicTimelineEntryContentSuggestions(...args),
    acceptTopicTimelineEntryContentSuggestion: vi.fn(),
    rejectTopicTimelineEntryContentSuggestion: (...args) =>
      mockRejectTopicTimelineEntryContentSuggestion(...args),
  },
}));

const suggestion = {
  id: 1,
  entry: { title: 'Lanzamiento de Bitcoin', start_date: '2009-01-03', end_date: null },
  content: { original_title: 'Whitepaper de Bitcoin' },
  suggested_by: { username: 'ana' },
  status: 'PENDING',
  message: '',
  is_duplicate: false,
  is_in_topic: false,
};

describe('TimelineEntryContentSuggestionsManager reject dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTopicTimelineEntryContentSuggestions.mockResolvedValue([suggestion]);
  });

  const openRejectDialog = async (user) => {
    await user.click(await screen.findByRole('button', { name: /^rechazar$/i }));
    return screen.findByRole('dialog');
  };

  it('shows a validation error when no reason is provided and does not call the API', async () => {
    const user = userEvent.setup();
    render(<TimelineEntryContentSuggestionsManager topicId={5} />);

    const dialog = await openRejectDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(
      await screen.findByText(/debe proporcionar una razón para rechazar/i),
    ).toBeInTheDocument();
    expect(mockRejectTopicTimelineEntryContentSuggestion).not.toHaveBeenCalled();
  });

  it('rejects the suggestion with the provided reason', async () => {
    const user = userEvent.setup();
    mockRejectTopicTimelineEntryContentSuggestion.mockResolvedValue({});
    render(<TimelineEntryContentSuggestionsManager topicId={5} />);

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/razon del rechazo/i), 'No es relevante');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    await waitFor(() => {
      expect(mockRejectTopicTimelineEntryContentSuggestion).toHaveBeenCalledWith(
        5,
        1,
        'No es relevante',
      );
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockRejectTopicTimelineEntryContentSuggestion.mockRejectedValue({
      response: { data: { error: 'No se pudo rechazar la sugerencia' } },
    });
    render(<TimelineEntryContentSuggestionsManager topicId={5} />);

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/razon del rechazo/i), 'No aplica');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(
      await screen.findByText(/no se pudo rechazar la sugerencia/i),
    ).toBeInTheDocument();
  });
});
