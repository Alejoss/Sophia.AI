import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCreationForm from '../TopicCreationForm';
import { renderWithProviders } from '../../test/formTestUtils';

const mockNavigate = vi.fn();
const mockGetTopicCreationRequests = vi.fn();
const mockCreateTopicCreationRequest = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/contentApi', () => ({
  default: {
    getTopicCreationRequests: (...args) => mockGetTopicCreationRequests(...args),
    createTopicCreationRequest: (...args) => mockCreateTopicCreationRequest(...args),
  },
}));

describe('TopicCreationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTopicCreationRequests.mockResolvedValue([]);
  });

  it('shows a validation error on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TopicCreationForm />);

    await screen.findByText(/aún no has enviado solicitudes/i);
    await user.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(await screen.findByText(/el título propuesto es requerido/i)).toBeInTheDocument();
    expect(mockCreateTopicCreationRequest).not.toHaveBeenCalled();
  });

  it('submits the expected payload and shows a success message', async () => {
    const user = userEvent.setup();
    mockCreateTopicCreationRequest.mockResolvedValue({ id: 1 });

    renderWithProviders(<TopicCreationForm />);

    await screen.findByText(/aún no has enviado solicitudes/i);
    await user.type(screen.getByLabelText(/título propuesto/i), 'Historia de Bitcoin');
    await user.type(screen.getByLabelText(/descripción propuesta/i), 'Un tema específico');
    await user.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    await waitFor(() => {
      expect(mockCreateTopicCreationRequest).toHaveBeenCalledWith({
        proposed_title: 'Historia de Bitcoin',
        proposed_description: 'Un tema específico',
      });
    });
    expect(await screen.findByText(/solicitud enviada/i)).toBeInTheDocument();
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockCreateTopicCreationRequest.mockRejectedValue({
      response: { data: { error: 'Ya tienes demasiadas solicitudes' } },
    });

    renderWithProviders(<TopicCreationForm />);

    await screen.findByText(/aún no has enviado solicitudes/i);
    await user.type(screen.getByLabelText(/título propuesto/i), 'Historia de Bitcoin');
    await user.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(await screen.findByText(/ya tienes demasiadas solicitudes/i)).toBeInTheDocument();
  });
});
