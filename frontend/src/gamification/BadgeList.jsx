import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Grid, Typography, CircularProgress, Alert, Tooltip } from '@mui/material';
import BadgeDisplay from './BadgeDisplay';
import { useDateLocales } from '../hooks/useDateLocales';

/**
 * Generate a human-readable description of how a badge was earned
 * based on the badge code and context_data
 */
const getBadgeEarningDescription = (badge, t) => {
  const badgeCode = badge.badge_code || badge.code;
  const contextData = badge.context_data || {};
  
  switch (badgeCode) {
    case 'first_knowledge_path_completed':
      if (contextData.knowledge_path_title) {
        return t('earning.pathCompletedNamed', { title: contextData.knowledge_path_title });
      }
      return t('earning.pathCompleted');
      
    case 'quiz_master':
      if (contextData.perfect_quizzes_count) {
        return t('earning.quizMasterCount', { count: contextData.perfect_quizzes_count });
      }
      return t('earning.quizMaster');
      
    case 'knowledge_seeker':
      if (contextData.completed_nodes_count) {
        return t('earning.nodesCount', { count: contextData.completed_nodes_count });
      }
      return t('earning.nodes');
      
    case 'first_comment':
      return t('earning.firstComment');
      
    case 'first_knowledge_path_created':
      if (contextData.knowledge_path_title) {
        return t('earning.pathCreatedNamed', { title: contextData.knowledge_path_title });
      }
      return t('earning.pathCreated');
      
    case 'content_creator':
      if (contextData.highly_rated_contents_count) {
        return t('earning.contentCreatorCount', { count: contextData.highly_rated_contents_count });
      }
      return t('earning.contentCreator');
      
    case 'first_highly_rated_comment':
      if (contextData.vote_count) {
        return t('earning.commentVotes', { count: contextData.vote_count });
      }
      return t('earning.commentVotesDefault');
      
    case 'first_highly_rated_content':
      if (contextData.vote_count) {
        return t('earning.contentVotes', { count: contextData.vote_count });
      }
      return t('earning.contentVotesDefault');
      
    case 'community_voice':
      if (contextData.total_comment_votes) {
        return t('earning.communityVotes', { count: contextData.total_comment_votes });
      }
      return t('earning.communityVotesDefault');
      
    case 'topic_curator':
      if (contextData.topic_title) {
        const contents = contextData.contents_count || 0;
        const withVotes = contextData.contents_with_votes || 0;
        return t('earning.topicCuratorNamed', {
          title: contextData.topic_title,
          contents,
          withVotes,
        });
      }
      return t('earning.topicCurator');
      
    case 'topic_architect':
      if (contextData.topic_title) {
        const withVotes = contextData.contents_with_votes || 0;
        const totalVotes = contextData.total_votes || 0;
        const voters = contextData.distinct_voters || 0;
        return t('earning.topicArchitectNamed', {
          title: contextData.topic_title,
          withVotes,
          totalVotes,
          voters,
        });
      }
      return t('earning.topicArchitect');
      
    default:
      return t('earning.default');
  }
};

/**
 * BadgeList Component
 * Displays a list of badges with loading and error states
 * 
 * @param {Array} badges - Array of badge objects
 * @param {string} title - Title to display above the list
 * @param {string} emptyMessage - Message to show when no badges
 * @param {boolean} loading - Loading state
 * @param {string} error - Error message if any
 * @param {boolean} showEarningTooltip - Whether to show "how you earned it" tooltip
 */
const BadgeList = ({ 
  badges, 
  title,
  emptyMessage,
  loading = false,
  error = null,
  showEarningTooltip = true
}) => {
  const { t } = useTranslation('gamification');
  const { intl } = useDateLocales();
  const resolvedTitle = title === undefined ? t('list.defaultTitle') : title;
  const resolvedEmpty = emptyMessage === undefined ? t('list.empty') : emptyMessage;
  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ py: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // Empty state
  if (!badges || badges.length === 0) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary" align="center">
          {resolvedEmpty}
        </Typography>
      </Box>
    );
  }

  // Sort badges by earned_at chronologically (oldest first)
  const sortedBadges = [...badges].sort((a, b) => {
    const dateA = a.earned_at ? new Date(a.earned_at).getTime() : 0;
    const dateB = b.earned_at ? new Date(b.earned_at).getTime() : 0;
    return dateA - dateB; // Ascending order (oldest first)
  });

  // Badge Card Component
  const BadgeCard = ({ badge }) => {
    const description = badge.badge_description || badge.description || '';
    const earningDescription = getBadgeEarningDescription(badge, t);

    const cardContent = (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          minHeight: 180, // Uniform minimum height
          height: '100%',
          '&:hover': {
            boxShadow: 2,
            transform: 'translateY(-2px)',
          },
        }}
      >
        {/* Badge Image and Name Row */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          {/* Badge Image */}
          <Box
            sx={{
              flexShrink: 0,
              width: 80,
              height: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BadgeDisplay badge={badge} showName={false} context="badgeList" />
          </Box>
          
          {/* Badge Name */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                fontSize: '1.1rem',
                lineHeight: 1.2,
              }}
            >
              {badge.badge_name || badge.name}
            </Typography>
          </Box>
        </Box>
        
        {/* Badge Description */}
        {description && (
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                lineHeight: 1.6,
              }}
            >
              {description}
            </Typography>
          </Box>
        )}
      </Box>
    );

    return (
      <Grid item xs={12} sm={6} md={4}>
        {showEarningTooltip ? (
          <Tooltip
            title={
              <Box sx={{ color: 'white' }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 'bold', 
                    mb: 0.5,
                    color: 'white',
                  }}
                >
                  {t('list.howEarned')}
                </Typography>
                <Typography 
                  variant="body2"
                  sx={{ color: 'white' }}
                >
                  {earningDescription}
                </Typography>
                {badge.earned_at && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      display: 'block', 
                      mt: 1, 
                      opacity: 0.9,
                      color: 'rgba(255, 255, 255, 0.9)',
                    }}
                  >
                    {t('list.earnedOn', {
                      date: new Date(badge.earned_at).toLocaleDateString(intl, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }),
                    })}
                  </Typography>
                )}
              </Box>
            }
            arrow
            placement="top"
            slotProps={{
              tooltip: {
                sx: {
                  bgcolor: '#212121',
                  color: 'white',
                  fontSize: '0.875rem',
                  maxWidth: 350,
                  zIndex: 1500,
                  boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.4)',
                  padding: '12px 16px',
                  '& .MuiTooltip-arrow': {
                    color: '#212121',
                  },
                },
              },
            }}
          >
            {cardContent}
          </Tooltip>
        ) : (
          cardContent
        )}
      </Grid>
    );
  };

  // Badges list with title and description
  return (
    <Box>
      {resolvedTitle && (
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          {resolvedTitle}
        </Typography>
      )}
      <Grid container spacing={3}>
        {sortedBadges.map((badge) => (
          <BadgeCard key={badge.id || badge.badge_code || `badge-${badge.badge_name}`} badge={badge} />
        ))}
      </Grid>
    </Box>
  );
};

export default BadgeList;