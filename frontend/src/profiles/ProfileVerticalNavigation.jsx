import React from 'react';
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
  LibraryBooks as LibraryIcon
} from '@mui/icons-material';

const ProfileVerticalNavigation = ({ 
  isOwnProfile = false, 
  userId = null,
  activeSection = 'publications',
  onSectionChange = () => {},
  unreadNotificationsCount = 0,
  sx = {} 
}) => {
  const handleSectionClick = (section) => {
    onSectionChange(null, section);
  };

  // Define menu items - Events visible to both owners and visitors
  const getMenuItems = () => {
    const baseItems = [
      {
        label: 'Publications',
        section: 'publications',
        icon: ArticleIcon
      },
      {
        label: 'Bookmarks',
        section: 'saved-items',
        icon: BookmarkIcon
      },
      {
        label: 'Knowledge Paths',
        section: 'knowledge-paths',
        icon: KnowledgePathIcon
      },
      {
        label: 'Certificates',
        section: 'certificates',
        icon: SchoolIcon
      },
      {
        label: 'Events',
        section: 'events',
        icon: EventIcon
      },
      {
        label: 'Favorite Cryptos',
        section: 'cryptos',
        icon: CryptoIcon
      }
    ];

    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        width: 280, 
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
          {isOwnProfile ? 'Your Profile' : 'Profile'}
        </Typography>
        
        <Divider sx={{ mb: 2 }} />
        
        <List sx={{ p: 0 }}>
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const isItemActive = activeSection === item.section;
            
            return (
              <ListItem key={index} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleSectionClick(item.section)}
                  sx={{
                    borderRadius: 1,
                    mx: 1,
                    backgroundColor: isItemActive ? 'primary.light' : 'transparent',
                    color: isItemActive ? 'primary.main' : 'text.primary',
                    '&:hover': {
                      backgroundColor: isItemActive ? 'primary.light' : 'action.hover',
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
                </ListItemButton>
              </ListItem>
            );
          })}

          {/* Notifications section - only for own profile */}
          {isOwnProfile && (
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleSectionClick('notifications')}
                sx={{
                  borderRadius: 1,
                  mx: 1,
                  backgroundColor: activeSection === 'notifications' ? 'primary.light' : 'transparent',
                  color: activeSection === 'notifications' ? 'primary.main' : 'text.primary',
                  '&:hover': {
                    backgroundColor: activeSection === 'notifications' ? 'primary.light' : 'action.hover',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'primary.light',
                    '&:hover': {
                      backgroundColor: 'primary.light',
                    }
                  }
                }}
                selected={activeSection === 'notifications'}
              >
                <ListItemIcon sx={{ 
                  color: activeSection === 'notifications' ? 'primary.main' : 'text.secondary',
                  minWidth: 40 
                }}>
                  <NotificationsIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Notifications"
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontWeight: activeSection === 'notifications' ? 600 : 400,
                      fontSize: '0.95rem'
                    }
                  }}
                />
                {/* Unread count pill */}
                {unreadNotificationsCount > 0 && (
                  <Chip
                    label={unreadNotificationsCount}
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
          )}

          {/* Separator */}
          {isOwnProfile && (
            <Divider sx={{ my: 2, mx: 1 }} />
          )}

          {/* Your Library link - only for own profile */}
          {isOwnProfile && (
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component="a"
                href="/content/library_user"
                sx={{
                  borderRadius: 1,
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
                  <LibraryIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Your Library"
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontWeight: 400,
                      fontSize: '0.95rem'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          )}
        </List>
      </Box>
    </Paper>
  );
};

export default ProfileVerticalNavigation; 