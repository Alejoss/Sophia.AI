import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimelineEntrySuggestionsManager from '../TimelineEntrySuggestionsManager';

const mockGetTopicTimelineEntrySuggestions = vi.fn();
const mockRejectTopicTimelineEntrySuggestion = vi.fn();

vi.mock('../../../api/contentApi', () => ({
  default: {
    getTopicTimelineEntrySuggestions: (...args) => mockGetTopicTimelineEntrySuggestions(...args),
    acceptTopicTimelineEntrySuggestion: vi.fn(),
    rejectTopicTimelineEntrySuggestion: (...args) => mockRejectTopicTimelineEntrySuggestion(...args),
  },
}));

const suggestion = {
  id: 1,
  title: 'Lanzamiento de Bitcoin',
  description: '',
  start_date: '2009-01-03',
  end_date: null,
  suggested_by: { username: 'ana' },
  contents: [],
  status: 'PENDING',
  message: '',
  is_duplicate: false,
};

describe('TimelineEntrySuggestionsManager reject dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTopicTimelineEntrySuggestions.mockResolvedValue([suggestion]);
  });

  const openRejectDialog = async (user) => {
    await user.click(await screen.findByRole('button', { name: /^rechazar$/i }));
    return screen.findByRole('dialog');
  };

  it('shows a validation error when no reason is provided and does not call the API', async () => {
    const user = userEvent.setup();
    render(<TimelineEntrySuggestionsManager topicId={5} />);

    const dialog = await openRejectDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(
      await screen.findByText(/debe proporcionar una razón para rechazar/i),
    ).toBeInTheDocument();
    expect(mockRejectTopicTimelineEntrySuggestion).not.toHaveBeenCalled();
  });

  it('rejects the suggestion with the provided reason', async () => {
    const user = userEvent.setup();
    mockRejectTopicTimelineEntrySuggestion.mockResolvedValue({});
    render(<TimelineEntrySuggestionsManager topicId={5} />);

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/razon del rechazo/i), 'Fecha incorrecta');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    await waitFor(() => {
      expect(mockRejectTopicTimelineEntrySuggestion).toHaveBeenCalledWith(5, 1, 'Fecha incorrecta');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockRejectTopicTimelineEntrySuggestion.mockRejectedValue({
      response: { data: { error: 'No se pudo rechazar la sugerencia' } },
    });
    render(<TimelineEntrySuggestionsManager topicId={5} />);

    const dialog = await openRejectDialog(user);
    await user.type(within(dialog).getByLabelText(/razon del rechazo/i), 'No aplica');
    await user.click(within(dialog).getByRole('button', { name: /^rechazar$/i }));

    expect(
      await screen.findByText(/no se pudo rechazar la sugerencia/i),
    ).toBeInTheDocument();
  });
});
