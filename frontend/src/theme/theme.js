import { createTheme } from '@mui/material/styles';

/**
 * Create theme configuration based on mode (light/dark)
 */
const createThemeConfig = (mode) => ({
  typography: {
    fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    h1: {
      fontSize: '3.2em',
      fontWeight: 400,
      lineHeight: 1.1,
    },
    h2: {
      fontSize: '2.4em',
      fontWeight: 400,
      lineHeight: 1.2,
    },
    h3: {
      fontSize: '2em',
      fontWeight: 400,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '24px',
      fontWeight: 400,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '20px',
      fontWeight: 400,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '18px',
      fontWeight: 400,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.4,
    },
    button: {
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  palette: {
    mode,
    primary: {
      main: '#646cff',
    },
    secondary: {
      main: '#535bf2',
    },
    ...(mode === 'dark'
      ? {
          // Dark mode palette - comfortable colors for eyes
          text: {
            primary: '#E0E0E0', // Off-white, easier on eyes than pure white
            secondary: '#B0B0B0', // Softer gray for secondary text
          },
          background: {
            default: '#121212', // Very dark gray (not pure black)
            paper: '#1E1E1E', // Slightly lighter for cards/surfaces
          },
        }
      : {
          // Light mode palette
          text: {
            primary: '#213547',
            secondary: 'rgba(0, 0, 0, 0.6)',
          },
          background: {
            default: '#ffffff',
            paper: '#ffffff',
          },
        }),
  },
  spacing: 8,
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiTypography: {
      defaultProps: {
        color: 'text.primary',
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          ...(mode === 'dark'
            ? {
                color: '#E0E0E0', // Off-white for better eye comfort
                '& input': {
                  color: '#E0E0E0',
                },
                '& textarea': {
                  color: '#E0E0E0',
                },
                '&::placeholder': {
                  color: 'rgba(176, 176, 176, 0.6)', // Softer placeholder
                  opacity: 1,
                },
              }
            : {
                color: '#213547',
                '& input': {
                  color: '#213547',
                },
                '& textarea': {
                  color: '#213547',
                },
              }),
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          ...(mode === 'dark'
            ? {
                '& .MuiInputBase-input': {
                  color: '#E0E0E0', // Off-white for better eye comfort
                },
                '& .MuiInputBase-input::placeholder': {
                  color: 'rgba(176, 176, 176, 0.6)', // Softer placeholder
                  opacity: 1,
                },
                '& .MuiInputLabel-root': {
                  color: '#B0B0B0', // Secondary text color for labels
                },
              }
            : {
                '& .MuiInputBase-input': {
                  color: '#213547',
                },
                '& .MuiInputBase-input::placeholder': {
                  color: 'rgba(33, 53, 71, 0.5)',
                  opacity: 1,
                },
              }),
        },
      },
    },
  },
});

/**
 * Export theme configuration function
 */
export default createThemeConfig;


