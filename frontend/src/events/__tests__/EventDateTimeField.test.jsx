import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventDateTimeField from '../EventDateTimeField';
import { renderWithProviders } from '../../test/formTestUtils';

const timeInput = () => screen.getByRole('textbox', { name: /choose time/i });

describe('EventDateTimeField', () => {
  it('leaves the time empty when only a date is set', () => {
    renderWithProviders(
      <EventDateTimeField label="Inicio" value="2026-11-16" onChange={vi.fn()} />,
    );

    expect(timeInput()).toHaveValue('');
    expect(screen.getByText(/déjala en blanco si no quieres indicar una hora/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar hora/i })).not.toBeInTheDocument();
  });

  it('shows a clock time only when one was provided', () => {
    renderWithProviders(
      <EventDateTimeField label="Inicio" value="2026-11-16T15:30" onChange={vi.fn()} />,
    );

    expect(timeInput()).toHaveValue('03:30 PM');
  });

  it('clears the time without putting a default back', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <EventDateTimeField label="Inicio" value="2026-11-16T15:30" onChange={onChange} />,
    );

    await user.click(screen.getByRole('button', { name: /quitar hora/i }));

    expect(onChange).toHaveBeenCalledWith('2026-11-16');
  });
});
