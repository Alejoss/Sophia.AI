import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LinkIcon from '@mui/icons-material/Link';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { useNavigate } from 'react-router-dom';
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
  canEdit,
  canSuggest = false,
  canReorder = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const links = [...(entry.contents || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const dateLabel = getEntryDateLabel(entry, index);
  const hasCollapsibleContent = Boolean(entry.description) || links.length > 0;
  const canExpand = hasCollapsibleContent || canSuggest;
  const relatedContentLabel = links.length === 1
    ? '1 contenido relacionado'
    : `${links.length} contenidos relacionados`;

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
              color={entry.start_date ? 'primary' : 'default'}
              variant={entry.start_date ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600 }}
            />
            <Stack direction="row" spacing={0.5} alignItems="center">
              {links.length > 0 && (
                <Tooltip title={relatedContentLabel}>
                  <Chip
                    icon={<LinkIcon />}
                    label={links.length}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                </Tooltip>
              )}
              {canEdit && (
              <Stack direction="row" spacing={0.5}>
                {canReorder && (
                  <>
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
                  </>
                )}
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
          </Stack>

          <Stack
            direction="row"
            spacing={0.5}
            alignItems="flex-start"
            justifyContent="space-between"
            sx={{ mt: 1.5 }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }}>
              {entry.title}
            </Typography>
            {expanded && canSuggest && (
              <Tooltip title="Sugerir contenido para esta entrada">
                <IconButton
                  size="small"
                  onClick={() => navigate(`/content/topics/${topicId}/timeline/${entry.id}/suggest-content`)}
                  aria-label="Sugerir contenido para esta entrada"
                  sx={{ mt: -0.25, flexShrink: 0 }}
                >
                  <LightbulbOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canExpand && (
              <Tooltip title={expanded ? 'Ocultar detalles' : 'Ver detalles'}>
                <IconButton
                  size="small"
                  onClick={() => setExpanded((prev) => !prev)}
                  aria-label={expanded ? 'Ocultar detalles' : 'Ver detalles'}
                  aria-expanded={expanded}
                  sx={{ mt: -0.25, flexShrink: 0 }}
                >
                  {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          <Collapse in={expanded} timeout="auto" unmountOnExit>
            {entry.description && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, whiteSpace: 'pre-line' }}>
                {entry.description}
              </Typography>
            )}

            {links.length > 0 && (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                {links.map((link) => (
                  <TopicTimelineContentPreview
                    key={link.id || link.content?.id}
                    link={link}
                    topicId={topicId}
                  />
                ))}
              </Stack>
            )}
          </Collapse>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TopicTimelineEntryCard;
