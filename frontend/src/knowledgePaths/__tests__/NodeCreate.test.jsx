import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NodeCreate from '../NodeCreate';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockGetKnowledgePathBasic = vi.fn();
const mockAddNode = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ pathId: '7' }),
  };
});

vi.mock('../../api/knowledgePathsApi', () => ({
  default: {
    getKnowledgePathBasic: (...args) => mockGetKnowledgePathBasic(...args),
    addNode: (...args) => mockAddNode(...args),
  },
}));

vi.mock('../../content/ContentSelector', () => ({
  default: ({ onContentSelected }) => (
    <button
      type="button"
      onClick={() => onContentSelected({ id: 99, title: 'Video sobre Bitcoin' })}
    >
      Seleccionar contenido mock
    </button>
  ),
}));

describe('NodeCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKnowledgePathBasic.mockResolvedValue({ id: 7, title: 'Camino de prueba' });
  });

  it('shows a title validation error and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NodeCreate />, { route: '/knowledge_path/7/nodes/create' });

    await user.click(await screen.findByRole('button', { name: /seleccionar contenido mock/i }));
    const titleField = await screen.findByLabelText(/título del nodo/i);
    await user.clear(titleField);
    await user.click(screen.getByRole('button', { name: /agregar nodo/i }));

    expect(await screen.findByText(/el título es requerido/i)).toBeInTheDocument();
    expect(mockAddNode).not.toHaveBeenCalled();
  });

  it('submits the expected payload and navigates on success', async () => {
    const user = userEvent.setup();
    mockAddNode.mockResolvedValue({ id: 1 });

    renderWithProviders(<NodeCreate />, { route: '/knowledge_path/7/nodes/create' });

    await user.click(await screen.findByRole('button', { name: /seleccionar contenido mock/i }));
    await user.type(screen.getByLabelText(/descripción/i), 'Explicación introductoria');
    await user.click(screen.getByRole('button', { name: /agregar nodo/i }));

    await waitFor(() => {
      expect(mockAddNode).toHaveBeenCalledWith('7', {
        title: 'Video sobre Bitcoin',
        description: 'Explicación introductoria',
        content_profile_id: 99,
      });
      expect(mockNavigate).toHaveBeenCalledWith('/knowledge_path/7/edit');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockAddNode.mockRejectedValue({
      response: { data: { error: 'No se pudo agregar el nodo' } },
    });

    renderWithProviders(<NodeCreate />, { route: '/knowledge_path/7/nodes/create' });

    await user.click(await screen.findByRole('button', { name: /seleccionar contenido mock/i }));
    await user.click(screen.getByRole('button', { name: /agregar nodo/i }));

    expect(await screen.findByText(/no se pudo agregar el nodo/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
