import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import '../styles/home.css';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent, 
  useTheme,
  useMediaQuery
} from "@mui/material";
import { 
  School as SchoolIcon, 
  Work as WorkIcon, 
  Person as PersonIcon,
  Groups as GroupsIcon,
  ArrowForward as ArrowForwardIcon
} from "@mui/icons-material";
import { AuthContext } from "../context/AuthContext.jsx";
import { getUserFromLocalStorage } from "../context/localStorageUtils.js";

const Home = () => {
  const navigate = useNavigate();
  const { authState, authInitialized } = React.useContext(AuthContext);
  const storedUser = getUserFromLocalStorage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    if (!authInitialized) return;

    // If user is already authenticated, redirect to profile page
    if (authState.isAuthenticated) {
      navigate("/profiles/my_profile");
      return;
    }

    // If there is evidence of a past login (stored user but not authenticated), redirect to login
    if (storedUser) {
      navigate("/profiles/login");
      return;
    }
  }, [authInitialized, authState.isAuthenticated, storedUser, navigate]);


  // Show home page only for new users (no authentication, no stored user)
  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: 'background.default',
      pt: 0, // Hero section compensates for .main-content padding
      pb: 0,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Hero Section - Full Width */}
      <Box className="home-hero-section">
        {/* Background Image Layer */}
        <Box className="home-hero-background" />
        {/* Overlay for better text contrast */}
        <Box className="home-hero-overlay" />
        {/* Content Container - Centered */}
        <Container maxWidth="lg">
          <Box className="home-hero-content">
            <Typography 
              variant="h1" 
              component="h1"
              sx={{ 
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' },
                fontWeight: 600,
                mb: 3,
                color: 'text.primary',
                lineHeight: 1.2
              }}
            >
              El Conocimiento es Poder
            </Typography>
            
            <Typography 
              variant="h5" 
              component="p"
              sx={{ 
                fontSize: { xs: '1.1rem', md: '1.5rem' },
                color: 'text.secondary',
                mb: 4,
                maxWidth: '800px',
                mx: 'auto',
                lineHeight: 1.6
              }}
            >
              Aprende desde la autonomía. 
              Explora temas creados por la comunidad y construye tu propia red de aprendizaje.
            </Typography>

            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate("/profiles/register")}
              sx={{
                bgcolor: '#FF6B35', // Naranja de marca
                color: 'white',
                px: 4,
                py: 1.5,
                fontSize: { xs: '1rem', md: '1.1rem' },
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': {
                  bgcolor: '#E55A2B',
                  transform: 'translateY(-2px)',
                  boxShadow: 4
                },
                transition: 'all 0.3s ease'
              }}
            >
              Comenzar
            </Button>

            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                ¿Ya tienes cuenta?{' '}
                <Link 
                  to="/profiles/login" 
                  style={{ 
                    color: '#FF6B35', 
                    textDecoration: 'none',
                    fontWeight: 500
                  }}
                >
                  Inicia sesión
                </Link>
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Qué es Academia Blockchain */}
      <Container maxWidth="lg">
        <Box sx={{ 
          pt: { xs: 4, md: 8 }, // Add padding-top here to maintain spacing after hero
          mb: { xs: 6, md: 8 },
          px: { xs: 2, md: 0 }
        }}>
          <Typography 
            variant="h2" 
            component="h2"
            sx={{ 
              fontSize: { xs: '1.75rem', md: '2.5rem' },
              fontWeight: 600,
              mb: 4,
              textAlign: 'center',
              color: 'text.primary'
            }}
          >
            ¿Qué es Academia Blockchain?
          </Typography>
          
          <Box sx={{ maxWidth: '900px', mx: 'auto' }}>
            <Typography 
              variant="body1" 
              sx={{ 
                fontSize: { xs: '1rem', md: '1.125rem' },
                color: 'text.secondary',
                mb: 3,
                lineHeight: 1.8
              }}
            >
              Academia Blockchain es más que una plataforma: es un territorio intelectual donde el conocimiento es un bien común, no un recurso secuestrado por instituciones, algoritmos o intereses económicos. No somos una academia de trading ni una criptomoneda. Somos un espacio donde la comunidad enlaza saberes, los reorganiza y los libera, como lo hacía el espíritu original de internet.
            </Typography>
            
            <Typography 
              variant="body1" 
              sx={{ 
                fontSize: { xs: '1rem', md: '1.125rem' },
                color: 'text.secondary',
                mb: 3,
                lineHeight: 1.8
              }}
            >
              Surgimos frente a una realidad incómoda: la arquitectura del conocimiento moderno está a la merced de la censura, la manipulación y la concentración del poder. El buscador y la IA que deberían abrir puertas en realidad deciden qué mostrar; la universidad, que debería iluminar, se ha convertido en un club elitista; las revistas científicas, que deberían custodiar la verdad, a menudo se someten a intereses políticos o económicos. En ese ruido, lo esencial se pierde: la capacidad de aprender sin intermediarios, de explorar sin permiso, de saber sin filtros.
            </Typography>
            
            <Typography 
              variant="body1" 
              sx={{ 
                fontSize: { xs: '1rem', md: '1.125rem' },
                color: 'text.secondary',
                lineHeight: 1.8
              }}
            >
              En Academia Blockchain, las ideas se conectan entre sí de forma colaborativa mediante caminos del conocimiento creados por la comunidad y temas. Los contenidos podrán relacionarse, descargarse, organizarse y preservarse gracias al uso de tecnologías como IPFS y blockchain, que iremos implementando gradualmente a medida que avance el desarrollo. Éstas garantizarán permanencia, resistencia a la censura y un ecosistema educativo abierto.
            </Typography>
          </Box>
        </Box>
      </Container>

          {/* Para quién es */}
          <Container maxWidth="lg">
            <Box sx={{ 
              mb: { xs: 6, md: 8 },
              px: { xs: 2, md: 0 }
            }}>
          <Typography 
            variant="h2" 
            component="h2"
            sx={{ 
              fontSize: { xs: '1.75rem', md: '2.5rem' },
              fontWeight: 600,
              mb: 4,
              textAlign: 'center',
              color: 'text.primary'
            }}
          >
            Para quién es
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                height: '100%',
                textAlign: 'center',
                p: 3,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-4px)'
                }
              }}>
                <SchoolIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Estudiantes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Buscas libertad en tu aprendizaje, sin estructuras rígidas.
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                height: '100%',
                textAlign: 'center',
                p: 3,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-4px)'
                }
              }}>
                <WorkIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Investigadores
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Buscas expandir tu conocimiento y valoras el aprendizaje autónomo.
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                height: '100%',
                textAlign: 'center',
                p: 3,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-4px)'
                }
              }}>
                <PersonIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Educadores
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Deseas compartir conocimiento y aportar en una comunidad de investigación.
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                height: '100%',
                textAlign: 'center',
                p: 3,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-4px)'
                }
              }}>
                <GroupsIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Comunidad
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  La conversación abierta y los archivos descentralizados nos protegen de la censura.
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>

      {/* Sección de Imagen con Texto Superpuesto */}
      <Container maxWidth="lg">
        <Box sx={{ 
          mb: { xs: 4, md: 6 },
          px: { xs: 2, md: 0 },
          position: 'relative'
        }}>
          {/* Imagen de fondo */}
          <Box
            component="img"
            src="/images/home_image.png"
            alt="Academia Blockchain"
            sx={{
              width: '100%',
              height: 'auto',
              maxWidth: '100%',
              borderRadius: 2,
              objectFit: 'contain',
              display: 'block'
            }}
          />
          
          {/* Texto superpuesto */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: { xs: 3, md: 6 },
              py: { xs: 4, md: 6 },
              borderRadius: 2,
              background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.75))',
              backdropFilter: 'blur(2px)'
            }}
          >
            {/* Primera sección de texto */}
            <Box sx={{ 
              textAlign: 'center',
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              maxWidth: '800px'
            }}>
              <Typography 
                variant="h2" 
                component="h2"
                sx={{ 
                  fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.25rem' },
                  fontWeight: 600,
                  mb: { xs: 1, md: 1.5 },
                  textAlign: 'center',
                  color: 'text.primary'
                }}
              >
                Descubre temas creados por la comunidad
              </Typography>
              
              <Typography 
                variant="body1" 
                color="text.secondary"
                sx={{ 
                  textAlign: 'center', 
                  maxWidth: '700px',
                  mx: 'auto',
                  fontSize: { xs: '0.875rem', md: '1rem' },
                  lineHeight: 1.6
                }}
              >
                Explora contenido organizado por temas de interés, donde cada tema es moderado y enriquecido por la comunidad.
              </Typography>
            </Box>

            {/* Botón Entrar */}
            <Box sx={{ 
              my: { xs: 2, md: 3 },
              flex: '0 0 auto'
            }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate("/profiles/register")}
                sx={{
                  bgcolor: '#FF6B35',
                  color: 'white',
                  px: { xs: 4, md: 6 },
                  py: { xs: 1.5, md: 2 },
                  fontSize: { xs: '1rem', md: '1.125rem' },
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: '#E55A2B',
                    transform: 'translateY(-2px)',
                    boxShadow: 4
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Entrar
              </Button>
            </Box>

            {/* Segunda sección de texto */}
            <Box sx={{ 
              textAlign: 'center',
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              maxWidth: '800px'
            }}>
              <Typography 
                variant="h2" 
                component="h2"
                sx={{ 
                  fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.25rem' },
                  fontWeight: 600,
                  mb: { xs: 1, md: 1.5 },
                  textAlign: 'center',
                  color: 'text.primary'
                }}
              >
                Explora rutas de aprendizaje estructuradas
              </Typography>
              
              <Typography 
                variant="body1" 
                color="text.secondary"
                sx={{ 
                  textAlign: 'center', 
                  maxWidth: '700px',
                  mx: 'auto',
                  fontSize: { xs: '0.875rem', md: '1rem' },
                  lineHeight: 1.6
                }}
              >
                Los caminos del conocimiento te guían paso a paso a través de una secuencia de contenido diseñada para construir comprensión progresiva.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* Footer */}
      <Box sx={{ 
        mt: { xs: 2, md: 3 },
        py: { xs: 2.5, md: 3 },
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}>
        <Container maxWidth="lg">
          <Box sx={{ 
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
            px: { xs: 2, md: 0 }
          }}>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ textAlign: { xs: 'center', sm: 'left' } }}
            >
              Síguenos en las redes sociales de Academia Blockchain
            </Typography>
            <Box sx={{ 
              display: 'flex',
              gap: 3,
              flexWrap: 'wrap',
              justifyContent: { xs: 'center', sm: 'flex-end' }
            }}>
              <Typography 
                variant="body2" 
                component="a"
                href="https://www.youtube.com/@AcademiaBlockchain"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': { color: '#FF6B35' }
                }}
              >
                YouTube
              </Typography>
              <Typography 
                variant="body2" 
                component="a"
                href="https://www.facebook.com/AcademiaBlockchain/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': { color: '#FF6B35' }
                }}
              >
                Facebook
              </Typography>
              <Typography 
                variant="body2" 
                component="a"
                href="https://x.com/aca_blockchain"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': { color: '#FF6B35' }
                }}
              >
                X
              </Typography>
              <Typography 
                variant="body2" 
                component="a"
                href="https://www.instagram.com/aca_blockchain/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': { color: '#FF6B35' }
                }}
              >
                Instagram
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;
