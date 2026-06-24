import React from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import ImageIcon from '@mui/icons-material/Image';
import ArticleIcon from '@mui/icons-material/Article';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getTopicContentPath, TOPIC_TABS } from '../../utils/urlUtils';

const getMediaIcon = (mediaType) => {
  const props = { fontSize: 'small' };
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

const TopicTimelineContentPreview = ({ link, topicId }) => {
  const content = link?.content;
  if (!content) return null;

  const mediaType = (content.media_type || '').toUpperCase();
  const title = getContentTitle(content);
  const contentId = content.id;
  const href = getTopicContentPath(contentId, topicId, TOPIC_TABS.TIMELINE);

  return (
    <Tooltip title="Abre en una nueva pestaña">
      <Chip
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        icon={getMediaIcon(mediaType)}
        label={(
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <span>{title}</span>
            <OpenInNewIcon sx={{ fontSize: 14, opacity: 0.65, flexShrink: 0 }} />
          </Box>
        )}
        variant="outlined"
        size="small"
        clickable
        sx={{
          maxWidth: '100%',
          height: 'auto',
          py: 0.5,
          textDecoration: 'none',
          color: 'inherit',
          '& .MuiChip-label': {
            whiteSpace: 'normal',
            lineHeight: 1.3,
          },
        }}
      />
    </Tooltip>
  );
};

export default TopicTimelineContentPreview;
