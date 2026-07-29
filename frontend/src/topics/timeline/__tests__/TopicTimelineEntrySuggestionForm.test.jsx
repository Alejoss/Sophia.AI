import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicTimelineEntrySuggestionForm from '../TopicTimelineEntrySuggestionForm';

vi.mock('../../../content/ContentSuggestionPicker', () => ({
  default: () => <div data-testid="content-suggestion-picker" />,
  getProfileContentId: (profile) => {
    const content = profile?.content;
    if (content == null) return null;
    if (typeof content === 'object') return content.id ?? null;
    return content;
  },
}));

const baseProps = {
  saving: false,
  onCancel: vi.fn(),
  onSubmit: vi.fn(),
};

describe('TopicTimelineEntrySuggestionForm', () => {
  it('shows a title validation error and disables submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TopicTimelineEntrySuggestionForm {...baseProps} onSubmit={onSubmit} />);

    const titleField = screen.getByLabelText(/título de la entrada/i);
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

    await user.type(screen.getByLabelText(/título de la entrada/i), 'Bull run de 2017');
    await user.click(screen.getByRole('button', { name: /enviar sugerencia/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Bull run de 2017',
        description: '',
        start_date: null,
        end_date: null,
        message: '',
        contents: [],
      });
    });
  });

  it('shows a Spanish API error without unmounting the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue({
      response: { data: { error: 'No se pudo enviar la sugerencia' } },
    });
    render(<TopicTimelineEntrySuggestionForm {...baseProps} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/título de la entrada/i), 'Bull run de 2017');
    await user.click(screen.getByRole('button', { name: /enviar sugerencia/i }));

    expect(await screen.findByText(/no se pudo enviar la sugerencia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/título de la entrada/i)).toBeInTheDocument();
  });
});
