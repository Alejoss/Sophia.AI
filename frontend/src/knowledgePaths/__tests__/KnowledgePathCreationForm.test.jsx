import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KnowledgePathCreationForm from '../KnowledgePathCreationForm';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockCreateKnowledgePath = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/knowledgePathsApi', () => ({
  default: {
    createKnowledgePath: (...args) => mockCreateKnowledgePath(...args),
  },
}));

describe('KnowledgePathCreationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation errors on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<KnowledgePathCreationForm />);

    await user.click(screen.getByRole('button', { name: /crear camino de conocimiento/i }));

    expect(await screen.findByText(/el título es requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/la descripción es requerida/i)).toBeInTheDocument();
    expect(mockCreateKnowledgePath).not.toHaveBeenCalled();
  });

  it('submits expected payload and navigates on success', async () => {
    const user = userEvent.setup();
    mockCreateKnowledgePath.mockResolvedValue({ id: 22 });

    renderWithProviders(<KnowledgePathCreationForm />);

    await user.type(screen.getByLabelText(/título/i), 'Introducción a Bitcoin');
    await user.type(screen.getByLabelText(/descripción/i), 'Un recorrido paso a paso.');
    await user.click(screen.getByRole('button', { name: /crear camino de conocimiento/i }));

    await waitFor(() => {
      expect(mockCreateKnowledgePath).toHaveBeenCalledWith({
        title: 'Introducción a Bitcoin',
        description: 'Un recorrido paso a paso.',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/knowledge_path/22/edit');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockCreateKnowledgePath.mockRejectedValue({
      response: { data: { error: 'No se pudo crear el camino de conocimiento' } },
    });

    renderWithProviders(<KnowledgePathCreationForm />);

    await user.type(screen.getByLabelText(/título/i), 'Introducción a Bitcoin');
    await user.type(screen.getByLabelText(/descripción/i), 'Un recorrido paso a paso.');
    await user.click(screen.getByRole('button', { name: /crear camino de conocimiento/i }));

    expect(
      await screen.findByText(/no se pudo crear el camino de conocimiento/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
