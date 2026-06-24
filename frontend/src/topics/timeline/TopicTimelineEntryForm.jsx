import React, { useEffect, useState } from 'react';

import {

  Alert,

  Box,

  Button,

  Paper,

  Stack,

  TextField,

} from '@mui/material';

import TopicTimelineContentSelector from './TopicTimelineContentSelector';

import TopicTimelineDateFields from './TopicTimelineDateFields';

import dayjs from 'dayjs';



const buildInitialState = (entry) => {

  const links = [...(entry?.contents || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const selectedIds = links.map((link) => String(link.content?.id)).filter(Boolean);

  return {

    title: entry?.title || '',

    description: entry?.description || '',

    start_date: entry?.start_date || '',

    end_date: entry?.end_date || '',

    selectedContentIds: selectedIds,

  };

};



const TopicTimelineEntryForm = ({

  entry,

  availableContents,

  loadingContents,

  saving,

  error,

  onCancel,

  onSubmit,

}) => {

  const [form, setForm] = useState(() => buildInitialState(entry));

  const [dateRangeError, setDateRangeError] = useState('');



  useEffect(() => {

    setForm(buildInitialState(entry));

    setDateRangeError('');

  }, [entry]);



  const handleFieldChange = (field) => (event) => {

    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  };



  const handleContentSelectionChange = (selectedIds) => {

    setForm((prev) => ({ ...prev, selectedContentIds: selectedIds }));

  };



  const handleDateChange = ({ start_date, end_date }) => {

    setForm((prev) => ({ ...prev, start_date, end_date }));

    if (

      start_date

      && end_date

      && dayjs(end_date).isBefore(dayjs(start_date), 'day')

    ) {

      setDateRangeError('La fecha final no puede ser anterior a la fecha inicial.');

    } else {

      setDateRangeError('');

    }

  };



  const handleSubmit = async () => {

    if (!form.title.trim()) return;

    if (

      form.start_date

      && form.end_date

      && dayjs(form.end_date).isBefore(dayjs(form.start_date), 'day')

    ) {

      setDateRangeError('La fecha final no puede ser anterior a la fecha inicial.');

      return;

    }

    const contents = form.selectedContentIds.map((id, index) => ({
      content_id: Number(id),
      order: index + 1,
      caption: '',
    }));

    await onSubmit({

      title: form.title.trim(),

      description: form.description,

      start_date: form.start_date || null,

      end_date: form.end_date || null,

      contents,

    });

  };



  return (

    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>

      <Stack spacing={2.5}>

        {error && <Alert severity="error">{error}</Alert>}

        {dateRangeError && <Alert severity="error">{dateRangeError}</Alert>}



        <TextField

          label="Titulo"

          value={form.title}

          onChange={handleFieldChange('title')}

          fullWidth

        />

        <TextField

          label="Descripcion narrativa"

          value={form.description}

          onChange={handleFieldChange('description')}

          fullWidth

          multiline

          minRows={3}

        />



        <TopicTimelineDateFields

          key={entry?.id ?? 'new'}

          startDate={form.start_date}

          endDate={form.end_date}

          onChange={handleDateChange}

          disabled={saving}

          isNewEntry={!entry}

        />



        <TopicTimelineContentSelector

          items={availableContents}

          selectedIds={form.selectedContentIds}

          loading={loadingContents}

          onSelectionChange={handleContentSelectionChange}

        />

      </Stack>



      <Box

        sx={{

          display: 'flex',

          justifyContent: 'flex-end',

          gap: 1.5,

          mt: 3,

          pt: 2,

          borderTop: 1,

          borderColor: 'divider',

        }}

      >

        <Button type="button" onClick={onCancel} disabled={saving}>

          Cancelar

        </Button>

        <Button

          type="button"

          variant="contained"

          onClick={handleSubmit}

          disabled={saving || !form.title.trim()}

        >

          {saving ? 'Guardando...' : 'Guardar'}

        </Button>

      </Box>

    </Paper>

  );

};



export default TopicTimelineEntryForm;

