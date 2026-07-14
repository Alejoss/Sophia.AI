import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicTimelineEntryForm from '../TopicTimelineEntryForm';

const baseProps = {
  entry: null,
  availableContents: [],
  loadingContents: false,
  saving: false,
  error: null,
  onCancel: vi.fn(),
  onSubmit: vi.fn(),
};

describe('TopicTimelineEntryForm', () => {
  it('shows a title validation error and disables submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TopicTimelineEntryForm {...baseProps} onSubmit={onSubmit} />);

    const titleField = screen.getByLabelText(/^titulo$/i);
    await user.type(titleField, 'a');
    await user.clear(titleField);

    expect(await screen.findByText(/el título es requerido/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the expected payload on valid submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue();
    render(<TopicTimelineEntryForm {...baseProps} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^titulo$/i), 'Whitepaper de Bitcoin');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await screen.findByRole('button', { name: /guardar/i });
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Whitepaper de Bitcoin',
      description: '',
      start_date: null,
      end_date: null,
      contents: [],
    });
  });

  it('shows the Spanish error passed in from the parent', () => {
    render(
      <TopicTimelineEntryForm
        {...baseProps}
        error="No se pudo guardar la entrada"
      />,
    );

    expect(screen.getByText(/no se pudo guardar la entrada/i)).toBeInTheDocument();
  });
});
