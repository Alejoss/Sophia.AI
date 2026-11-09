import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import MainLayout from '../MainLayout';
import { renderWithProviders } from '../../test/formTestUtils';

vi.mock('../../generalComponents/HeaderComp.jsx', () => ({
  default: () => <header>header</header>,
}));

function renderLayout(route) {
  return renderWithProviders(
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="messages" element={<div>inbox</div>} />
        <Route path="messages/thread/:userId" element={<div>thread</div>} />
        <Route path="welcome" element={<div>welcome</div>} />
      </Route>
    </Routes>,
    { route },
  );
}

describe('MainLayout messages viewport', () => {
  it('locks the document on the inbox and on an open thread', () => {
    const { unmount } = renderLayout('/messages');
    let main = screen.getByRole('main');
    expect(main).toHaveClass('main-content', 'main-content--locked');
    expect(main.parentElement).toHaveClass('main-layout', 'main-layout--locked');
    unmount();

    renderLayout('/messages/thread/2');
    main = screen.getByRole('main');
    expect(main).toHaveClass('main-content--locked');
    expect(main.parentElement).toHaveClass('main-layout--locked');
  });

  it('leaves other pages on the normal document flow', () => {
    renderLayout('/welcome');
    const main = screen.getByRole('main');
    expect(main).toHaveClass('main-content');
    expect(main).not.toHaveClass('main-content--locked');
    expect(main.parentElement).not.toHaveClass('main-layout--locked');
  });
});
