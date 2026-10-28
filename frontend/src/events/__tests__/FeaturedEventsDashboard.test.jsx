import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeaturedEventsDashboard from '../FeaturedEventsDashboard';
import { renderWithProviders } from '../../test/formTestUtils';

const mockFetchAdminFeaturedEvents = vi.fn();
const mockFetchFeaturedEventChoices = vi.fn();
const mockSaveFeaturedEvent = vi.fn();
const mockDeleteFeaturedEvent = vi.fn();

vi.mock('../../api/eventsApi', () => ({
  fetchAdminFeaturedEvents: (...args) => mockFetchAdminFeaturedEvents(...args),
  fetchFeaturedEventChoices: (...args) => mockFetchFeaturedEventChoices(...args),
  saveFeaturedEvent: (...args) => mockSaveFeaturedEvent(...args),
  deleteFeaturedEvent: (...args) => mockDeleteFeaturedEvent(...args),
}));

const livePlacement = {
  id: 1,
  event_id: 7,
  title: 'Curso de Bitcoin',
  desktop_image: 'http://localhost/desktop.jpg',
  mobile_image: 'http://localhost/mobile.jpg',
  is_active: true,
  is_live: true,
  event_is_visible: true,
  event_has_ended: false,
  date_start: null,
  date_end: null,
};

const eventChoices = [
  { id: 9, title: 'Taller de Ethereum', is_visible: true, has_ended: false, has_banner: false },
  { id: 7, title: 'Curso de Bitcoin', is_visible: true, has_ended: false, has_banner: true },
  { id: 3, title: 'Cierre del club', is_visible: true, has_ended: true, has_banner: false },
];

const imageFile = (name) => new File(['img'], name, { type: 'image/png' });

const uploadBoth = async (user) => {
  const desktop = imageFile('desktop.png');
  const mobile = imageFile('mobile.png');
  await user.upload(screen.getByLabelText(/imagen para computadora/i), desktop);
  await user.upload(screen.getByLabelText(/imagen para celular/i), mobile);
  await waitFor(() => {
    expect(screen.getAllByRole('button', { name: /cambiar imagen/i })).toHaveLength(2);
  });
  return { desktop, mobile };
};

const chooseEvent = async (user, title) => {
  await user.click(screen.getByRole('combobox', { name: /evento/i }));
  await user.click(await screen.findByRole('option', { name: new RegExp(title, 'i') }));
};

describe('FeaturedEventsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAdminFeaturedEvents.mockResolvedValue([livePlacement]);
    mockFetchFeaturedEventChoices.mockResolvedValue(eventChoices);
    mockSaveFeaturedEvent.mockResolvedValue({});
  });

  it('shows the upload form and the saved banners', async () => {
    renderWithProviders(<FeaturedEventsDashboard />);

    expect(await screen.findByRole('heading', { name: /nuevo anuncio/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/imagen para computadora/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/imagen para celular/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /evento/i })).toBeInTheDocument();
    expect(screen.getByText('Se muestra ahora')).toBeInTheDocument();
  });

  it('uploads both images, picks the event, and saves', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FeaturedEventsDashboard />);
    await screen.findByRole('heading', { name: /nuevo anuncio/i });

    const { desktop, mobile } = await uploadBoth(user);
    await chooseEvent(user, 'Taller de Ethereum');
    await user.click(screen.getByRole('button', { name: /guardar anuncio/i }));

    await waitFor(() => {
      expect(mockSaveFeaturedEvent).toHaveBeenCalledWith(9, {
        desktopFile: desktop,
        mobileFile: mobile,
        isActive: true,
      });
    });
    expect(await screen.findByText(/el anuncio quedó guardado/i)).toBeInTheDocument();
  });

  it('asks for the event when none is picked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FeaturedEventsDashboard />);
    await screen.findByRole('heading', { name: /nuevo anuncio/i });

    await uploadBoth(user);
    await user.click(screen.getByRole('button', { name: /guardar anuncio/i }));

    expect(await screen.findByText(/elige el evento que abre este anuncio/i)).toBeInTheDocument();
    expect(mockSaveFeaturedEvent).not.toHaveBeenCalled();
  });

  it('asks for both images before saving', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FeaturedEventsDashboard />);
    await screen.findByRole('heading', { name: /nuevo anuncio/i });

    await user.upload(screen.getByLabelText(/imagen para computadora/i), imageFile('desktop.png'));
    await chooseEvent(user, 'Taller de Ethereum');
    await user.click(screen.getByRole('button', { name: /guardar anuncio/i }));

    expect(await screen.findByText(/sube la imagen para computadora y la imagen para celular/i))
      .toBeInTheDocument();
    expect(mockSaveFeaturedEvent).not.toHaveBeenCalled();
  });

  it('warns when the chosen event has ended', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FeaturedEventsDashboard />);
    await screen.findByRole('heading', { name: /nuevo anuncio/i });

    await chooseEvent(user, 'Cierre del club');

    expect(screen.getByText(/este evento ya terminó/i)).toBeInTheDocument();
  });

  it('loads a saved banner into the form for editing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FeaturedEventsDashboard />);

    await user.click(await screen.findByRole('button', { name: /^editar$/i }));

    expect(screen.getByRole('heading', { name: /anuncio de “curso de bitcoin”/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /evento/i })).toHaveValue('Curso de Bitcoin');
    expect(screen.getAllByRole('button', { name: /cambiar imagen/i })).toHaveLength(2);
  });

  it('hides the live banner from the list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FeaturedEventsDashboard />);

    await user.click(await screen.findByRole('button', { name: /^ocultar$/i }));

    await waitFor(() => {
      expect(mockSaveFeaturedEvent).toHaveBeenCalledWith(7, { isActive: false });
    });
  });
});
