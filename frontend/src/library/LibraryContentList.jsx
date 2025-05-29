import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Grid, CircularProgress, Card, CardMedia, CardContent, IconButton, Menu, MenuItem } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import contentApi from '../api/contentApi';
import { getFileUrl } from '../utils/fileUtils';
import { createContentDetailUrl, CONTEXT_TYPES } from '../utils/urlUtils';

const LibraryContentList = () => {
  // ... existing code ...

  return (
    <Card>
      <CardMedia
        component="img"
        height="140"
        image={getFileUrl(content.thumbnail_url)}
        alt={content.display_title || "Untitled"}
      />
      <CardContent>
        <Typography gutterBottom variant="h6" component="div">
          {content.display_title || "Untitled"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {content.description?.substring(0, 100)}
          {content.description?.length > 100 ? '...' : ''}
        </Typography>
        <Button 
          component={Link} 
          to={createContentDetailUrl(content.id, CONTEXT_TYPES.LIBRARY, libraryId)} 
          variant="contained" 
          size="small"
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
};

export default LibraryContentList; 