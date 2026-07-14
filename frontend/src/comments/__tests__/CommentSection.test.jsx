import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommentSection from '../CommentSection';
import { renderWithProviders } from '../../test/formTestUtils';

const mockGetTopicComments = vi.fn();
const mockAddTopicComment = vi.fn();

vi.mock('../../api/commentsApi', () => ({
  default: {
    getKnowledgePathComments: vi.fn(),
    getContentComments: vi.fn(),
    getTopicComments: (...args) => mockGetTopicComments(...args),
    addKnowledgePathComment: vi.fn(),
    addContentComment: vi.fn(),
    addTopicComment: (...args) => mockAddTopicComment(...args),
    deleteComment: vi.fn(),
    updateComment: vi.fn(),
    addCommentReply: vi.fn(),
  },
}));

describe('CommentSection form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTopicComments.mockResolvedValue([]);
  });

  it('shows a validation error on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommentSection topicId={5} />);

    await screen.findByText(/aún no hay comentarios/i);
    await user.click(screen.getByRole('button', { name: /publicar comentario/i }));

    expect(
      await screen.findByText(/escribe un comentario antes de publicar/i),
    ).toBeInTheDocument();
    expect(mockAddTopicComment).not.toHaveBeenCalled();
  });

  it('submits the comment and reloads the list', async () => {
    const user = userEvent.setup();
    mockAddTopicComment.mockResolvedValue({});
    renderWithProviders(<CommentSection topicId={5} />);

    await screen.findByText(/aún no hay comentarios/i);
    await user.type(
      screen.getByPlaceholderText(/escriba un comentario/i),
      'Muy buen tema',
    );
    await user.click(screen.getByRole('button', { name: /publicar comentario/i }));

    await waitFor(() => {
      expect(mockAddTopicComment).toHaveBeenCalledWith(5, 'Muy buen tema');
    });
    await waitFor(() => {
      expect(mockGetTopicComments).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockAddTopicComment.mockRejectedValue({
      response: { data: { error: 'No se pudo agregar el comentario' } },
    });
    renderWithProviders(<CommentSection topicId={5} />);

    await screen.findByText(/aún no hay comentarios/i);
    await user.type(
      screen.getByPlaceholderText(/escriba un comentario/i),
      'Muy buen tema',
    );
    await user.click(screen.getByRole('button', { name: /publicar comentario/i }));

    expect(
      await screen.findByText(/no se pudo agregar el comentario/i),
    ).toBeInTheDocument();
  });
});
