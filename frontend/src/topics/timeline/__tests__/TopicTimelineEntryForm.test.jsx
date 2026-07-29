import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicTimelineEntryForm from '../TopicTimelineEntryForm';

const baseProps = {
  entry: null,
  saving: false,
  onCancel: vi.fn(),
  onSubmit: vi.fn(),
};

describe('TopicTimelineEntryForm', () => {
  it('shows a title validation error and disables submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TopicTimelineEntryForm {...baseProps} onSubmit={onSubmit} />);

    const titleField = screen.getByLabelText(/^título$/i);
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

    await user.type(screen.getByLabelText(/^título$/i), 'Whitepaper de Bitcoin');
    await user.click(screen.getByRole('button', { name: /guardar|crear entrada/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Whitepaper de Bitcoin',
        description: '',
        start_date: null,
        end_date: null,
      });
    });
  });

  it('does not render the topic content selector', () => {
    render(<TopicTimelineEntryForm {...baseProps} />);

    expect(screen.queryByText(/contenidos del tema/i)).not.toBeInTheDocument();
  });

  it('shows a Spanish API error without unmounting the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue({
      response: { data: { error: 'No se pudo guardar la entrada' } },
    });
    render(<TopicTimelineEntryForm {...baseProps} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^título$/i), 'Whitepaper de Bitcoin');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/no se pudo guardar la entrada/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^título$/i)).toBeInTheDocument();
  });
});
