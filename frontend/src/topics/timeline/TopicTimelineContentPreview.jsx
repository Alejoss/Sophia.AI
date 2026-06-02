import React from 'react';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import ImageIcon from '@mui/icons-material/Image';
import ArticleIcon from '@mui/icons-material/Article';
import LinkIcon from '@mui/icons-material/Link';
import ContentDisplay from '../../content/ContentDisplay';

const MEDIA_LABELS = {
  VIDEO: 'Video',
  AUDIO: 'Audio',
  IMAGE: 'Imagen',
  TEXT: 'Texto',
};

const ROLE_LABELS = {
  PRIMARY: 'Principal',
  REFERENCE: 'Referencia',
  EXAMPLE: 'Ejemplo',
  OPTIONAL: 'Opcional',
};

const getMediaIcon = (mediaType, sx = {}) => {
  const props = { fontSize: 'small', sx };
  switch ((mediaType || '').toUpperCase()) {
    case 'VIDEO':
      return <VideocamIcon {...props} />;
    case 'AUDIO':
      return <AudiotrackIcon {...props} />;
    case 'IMAGE':
      return <ImageIcon {...props} />;
    case 'TEXT':
      return <ArticleIcon {...props} />;
    default:
      return <LinkIcon {...props} />;
  }
};

const getContentTitle = (content) => {
  const profile = content?.selected_profile || content;
  return profile?.title || content?.original_title || 'Contenido sin titulo';
};

const TopicTimelineContentPreview = ({ link, topicId, navigate, compact = false }) => {
  const content = link?.content;
  if (!content) return null;

  const mediaType = (content.media_type || '').toUpperCase();
  const title = getContentTitle(content);
  const contentId = content.id;

  if (!compact) {
    return (
      <Box sx={{ mt: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
          <Chip size="small" color="primary" label={ROLE_LABELS[link.role] || 'Contenido'} />
          <Chip size="small" variant="outlined" icon={getMediaIcon(mediaType)} label={MEDIA_LABELS[mediaType] || 'Contenido'} />
        </Stack>
        <ContentDisplay
          content={content}
          variant="card"
          showAuthor
          topicId={topicId}
          onClick={() => navigate(`/content/${contentId}/topic/${topicId}`)}
        />
        {link.caption && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {link.caption}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Card variant="outlined" sx={{ height: '100%', bgcolor: 'background.paper' }}>
      <CardActionArea
        onClick={() => navigate(`/content/${contentId}/topic/${topicId}`)}
        sx={{ height: '100%' }}
      >
        <CardContent sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            {getMediaIcon(mediaType, { color: 'primary.main' })}
            <Chip size="small" label={MEDIA_LABELS[mediaType] || 'Contenido'} variant="outlined" />
          </Stack>
          <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
            {title}
          </Typography>
          {link.caption && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {link.caption}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default TopicTimelineContentPreview;
