import React from 'react';
import PropTypes from 'prop-types';
import { Stack, TextField, Typography } from '@mui/material';
import { combineEventDateTime, splitEventDateTime } from '../utils/dateUtils';

const EventDateTimeField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  dateHelperText,
}) => {
  const { date, time } = splitEventDateTime(value);

  const handleDateChange = (e) => {
    onChange(combineEventDateTime(e.target.value, time));
  };

  const handleTimeChange = (e) => {
    onChange(combineEventDateTime(date, e.target.value));
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" color={error ? 'error' : 'text.primary'}>
        {label}
      </Typography>
      <TextField
        type="date"
        label="Fecha"
        value={date}
        onChange={handleDateChange}
        error={Boolean(error)}
        helperText={dateHelperText || ''}
        InputLabelProps={{ shrink: true }}
        fullWidth
      />
      <TextField
        type="time"
        label="Hora (opcional)"
        value={time}
        onChange={handleTimeChange}
        error={Boolean(error)}
        helperText="12:00 pm por defecto si no se indica hora"
        InputLabelProps={{ shrink: true }}
        fullWidth
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
  );
};

EventDateTimeField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  helperText: PropTypes.string,
  dateHelperText: PropTypes.string,
};

export default EventDateTimeField;
