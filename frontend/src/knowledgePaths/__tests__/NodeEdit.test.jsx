import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NodeEdit from '../NodeEdit';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockGetKnowledgePathBasic = vi.fn();
const mockGetNode = vi.fn();
const mockGetNodeContent = vi.fn();
const mockUpdateNode = vi.fn();
const mockGetQuizzesByPathId = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ pathId: '7', nodeId: '3' }),
  };
});

vi.mock('../../api/knowledgePathsApi', () => ({
  default: {
    getKnowledgePathBasic: (...args) => mockGetKnowledgePathBasic(...args),
    getNode: (...args) => mockGetNode(...args),
    getNodeContent: (...args) => mockGetNodeContent(...args),
    updateNode: (...args) => mockUpdateNode(...args),
  },
}));

vi.mock('../../api/quizzesApi', () => ({
  default: {
    getQuizzesByPathId: (...args) => mockGetQuizzesByPathId(...args),
  },
}));

vi.mock('../../content/ContentSelector', () => ({
  default: ({ onContentSelected }) => (
    <button
      type="button"
      onClick={() => onContentSelected({ id: 55, title: 'Nuevo contenido' })}
    >
      Cambiar contenido mock
    </button>
  ),
}));

describe('NodeEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKnowledgePathBasic.mockResolvedValue({ id: 7, title: 'Camino de prueba' });
    mockGetNode.mockResolvedValue({
      id: 3,
      title: 'Nodo original',
      description: 'Descripción original',
      content_profile_id: 42,
    });
    mockGetNodeContent.mockResolvedValue({ id: 42, title: 'Contenido original' });
    mockGetQuizzesByPathId.mockResolvedValue([]);
  });

  it('shows a title validation error and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NodeEdit />, { route: '/knowledge_path/7/nodes/3/edit' });

    const titleField = await screen.findByDisplayValue('Nodo original');
    await user.clear(titleField);
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(/el título es requerido/i)).toBeInTheDocument();
    expect(mockUpdateNode).not.toHaveBeenCalled();
  });

  it('submits the expected payload and navigates on success', async () => {
    const user = userEvent.setup();
    mockUpdateNode.mockResolvedValue({ id: 3 });

    renderWithProviders(<NodeEdit />, { route: '/knowledge_path/7/nodes/3/edit' });

    await screen.findByDisplayValue('Nodo original');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateNode).toHaveBeenCalledWith('7', '3', {
        title: 'Nodo original',
        description: 'Descripción original',
        content_profile_id: 42,
      });
      expect(mockNavigate).toHaveBeenCalledWith('/knowledge_path/7/edit');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockUpdateNode.mockRejectedValue({
      response: { data: { error: 'No se pudo actualizar el nodo' } },
    });

    renderWithProviders(<NodeEdit />, { route: '/knowledge_path/7/nodes/3/edit' });

    await screen.findByDisplayValue('Nodo original');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(/no se pudo actualizar el nodo/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
