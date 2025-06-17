import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Card, CardContent, CardMedia, Button, Chip, Stack, CardActions, Avatar } from '@mui/material';
import { getFileUrl } from '../utils/fileUtils';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ArticleIcon from '@mui/icons-material/Article';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VideocamIcon from '@mui/icons-material/Videocam';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';

const ContentDisplay = ({ 
  content,
  variant = 'simple', // 'simple', 'detailed', 'card', 'preview'
  showActions = false,
  onRemove,
  onEdit,
  onClick,
  maxImageHeight = 300,
  showAuthor = true,
  additionalActions,
  topicId = null
}) => {
  const [renderError, setRenderError] = useState(null);

  if (!content) {
    return null;
  }

  // Get appropriate data from either content or content_profile
  const profile = content.selected_profile || content;
  const title = profile.title || content.original_title || 'Untitled';
  const author = profile.author || content.original_author;
  const mediaType = content.media_type || '';
  const fileDetails = content.file_details;
  const url = content.url || fileDetails?.url;

  // Standardized way to get file URL from different possible structures
  const getFileUrlFromContent = () => {
    try {
      if (!fileDetails) {
        if (content.url) {
          return content.url;
        }
        return null;
      }
      
      if (fileDetails.url) {
        return fileDetails.url;
      }
      
      if (fileDetails.file) {
        if (typeof fileDetails.file === 'string') {
          return fileDetails.file;
        }
        return getFileUrl(fileDetails.file);
      }
      
      if (content.url) {
        return content.url;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting file URL:', error);
      setRenderError(`Error getting file URL: ${error.message}`);
      return null;
    }
  };

  const getMediaTypeIcon = (content) => {
    console.log('\n=== getMediaTypeIcon ===');
    console.log('Content:', content);
    console.log('Has URL?', !!url);
    
    const iconProps = { fontSize: 'large', sx: { opacity: 0.7 } };
    const [showFallbackIcon, setShowFallbackIcon] = useState(false);

    // First check if content has a favicon
    if (content.favicon && content.media_type === 'TEXT') {
      return (
        <Box sx={{ 
          width: 24, 
          height: 24, 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {showFallbackIcon ? (
            <LinkIcon {...iconProps} />
          ) : (
            <img 
              src={content.favicon}
              alt="Site Icon"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={() => setShowFallbackIcon(true)}
            />
          )}
        </Box>
      );
    }

    // Handle non-URL content or non-TEXT URL content
    const mediaType = content.media_type?.toUpperCase();
    console.log('Using media type:', mediaType);
    
    switch (mediaType) {
      case 'VIDEO':
        console.log('Showing video icon');
        return <VideocamIcon {...iconProps} />;
      case 'AUDIO':
        console.log('Showing audio icon');
        return <AudiotrackIcon {...iconProps} />;
      case 'TEXT':
        if (content.url) {
          console.log('Showing link icon');
          return <LinkIcon {...iconProps} />;
        }
        if (fileDetails?.file?.toLowerCase().endsWith('.pdf')) {
          console.log('Showing PDF icon');
          return <PictureAsPdfIcon {...iconProps} />;
        }
        console.log('Showing text icon');
        return <ArticleIcon {...iconProps} />;
      case 'IMAGE':
        console.log('Showing image icon');
        return <ImageIcon {...iconProps} />;
      default:
        console.log('Showing default icon');
        return <DescriptionIcon {...iconProps} />;
    }
  };

  const renderContentByType = () => {
    const mediaType = content.media_type?.toUpperCase();
    const fileUrl = getFileUrlFromContent();

    switch (mediaType) {
      case 'IMAGE':
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            maxHeight: maxImageHeight,
            overflow: 'hidden'
          }}>
            <img 
              src={fileUrl} 
              alt={content.selected_profile?.title || content.original_title}
              style={{ 
                maxWidth: '100%',
                maxHeight: maxImageHeight,
                objectFit: 'contain'
              }}
            />
          </Box>
        );
      case 'VIDEO':
        return (
          <Box sx={{ width: '100%', maxWidth: '800px', mx: 'auto' }}>
            <video 
              controls 
              style={{ width: '100%' }}
              src={fileUrl}
            >
              Your browser does not support the video tag.
            </video>
          </Box>
        );
      case 'AUDIO':
        return (
          <Box sx={{ width: '100%', maxWidth: '600px', mx: 'auto' }}>
            <audio 
              controls 
              style={{ width: '100%' }}
              src={fileUrl}
            >
              Your browser does not support the audio tag.
            </audio>
          </Box>
        );
      case 'TEXT':
        return content.file_details?.extracted_text ? (
          <Box sx={{ 
            width: '100%',
            maxWidth: '800px',
            mx: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {content.file_details.extracted_text}
          </Box>
        ) : null;
      default:
        return (
          <Typography color="text.secondary">
            Unsupported media type: {mediaType}
          </Typography>
        );
    }
  };

  const renderContent = () => {
    try {
      if (renderError) {
        return (
          <Typography color="error" align="center" sx={{ p: 2 }}>
            {renderError}
          </Typography>
        );
      }

      // For simple variant, render a simplified view
      if (variant === 'simple') {
        return (
          <Box sx={{ 
            p: 1, 
            '&:hover': { bgcolor: 'action.hover' },
            cursor: onClick ? 'pointer' : 'default',
            borderRadius: 1
          }} 
          onClick={onClick}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'background.default'
            }}>
              {getMediaTypeIcon(content)}
            </Box>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="subtitle1" noWrap>
                {title}
              </Typography>
              {showAuthor && author && (
                <Typography variant="body2" color="text.secondary" noWrap>
                  By {author}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
        );
      }
      
      const contentBody = (
        <>
          {renderContentByType()}
          <Box sx={{ mt: variant === 'card' ? 0 : 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {/* Show title and author for all variants except when TEXT type is in detailed view */}
              {(!content.media_type || content.media_type.toUpperCase() !== 'TEXT' || variant !== 'detailed') && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {getMediaTypeIcon(content)}
                    <Typography variant={variant === 'card' ? 'h6' : 'body1'}>
                      {title}
                    </Typography>
                  </Box>
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
                </Box>
              )}
            </Box>
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
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: onClick ? 'pointer' : 'default'
              }}
              onClick={onClick}
            >
              <CardMedia
                component="div"
                sx={{
                  height: 140,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.paper'
                }}
              >
                {getMediaTypeIcon(content)}
              </CardMedia>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h6" component="div">
                  {content.selected_profile?.title || content.original_title}
                </Typography>
                {showAuthor && content.selected_profile?.author && (
                  <Typography variant="body2" color="text.secondary">
                    By {content.selected_profile.author}
                  </Typography>
                )}
                {content.selected_profile?.personal_note && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    {content.selected_profile.personal_note}
                  </Typography>
                )}
              </CardContent>
              {showActions && (
                <CardActions>
                  {onEdit && (
                    <Button size="small" onClick={onEdit}>
                      Edit
                    </Button>
                  )}
                  {onRemove && (
                    <Button size="small" color="error" onClick={onRemove}>
                      Remove
                    </Button>
                  )}
                  {additionalActions}
                </CardActions>
              )}
            </Card>
          );

        case 'detailed':
          return (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  {title}
                </Typography>
                {showAuthor && author && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    By {author}
                  </Typography>
                )}
              </Box>
              {renderContentByType()}
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
            </Paper>
          );

        case 'preview':
        case 'simple':
        default:
          const fileUrl = getFileUrlFromContent();
          return (
            <Box 
              onClick={onClick} 
              sx={{ 
                cursor: onClick ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1,
                '&:hover': {
                  backgroundColor: 'action.hover',
                  borderRadius: 1
                }
              }}
            >
              <Box sx={{ 
                width: 60, 
                height: 60, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: 'background.paper',
                borderRadius: 1,
                overflow: 'hidden'
              }}>
                {content.media_type === 'IMAGE' && fileUrl ? (
                  <img
                    src={fileUrl}
                    alt={title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      console.error('❌ Image failed to load:', fileUrl);
                      e.target.src = '/placeholder-image.png';
                      e.target.onerror = null;
                    }}
                  />
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%'
                  }}>
                    {content.media_type === 'VIDEO' && <VideocamIcon sx={{ fontSize: 30, color: 'primary.main' }} />}
                    {content.media_type === 'AUDIO' && <AudiotrackIcon sx={{ fontSize: 30, color: 'primary.main' }} />}
                    {content.media_type === 'TEXT' && <ArticleIcon sx={{ fontSize: 30, color: 'primary.main' }} />}
                  </Box>
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                  variant="subtitle1" 
                  noWrap
                  sx={{ 
                    fontWeight: 'medium',
                    color: 'text.primary'
                  }}
                >
                  {title}
                </Typography>
                {showAuthor && author && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    noWrap
                  >
                    By {author}
                  </Typography>
                )}
              </Box>
            </Box>
          );
      }
    } catch (error) {
      console.error('Error in renderContent:', error);
      return (
        <Typography color="error" align="center" sx={{ p: 2 }}>
          Error rendering content: {error.message}
        </Typography>
      );
    }
  };

  try {
    return renderContent();
  } catch (error) {
    console.error('Fatal error in ContentDisplay:', error);
    return (
      <Typography color="error" align="center" sx={{ p: 2 }}>
        Error displaying content: {error.message}
      </Typography>
    );
  }
};

export default ContentDisplay; 