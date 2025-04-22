import React, { useEffect } from 'react';
import { Box, Typography, Paper, Card, CardContent, CardMedia, Button, Chip } from '@mui/material';
import { getFileUrl } from '../utils/fileUtils';

const ContentDisplay = ({ 
  content_profile,
  variant = 'simple', // 'simple', 'detailed', 'card', 'preview'
  showActions = false,
  onRemove,
  onEdit,
  onClick,
  maxImageHeight = 300,
  showAuthor = true,
  additionalActions
}) => {
  if (!content_profile) return null;

  const title = content_profile.title || content_profile.content?.original_title || 'Untitled';
  const author = content_profile.author || content_profile.content?.original_author;
  const mediaType = content_profile.content?.media_type;
  const fileDetails = content_profile.content?.file_details;

  const getFullUrl = (fileDetails) => {
    if (!fileDetails) return null;
    return fileDetails.url;
  };

  const renderContentByType = () => {
    if (!fileDetails) return null;

    const fileUrl = getFullUrl(fileDetails);
    if (!fileUrl) return null;

    switch (mediaType?.toLowerCase()) {
      case 'image':
        return (
          <Box sx={{ 
            mb: 2, 
            display: 'flex', 
            justifyContent: 'center',
            maxHeight: `${maxImageHeight}px`,
            overflow: 'hidden',
            borderRadius: variant === 'card' ? 0 : 1
          }}>
            {variant === 'card' ? (
              <CardMedia
                component="img"
                height={maxImageHeight}
                image={fileUrl}
                alt={title}
                sx={{ 
                  objectFit: 'cover',
                  cursor: onClick ? 'pointer' : 'default'
                }}
                onClick={onClick}
                onError={(e) => {
                  e.target.src = '/placeholder-image.png';
                  e.target.onerror = null;
                }}
              />
            ) : (
              <img
                src={fileUrl}
                alt={title}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                  cursor: onClick ? 'pointer' : 'default'
                }}
                onClick={onClick}
                onError={(e) => {
                  e.target.src = '/placeholder-image.png';
                  e.target.onerror = null;
                }}
              />
            )}
          </Box>
        );

      case 'text':
        return (
          <Box sx={{ my: 2 }}>
            <Typography 
              variant="body1" 
              sx={{ 
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                backgroundColor: 'rgba(0, 0, 0, 0.03)',
                p: 2,
                borderRadius: 1,
                maxHeight: variant === 'preview' ? '100px' : 'none',
                overflow: variant === 'preview' ? 'hidden' : 'auto'
              }}
            >
              {fileDetails.text || 'No content available'}
            </Typography>
          </Box>
        );

      case 'video':
        return (
          <Box sx={{ 
            my: 2, 
            display: 'flex', 
            justifyContent: 'center',
            maxHeight: variant === 'preview' ? '200px' : '70vh',
            position: 'relative'
          }}>
            {variant === 'preview' ? (
              <Box sx={{
                width: '100%',
                height: '200px',
                bgcolor: 'rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: onClick ? 'pointer' : 'default'
              }} onClick={onClick}>
                <Typography>Click to play video</Typography>
              </Box>
            ) : (
              <video
                controls
                style={{
                  maxWidth: '100%',
                  height: 'auto'
                }}
              >
                <source src={fileUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}
          </Box>
        );

      case 'audio':
        return (
          <Box sx={{ 
            my: 2,
            p: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.03)',
            borderRadius: 1
          }}>
            <audio
              controls
              style={{ width: '100%' }}
            >
              <source src={fileUrl} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </Box>
        );

      default:
        return (
          <Typography color="text.secondary">
            Content preview not available
          </Typography>
        );
    }
  };

  const renderContent = () => {
    const contentBody = (
      <>
        {renderContentByType()}
        <Box sx={{ mt: variant === 'card' ? 0 : 2 }}>
          <Typography variant={variant === 'card' ? 'h6' : 'body1'} gutterBottom>
            {title}
          </Typography>
          {showAuthor && author && (
            variant === 'card' ? (
              <Chip 
                label={`Author: ${author}`}
                size="small"
                variant="outlined"
                sx={{ mb: 1 }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                By {author}
              </Typography>
            )
          )}
          {showActions && (
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {onEdit && (
                <Button size="small" onClick={onEdit}>
                  Change Content
                </Button>
              )}
              {onRemove && (
                <Button size="small" color="error" onClick={onRemove}>
                  Remove
                </Button>
              )}
              {additionalActions}
            </Box>
          )}
        </Box>
      </>
    );

    switch (variant) {
      case 'card':
        return (
          <Card 
            onClick={onClick} 
            sx={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              cursor: onClick ? 'pointer' : 'default'
            }}
          >
            {renderContentByType()}
            <CardContent sx={{ flexGrow: 1 }}>
              {contentBody}
            </CardContent>
          </Card>
        );

      case 'detailed':
        return (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
            {contentBody}
          </Paper>
        );

      case 'preview':
      case 'simple':
      default:
        return (
          <Box onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default' }}>
            {contentBody}
          </Box>
        );
    }
  };

  return renderContent();
};

export default ContentDisplay; 