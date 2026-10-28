import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { listPublicCourses } from '../api/paymentsApi';

const EventLandingField = ({ value, onChange, error }) => {
  const { t } = useTranslation('events');
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listPublicCourses()
      .then((courses) => {
        if (!cancelled) setOptions(Array.isArray(courses) ? courses : []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = options.find((course) => course.code === value);

  return (
    <FormControl fullWidth error={Boolean(error)}>
      <InputLabel id="event-landing-label">{t('fields.landingPage')}</InputLabel>
      <Select
        labelId="event-landing-label"
        label={t('fields.landingPage')}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <MenuItem value="">{t('fields.landingNone')}</MenuItem>
        {options.map((course) => (
          <MenuItem key={course.code} value={course.code}>
            {course.title}
          </MenuItem>
        ))}
        {value && !selected && (
          <MenuItem value={value}>{value}</MenuItem>
        )}
      </Select>
      <FormHelperText>
        {error || (selected?.path
          ? t('fields.landingHelper', { path: selected.path })
          : t('fields.landingHelperEmpty'))}
      </FormHelperText>
    </FormControl>
  );
};

EventLandingField.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
};

export default EventLandingField;
