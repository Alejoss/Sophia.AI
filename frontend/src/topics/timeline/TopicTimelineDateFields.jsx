import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

export const DATE_MODES = {
  NONE: 'none',
  POINT: 'point',
  PERIOD: 'period',
};

const inferInitialMode = (startDate, endDate, isNewEntry) => {
  if (endDate) return DATE_MODES.PERIOD;
  if (startDate) return DATE_MODES.POINT;
  return isNewEntry ? DATE_MODES.POINT : DATE_MODES.NONE;
};

const toApiDate = (value) => (value && value.isValid() ? value.format('YYYY-MM-DD') : '');

const TopicTimelineDateFields = ({ startDate, endDate, onChange, disabled = false, isNewEntry = false }) => {
  const [mode, setMode] = useState(() => inferInitialMode(startDate, endDate, isNewEntry));
  const [rangeError, setRangeError] = useState('');

  const startValue = startDate ? dayjs(startDate) : null;
  const endValue = endDate ? dayjs(endDate) : null;

  const emitChange = (nextStart, nextEnd) => {
    onChange({
      start_date: nextStart,
      end_date: nextEnd,
    });
  };

  const validateRange = (nextStart, nextEnd) => {
    if (nextStart && nextEnd && dayjs(nextEnd).isBefore(dayjs(nextStart), 'day')) {
      setRangeError('La fecha final no puede ser anterior a la fecha inicial.');
      return false;
    }
    setRangeError('');
    return true;
  };

  const handleModeChange = (event) => {
    const nextMode = event.target.value;
    setMode(nextMode);
    setRangeError('');

    if (nextMode === DATE_MODES.NONE) {
      emitChange('', '');
      return;
    }
    if (nextMode === DATE_MODES.POINT) {
      emitChange(startDate, '');
      return;
    }
    emitChange(startDate, endDate);
  };

  const handleStartChange = (newDate) => {
    const nextStart = toApiDate(newDate);
    const nextEnd = mode === DATE_MODES.POINT ? '' : endDate;
    if (!validateRange(nextStart, nextEnd)) {
      emitChange(nextStart, nextEnd);
      return;
    }
    emitChange(nextStart, nextEnd);
  };

  const handleEndChange = (newDate) => {
    const nextEnd = toApiDate(newDate);
    if (!validateRange(startDate, nextEnd)) {
      emitChange(startDate, nextEnd);
      return;
    }
    emitChange(startDate, nextEnd);
  };

  const datePickerSlotProps = {
    field: { clearable: true },
    textField: { fullWidth: true },
    popper: { disablePortal: true },
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Referencia temporal (opcional)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Usa una fecha concreta para hitos puntuales o un periodo para etapas con duracion.
          Si no defines fechas, la entrada se mostrara como una etapa numerada.
        </Typography>

        <RadioGroup
          value={mode}
          onChange={handleModeChange}
          sx={{ mb: mode === DATE_MODES.NONE ? 0 : 2 }}
        >
          <FormControlLabel
            value={DATE_MODES.POINT}
            control={<Radio size="small" disabled={disabled} />}
            label="Fecha concreta (un solo día)"
          />
          <FormControlLabel
            value={DATE_MODES.PERIOD}
            control={<Radio size="small" disabled={disabled} />}
            label="Periodo de tiempo"
          />
          <FormControlLabel
            value={DATE_MODES.NONE}
            control={<Radio size="small" disabled={disabled} />}
            label='Sin fecha (Etapa conceptual, por ej. "Período Jurásico")'
          />
        </RadioGroup>

        {mode === DATE_MODES.POINT && (
          <DatePicker
            label="Fecha del evento"
            value={startValue}
            onChange={handleStartChange}
            disabled={disabled}
            closeOnSelect
            slotProps={{
              ...datePickerSlotProps,
              textField: {
                ...datePickerSlotProps.textField,
                helperText: 'Ej. 31 oct 2008 para la publicacion del whitepaper de Bitcoin.',
              },
            }}
          />
        )}

        {mode === DATE_MODES.PERIOD && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <DatePicker
              label="Fecha inicial"
              value={startValue}
              onChange={handleStartChange}
              disabled={disabled}
              closeOnSelect
              slotProps={{
                ...datePickerSlotProps,
                textField: {
                  ...datePickerSlotProps.textField,
                  helperText: 'Inicio del periodo.',
                },
              }}
            />
            <DatePicker
              label="Fecha final (opcional)"
              value={endValue}
              onChange={handleEndChange}
              disabled={disabled}
              minDate={startValue || undefined}
              closeOnSelect
              slotProps={{
                ...datePickerSlotProps,
                textField: {
                  ...datePickerSlotProps.textField,
                  error: Boolean(rangeError),
                  helperText: rangeError || 'Dejala vacia si el periodo sigue abierto.',
                },
              }}
            />
          </Stack>
        )}
      </Box>
    </LocalizationProvider>
  );
};

TopicTimelineDateFields.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isNewEntry: PropTypes.bool,
};

export default TopicTimelineDateFields;
