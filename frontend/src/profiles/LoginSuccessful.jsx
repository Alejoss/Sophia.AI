import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Box, 
  Typography,
  Fade,
  Grow
} from '@mui/material';
import { 
  School as SchoolIcon,
  Topic as TopicIcon
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';

const LoginSuccessful = () => {
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const user = authState?.user || null;

  useEffect(() => {
    // Check if user had previous session data (re-login)
    const hadPreviousSession = sessionStorage.getItem('had_previous_session') === 'true';
    setIsReturningUser(hadPreviousSession);
    
    // Clear the flag after using it
    sessionStorage.removeItem('had_previous_session');
    
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const sections = [
    {
      id: 'knowledge-paths',
      title: 'Caminos del Conocimiento',
      subtitle: 'Explora rutas de aprendizaje estructuradas',
      path: '/knowledge_path',
      icon: <SchoolIcon sx={{ fontSize: 60 }} />,
      imageUrl: '/images/knowledge_path_art.jpg'
    },
    {
      id: 'topics',
      title: 'Temas',
      subtitle: 'Descubre contenido por temas de interés',
      path: '/content/topics',
      icon: <TopicIcon sx={{ fontSize: 60 }} />,
      imageUrl: '/images/topic_art.jpg'
    }
  ];

  if (loading) {
    return (
      <Box sx={{ 
        height: '100vh',
        width: '100vw',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: 'background.default'
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Cargando...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh',
      width: '100vw',
      display: 'flex',
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'hidden',
      bgcolor: 'background.default',
      zIndex: 1
    }}>
      {/* Welcome message overlay */}
      {user && (
        <Fade in={!loading} timeout={800}>
          <Box sx={{
            position: 'absolute',
            top: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            textAlign: 'center',
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            px: 4,
            py: 2,
            borderRadius: 3,
            boxShadow: 3
          }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {isReturningUser 
                ? (
                  <>
                    ¡Qué bueno verte de nuevo,{' '}
                    <Link 
                      to="/profiles/my_profile" 
                      style={{ 
                        color: 'inherit', 
                        textDecoration: 'underline',
                        cursor: 'pointer'
                      }}
                    >
                      {user.username}
                    </Link>
                    !
                  </>
                )
                : (
                  <>
                    ¡Hola,{' '}
                    <Link 
                      to="/profiles/my_profile" 
                      style={{ 
                        color: 'inherit', 
                        textDecoration: 'underline',
                        cursor: 'pointer'
                      }}
                    >
                      {user.username}
                    </Link>
                    !
                  </>
                )
              }
            </Typography>
          </Box>
        </Fade>
      )}

      {sections.map((section, index) => (
        <Grow 
          in={!loading} 
          timeout={600 + index * 200}
          key={section.id}
        >
          <Box
            onClick={() => navigate(section.path)}
            onMouseEnter={() => setHovered(section.id)}
            onMouseLeave={() => setHovered(null)}
            sx={{
              flex: 1,
              position: 'relative',
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: hovered === section.id ? 'scale(1.02)' : 'scale(1)',
              zIndex: 1,
              borderRight: index === 0 ? '4px solid rgba(255, 255, 255, 0.3)' : 'none',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `url(${section.imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: hovered === section.id ? 'scale(1.1)' : 'scale(1)',
                zIndex: 0
              },
            }}
          >
            {/* Content */}
            <Box
              sx={{
                position: 'relative',
                zIndex: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'white',
                px: 4,
                textAlign: 'center',
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: hovered === section.id ? 'translateY(-10px)' : 'translateY(0)'
              }}
            >
              <Typography
                variant="h3"
                component="h2"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  textShadow: '2px 2px 8px rgba(0, 0, 0, 0.5)',
                  fontSize: { xs: '2rem', md: '3rem', lg: '4rem' },
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  px: 3,
                  py: 1.5,
                  borderRadius: 2,
                  display: 'inline-block'
                }}
              >
                {section.title}
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  opacity: hovered === section.id ? 1 : 0.9,
                  textShadow: '1px 1px 4px rgba(0, 0, 0, 0.5)',
                  fontSize: { xs: '1rem', md: '1.25rem' },
                  maxWidth: '400px',
                  bgcolor: 'rgba(0, 0, 0, 0.4)',
                  backdropFilter: 'blur(10px)',
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  display: 'inline-block',
                  color: 'white'
                }}
              >
                {section.subtitle}
              </Typography>
            </Box>
          </Box>
        </Grow>
      ))}
    </Box>
  );
};

export default LoginSuccessful;
