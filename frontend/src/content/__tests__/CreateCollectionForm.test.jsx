import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateCollectionForm from '../CreateCollectionForm';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockCreateCollection = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/contentApi', () => ({
  default: {
    createCollection: (...args) => mockCreateCollection(...args),
  },
}));

describe('CreateCollectionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation error on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateCollectionForm />);

    await user.click(screen.getByRole('button', { name: /crear colección/i }));

    expect(
      await screen.findByText(/el nombre de la colección es requerido/i),
    ).toBeInTheDocument();
    expect(mockCreateCollection).not.toHaveBeenCalled();
  });

  it('submits expected payload and navigates on success', async () => {
    const user = userEvent.setup();
    mockCreateCollection.mockResolvedValue({ id: 5 });

    renderWithProviders(<CreateCollectionForm />);

    await user.type(screen.getByLabelText(/nombre de la colección/i), 'Mi colección');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /crear colección/i }));

    await waitFor(() => {
      expect(mockCreateCollection).toHaveBeenCalledWith({
        name: 'Mi colección',
        is_public: true,
      });
      expect(mockNavigate).toHaveBeenCalledWith('/content/collections');
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockCreateCollection.mockRejectedValue({
      response: { data: { error: 'Ya existe una colección con ese nombre' } },
    });

    renderWithProviders(<CreateCollectionForm />);

    await user.type(screen.getByLabelText(/nombre de la colección/i), 'Duplicada');
    await user.click(screen.getByRole('button', { name: /crear colección/i }));

    expect(
      await screen.findByText(/ya existe una colección con ese nombre/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
