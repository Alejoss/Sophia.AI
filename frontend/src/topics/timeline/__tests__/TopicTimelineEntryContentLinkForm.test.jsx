import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicTimelineEntryContentLinkForm from '../TopicTimelineEntryContentLinkForm';

vi.mock('../../../content/ContentSuggestionPicker', () => ({
  __esModule: true,
  getProfileContentId: (profile) => profile?.content?.id,
  default: ({ title, onSelectionChange, selectedProfiles }) => (
    <div>
      <span>{title}</span>
      <button
        type="button"
        onClick={() => onSelectionChange([
          ...(selectedProfiles || []),
          { id: 99, content: { id: 50 }, title: 'Nuevo video' },
        ])}
      >
        Mock add profile
      </button>
    </div>
  ),
}));

vi.mock('../TopicTimelineContentSelector', () => ({
  __esModule: true,
  default: ({ selectedIds, onSelectionChange }) => (
    <div>
      <span>Contenidos del tema</span>
      <button
        type="button"
        onClick={() => onSelectionChange([...(selectedIds || []), '12'])}
      >
        Mock select topic content
      </button>
    </div>
  ),
}));

const baseProps = {
  entry: null,
  availableContents: [],
  loadingContents: false,
  saving: false,
  error: null,
  onCancel: vi.fn(),
  onSkip: vi.fn(),
  onSubmit: vi.fn(),
};

describe('TopicTimelineEntryContentLinkForm', () => {
  it('submits topic content and new profiles together', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue();
    render(<TopicTimelineEntryContentLinkForm {...baseProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /mock select topic content/i }));
    await user.click(screen.getByRole('button', { name: /mock add profile/i }));
    await user.click(screen.getByRole('button', { name: /guardar contenidos/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      contents: [
        { content_id: 12, order: 1, caption: '' },
        { content_id: 50, order: 2, caption: '' },
      ],
      newProfiles: [
        { id: 99, content: { id: 50 }, title: 'Nuevo video' },
      ],
    });
  });

  it('shows skip when enabled', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(
      <TopicTimelineEntryContentLinkForm
        {...baseProps}
        showSkip
        onSkip={onSkip}
      />,
    );

    await user.click(screen.getByRole('button', { name: /omitir/i }));
    expect(onSkip).toHaveBeenCalled();
  });
});
