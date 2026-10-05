import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import NotFound from '../NotFound';
import { renderWithProviders } from '../../test/formTestUtils';

describe('NotFound', () => {
  it('renders branded 404 copy and navigates home', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/missing" element={<NotFound />} />
        <Route path="/" element={<div>Inicio</div>} />
      </Routes>,
      { route: '/missing' },
    );

    expect(screen.getByText('Academia Blockchain')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /no encontramos esta página/i })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /volver al inicio/i }));
    expect(await screen.findByText('Inicio')).toBeInTheDocument();
  });
});
