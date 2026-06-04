export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const DEFAULT_EVENT_TIME = '12:00';

export const splitEventDateTime = (value) => {
  if (!value) return { date: '', time: '' };
  const [date, timePart] = value.split('T');
  return {
    date: date || '',
    time: timePart ? timePart.slice(0, 5) : '',
  };
};

export const combineEventDateTime = (date, time) => {
  if (!date) return '';
  return `${date}T${time || DEFAULT_EVENT_TIME}`;
};

export const formatDateTimeForInput = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}; 