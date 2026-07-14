import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicTimelineEntrySuggestionForm from '../TopicTimelineEntrySuggestionForm';

vi.mock('../../../content/ContentSuggestionPicker', () => ({
  default: () => <div data-testid="content-suggestion-picker" />,
  getProfileContentId: (profile) => profile?.content?.id,
}));

const baseProps = {
  saving: false,
  error: null,
  onCancel: vi.fn(),
  onSubmit: vi.fn(),
};

describe('TopicTimelineEntrySuggestionForm', () => {
  it('shows a title validation error and disables submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TopicTimelineEntrySuggestionForm {...baseProps} onSubmit={onSubmit} />);

    const titleField = screen.getByLabelText(/titulo de la entrada/i);
    await user.type(titleField, 'a');
    await user.clear(titleField);

    expect(await screen.findByText(/el título es requerido/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar sugerencia/i })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the expected payload on valid submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue();
    render(<TopicTimelineEntrySuggestionForm {...baseProps} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/titulo de la entrada/i), 'Bull run de 2017');
    await user.click(screen.getByRole('button', { name: /enviar sugerencia/i }));

    await screen.findByRole('button', { name: /enviar sugerencia/i });
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Bull run de 2017',
      description: '',
      start_date: null,
      end_date: null,
      message: '',
      contents: [],
    });
  });

  it('shows the Spanish error passed in from the parent', () => {
    render(
      <TopicTimelineEntrySuggestionForm
        {...baseProps}
        error="No se pudo enviar la sugerencia"
      />,
    );

    expect(screen.getByText(/no se pudo enviar la sugerencia/i)).toBeInTheDocument();
  });
});
