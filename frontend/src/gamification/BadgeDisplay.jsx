import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { BADGE_CATEGORY_COLORS, BADGE_SIZES, BADGE_CONTEXT_SIZES } from './badgeConstants';
import { getBadgeIconPath } from './badgeIconMap';

const BadgeContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isExtraTiny',
})(({ theme, isExtraTiny }) => ({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: isExtraTiny ? theme.spacing(0.25) : theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  transition: 'transform 0.2s ease-in-out',
  verticalAlign: isExtraTiny ? 'middle' : 'baseline',
  lineHeight: isExtraTiny ? 1 : 'normal',
  '&:hover': {
    transform: isExtraTiny ? 'scale(1.1)' : 'scale(1.05)',
  },
}));

const BadgeIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasIcon' && prop !== 'isExtraTiny',
})(({ theme, hasIcon, isExtraTiny }) => ({
  width: 64,
  height: 64,
  borderRadius: '50%',
  backgroundColor: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: isExtraTiny ? 0 : theme.spacing(0.5),
  border: 'none',
  flexShrink: 0,
  '& img': {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'contain',
  },
}));

const BadgeName = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  fontWeight: 500,
  textAlign: 'center',
  maxWidth: 80,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

/**
 * BadgeDisplay Component
 * Displays a single badge with icon, name, and tooltip
 * 
 * @param {Object} badge - Badge object with name, description, icon, etc.
 * @param {boolean} showName - Whether to show badge name below icon
 * @param {string} size - Size variant: 'extraTiny', 'tiny', 'small', 'medium', or 'large' (takes precedence over context)
 * @param {string} context - Context variant: 'comment', 'header', 'profile', 'badgeList', 'notification' (automatically determines size)
 */
const BadgeDisplay = ({ badge, showName = true, size, context }) => {
  // Determine size: explicit size prop takes precedence, then context, then default
  const determinedSize = size || BADGE_CONTEXT_SIZES[context] || BADGE_CONTEXT_SIZES.default;
  const dimensions = BADGE_SIZES[determinedSize] || BADGE_SIZES.medium;
  const isExtraTiny = determinedSize === 'extraTiny';

  const getCategoryColor = (category) => {
    return BADGE_CATEGORY_COLORS[category] || BADGE_CATEGORY_COLORS.DEFAULT;
  };

  const categoryColor = getCategoryColor(badge.badge_category || badge.category);
  
  // Default badge image path
  const DEFAULT_BADGE_IMAGE = '/images/badge_sky_blue.png';
  
  // Determine which image to use with priority:
  // 1. Database icon (if uploaded): badge.badge_icon || badge.icon
  // 2. Mapped icon (based on badge code): getBadgeIconPath(badge_code)
  // 3. Default fallback: badge_sky_blue.png
  const badgeCode = badge.badge_code || badge.code;
  const databaseIcon = badge.badge_icon || badge.icon;
  const mappedIcon = badgeCode ? getBadgeIconPath(badgeCode) : DEFAULT_BADGE_IMAGE;
  
  const badgeImage = databaseIcon || mappedIcon;
  const hasCustomIcon = !!databaseIcon;

  // For comments, only show the badge name in tooltip (no description)
  // For header, no tooltip at all
  const isCommentContext = context === 'comment';
  const isHeaderContext = context === 'header';
  
  const badgeContent = (
    <BadgeContainer isExtraTiny={isExtraTiny}>
      <BadgeIcon
        hasIcon={hasCustomIcon}
        isExtraTiny={isExtraTiny}
        sx={{
          width: dimensions.icon,
          height: dimensions.icon,
        }}
      >
        <img
          src={badgeImage}
          alt={badge.badge_name || badge.name || 'Badge'}
          onError={(e) => {
            // If database icon fails, try mapped icon
            if (hasCustomIcon && badgeCode) {
              const mappedIconPath = getBadgeIconPath(badgeCode);
              if (e.target.src !== mappedIconPath) {
                e.target.src = mappedIconPath;
                return;
              }
            }
            // Fallback to default badge image
            if (e.target.src !== DEFAULT_BADGE_IMAGE) {
              e.target.src = DEFAULT_BADGE_IMAGE;
            } else {
              // If default also fails, hide the image
              e.target.style.display = 'none';
            }
          }}
        />
      </BadgeIcon>
      {showName && (
        <BadgeName sx={{ fontSize: dimensions.fontSize }}>
          {badge.badge_name || badge.name}
        </BadgeName>
      )}
    </BadgeContainer>
  );
  
  // No tooltip - return badge content directly
  return badgeContent;
};

export default BadgeDisplay;