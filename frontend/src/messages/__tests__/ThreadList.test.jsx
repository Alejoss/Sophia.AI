import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThreadList from '../ThreadList';
import { renderWithProviders } from '../../test/formTestUtils';

vi.mock('../../api/messagesApi', () => ({
  fetchThreads: vi.fn().mockResolvedValue({ data: [] }),
}));

describe('ThreadList search form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents full-page navigation on Enter in the search field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThreadList onThreadSelect={vi.fn()} />);

    const search = await screen.findByPlaceholderText(/buscar conversaciones/i);
    const form = search.closest('form');
    expect(form).toBeTruthy();
    expect(form).toHaveAttribute('novalidate');

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    const prevented = !form.dispatchEvent(submitEvent) || submitEvent.defaultPrevented;
    expect(prevented).toBe(true);

    await user.type(search, 'alice{enter}');
    expect(search).toHaveValue('alice');
  });
});
