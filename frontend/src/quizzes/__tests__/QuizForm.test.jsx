import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizForm from '../QuizForm';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockGetKnowledgePath = vi.fn();
const mockCreateQuiz = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ pathId: '3' }),
  };
});

vi.mock('../../api/knowledgePathsApi', () => ({
  default: {
    getKnowledgePath: (...args) => mockGetKnowledgePath(...args),
  },
}));

vi.mock('../../api/quizzesApi', () => ({
  default: {
    getQuiz: vi.fn(),
    createQuiz: (...args) => mockCreateQuiz(...args),
    updateQuiz: vi.fn(),
    deleteQuiz: vi.fn(),
  },
}));

describe('QuizForm (create mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKnowledgePath.mockResolvedValue({
      nodes: [{ id: 10, title: 'Nodo introductorio' }],
    });
  });

  it('shows validation errors on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuizForm />);

    await user.click(await screen.findByRole('button', { name: /crear cuestionario/i }));

    expect(await screen.findByText(/el título es requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/debes seleccionar un nodo precedente/i)).toBeInTheDocument();
    expect(mockCreateQuiz).not.toHaveBeenCalled();
  });

  it('creates the quiz with the expected payload and navigates on success', async () => {
    const user = userEvent.setup();
    mockCreateQuiz.mockResolvedValue({ id: 1 });
    renderWithProviders(<QuizForm />);

    await user.click(await screen.findByLabelText(/seleccionar nodo precedente/i));
    await user.click(await screen.findByRole('option', { name: /nodo introductorio/i }));
    await user.type(screen.getByLabelText(/título del cuestionario/i), 'Cuestionario de introducción');
    await user.click(screen.getByRole('button', { name: /crear cuestionario/i }));

    await waitFor(() => {
      expect(mockCreateQuiz).toHaveBeenCalledWith('3', {
        title: 'Cuestionario de introducción',
        description: '',
        precedingNodeId: '10',
        max_attempts_per_day: 2,
        questions: [],
      });
      expect(mockNavigate).toHaveBeenCalledWith('/knowledge_path/3/edit');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockCreateQuiz.mockRejectedValue({
      response: { data: { error: 'No se pudo crear el cuestionario' } },
    });
    renderWithProviders(<QuizForm />);

    await user.click(await screen.findByLabelText(/seleccionar nodo precedente/i));
    await user.click(await screen.findByRole('option', { name: /nodo introductorio/i }));
    await user.type(screen.getByLabelText(/título del cuestionario/i), 'Cuestionario de introducción');
    await user.click(screen.getByRole('button', { name: /crear cuestionario/i }));

    expect(
      await screen.findByText(/no se pudo crear el cuestionario/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
