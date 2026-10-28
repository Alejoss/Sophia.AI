import { describe, expect, it } from 'vitest';
import {
  combineEventDateTime,
  eventDatesAreOrdered,
  eventHasEnded,
  eventHasStarted,
  eventStartIsUpcoming,
  formatDateTimeForInput,
  formatEventWhen,
  splitEventDateTime,
} from '../dateUtils';

describe('optional event clock time', () => {
  it('keeps a date when no time is combined', () => {
    expect(combineEventDateTime('2026-11-16', '')).toBe('2026-11-16');
    expect(combineEventDateTime('2026-11-16', '15:30')).toBe('2026-11-16T15:30');
    expect(combineEventDateTime('', '15:30')).toBe('');
  });

  it('splits a date-only value without inventing a time', () => {
    expect(splitEventDateTime('2026-11-16')).toEqual({ date: '2026-11-16', time: '' });
    expect(splitEventDateTime('2026-11-16T15:30')).toEqual({ date: '2026-11-16', time: '15:30' });
    expect(splitEventDateTime('')).toEqual({ date: '', time: '' });
  });

  it('loads a date-only event back into the form without a clock time', () => {
    expect(formatDateTimeForInput('2026-11-16T12:00:00Z', false)).toBe('2026-11-16');
  });

  it('loads a timed event as local wall time', () => {
    const start = '2026-11-16T15:30:00Z';
    const expected = new Date(start);
    const pad = (n) => String(n).padStart(2, '0');
    expect(formatDateTimeForInput(start, true)).toBe(
      `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}T${pad(expected.getHours())}:${pad(expected.getMinutes())}`,
    );
  });

  it('allows the same calendar day when either side has no time', () => {
    expect(eventDatesAreOrdered('2026-11-16', '2026-11-16')).toBe(true);
    expect(eventDatesAreOrdered('2026-11-16T18:00', '2026-11-16')).toBe(true);
    expect(eventDatesAreOrdered('2026-11-16', '2026-11-15')).toBe(false);
    expect(eventDatesAreOrdered('2026-11-16T18:00', '2026-11-16T17:00')).toBe(false);
    expect(eventDatesAreOrdered('2026-11-16T15:00', '2026-11-16T17:00')).toBe(true);
  });

  it('treats a date-only start as upcoming on that local day', () => {
    const now = new Date(2026, 10, 16, 23, 30, 0);
    expect(eventStartIsUpcoming('2026-11-16', now)).toBe(true);
    expect(eventStartIsUpcoming('2026-11-15', now)).toBe(false);
    expect(eventStartIsUpcoming('2026-11-16T23:00', now)).toBe(false);
    expect(eventStartIsUpcoming('2026-11-17T01:00', now)).toBe(true);
  });

  it('does not mark a date-only event as started until the UTC day has passed', () => {
    const now = new Date('2026-11-16T23:00:00Z');
    expect(eventHasStarted({
      date_start: '2026-11-16T12:00:00Z',
      date_start_has_time: false,
    }, now)).toBe(false);
    expect(eventHasStarted({
      date_start: '2026-11-15T12:00:00Z',
      date_start_has_time: false,
    }, now)).toBe(true);
    expect(eventHasEnded({
      date_end: '2026-11-16T12:00:00Z',
      date_end_has_time: false,
    }, now)).toBe(false);
  });

  it('formats a date-only event without a clock time', () => {
    const formatted = formatEventWhen('2026-11-16T12:00:00Z', false, 'en-US', { month: 'long' });
    expect(formatted).toMatch(/November/);
    expect(formatted).toMatch(/16/);
    expect(formatted).not.toMatch(/12|7:00|AM|PM/i);
  });
});
