import React from "react";
import { Trans, useTranslation } from "react-i18next";
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
import HomeHeroBackground from "../components/HomeHeroBackground.jsx";

const GITHUB_URL = "https://github.com/Alejoss/Sophia.AI";

const Home = () => {
  const { t } = useTranslation("misc");
  const navigate = useNavigate();
  const { authState } = React.useContext(AuthContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDark = theme.palette.mode === 'dark';
  // Hero/content box background: light glass in light mode, dark glass in dark mode for text contrast
  const heroBoxBg = isDark ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.77)';
  const isAuthenticated = authState?.isAuthenticated ?? false;

  // Authenticated home: project info, collaborative, open source, blockchain status, GitHub.
  // Use persisted auth on the first paint — do not wait for checkAuth or the
  // guest landing (home_hero.jpg) flashes then swaps, which tanks CLS/LCP.
  if (isAuthenticated) {
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
          <HomeHeroBackground variant="authenticated" objectPosition="top center" />
          <Box className="home-hero-overlay home-hero-overlay-authenticated" />
          <Box sx={{ position: 'absolute', top: { xs: 80, md: 88 }, right: { xs: 24, md: 40 }, zIndex: 3 }}>
            <Button
              variant="outlined"
              size="medium"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate("/profiles/my_profile")}
              sx={{
                borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.23)',
                color: 'text.secondary',
                px: 3,
                py: 1.25,
                fontSize: { xs: '0.9375rem', md: '1rem' },
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.9)',
                '&:hover': {
                  borderColor: '#FF6B35',
                  color: '#FF6B35',
                  bgcolor: isDark ? 'rgba(45,45,45,0.95)' : 'rgba(255,255,255,0.95)',
                  boxShadow: 1
                },
                transition: 'all 0.2s ease'
              }}
            >
              {t("legacyHome.goToProfile")}
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
                  bgcolor: heroBoxBg,
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
                  {t("legacyHome.authLead")}
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
              {t("legacyHome.authHeading")}
            </Typography>
            <Box sx={{ maxWidth: '900px', mx: 'auto' }}>
              <Typography variant="body1" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' }, color: 'text.secondary', mb: 3, lineHeight: 1.8 }}>
                {t("legacyHome.authBody")}
              </Typography>
              <Typography variant="body1" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' }, color: 'text.secondary', lineHeight: 1.8 }}>
                <Trans
                  t={t}
                  i18nKey="legacyHome.authContribute"
                  components={{
                    github: (
                      <MuiLink href={GITHUB_URL} target="_blank" rel="noopener noreferrer" color="primary" sx={{ fontWeight: 500 }} />
                    ),
                  }}
                />
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
              {t("legacyHome.roadmapTitle")}
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={6}>
                <Card sx={{ height: '100%', textAlign: 'center', p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, transition: 'all 0.3s ease', '&:hover': { boxShadow: 4, transform: 'translateY(-4px)' } }}>
                  <CurrencyBitcoinIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>{t("legacyHome.paymentsTitle")}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                    {t("legacyHome.paymentsBody")}
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <Card sx={{ height: '100%', textAlign: 'center', p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, transition: 'all 0.3s ease', '&:hover': { boxShadow: 4, transform: 'translateY(-4px)' } }}>
                  <LockIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>{t("legacyHome.blockchainTitle")}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                    {t("legacyHome.blockchainBody")}
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <Card sx={{ height: '100%', textAlign: 'center', p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, transition: 'all 0.3s ease', '&:hover': { boxShadow: 4, transform: 'translateY(-4px)' } }}>
                  <FolderIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>{t("legacyHome.filesTitle")}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                    {t("legacyHome.filesBody")} 
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <Card sx={{ height: '100%', textAlign: 'center', p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, transition: 'all 0.3s ease', '&:hover': { boxShadow: 4, transform: 'translateY(-4px)' } }}>
                  <HubIcon sx={{ fontSize: 48, color: '#FF6B35', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>{t("legacyHome.connectionsTitle")}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                    {t("legacyHome.connectionsBody")} 
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Container>

        <Box
          sx={{
            position: 'relative',
            width: 'calc(100% + 2rem)',
            marginLeft: '-1rem',
            marginRight: '-1rem',
            minHeight: { xs: 280, md: 320 },
            mb: { xs: 6, md: 8 },
            overflowX: 'clip',
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
                bgcolor: heroBoxBg,
                boxShadow: 2,
              }}
            >
              <Typography variant="h2" component="h2" sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 600, mb: 2, color: 'text.primary' }}>
                {t("legacyHome.notABusiness")}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 0, maxWidth: '700px', mx: 'auto', lineHeight: 1.7, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                <Trans
                  t={t}
                  i18nKey="legacyHome.support"
                  components={{
                    github: (
                      <MuiLink href={GITHUB_URL} target="_blank" rel="noopener noreferrer" color="primary" sx={{ fontWeight: 500 }} />
                    ),
                  }}
                />
              </Typography>
            </Box>
          </Container>
        </Box>

        <Box sx={{ mt: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3 }, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, px: { xs: 2, md: 0 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'center', sm: 'left' }, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                {t("legacyHome.follow")}
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

  // Guest landing. Shown when there is no persisted session (typical first visit).
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
        <HomeHeroBackground variant="guest" />
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
                bgcolor: heroBoxBg,
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
                {t("legacyHome.heroTitle")}
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
                {t("legacyHome.heroLead")}
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
                {t("legacyHome.start")}
              </Button>

              <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                <Trans
                  t={t}
                  i18nKey="legacyHome.haveAccount"
                  components={{
                    login: (
                      <Link
                        to="/profiles/login"
                        style={{
                          color: '#FF6B35',
                          textDecoration: 'none',
                          fontWeight: 500
                        }}
                      />
                    ),
                  }}
                />
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
            {t("legacyHome.whatTitle")}
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
              {t("legacyHome.what1")}
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
              {t("legacyHome.what2")}
            </Typography>
            
            <Typography 
              variant="body1" 
              sx={{ 
                fontSize: { xs: '1.1rem', md: '1.5rem' },
                color: 'text.secondary',
                lineHeight: 1.8
              }}
            >
              {t("legacyHome.what3")}
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
            {t("legacyHome.audienceTitle")}
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
                  {t("legacyHome.students")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                  {t("legacyHome.studentsBody")}
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
                  {t("legacyHome.researchers")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                  {t("legacyHome.researchersBody")}
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
                  {t("legacyHome.educators")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                  {t("legacyHome.educatorsBody")}
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
                  {t("legacyHome.community")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                  {t("legacyHome.communityBody")}
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
          width: 'calc(100% + 2rem)',
          marginLeft: '-1rem',
          marginRight: '-1rem',
          mb: { xs: 4, md: 6 },
          overflowX: 'clip',
        }}
      >
        <Box sx={{ position: 'relative', width: '100%' }}>
          {/* Imagen de fondo */}
          <Box
            component="img"
            src="/images/home_image.png"
            alt={t("legacyHome.imageAlt")}
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
                bgcolor: heroBoxBg,
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
                {t("legacyHome.discoverTitle")}
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
                {t("legacyHome.discoverBody")}
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
                  {t("legacyHome.enter")}
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
                {t("legacyHome.pathsTitle")}
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
                {t("legacyHome.pathsBody")}
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
              {t("legacyHome.followLong")}
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
