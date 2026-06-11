import React from 'react';
import PropTypes from 'prop-types';
import { Stack, Typography } from '@mui/material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { combineEventDateTime, DEFAULT_EVENT_TIME, splitEventDateTime } from '../utils/dateUtils';

const EventDateTimeField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  dateHelperText,
  minDate,
}) => {
  const { date, time } = splitEventDateTime(value);
  const dateValue = date ? dayjs(date) : null;
  const timeValue = date
    ? dayjs(`${date} ${time || DEFAULT_EVENT_TIME}`, 'YYYY-MM-DD HH:mm')
    : null;

  const handleDateChange = (newDate) => {
    if (!newDate || !newDate.isValid()) {
      onChange('');
      return;
    }
    onChange(combineEventDateTime(newDate.format('YYYY-MM-DD'), time));
  };

  const handleTimeChange = (newTime) => {
    if (!date) return;
    if (!newTime || !newTime.isValid()) {
      onChange(combineEventDateTime(date, ''));
      return;
    }
    onChange(combineEventDateTime(date, newTime.format('HH:mm')));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" color={error ? 'error' : 'text.primary'}>
          {label}
        </Typography>
        <DatePicker
          label="Fecha"
          value={dateValue}
          onChange={handleDateChange}
          minDate={minDate ? dayjs(minDate) : undefined}
          slotProps={{
            textField: {
              fullWidth: true,
              error: Boolean(error),
              helperText: dateHelperText || '',
            },
            field: { clearable: true },
          }}
        />
        <TimePicker
          label="Hora (opcional)"
          value={timeValue}
          onChange={handleTimeChange}
          disabled={!date}
          ampm
          slotProps={{
            textField: {
              fullWidth: true,
              error: Boolean(error),
              helperText: '12:00 pm por defecto si no se indica hora',
            },
            field: { clearable: true },
          }}
        />
        {error && (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        )}
        {!error && helperText && (
          <Typography variant="caption" color="text.secondary">
            {helperText}
          </Typography>
        )}
      </Stack>
    </LocalizationProvider>
  );
};

EventDateTimeField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  helperText: PropTypes.string,
  dateHelperText: PropTypes.string,
  minDate: PropTypes.instanceOf(Date),
};

export default EventDateTimeField;
