import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Button, 
  Box, 
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import contentApi from '../api/contentApi';
import ContentDisplay from './ContentDisplay';

// Uses ContentDisplay simple mode with SimpleContentProfileSerializer for consistent display
const ContentSearchModal = ({ isOpen, onClose, onSelectContent, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [userContent, setUserContent] = useState([]);
  const [filteredContent, setFilteredContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserContent = async () => {
      try {
        const content = await contentApi.getUserContent();
        console.log('Fetched user content:', content);
        setUserContent(content);
        setFilteredContent(content);
      } catch (err) {
        console.error('Error fetching content:', err);
        setError('Error al cargar el contenido');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchUserContent();
    }
  }, [isOpen]);

  useEffect(() => {
    const filtered = userContent.filter(contentProfile =>
      (contentProfile.content?.original_title || contentProfile.title || 'Untitled').toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredContent(filtered);
  }, [searchTerm, userContent]);

  const handleSelectContent = (contentProfile) => {
    console.log('Selected content profile in modal:', contentProfile);
    onSelectContent(contentProfile);
    onClose();
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={!isLoading ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h6">
          Seleccionar contenido de tu biblioteca
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* Search Input */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Buscar contenido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            variant="outlined"
            size="small"
          />
        </Box>

        {/* Content List */}
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : filteredContent.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No se encontró contenido
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredContent.map((contentProfile) => {
                const content = contentProfile.content;
                if (!content) return null;

                return (
                  <Box
                    key={contentProfile.id}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 0.5,
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 1
                      },
                      cursor: !isLoading ? 'pointer' : 'not-allowed',
                      opacity: isLoading ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                    onClick={!isLoading ? () => handleSelectContent(contentProfile) : undefined}
                  >
                    <ContentDisplay
                      content={contentProfile.content}
                      variant="simple"
                      showAuthor={false}
                      onClick={() => handleSelectContent(contentProfile)}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        {isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Agregando contenido...
            </Typography>
          </Box>
        ) : (
          <Button onClick={onClose} color="inherit">
            Cancelar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ContentSearchModal; 