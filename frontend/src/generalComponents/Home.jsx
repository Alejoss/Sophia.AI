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
  Link as MuiLink,
  useTheme,
  useMediaQuery
} from "@mui/material";
import { 
  School as SchoolIcon, 
  Work as WorkIcon, 
  Person as PersonIcon,
  Groups as GroupsIcon,
  ArrowForward as ArrowForwardIcon,
  Build as BuildIcon,
  Lock as LockIcon,
  OpenInNew as OpenInNewIcon,
  CurrencyBitcoin as CurrencyBitcoinIcon,
  Folder as FolderIcon,
  Hub as HubIcon,
} from "@mui/icons-material";
import { AuthContext } from "../context/AuthContext.jsx";
import { getUserFromLocalStorage } from "../context/localStorageUtils.js";

const GITHUB_URL = "https://github.com/Alejoss/Sophia.AI";

const Home = () => {
  const navigate = useNavigate();
  const { authState, authInitialized } = React.useContext(AuthContext);
  const storedUser = getUserFromLocalStorage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isAuthenticated = authState?.isAuthenticated ?? false;

  useEffect(() => {
    if (!authInitialized) return;
    // If there is evidence of a past login (stored user but not authenticated), redirect to login
    if (!isAuthenticated && storedUser) {
      navigate("/profiles/login");
      return;
    }
  }, [authInitialized, isAuthenticated, storedUser, navigate]);

  // Authenticated home: project info, collaborative, open source, blockchain status, GitHub
  if (authInitialized && isAuthenticated) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        bgcolor: 'background.default',
        pt: 0,
        pb: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box className="home-hero-section">
          <Box className="home-hero-background home-hero-background-authenticated" />
          <Box className="home-hero-overlay home-hero-overlay-authenticated" />
          <Box sx={{ position: 'absolute', top: { xs: 80, md: 88 }, right: { xs: 24, md: 40 }, zIndex: 3 }}>
            <Button
              variant="outlined"
              size="medium"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate("/profiles/my_profile")}
              sx={{
                borderColor: 'rgba(0,0,0,0.23)',
                color: 'text.secondary',
                px: 3,
                py: 1.25,
                fontSize: { xs: '0.9375rem', md: '1rem' },
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.9)',
                '&:hover': {
                  borderColor: '#FF6B35',
                  color: '#FF6B35',
                  bgcolor: 'rgba(255,255,255,0.95)',
                  boxShadow: 1
                },
                transition: 'all 0.2s ease'
              }}
            >
              Ir a mi perfil
            </Button>
          </Box>
          <Container maxWidth="lg">
            <Box className="home-hero-content">
              <Box
                sx={{
                  px: { xs: 2, md: 4 },
                  py: { xs: 2.5, md: 3 },
                  mx: 'auto',
                  maxWidth: 720,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.77)',
                  boxShadow: 2,
                }}
              >
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
                  Academia Blockchain
                </Typography>
                <Typography 
                  variant="h5" 
                  component="p"
                  sx={{ 
                    fontSize: { xs: '1.1rem', md: '1.5rem' },
                    color: 'text.secondary',
                    mb: 0,
                    maxWidth: '800px',
                    mx: 'auto',
                    lineHeight: 1.6
                  }}
                >
                  Este proyecto está en construcción y se nutre de la comunidad. Aquí encontrarás información sobre el estado del proyecto y cómo participar.
                </Typography>
              </Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box sx={{ pt: { xs: 4, md: 8 }, mb: { xs: 6, md: 8 }, px: { xs: 2, md: 0 } }}>
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
              Un proyecto en construcción y colaborativo
            </Typography>
            <Box sx={{ maxWidth: '900px', mx: 'auto' }}>
              <Typography variant="body1" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' }, color: 'text.secondary', mb: 3, lineHeight: 1.8 }}>
                Academia Blockchain avanza gracias a la participación de la comunidad. Las funcionalidades que ves hoy se irán ampliando con el tiempo; tu uso, feedback y aportes son parte de ese proceso.
              </Typography>
              <Typography variant="body1" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' }, color: 'text.secondary', lineHeight: 1.8 }}>
                Si eres programador o programadora, puedes contribuir directamente al código: el proyecto es de código abierto. En el{' '}
                <MuiLink href={GITHUB_URL} target="_blank" rel="noopener noreferrer" color="primary" sx={{ fontWeight: 500 }}>
                  repositorio de GitHub
                </MuiLink>
                {' '}encontrarás el roadmap, issues y la documentación para sumarte al desarrollo.
              </Typography>
            </Box>
          </Box>
        </Container>

        <Container maxWidth="lg">
          <Box sx={{ mb: { xs: 6, md: 8 }, px: { xs: 2, md: 0 } }}>
            <Typography 
              variant="h2" 
              component="h2"
              sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' }, fontWeight: 600, mb: 4, textAlign: 'center', color: 'text.primary' }}
            >
              Roadmap en Ideas
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={6}>
                <Card sx={{ height: '100%', textAlign: 'center', p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, transition: 'all 0.3s ease', '&:hover': { boxShadow: 4, transform: 'translateY(-4px)' } }}>
                  <CurrencyBitcoinIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Pagos</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                    Habilitaremos pagos con criptomonedas para cursos, eventos y caminos del conocimiento. Esto habilitará un acto de profunda resistencia: generar intercambios fuera de la economía fiat. Sin embargo, esta funcionalidad depende de ciertos aspectos regulatorios, y en mi país está prohibido usar criptos como medio de pago. Estamos considerando una empresa en El Salvador o en Paraguay, si eres un conocedor del tema por favor contáctanos.
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <Card sx={{ height: '100%', textAlign: 'center', p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, transition: 'all 0.3s ease', '&:hover': { boxShadow: 4, transform: 'translateY(-4px)' } }}>
                  <LockIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Blockchain</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                    Aunque no hemos implementado blockchain para pagos por razones regulatorias, la cadena de bloques es una tecnología que trasciende el uso monetario: El siguiente paso es utilizarla para guardar NFTs, contenido y certificados de educación. Esto será muy valioso en un mundo en el que las noticias falsas amenazan con re escribir el pasado. Un hash en un bloque de Bitcoin nos asegura que "tal documento" existió en ese momento del tiempo.
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <Card sx={{ height: '100%', textAlign: 'center', p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, transition: 'all 0.3s ease', '&:hover': { boxShadow: 4, transform: 'translateY(-4px)' } }}>
                  <FolderIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Archivos</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                    ¿Has notado que las plataformas web más importantes hacen todo lo posible por evitar que tengas acceso al archivo? En Academia Blockchain, siempre que sea posible, los contenidos educativos, documentos y recursos podrán descargarse y guardarse de forma descentralizada. Integraremos tecnologías como IPFS y otras soluciones como FileCoin. Colaborativamente podremos asegurarnos de que un archivo no se borre nunca. 
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <Card sx={{ height: '100%', textAlign: 'center', p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, transition: 'all 0.3s ease', '&:hover': { boxShadow: 4, transform: 'translateY(-4px)' } }}>
                  <HubIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Conexiones</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                    La plataforma conecta temas, caminos del conocimiento y personas. ¿Has visto que cuando scrolleas en una red social, todo el contenido es igual en jerarquía? Es decir, todo importa lo mismo: No hay un camino. El scroll mantiene la superficialidad de una máquina tragamonedas. 
                    Por otro lado, el "buscador" hace lo posible por darte una respuesta autoritaria y ocultarte lo demás. En contraste, la investigación en Academia Blockchain es de código abierto. 
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Container>

        <Box
          sx={{
            position: 'relative',
            width: '100vw',
            left: '50%',
            right: '50%',
            marginLeft: 'calc(-50vw + 1rem)',
            marginRight: 'calc(-50vw + 1rem)',
            minHeight: { xs: 280, md: 320 },
            mb: { xs: 6, md: 8 },
            overflow: 'hidden',
            backgroundImage: 'url(/images/apoyar_proyecto_background.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
              zIndex: 1,
            }}
          />
          <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2, py: { xs: 4, md: 6 } }}>
            <Box
              sx={{
                px: { xs: 2, md: 4 },
                py: { xs: 2.5, md: 3 },
                mx: 'auto',
                maxWidth: 720,
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.77)',
                boxShadow: 2,
              }}
            >
              <Typography variant="h2" component="h2" sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 600, mb: 2, color: 'text.primary' }}>
                Academia Blockchain no es un negocio
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 0, maxWidth: '700px', mx: 'auto', lineHeight: 1.7, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                Los servidores cuestan y los programadores comemos. Es decir, Academia Blockchain debe cubrir sus gastos.
                Sin embargo, sabemos que aceptar ciertos inversionistas que buscan un retorno económico claro nos limitaría a crear un "modelo de negocio" lo más rentable posible. Este no es el mejor lente si queremos ver descentralización.
                {' '}
                Por ello, hay distintas maneras de{' '}
                <MuiLink href={GITHUB_URL} target="_blank" rel="noopener noreferrer" color="primary" sx={{ fontWeight: 500 }}>
                  apoyar al proyecto.
                </MuiLink>
              </Typography>
            </Box>
          </Container>
        </Box>

        <Box sx={{ mt: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3 }, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, px: { xs: 2, md: 0 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'center', sm: 'left' }, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                Síguenos en redes sociales
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-end' } }}>
                <Typography variant="body2" component="a" href="https://www.youtube.com/@AcademiaBlockchain" target="_blank" rel="noopener noreferrer" sx={{ color: 'text.secondary', textDecoration: 'none', fontSize: { xs: '1.1rem', md: '1.5rem' }, '&:hover': { color: '#FF6B35' } }}>YouTube</Typography>
                <Typography variant="body2" component="a" href="https://www.facebook.com/AcademiaBlockchain/" target="_blank" rel="noopener noreferrer" sx={{ color: 'text.secondary', textDecoration: 'none', fontSize: { xs: '1.1rem', md: '1.5rem' }, '&:hover': { color: '#FF6B35' } }}>Facebook</Typography>
                <Typography variant="body2" component="a" href="https://x.com/aca_blockchain" target="_blank" rel="noopener noreferrer" sx={{ color: 'text.secondary', textDecoration: 'none', fontSize: { xs: '1.1rem', md: '1.5rem' }, '&:hover': { color: '#FF6B35' } }}>X</Typography>
                <Typography variant="body2" component="a" href="https://www.instagram.com/aca_blockchain/" target="_blank" rel="noopener noreferrer" sx={{ color: 'text.secondary', textDecoration: 'none', fontSize: { xs: '1.1rem', md: '1.5rem' }, '&:hover': { color: '#FF6B35' } }}>Instagram</Typography>
              </Box>
            </Box>
          </Container>
        </Box>
      </Box>
    );
  }

  // Show home page for non-authenticated users (and while auth is initializing, show landing)
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
            <Box
              sx={{
                px: { xs: 2, md: 4 },
                py: { xs: 2.5, md: 3 },
                mx: 'auto',
                maxWidth: 720,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.77)',
                boxShadow: 2,
              }}
            >
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
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
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
                fontSize: { xs: '1.1rem', md: '1.5rem' },
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
                fontSize: { xs: '1.1rem', md: '1.5rem' },
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
                fontSize: { xs: '1.1rem', md: '1.5rem' },
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
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
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
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
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
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
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
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                  La conversación abierta y los archivos descentralizados nos protegen de la censura.
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>

      {/* Sección de Imagen con Texto Superpuesto */}
      <Box
        sx={{
          position: 'relative',
          width: '100vw',
          left: '50%',
          right: '50%',
          marginLeft: 'calc(-50vw + 1rem)',
          marginRight: 'calc(-50vw + 1rem)',
          mb: { xs: 4, md: 6 },
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'relative', width: '100%' }}>
          {/* Imagen de fondo */}
          <Box
            component="img"
            src="/images/home_image.png"
            alt="Academia Blockchain"
            sx={{
              width: '100%',
              height: 'auto',
              maxWidth: '100%',
              borderRadius: 0,
              objectFit: 'cover',
              display: 'block'
            }}
          />
          
          {/* Texto superpuesto: overlay sin fondo; solo la caja del texto tiene 0.77 */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              px: { xs: 2, md: 4 },
              py: { xs: 4, md: 6 },
            }}
          >
            <Box
              sx={{
                px: { xs: 2, md: 4 },
                py: { xs: 2.5, md: 3 },
                mx: 'auto',
                maxWidth: 720,
                width: '100%',
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.77)',
                boxShadow: 2,
              }}
            >
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
                  fontSize: { xs: '1.1rem', md: '1.5rem' },
                  lineHeight: 1.6
                }}
              >
                Explora contenido organizado por temas de interés, donde cada tema es moderado y enriquecido por la comunidad.
              </Typography>

              <Box sx={{ my: { xs: 2, md: 3 } }}>
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
                  fontSize: { xs: '1.1rem', md: '1.5rem' },
                  lineHeight: 1.6
                }}
              >
                Los caminos del conocimiento te guían paso a paso a través de una secuencia de contenido diseñada para construir comprensión progresiva.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

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
              sx={{ textAlign: { xs: 'center', sm: 'left' }, fontSize: { xs: '1.1rem', md: '1.5rem' } }}
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
                  fontSize: { xs: '1.1rem', md: '1.5rem' },
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
                  fontSize: { xs: '1.1rem', md: '1.5rem' },
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
                  fontSize: { xs: '1.1rem', md: '1.5rem' },
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
                  fontSize: { xs: '1.1rem', md: '1.5rem' },
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
