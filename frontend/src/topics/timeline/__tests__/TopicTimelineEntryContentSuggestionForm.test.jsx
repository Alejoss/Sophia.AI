import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicTimelineEntryContentSuggestionForm from '../TopicTimelineEntryContentSuggestionForm';

vi.mock('../../../content/ContentSuggestionPicker', () => ({
  default: ({ onSelectionChange }) => (
    <button
      type="button"
      onClick={() => onSelectionChange([{ id: 1, content: { id: 55 } }])}
    >
      Seleccionar contenido mock
    </button>
  ),
  getProfileContentId: (profile) => {
    const content = profile?.content;
    if (content == null) return null;
    if (typeof content === 'object') return content.id ?? null;
    return content;
  },
}));

const entry = {
  title: 'Lanzamiento de Ethereum',
  description: '',
  start_date: '2015-07-30',
  end_date: null,
};

const baseProps = {
  entry,
  saving: false,
  onCancel: vi.fn(),
  onSubmit: vi.fn(),
};

describe('TopicTimelineEntryContentSuggestionForm', () => {
  it('shows a validation error when no content is selected and does not submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TopicTimelineEntryContentSuggestionForm {...baseProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /enviar sugerencia/i }));

    expect(
      await screen.findByText(/selecciona un contenido para vincular a esta entrada/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the selected content and message', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue();
    render(<TopicTimelineEntryContentSuggestionForm {...baseProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /seleccionar contenido mock/i }));
    await user.type(
      screen.getByLabelText(/mensaje para moderadores/i),
      'Encaja bien con esta entrada',
    );
    await user.click(screen.getByRole('button', { name: /enviar sugerencia/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        content_id: 55,
        message: 'Encaja bien con esta entrada',
      });
    });
  });

  it('shows a Spanish API error without unmounting the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue({
      response: { data: { error: 'No se pudo enviar la sugerencia' } },
    });
    render(<TopicTimelineEntryContentSuggestionForm {...baseProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /seleccionar contenido mock/i }));
    await user.click(screen.getByRole('button', { name: /enviar sugerencia/i }));

    expect(await screen.findByText(/no se pudo enviar la sugerencia/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar sugerencia/i })).toBeInTheDocument();
  });
});
