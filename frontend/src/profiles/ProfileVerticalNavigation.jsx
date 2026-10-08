
import React from "react";
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Paper,
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
  EmojiEvents as BadgeIcon,
  Lightbulb as LightbulbIcon,
  Security as SecurityIcon,
  AcUnit as TopicIcon,
  LibraryBooks as LibraryIcon,
  Toll as TollIcon
} from '@mui/icons-material';
import { createMenuConfig } from '../utils/menuUtils';
import { useTranslation } from 'react-i18next';

/** Temporarily hidden until crypto payments are ready for general use. */
export const SHOW_FAVORITE_CRYPTOS_SECTION = false;

// Export menu configuration for use in header navigation
export const getProfileMenuItems = (isOwnProfile = false, unreadNotificationsCount = 0) => {
  const baseItems = [
    {
      labelKey: 'profile.publications',
      section: 'publications',
      icon: ArticleIcon,
      path: null // Will be handled by section change
    },
    {
      labelKey: 'profile.knowledgePaths',
      section: 'knowledge-paths',
      icon: KnowledgePathIcon,
      path: null
    },
    {
      labelKey: 'profile.topics',
      section: 'topics',
      icon: TopicIcon,
      path: null
    },
    {
      labelKey: 'profile.certificates',
      section: 'certificates',
      icon: SchoolIcon,
      path: null
    },
    {
      labelKey: 'profile.events',
      section: 'events',
      icon: EventIcon,
      path: null
    },
    ...(SHOW_FAVORITE_CRYPTOS_SECTION
      ? [{
          labelKey: 'profile.cryptos',
          section: 'cryptos',
          icon: CryptoIcon,
          path: null
        }]
      : []),
    {
      labelKey: 'profile.badges',
      section: 'badges',
      icon: BadgeIcon,
      path: null
    }
  ];

  if (isOwnProfile) {
    const insertAfterSection = SHOW_FAVORITE_CRYPTOS_SECTION ? 'cryptos' : 'events';
    const insertIndex = baseItems.findIndex((item) => item.section === insertAfterSection);
    baseItems.splice(insertIndex + 1, 0, {
      labelKey: 'profile.tokens',
      section: 'tokens',
      icon: TollIcon,
      path: null
    });
  }

  // Add profile-specific items
  if (isOwnProfile) {
    baseItems.push(
      {
        labelKey: 'profile.bookmarks',
        section: 'saved-items',
        icon: BookmarkIcon,
        path: null
      },
      {
        labelKey: 'profile.notifications',
        section: 'notifications',
        icon: NotificationsIcon,
        path: null,
        badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : null
      },
      {
        labelKey: 'profile.security',
        section: 'security',
        icon: SecurityIcon,
        path: null
      },
      {
        labelKey: 'profile.suggestions',
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
  return createMenuConfig(items, 'profile.sections', true);
};

const ProfileVerticalNavigation = ({ 
  isOwnProfile = false, 
  userId = null,
  activeSection = 'publications',
  onSectionChange = () => {},
  onSuggestionClick = () => {},
  unreadNotificationsCount = 0,
  /** Total public collections when viewing another user's profile; drives sidebar button text. */
  sharedCollectionsCount = null,
  sx = {} 
}) => {
  const { t } = useTranslation('nav');
  const navigate = useNavigate();
  const labelOf = (item) => t(item.labelKey);
  const sharedCollectionsLabel = sharedCollectionsCount == null
    ? t('profile.sharedCollections')
    : t('profile.sharedCollectionsCount', { count: sharedCollectionsCount });

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
        {isOwnProfile ? (
          <Button
            component={Link}
            to="/content/library_user"
            variant="contained"
            startIcon={<LibraryIcon />}
            fullWidth
            sx={{
              mb: 2,
              py: 1.25,
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '1rem',
            }}
          >
            {t('profile.myLibrary')}
          </Button>
        ) : (
          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              onSectionChange(null, 'shared-collections');
              if (userId != null) {
                navigate(`/profiles/user_profile/${userId}?section=shared-collections`);
              }
            }}
            sx={{
              mb: 2,
              py: 1.25,
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.95rem',
              lineHeight: 1.25,
              whiteSpace: 'normal',
              ...(activeSection === 'shared-collections' && {
                boxShadow: 6,
              }),
            }}
          >
            {sharedCollectionsLabel}
          </Button>
        )}

        <Divider sx={{ mb: 2 }} />
        
        <List sx={{ p: 0 }}>
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const isItemActive = activeSection === item.section;

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
                      primary={labelOf(item)}
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
                    primary={labelOf(item)}
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