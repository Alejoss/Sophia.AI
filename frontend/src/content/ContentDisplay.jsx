import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Card, CardContent, CardMedia, Button, Chip, Stack } from '@mui/material';
import { getFileUrl } from '../utils/fileUtils';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ArticleIcon from '@mui/icons-material/Article';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VideocamIcon from '@mui/icons-material/Videocam';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';

// Track render count to detect potential infinite loops
let renderCount = 0;

const ContentDisplay = ({ 
  content,
  variant = 'simple', // 'simple', 'detailed', 'card', 'preview'
  showActions = false,
  onRemove,
  onEdit,
  onClick,
  maxImageHeight = 300,
  showAuthor = true,
  additionalActions
}) => {
  const [renderError, setRenderError] = useState(null);
  
  // Track render count
  renderCount++;
  
  useEffect(() => {
    console.log(`🖼️ ContentDisplay mounted/updated #${renderCount}`);
    
    // Log the content structure
    console.log('Content passed to ContentDisplay:', content);
    
    // Reset render count when content changes
    return () => {
      console.log('🧹 ContentDisplay unmounting');
    };
  }, [content]);

  if (!content) {
    console.warn('⚠️ ContentDisplay received null/undefined content');
    return null;
  }

  // Get appropriate data from either content or content_profile
  const profile = content.selected_profile || content;
  const title = profile.title || content.original_title || 'Untitled';
  const author = profile.author || content.original_author;
  const mediaType = content.media_type || '';
  const fileDetails = content.file_details;

  console.log('📦 ContentDisplay processing:', { 
    contentId: content.id,
    title, 
    mediaType, 
    hasFileDetails: !!fileDetails,
    fileDetailsData: fileDetails,
    hasUrl: !!content.url,
    variant
  });

  // Standardized way to get file URL from different possible structures
  const getFileUrlFromContent = () => {
    try {
      if (!fileDetails) {
        console.warn('⚠️ No fileDetails available');
        
        // If direct URL is available on content, use that
        if (content.url) {
          console.log('Using content.url instead:', content.url);
          return content.url;
        }
        
        return null;
      }
      
      // If URL is directly available on fileDetails
      if (fileDetails.url) {
        console.log('Using fileDetails.url:', fileDetails.url);
        return fileDetails.url;
      }
      
      // If file property is available (used in some components)
      if (fileDetails.file) {
        // If file is a string, use it directly
        if (typeof fileDetails.file === 'string') {
          console.log('Using fileDetails.file string:', fileDetails.file);
          return fileDetails.file;
        }
        
        const url = getFileUrl(fileDetails.file);
        console.log('Using fileDetails.file converted to URL:', url);
        return url;
      }
      
      // If the URL was passed directly in the content object
      if (content.url) {
        console.log('Using content.url as fallback:', content.url);
        return content.url;
      }
      
      console.warn('⚠️ No valid URL found in content');
      return null;
    } catch (error) {
      console.error('Error getting file URL:', error);
      setRenderError(`Error getting file URL: ${error.message}`);
      return null;
    }
  };

  const renderContentByType = () => {
    try {
      if (!fileDetails && !content.url) {
        console.warn('⚠️ No file details or URL available');
        return (
          <Typography color="text.secondary">
            No file details available
          </Typography>
        );
      }

      const fileUrl = getFileUrlFromContent();
      if (!fileUrl) {
        console.warn('⚠️ File URL not available');
        return (
          <Typography color="text.secondary">
            File URL not available
          </Typography>
        );
      }
      
      // Normalize media type for case-insensitive comparison
      const normalizedMediaType = mediaType.toUpperCase();
      console.log('🎯 Rendering content type:', normalizedMediaType, 'with URL:', fileUrl);

      switch (normalizedMediaType) {
        case 'IMAGE':
          console.log('🖼️ Rendering IMAGE content with URL:', fileUrl);
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
                    console.error('❌ Image failed to load:', fileUrl);
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
                    console.error('❌ Image failed to load:', fileUrl);
                    e.target.src = '/placeholder-image.png';
                    e.target.onerror = null;
                  }}
                />
              )}
            </Box>
          );

        case 'TEXT':
          // Determine the appropriate icon based on file extension
          let fileIcon = <ArticleIcon sx={{ fontSize: 40, color: 'primary.main' }} />;
          let fileType = 'Text Document';
          
          if (fileUrl) {
            if (fileUrl.toLowerCase().endsWith('.pdf')) {
              fileIcon = <PictureAsPdfIcon sx={{ fontSize: 40, color: 'error.main' }} />;
              fileType = 'PDF Document';
            } else if (fileUrl.toLowerCase().endsWith('.doc') || fileUrl.toLowerCase().endsWith('.docx')) {
              fileIcon = <DescriptionIcon sx={{ fontSize: 40, color: 'primary.main' }} />;
              fileType = 'Word Document';
            }
          }
          
          return (
            <Box sx={{ my: 2 }}>
              {fileDetails?.text ? (
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
                  {fileDetails.text}
                </Typography>
              ) : fileUrl ? (
                <Paper 
                  variant="outlined"
                  sx={{ 
                    p: 2, 
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    borderRadius: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: onClick ? 'pointer' : 'default'
                  }}
                  onClick={onClick ? onClick : undefined}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 2 }}>
                    {fileIcon}
                    <Box sx={{ ml: 2, flexGrow: 1 }}>
                      <Typography variant="h6" component="div">
                        {title}
                      </Typography>
                      {author && (
                        <Typography variant="body2" color="text.secondary">
                          By {author}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {fileType}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Button
                    variant="contained"
                    color="primary"
                    href={fileUrl}
                    target="_blank"
                    endIcon={<OpenInNewIcon />}
                    onClick={(e) => {
                      // Prevent the parent onClick from firing when clicking the button
                      if (onClick) e.stopPropagation();
                    }}
                  >
                    View Document
                  </Button>
                </Paper>
              ) : (
                <Typography color="text.secondary">
                  No content available
                </Typography>
              )}
            </Box>
          );

        case 'VIDEO':
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
                <Box sx={{ width: '100%' }}>
                  <video
                    controls
                    style={{
                      maxWidth: '100%',
                      height: 'auto'
                    }}
                    onError={(e) => {
                      console.error('❌ Video playback error:', e);
                      e.target.parentNode.innerHTML = 'Error loading video. Format may not be supported.';
                    }}
                  >
                    <source src={fileUrl} type="video/mp4" />
                    <source src={fileUrl} type="video/webm" />
                    <source src={fileUrl} type="video/ogg" />
                    Your browser does not support the video tag.
                  </video>
                </Box>
              )}
            </Box>
          );

        case 'AUDIO':
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
                onError={(e) => {
                  console.error('❌ Audio playback error:', e);
                  e.target.parentNode.innerHTML = 'Error loading audio. Format may not be supported.';
                }}
              >
                <source src={fileUrl} type="audio/mpeg" />
                <source src={fileUrl} type="audio/ogg" />
                <source src={fileUrl} type="audio/wav" />
                Your browser does not support the audio element.
              </audio>
            </Box>
          );

        default:
          console.warn('⚠️ Unknown media type:', mediaType);
          return (
            <Typography color="text.secondary">
              Content preview not available for type: {mediaType || 'Unknown'}
            </Typography>
          );
      }
    } catch (error) {
      console.error('Error rendering content by type:', error);
      setRenderError(`Error rendering content: ${error.message}`);
      return (
        <Typography color="error">
          Error rendering content: {error.message}
        </Typography>
      );
    }
  };

  const renderContent = () => {
    try {
      console.log('🔍 Rendering content with variant:', variant);
      
      if (renderError) {
        return (
          <Typography color="error" align="center" sx={{ p: 2 }}>
            {renderError}
          </Typography>
        );
      }
      
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
      console.error('❌ Error in renderContent:', error);
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
    console.error('❌ Fatal error in ContentDisplay:', error);
    return (
      <Typography color="error" align="center" sx={{ p: 2 }}>
        Error displaying content: {error.message}
      </Typography>
    );
  }
};

export default ContentDisplay; 