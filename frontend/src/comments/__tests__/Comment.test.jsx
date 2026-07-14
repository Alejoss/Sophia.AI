import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Comment } from '../Comment';
import { AuthContext } from '../../context/AuthContext';
import { mockAuthValue } from '../../test/formTestUtils';

const mockAddCommentReply = vi.fn();
const mockUpdateComment = vi.fn();

vi.mock('../../api/commentsApi', () => ({
  default: {
    addCommentReply: (...args) => mockAddCommentReply(...args),
    updateComment: (...args) => mockUpdateComment(...args),
    deleteComment: vi.fn(),
  },
}));

vi.mock('../../votes/VoteComponent', () => ({
  default: () => <div data-testid="vote-component" />,
}));

const renderComment = (comment, auth = mockAuthValue) =>
  render(
    <AuthContext.Provider value={auth}>
      <Comment comment={comment} depth={0} allComments={[comment]} setAllComments={vi.fn()} />
    </AuthContext.Provider>,
  );

const baseComment = {
  id: 1,
  body: 'Comentario original',
  author: 1,
  author_name: 'testuser',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_edited: false,
  replies: [],
  reply_count: 0,
  is_active: true,
};

describe('Comment reply form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a validation error on empty reply submit and does not call the API', async () => {
    const user = userEvent.setup();
    const comment = { ...baseComment, author: 999 };
    renderComment(comment);

    await user.click(screen.getByRole('button', { name: /responder/i }));
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));

    expect(
      await screen.findByText(/el comentario no puede estar vacío/i),
    ).toBeInTheDocument();
    expect(mockAddCommentReply).not.toHaveBeenCalled();
  });

  it('submits the reply', async () => {
    const user = userEvent.setup();
    mockAddCommentReply.mockResolvedValue({ id: 2, body: 'Gracias!', replies: [] });
    const comment = { ...baseComment, author: 999 };
    renderComment(comment);

    await user.click(screen.getByRole('button', { name: /responder/i }));
    const [replyField] = screen.getAllByRole('textbox');
    await user.type(replyField, 'Gracias por compartir');
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));

    await waitFor(() => {
      expect(mockAddCommentReply).toHaveBeenCalledWith(1, 'Gracias por compartir');
    });
  });

  it('shows a Spanish alert when the reply API call fails', async () => {
    const user = userEvent.setup();
    mockAddCommentReply.mockRejectedValue({
      response: { data: { error: 'No se pudo agregar la respuesta' } },
    });
    const comment = { ...baseComment, author: 999 };
    renderComment(comment);

    await user.click(screen.getByRole('button', { name: /responder/i }));
    const [replyField] = screen.getAllByRole('textbox');
    await user.type(replyField, 'Gracias');
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));

    expect(
      await screen.findByText(/no se pudo agregar la respuesta/i),
    ).toBeInTheDocument();
  });
});

describe('Comment edit form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const openEditForm = async (user) => {
    const menuButtons = screen.getAllByRole('button', { name: '' });
    await user.click(menuButtons[0]);
    await user.click(await screen.findByRole('menuitem', { name: /editar/i }));
  };

  it('shows a validation error when the body is cleared and does not call the API', async () => {
    const user = userEvent.setup();
    renderComment(baseComment);

    await openEditForm(user);
    const editField = screen.getByDisplayValue('Comentario original');
    await user.clear(editField);
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(
      await screen.findByText(/el comentario no puede estar vacío/i),
    ).toBeInTheDocument();
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it('saves the edited comment', async () => {
    const user = userEvent.setup();
    mockUpdateComment.mockResolvedValue({});
    renderComment(baseComment);

    await openEditForm(user);
    const editField = screen.getByDisplayValue('Comentario original');
    await user.clear(editField);
    await user.type(editField, 'Comentario editado');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockUpdateComment).toHaveBeenCalledWith(1, 'Comentario editado');
    });
  });

  it('shows a Spanish alert when the edit API call fails', async () => {
    const user = userEvent.setup();
    mockUpdateComment.mockRejectedValue({
      response: { data: { error: 'No se pudo editar el comentario' } },
    });
    renderComment(baseComment);

    await openEditForm(user);
    const editField = screen.getByDisplayValue('Comentario original');
    await user.clear(editField);
    await user.type(editField, 'Otro comentario');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(
      await screen.findByText(/no se pudo editar el comentario/i),
    ).toBeInTheDocument();
  });
});
