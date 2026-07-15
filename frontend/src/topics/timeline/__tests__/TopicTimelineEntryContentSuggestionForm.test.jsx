import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  getProfileContentId: (profile) => profile?.content?.id,
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
  error: null,
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

    await screen.findByRole('button', { name: /enviar sugerencia/i });
    expect(onSubmit).toHaveBeenCalledWith({
      content_id: 55,
      message: 'Encaja bien con esta entrada',
    });
  });

  it('shows the Spanish error passed in from the parent', () => {
    render(
      <TopicTimelineEntryContentSuggestionForm
        {...baseProps}
        error="No se pudo enviar la sugerencia"
      />,
    );

    expect(screen.getByText(/no se pudo enviar la sugerencia/i)).toBeInTheDocument();
  });
});
