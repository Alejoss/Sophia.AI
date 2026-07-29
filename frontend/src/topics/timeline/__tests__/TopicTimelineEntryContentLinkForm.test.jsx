import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicTimelineEntryContentLinkForm from '../TopicTimelineEntryContentLinkForm';

vi.mock('../../../content/LibrarySelectMultiple', () => ({
  __esModule: true,
  default: ({ onSelectionChange, onSave }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          const profiles = [
            { id: 99, content: { id: 50 }, title: 'Nuevo video' },
          ];
          onSelectionChange(profiles);
          onSave(profiles.map((profile) => profile.id), profiles);
        }}
      >
        Mock select library content
      </button>
      <button
        type="button"
        onClick={() => onSave([], [])}
      >
        Mock save library
      </button>
    </div>
  ),
}));

vi.mock('../../../content/UploadContentForm', () => ({
  __esModule: true,
  default: ({ onContentUploaded, onUploadingChange }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          onUploadingChange?.(true);
          onContentUploaded?.({ id: 77, content: 88, title: 'Desde URL' });
        }}
      >
        Mock upload content
      </button>
    </div>
  ),
}));

vi.mock('../TopicTimelineContentSelector', () => ({
  __esModule: true,
  default: ({ selectedIds, onSelectionChange }) => (
    <div>
      <span>Contenidos del tema selector</span>
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
  topicId: '2',
  availableContents: [
    { id: 12, content: { id: 12 }, title: 'Whitepaper' },
  ],
  loadingContents: false,
  saving: false,
  error: null,
  onCancel: vi.fn(),
  onSkip: vi.fn(),
  onSubmit: vi.fn(),
};

describe('TopicTimelineEntryContentLinkForm', () => {
  it('shows a single choice screen initially', () => {
    render(<TopicTimelineEntryContentLinkForm {...baseProps} />);

    expect(screen.getByRole('button', { name: /contenidos del tema/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /elegir de tu biblioteca/i })).toBeInTheDocument();
    expect(screen.queryByText(/contenidos del tema selector/i)).not.toBeInTheDocument();
  });

  it('opens only one form at a time and submits combined selections', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue();
    render(<TopicTimelineEntryContentLinkForm {...baseProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /contenidos del tema/i }));
    expect(screen.getByText(/contenidos del tema selector/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /elegir de tu biblioteca/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /mock select topic content/i }));
    await user.click(screen.getByRole('button', { name: /listo/i }));

    await user.click(screen.getByRole('button', { name: /elegir de tu biblioteca/i }));
    expect(screen.getByRole('button', { name: /mock select library content/i })).toBeInTheDocument();
    expect(screen.queryByText(/contenidos del tema selector/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /mock select library content/i }));
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

  it('resolves content id when upload returns content as a primary key', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue();
    render(<TopicTimelineEntryContentLinkForm {...baseProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /desde url/i }));
    await user.click(screen.getByRole('button', { name: /mock upload content/i }));

    expect(screen.getByRole('button', { name: /guardar contenidos/i })).not.toBeDisabled();
    await user.click(screen.getByRole('button', { name: /guardar contenidos/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      contents: [
        { content_id: 88, order: 1, caption: '' },
      ],
      newProfiles: [
        { id: 77, content: 88, title: 'Desde URL' },
      ],
    });
  });

  it('surfaces API errors from a failed submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue({
      response: { data: { contents: 'Solo se pueden adjuntar contenidos que ya pertenecen al tema.' } },
    });
    render(<TopicTimelineEntryContentLinkForm {...baseProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /contenidos del tema/i }));
    await user.click(screen.getByRole('button', { name: /mock select topic content/i }));
    await user.click(screen.getByRole('button', { name: /listo/i }));
    await user.click(screen.getByRole('button', { name: /guardar contenidos/i }));

    expect(
      await screen.findByText(/solo se pueden adjuntar contenidos que ya pertenecen al tema/i),
    ).toBeInTheDocument();
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
