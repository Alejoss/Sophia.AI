import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuggestionModal from '../SuggestionModal';
import { renderWithProviders } from '../../test/formTestUtils';

const mockSubmitSuggestion = vi.fn();

vi.mock('../../api/profilesApi', () => ({
  submitSuggestion: (...args) => mockSubmitSuggestion(...args),
}));

describe('SuggestionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a min-length validation error and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SuggestionModal open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/tu sugerencia/i), 'corta');
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));

    expect(
      await screen.findByText(/la sugerencia debe tener al menos 10 caracteres/i),
    ).toBeInTheDocument();
    expect(mockSubmitSuggestion).not.toHaveBeenCalled();
  });

  it('submits the message and shows a success alert', async () => {
    const user = userEvent.setup();
    mockSubmitSuggestion.mockResolvedValue({});

    renderWithProviders(<SuggestionModal open onClose={vi.fn()} />);

    await user.type(
      screen.getByLabelText(/tu sugerencia/i),
      'Sería genial agregar más contenido en español.',
    );
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));

    await waitFor(() => {
      expect(mockSubmitSuggestion).toHaveBeenCalledWith(
        'Sería genial agregar más contenido en español.',
      );
    });
    expect(await screen.findByText(/tu sugerencia ha sido enviada exitosamente/i)).toBeInTheDocument();
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockSubmitSuggestion.mockRejectedValue({
      response: { data: { error: 'No se pudo enviar en este momento' } },
    });

    renderWithProviders(<SuggestionModal open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/tu sugerencia/i), 'Una sugerencia válida y larga.');
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));

    expect(await screen.findByText(/no se pudo enviar en este momento/i)).toBeInTheDocument();
  });
});
