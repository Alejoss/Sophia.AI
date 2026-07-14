import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicModerators from '../TopicModerators';

const mockGetTopicDetails = vi.fn();
const mockGetTopicModeratorInvitations = vi.fn();
const mockInviteTopicModerator = vi.fn();
const mockRemoveTopicModerators = vi.fn();
const mockSearchUsersByUsername = vi.fn();

vi.mock('../../api/contentApi', () => ({
  default: {
    getTopicDetails: (...args) => mockGetTopicDetails(...args),
    getTopicModeratorInvitations: (...args) => mockGetTopicModeratorInvitations(...args),
    inviteTopicModerator: (...args) => mockInviteTopicModerator(...args),
    removeTopicModerators: (...args) => mockRemoveTopicModerators(...args),
    searchUsersByUsername: (...args) => mockSearchUsersByUsername(...args),
  },
}));

describe('TopicModerators invite form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTopicDetails.mockResolvedValue({ moderators: [] });
    mockGetTopicModeratorInvitations.mockResolvedValue([]);
    mockSearchUsersByUsername.mockResolvedValue([]);
  });

  it('shows a validation error on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    render(<TopicModerators topicId={3} />);

    await user.click(await screen.findByRole('button', { name: /invitar moderador/i }));

    expect(
      await screen.findByText(/por favor ingrese un nombre de usuario/i),
    ).toBeInTheDocument();
    expect(mockInviteTopicModerator).not.toHaveBeenCalled();
  });

  it('invites the moderator and refreshes the data', async () => {
    const user = userEvent.setup();
    mockInviteTopicModerator.mockResolvedValue({});
    render(<TopicModerators topicId={3} />);

    await user.type(await screen.findByLabelText(/nombre de usuario/i), 'carlos');
    await user.type(screen.getByLabelText(/mensaje \(opcional\)/i), 'Bienvenido');
    await user.click(screen.getByRole('button', { name: /invitar moderador/i }));

    await waitFor(() => {
      expect(mockInviteTopicModerator).toHaveBeenCalledWith(3, 'carlos', 'Bienvenido');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockInviteTopicModerator.mockRejectedValue({
      response: { data: { error: 'No se pudo enviar la invitación' } },
    });
    render(<TopicModerators topicId={3} />);

    await user.type(await screen.findByLabelText(/nombre de usuario/i), 'carlos');
    await user.click(screen.getByRole('button', { name: /invitar moderador/i }));

    expect(
      await screen.findByText(/no se pudo enviar la invitación/i),
    ).toBeInTheDocument();
  });
});
