import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicEdit from '../TopicEdit';
import { renderWithProviders, mockAuthValue } from '../../test/formTestUtils';

const mockGetTopicDetails = vi.fn();
const mockUpdateTopic = vi.fn();
const mockGetTopicContentSuggestions = vi.fn();
const mockGetTopicTimelineEntrySuggestions = vi.fn();
const mockGetTopicTimelineEntryContentSuggestions = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ topicId: '9' }),
  };
});

vi.mock('../../api/contentApi', () => ({
  default: {
    getTopicDetails: (...args) => mockGetTopicDetails(...args),
    updateTopic: (...args) => mockUpdateTopic(...args),
    getTopicContentSuggestions: (...args) => mockGetTopicContentSuggestions(...args),
    getTopicTimelineEntrySuggestions: (...args) => mockGetTopicTimelineEntrySuggestions(...args),
    getTopicTimelineEntryContentSuggestions: (...args) =>
      mockGetTopicTimelineEntryContentSuggestions(...args),
    updateTopicImage: vi.fn(),
    deleteTopic: vi.fn(),
  },
}));

vi.mock('../../components/ImageUploadModal', () => ({
  default: () => <div data-testid="image-upload-modal" />,
}));

vi.mock('../TopicModerators', () => ({
  default: () => <div data-testid="topic-moderators" />,
}));

vi.mock('../TopicContentManager', () => ({
  default: () => <div data-testid="topic-content-manager" />,
}));

vi.mock('../ContentSuggestionsManager', () => ({
  default: () => <div data-testid="content-suggestions-manager" />,
}));

vi.mock('../timeline/TimelineEntrySuggestionsManager', () => ({
  default: () => <div data-testid="timeline-entry-suggestions-manager" />,
}));

vi.mock('../timeline/TimelineEntryContentSuggestionsManager', () => ({
  default: () => <div data-testid="timeline-entry-content-suggestions-manager" />,
}));

vi.mock('../timeline/TopicTimeline', () => ({
  default: () => <div data-testid="topic-timeline" />,
}));

describe('TopicEdit general tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTopicDetails.mockResolvedValue({
      id: 9,
      title: 'Tema original',
      description: 'Descripción original',
      creator: mockAuthValue.user.id,
      moderators: [],
    });
    mockGetTopicContentSuggestions.mockResolvedValue([]);
    mockGetTopicTimelineEntrySuggestions.mockResolvedValue([]);
    mockGetTopicTimelineEntryContentSuggestions.mockResolvedValue([]);
  });

  it('shows a title validation error and does not call the API', async () => {
    const { container } = renderWithProviders(<TopicEdit />, {
      route: '/content/topics/9/edit',
    });

    const titleField = await screen.findByDisplayValue('Tema original');
    fireEvent.change(titleField, { target: { value: '' } });

    const form = container.querySelector('#topic-edit-form');
    fireEvent.submit(form);

    expect(await screen.findByText(/el título es requerido/i)).toBeInTheDocument();
    expect(mockUpdateTopic).not.toHaveBeenCalled();
  });

  it('submits the expected payload and shows a success snackbar', async () => {
    const user = userEvent.setup();
    mockUpdateTopic.mockResolvedValue({
      id: 9,
      title: 'Tema actualizado',
      description: 'Descripción original',
      creator: mockAuthValue.user.id,
      moderators: [],
    });

    renderWithProviders(<TopicEdit />, { route: '/content/topics/9/edit' });

    const titleField = await screen.findByDisplayValue('Tema original');
    await user.clear(titleField);
    await user.type(titleField, 'Tema actualizado');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateTopic).toHaveBeenCalledWith('9', {
        title: 'Tema actualizado',
        description: 'Descripción original',
      });
    });
    expect(await screen.findByText(/cambios guardados/i)).toBeInTheDocument();
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockUpdateTopic.mockRejectedValue({
      response: { data: { error: 'No se pudo actualizar el tema' } },
    });

    renderWithProviders(<TopicEdit />, { route: '/content/topics/9/edit' });

    const titleField = await screen.findByDisplayValue('Tema original');
    await user.clear(titleField);
    await user.type(titleField, 'Otro título');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(/no se pudo actualizar el tema/i)).toBeInTheDocument();
  });
});
