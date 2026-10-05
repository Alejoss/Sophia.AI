import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Quiz from '../Quiz';
import quizApi from '../../api/quizzesApi';
import { renderWithProviders } from '../../test/formTestUtils';

vi.mock('../../api/quizzesApi', () => ({
  default: {
    getQuiz: vi.fn(),
    submitQuiz: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ quizId: '1' }),
    useNavigate: () => vi.fn(),
  };
});

const quizFixture = {
  id: 1,
  title: 'Quiz de prueba',
  description: 'Desc',
  max_attempts_per_day: 3,
  knowledge_path: 9,
  user_attempts: [],
  questions: [
    {
      id: 10,
      text: '¿Capital de Ecuador?',
      question_type: 'SINGLE',
      options: [
        { id: 1, text: 'Quito' },
        { id: 2, text: 'Guayaquil' },
      ],
    },
  ],
};

describe('Quiz taking form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizApi.getQuiz.mockResolvedValue(quizFixture);
  });

  it('shows a Spanish error when submit fails with an English Axios-like payload', async () => {
    const user = userEvent.setup();
    quizApi.submitQuiz.mockRejectedValue('Request failed with status code 500');

    renderWithProviders(<Quiz />);

    expect(await screen.findByText(/capital de ecuador/i)).toBeInTheDocument();
    await user.click(screen.getByText('Quito'));
    await user.click(screen.getByRole('button', { name: /enviar cuestionario/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no se pudo enviar el cuestionario/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/request failed with status code/i)).not.toBeInTheDocument();
  });
});
