import i18n from '../i18n';
import { getIntlLocale } from './dateLocales';

export const formatDate = (dateString, locale) => {
  const resolvedLocale = locale || getIntlLocale(i18n.resolvedLanguage || i18n.language);
  return new Date(dateString).toLocaleDateString(resolvedLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const pad = (n) => String(n).padStart(2, '0');

export const splitEventDateTime = (value) => {
  if (!value) return { date: '', time: '' };
  const [date, timePart] = String(value).split('T');
  return {
    date: date || '',
    time: timePart ? timePart.slice(0, 5) : '',
  };
};

/** A clock time is present only when the value includes one. Date-only stays date-only. */
export const combineEventDateTime = (date, time) => {
  if (!date) return '';
  if (!time) return date;
  return `${date}T${time}`;
};

export const eventValueHasTime = (value) => Boolean(splitEventDateTime(value).time);

export const formatDateTimeForInput = (dateString, hasTime = true) => {
  if (!dateString) return '';
  if (!hasTime) return String(dateString).slice(0, 10);
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const localDateString = (now) => (
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
);

const utcDateString = (now) => now.toISOString().slice(0, 10);

/** Date-only values are upcoming when the calendar day is today or later. */
export const eventStartIsUpcoming = (value, now = new Date()) => {
  if (!value) return true;
  if (!eventValueHasTime(value)) {
    return value.slice(0, 10) >= localDateString(now);
  }
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() >= now.getTime() + 60 * 60 * 1000;
};

/**
 * Timed values must be strictly later. If either side has no clock time,
 * the end calendar day may be the same day.
 */
export const eventDatesAreOrdered = (start, end) => {
  if (!start || !end) return true;
  if (!eventValueHasTime(start) || !eventValueHasTime(end)) {
    return end.slice(0, 10) >= start.slice(0, 10);
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;
  return endDate > startDate;
};

export const eventHasStarted = (event, now = new Date()) => {
  if (!event?.date_start) return false;
  if (event.date_start_has_time === false) {
    return String(event.date_start).slice(0, 10) < utcDateString(now);
  }
  return new Date(event.date_start) < now;
};

export const eventHasEnded = (event, now = new Date()) => {
  if (!event?.date_end) return false;
  if (event.date_end_has_time === false) {
    return String(event.date_end).slice(0, 10) < utcDateString(now);
  }
  return new Date(event.date_end) <= now;
};

/** Format an event instant. `hasTime === false` prints the calendar day only. */
export const formatEventWhen = (dateString, hasTime, locale, { month = 'long' } = {}) => {
  if (!dateString) return '';
  const resolvedLocale = locale || getIntlLocale(i18n.resolvedLanguage || i18n.language);
  const options = {
    year: 'numeric',
    month,
    day: 'numeric',
  };
  if (hasTime !== false) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return new Date(dateString).toLocaleDateString(resolvedLocale, options);
}; 