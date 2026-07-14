import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FavoriteCryptos from '../FavoriteCryptos';
import { renderWithProviders } from '../../test/formTestUtils';

const mockGetCryptocurrencies = vi.fn();
const mockGetUserAcceptedCryptos = vi.fn();
const mockAddAcceptedCrypto = vi.fn();
const mockDeleteAcceptedCrypto = vi.fn();

vi.mock('../../api/profilesApi', () => ({
  getCryptocurrencies: (...args) => mockGetCryptocurrencies(...args),
  getUserAcceptedCryptos: (...args) => mockGetUserAcceptedCryptos(...args),
  addAcceptedCrypto: (...args) => mockAddAcceptedCrypto(...args),
  deleteAcceptedCrypto: (...args) => mockDeleteAcceptedCrypto(...args),
}));

const availableCryptos = [
  { id: 1, name: 'Bitcoin', code: 'BTC' },
  { id: 2, name: 'Ethereum', code: 'ETH' },
];

describe('FavoriteCryptos add modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserAcceptedCryptos.mockResolvedValue([]);
    mockGetCryptocurrencies.mockResolvedValue(availableCryptos);
  });

  const openModal = async (user) => {
    await user.click(await screen.findByRole('button', { name: /agregar criptomoneda/i }));
    return screen.findByRole('dialog');
  };

  it('shows a validation error when no crypto is selected and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FavoriteCryptos isOwnProfile userId={1} />);

    await openModal(user);
    await user.click(screen.getByRole('button', { name: /^agregar$/i }));

    expect(
      await screen.findByText(/por favor selecciona una criptomoneda/i),
    ).toBeInTheDocument();
    expect(mockAddAcceptedCrypto).not.toHaveBeenCalled();
  });

  it('adds the selected cryptocurrency and refreshes the list', async () => {
    const user = userEvent.setup();
    mockAddAcceptedCrypto.mockResolvedValue({});
    renderWithProviders(<FavoriteCryptos isOwnProfile userId={1} />);

    await openModal(user);
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /bitcoin/i }));
    await user.type(screen.getByLabelText(/dirección de billetera/i), '0xABC');
    await user.click(screen.getByRole('button', { name: /^agregar$/i }));

    await waitFor(() => {
      expect(mockAddAcceptedCrypto).toHaveBeenCalledWith('1', '0xABC');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows a Spanish alert when the API call fails', async () => {
    const user = userEvent.setup();
    mockAddAcceptedCrypto.mockRejectedValue({
      response: { data: { error: 'No se pudo agregar la criptomoneda' } },
    });
    renderWithProviders(<FavoriteCryptos isOwnProfile userId={1} />);

    await openModal(user);
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /ethereum/i }));
    await user.click(screen.getByRole('button', { name: /^agregar$/i }));

    expect(
      await screen.findByText(/no se pudo agregar la criptomoneda/i),
    ).toBeInTheDocument();
  });
});
