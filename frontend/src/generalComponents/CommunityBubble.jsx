import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Collapse,
  IconButton,
  Paper,
  Typography,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useThemeMode } from '../context/ThemeContext.jsx';

const BUBBLE_TEXT = `Academia Blockchain es un proyecto comunitario. Puedes sugerir contenido para temas.

Crear caminos del conocimiento.
Crear Temas.
Compartir tu Biblioteca.`;

const CommunityBubble = () => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const theme = useTheme();
  const { mode } = useThemeMode();

  const toggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'fixed',
        right: { xs: 16, sm: 24 },
        bottom: { xs: 16, sm: 24 },
        zIndex: (t) => t.zIndex.tooltip + 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 1,
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <Collapse in={open} orientation="vertical" collapsedSize={0}>
        <Paper
          id="community-bubble-panel"
          elevation={8}
          role="dialog"
          aria-label="Mensaje de la comunidad"
          sx={{
            maxWidth: 320,
            p: 2,
            pr: 5,
            position: 'relative',
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <IconButton
            size="small"
            onClick={close}
            aria-label="Cerrar"
            sx={{ position: 'absolute', top: 4, right: 4 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-line',
              lineHeight: 1.6,
              color: 'text.primary',
            }}
          >
            {BUBBLE_TEXT}
          </Typography>
        </Paper>
      </Collapse>

      <Box
        component="button"
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="community-bubble-panel"
        aria-label="Información del proyecto comunitario"
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          p: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
          boxShadow: theme.palette.mode === 'dark' ? 4 : 6,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'divider',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            transform: 'scale(1.05)',
            boxShadow: theme.palette.mode === 'dark' ? 6 : 8,
          },
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }}
      >
        {mode === 'light' ? (
          <Box
            component="img"
            src="/images/logo.png"
            alt="Logo Academia Blockchain"
            sx={{ height: 32, width: 'auto', display: 'block' }}
          />
        ) : (
          <Typography
            component="span"
            sx={{
              fontWeight: 700,
              fontSize: '0.95rem',
              letterSpacing: '-0.02em',
              color: 'primary.main',
              fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
            }}
          >
            AB
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default CommunityBubble;
