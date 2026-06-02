import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import TopicTimelineContentPreview from './TopicTimelineContentPreview';

const formatDate = (value) => {
  if (!value) return null;
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const getEntryDateLabel = (entry, index) => {
  if (entry.display_date) return entry.display_date;
  if (entry.start_date && entry.end_date) {
    return `${formatDate(entry.start_date)} - ${formatDate(entry.end_date)}`;
  }
  if (entry.start_date) return formatDate(entry.start_date);
  return `Etapa ${index + 1}`;
};

const TopicTimelineEntryCard = ({
  entry,
  index,
  topicId,
  navigate,
  canEdit,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) => {
  const links = [...(entry.contents || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const primaryLink = links.find((link) => link.role === 'PRIMARY') || links[0];
  const secondaryLinks = links.filter((link) => link !== primaryLink);
  const dateLabel = getEntryDateLabel(entry, index);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '28px 1fr', sm: '56px 1fr' }, gap: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: isLast ? '50%' : -24,
            width: 2,
            bgcolor: 'divider',
          }}
        />
        <Box
          sx={{
            width: { xs: 20, sm: 28 },
            height: { xs: 20, sm: 28 },
            mt: 2.5,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            border: '4px solid',
            borderColor: 'background.default',
            zIndex: 1,
            boxShadow: 2,
          }}
        />
      </Box>

      <Card
        variant="outlined"
        sx={{
          mb: 3,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          transition: 'box-shadow 160ms ease, transform 160ms ease',
          '&:hover': {
            boxShadow: 3,
            transform: 'translateY(-1px)',
          },
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Chip
              icon={<CalendarTodayIcon />}
              label={dateLabel}
              color={entry.display_date || entry.start_date ? 'primary' : 'default'}
              variant={entry.display_date || entry.start_date ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600 }}
            />
            {canEdit && (
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Subir">
                  <span>
                    <IconButton size="small" onClick={() => onMoveUp(entry.id)} disabled={isFirst}>
                      <KeyboardArrowUpIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Bajar">
                  <span>
                    <IconButton size="small" onClick={() => onMoveDown(entry.id)} disabled={isLast}>
                      <KeyboardArrowDownIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => onEdit(entry)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton size="small" color="error" onClick={() => onDelete(entry)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          </Stack>

          <Typography variant="h6" sx={{ mt: 1.5, fontWeight: 700 }}>
            {entry.title}
          </Typography>
          {entry.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
              {entry.description}
            </Typography>
          )}

          {primaryLink && (
            <TopicTimelineContentPreview
              link={primaryLink}
              topicId={topicId}
              navigate={navigate}
            />
          )}

          {secondaryLinks.length > 0 && (
            <Box sx={{ mt: 2.5 }}>
              <Divider sx={{ mb: 1.5 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Contenidos relacionados
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                  },
                }}
              >
                {secondaryLinks.map((link) => (
                  <TopicTimelineContentPreview
                    key={link.id || link.content?.id}
                    link={link}
                    topicId={topicId}
                    navigate={navigate}
                    compact
                  />
                ))}
              </Box>
            </Box>
          )}

          {canEdit && links.length === 0 && (
            <Button size="small" sx={{ mt: 2 }} onClick={() => onEdit(entry)}>
              Adjuntar contenidos
            </Button>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default TopicTimelineEntryCard;
