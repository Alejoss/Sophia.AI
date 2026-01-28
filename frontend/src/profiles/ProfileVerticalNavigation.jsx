
import React from "react";

import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Paper,
  Badge,
  Chip
} from '@mui/material';
import {
  Article as ArticleIcon,
  Event as EventIcon,
  School as SchoolIcon,
  Bookmark as BookmarkIcon,
  CurrencyBitcoin as CryptoIcon,
  AccountTree as KnowledgePathIcon,
  Notifications as NotificationsIcon,
  LibraryBooks as LibraryIcon,
  EmojiEvents as BadgeIcon,
  Lightbulb as LightbulbIcon,
  Security as SecurityIcon,
  AcUnit as TopicIcon
} from '@mui/icons-material';
import { createMenuConfig } from '../utils/menuUtils';

// Export menu configuration for use in header navigation
export const getProfileMenuItems = (isOwnProfile = false, unreadNotificationsCount = 0) => {
  const baseItems = [
    {
      label: 'Publicaciones',
      section: 'publications',
      icon: ArticleIcon,
      path: null // Will be handled by section change
    },
    {
      label: 'Caminos de conocimiento',
      section: 'knowledge-paths',
      icon: KnowledgePathIcon,
      path: null
    },
    {
      label: 'Temas',
      section: 'topics',
      icon: TopicIcon,
      path: null
    },
    {
      label: 'Certificados',
      section: 'certificates',
      icon: SchoolIcon,
      path: null
    },
    {
      label: 'Eventos',
      section: 'events',
      icon: EventIcon,
      path: null
    },
    {
      label: 'Criptomonedas favoritas',
      section: 'cryptos',
      icon: CryptoIcon,
      path: null
    },
    {
      label: 'Insignias',
      section: 'badges',
      icon: BadgeIcon,
      path: null
    }
  ];

  // Add profile-specific items
  if (isOwnProfile) {
    baseItems.push(
      {
        label: 'Marcadores',
        section: 'saved-items',
        icon: BookmarkIcon,
        path: null
      },
      {
        label: 'Notificaciones',
        section: 'notifications',
        icon: NotificationsIcon,
        path: null,
        badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : null
      },
      {
        label: 'Seguridad',
        section: 'security',
        icon: SecurityIcon,
        path: null
      },
      {
        label: 'Tu biblioteca',
        section: 'library',
        icon: LibraryIcon,
        path: '/content/library_user',
        showDividerBefore: true // Flag to show divider before this item
      },
      {
        label: 'Sugerencias',
        section: 'suggestions',
        icon: LightbulbIcon,
        path: null,
        isAction: true // Special flag to indicate this is an action button, not a section
      }
    );
  }

  return baseItems;
};

// Export menu configuration for use in header navigation
export const getProfileMenuConfig = (isOwnProfile = false, unreadNotificationsCount = 0) => {
  const items = getProfileMenuItems(isOwnProfile, unreadNotificationsCount);
  return createMenuConfig(items, 'Secciones del perfil', true);
};

const ProfileVerticalNavigation = ({ 
  isOwnProfile = false, 
  userId = null,
  activeSection = 'publications',
  onSectionChange = () => {},
  onSuggestionClick = () => {},
  unreadNotificationsCount = 0,
  sx = {} 
}) => {
  const handleSectionClick = (section) => {
    onSectionChange(null, section);
  };

  // Get menu items using the exported function
  const menuItems = getProfileMenuItems(isOwnProfile, unreadNotificationsCount);

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        width: {
          xs: "100%", // full width on mobile
          md: 280,    // fixed 280px on md+
        },
        minHeight: 'fit-content',
        backgroundColor: 'background.paper',
        ...sx 
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography 
          variant="h6" 
          component="h2" 
          sx={{ 
            mb: 2, 
            color: 'text.primary',
            fontWeight: 600 
          }}
        >
          {isOwnProfile ? 'Tu perfil' : 'Perfil'}
        </Typography>
        
        <Divider sx={{ mb: 2 }} />
        
        <List sx={{ p: 0 }}>
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const isItemActive = activeSection === item.section;
            
            // Show divider before library item if flag is set
            const showDivider = item.showDividerBefore;
            
            // Handle library link differently (external link)
            if (item.path && item.section === 'library') {
              return (
                <React.Fragment key={index}>
                  {showDivider && <Divider sx={{ my: 1, mx: 2 }} />}
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      component="a"
                      href={item.path}
                      sx={{
                        borderRadius: 0.5,
                        mx: 1,
                        backgroundColor: 'transparent',
                        color: 'text.primary',
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        }
                      }}
                    >
                      <ListItemIcon sx={{ 
                        color: 'text.secondary',
                        minWidth: 40 
                      }}>
                        <IconComponent />
                      </ListItemIcon>
                      <ListItemText 
                        primary={item.label}
                        sx={{
                          '& .MuiListItemText-primary': {
                            fontWeight: 400,
                            fontSize: '0.95rem'
                          }
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                </React.Fragment>
              );
            }
            
            // Handle suggestions action button (opens modal)
            if (item.isAction && item.section === 'suggestions') {
              return (
                <ListItem key={index} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => onSuggestionClick()}
                    sx={{
                      borderRadius: 0.5,
                      mx: 1,
                      backgroundColor: 'transparent',
                      color: 'text.primary',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      }
                    }}
                  >
                    <ListItemIcon sx={{ 
                      color: 'text.secondary',
                      minWidth: 40 
                    }}>
                      <IconComponent />
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.label}
                      sx={{
                        '& .MuiListItemText-primary': {
                          fontWeight: 400,
                          fontSize: '0.95rem'
                        }
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            }
            
            return (
              <ListItem key={index} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleSectionClick(item.section)}
                  sx={{
                    borderRadius: 0.5,
                    mx: 1,
                    backgroundColor: isItemActive ? 'primary.light' : 'transparent',
                    color: isItemActive ? 'text.white' : 'text.white',
                    '&:hover': {
                      backgroundColor: isItemActive ? 'text.white' : 'action.hover',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'primary.light',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                      }
                    }
                  }}
                  selected={isItemActive}
                >
                  <ListItemIcon sx={{ 
                    color: isItemActive ? 'primary.main' : 'text.secondary',
                    minWidth: 40 
                  }}>
                    <IconComponent />
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.label}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontWeight: isItemActive ? 600 : 400,
                        fontSize: '0.95rem'
                      }
                    }}
                  />
                  {/* Badge for notifications */}
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      color="error"
                      sx={{
                        height: 20,
                        minWidth: 20,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        '& .MuiChip-label': {
                          px: 0.5
                        }
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Paper>
  );
};

export default ProfileVerticalNavigation; 