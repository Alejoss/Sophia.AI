import { useContext, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem, ListItemButton, ListItemText, useMediaQuery, useTheme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { AuthContext } from '../context/AuthContext.jsx';
import { useThemeMode } from '../context/ThemeContext.jsx';
import { getProfileMenuConfig } from '../profiles/ProfileVerticalNavigation.jsx';
import { mergeMenuConfigs } from '../utils/menuUtils';
import '../styles/header.css';

const HeaderComp = () => {
  const { authState } = useContext(AuthContext);
  const { isAuthenticated, user } = authState;
  const { mode, toggleMode } = useThemeMode();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  // Check if we're on a profile page
  const isOnProfilePage = location.pathname.includes('/profiles/') && 
                         !location.pathname.includes('/login') && 
                         !location.pathname.includes('/register');

  // Get profile menu configuration if on profile page
  const profileMenuConfig = isOnProfilePage ? getProfileMenuConfig(true, 0) : null;

  // Merge all menu configurations for mobile navigation
  const mobileMenuItems = profileMenuConfig ? 
    mergeMenuConfigs([profileMenuConfig]) : [];

  const handleProfileSectionClick = (section) => {
    // Close mobile menu
    setIsOpen(false);
    
    // Navigate to profile with section parameter
    if (section === 'library') {
      window.location.href = '/content/library_user';
    } else {
      // Use the Profile component's section change handler if available
      if (window.handleProfileSectionChange) {
        window.handleProfileSectionChange(section);
      } else {
        // Fallback: update URL and reload
        const currentUrl = new URL(window.location);
        currentUrl.searchParams.set('section', section);
        window.history.pushState({}, '', currentUrl);
        window.location.reload();
      }
    }
  };

  const renderMobileMenuItem = (item) => {
    if (item.type === 'header') {
      return (
        <ListItem key={item.key} sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 2 }}>
          <ListItemText 
            primary={item.label}
            primaryTypographyProps={{
              fontWeight: 600,
              color: 'text.secondary'
            }}
          />
        </ListItem>
      );
    }

    if (item.type === 'item') {
      return (
        <ListItem 
          key={item.key}
          disablePadding
        >
          <ListItemButton
            onClick={() => handleProfileSectionClick(item.section)}
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {item.icon && <item.icon sx={{ fontSize: 16 }} />}
                  {item.label}
                  {item.badge && (
                    <Box
                      component="span"
                      sx={{
                        bgcolor: 'error.main',
                        color: 'white',
                        fontSize: '0.75rem',
                        borderRadius: '9999px',
                        px: 1,
                        py: 0.5,
                        ml: 'auto'
                      }}
                    >
                      {item.badge}
                    </Box>
                  )}
                </Box>
              }
            />
          </ListItemButton>
        </ListItem>
      );
    }

    return null;
  };

  const navLinks = [
    { to: '/search', label: 'Buscar' },
    { to: '/knowledge_path', label: 'Caminos de conocimiento' },
    { to: '/content/topics', label: 'Temas' },
    { to: '/events', label: 'Eventos' },
  ];

  const authLinks = isAuthenticated
    ? [
        { to: '/profiles/my_profile', label: user.username },
        { to: '/profiles/logout', label: 'Cerrar sesión' },
      ]
    : [
        { to: '/profiles/login', label: 'Iniciar sesión' },
        { to: '/profiles/register', label: 'Registrarse' },
      ];

  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        bgcolor: 'background.paper',
        boxShadow: theme.palette.mode === 'dark' 
          ? '0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)'
          : '0 2px 4px rgba(6, 17, 118, 0.08), 0 4px 12px rgba(6, 17, 118, 0.08)',
        zIndex: 1000,
      }}
    >
      <Toolbar 
        sx={{ 
          maxWidth: '1200px',
          width: '100%',
          mx: 'auto',
          px: { xs: 2, md: 3 },
          justifyContent: 'space-between',
        }}
      >
        <Box
          component={Link}
          to="/"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textDecoration: 'none',
            color: 'inherit',
            position: 'relative',
          }}
          ref={(el) => {
            if (el) {
              // #region agent log
              const logoImg = el.querySelector('img');
              const computedStyle = window.getComputedStyle(el);
              fetch('http://127.0.0.1:7243/ingest/dedadcf2-b73e-481e-9590-d75e385009f3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HeaderComp.jsx:logo-box-ref',message:'Header logo box check',data:{hasElement:!!el,hasLogoImg:!!logoImg,logoSrc:logoImg?.src,computedBackgroundImage:computedStyle.backgroundImage,computedBackground:computedStyle.background,allImages:Array.from(el.querySelectorAll('img')).map(img=>({src:img.src,alt:img.alt}))},timestamp:Date.now(),sessionId:'debug-session',runId:'header-check',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
            }
          }}
        >
          {mode === 'light' && (
            <Box
              component="img"
              src="/images/logo.png"
              alt="Logo"
              sx={{
                height: { xs: '24px', lg: '28px' },
                width: 'auto',
                display: 'block',
              }}
            />
          )}
          <Typography
            variant="h6"
            component="span"
            sx={{
              fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
              fontWeight: 600,
              fontSize: { xs: '16px', md: '18px' },
              color: 'text.primary',
              whiteSpace: 'nowrap',
            }}
          >
            ACADEMIA BLOCKCHAIN
          </Typography>
        </Box>

        {/* Desktop Navigation */}
        <Box
          sx={{
            display: { xs: 'none', lg: 'flex' },
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          {navLinks.map((link) => (
            <Typography
              key={link.to}
              component={Link}
              to={link.to}
              sx={{
                color: 'text.primary',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: 400,
                px: 2.5,
                py: 0.625,
                borderRadius: '4px',
                '&:hover': {
                  color: '#6d28d2',
                  bgcolor: '#6d28d21f',
                },
              }}
            >
              {link.label}
            </Typography>
          ))}
          {authLinks.map((link) => (
            <Typography
              key={link.to}
              component={Link}
              to={link.to}
              sx={{
                color: 'text.primary',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: 400,
                px: 2.5,
                py: 0.625,
                borderRadius: '4px',
                '&:hover': {
                  color: '#6d28d2',
                  bgcolor: '#6d28d21f',
                },
              }}
            >
              {link.label}
            </Typography>
          ))}
          
          {/* Dark Mode Toggle */}
          <IconButton
            onClick={toggleMode}
            aria-label="toggle dark mode"
            sx={{
              ml: 1,
              color: 'text.primary',
            }}
          >
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Box>

        {/* Mobile Menu Button and Dark Mode Toggle */}
        <Box sx={{ display: { xs: 'flex', lg: 'none' }, alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={toggleMode}
            aria-label="toggle dark mode"
            sx={{
              color: 'text.primary',
            }}
          >
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
          <IconButton
            onClick={() => setIsOpen(!isOpen)}
            aria-label="menu"
          >
            <MenuIcon />
          </IconButton>
        </Box>

        {/* Mobile Drawer */}
        <Drawer
          anchor="top"
          open={isOpen}
          onClose={() => setIsOpen(false)}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': {
              top: '64px',
              bgcolor: 'background.paper',
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 12px rgba(0, 0, 0, 0.5)'
                : '0 4px 12px rgba(0, 0, 0, 0.15)',
            },
          }}
        >
          <List sx={{ pt: 0 }}>
            {navLinks.map((link) => (
              <ListItem
                key={link.to}
                component={Link}
                to={link.to}
                onClick={() => setIsOpen(false)}
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemText
                  primary={link.label}
                  primaryTypographyProps={{
                    fontSize: '14px',
                    color: 'text.primary',
                  }}
                />
              </ListItem>
            ))}
            {mobileMenuItems.map(renderMobileMenuItem)}
            {authLinks.map((link) => (
              <ListItem
                key={link.to}
                component={Link}
                to={link.to}
                onClick={() => setIsOpen(false)}
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Typography
                      component="span"
                      sx={{
                        fontSize: '14px',
                        color: 'text.primary',
                      }}
                    >
                      {link.label}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
            {/* Dark Mode Toggle in Mobile Menu */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  toggleMode();
                  setIsOpen(false);
                }}
                sx={{
                  borderTop: 1,
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemText
                  primary={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                  primaryTypographyProps={{
                    fontSize: '14px',
                    color: 'text.primary',
                  }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Drawer>
      </Toolbar>
    </AppBar>
  );
};

export default HeaderComp;
