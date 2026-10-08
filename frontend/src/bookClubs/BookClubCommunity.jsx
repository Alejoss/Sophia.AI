import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../api/bookClubsApi';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER } from './clubTheme';

const BookClubCommunity = () => {
  const { t } = useTranslation('bookClubs');
  const { hub, club, slug, canParticipate } = useBookClub();
  const topicId = hub.quick_links?.topic_id;
  const telegramUrl = club?.telegram_group_url;
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(canParticipate);
  const [membersError, setMembersError] = useState('');

  useEffect(() => {
    if (!canParticipate) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    bookClubsApi
      .listMembers(slug)
      .then((data) => {
        if (!cancelled) {
          setMembers(data);
          setMembersError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMembersError(
            err?.response?.data?.detail ||
              t('errors.loadMembers')
          );
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, canParticipate, t]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {t('community.title')}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
          {t('community.intro')}
        </Typography>
      </Box>

      {telegramUrl ? (
        <Box
          sx={{
            p: 3,
            border: `1px solid ${CLUB_ACCENT}`,
            borderRadius: 1,
            bgcolor: 'rgba(255,107,53,0.08)',
          }}
        >
          <Typography variant="overline" sx={{ color: CLUB_ACCENT, fontWeight: 700 }}>
            Telegram
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5, mb: 1 }}>
            {t('community.groupTitle')}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
            {t('community.groupBody')}
          </Typography>
          <Button
            variant="contained"
            component="a"
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
          >
            {t('community.openTelegram')}
          </Button>
        </Box>
      ) : (
        <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }}>
          {t('community.noTelegram')}
        </Alert>
      )}

      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t('community.members')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)' }}>
              {t('community.membersHint')}
            </Typography>
          </Box>
          {canParticipate && (
            <Button
              component={RouterLink}
              to={`/club-de-lectura/${slug}/presentate`}
              sx={{ color: CLUB_ACCENT, fontWeight: 700 }}
            >
              {t('community.editIntro')}
            </Button>
          )}
        </Stack>

        {!canParticipate ? (
          <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }}>
            {t('community.joinToMeet')}
          </Alert>
        ) : membersLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} sx={{ color: CLUB_ACCENT }} />
          </Box>
        ) : membersError ? (
          <Alert severity="error">{membersError}</Alert>
        ) : members.length === 0 ? (
          <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }}>
            {t('community.nobodyYet')}
          </Alert>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            {members.map((member) => (
              <Box
                key={member.id}
                sx={{
                  p: 2.5,
                  border: member.is_me
                    ? `1px solid ${CLUB_ACCENT}`
                    : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 1,
                  bgcolor: member.is_me
                    ? 'rgba(255,107,53,0.06)'
                    : 'rgba(255,255,255,0.025)',
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>
                  @{member.username}
                  {member.is_me ? t('you') : ''}
                </Typography>
                {member.country && (
                  <Typography
                    variant="body2"
                    sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.5 }}
                  >
                    {member.country}
                  </Typography>
                )}
                {member.intro_description && (
                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,0.78)',
                      mt: 1.25,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {member.intro_description}
                  </Typography>
                )}
                {(member.social_url || member.additional_url) && (
                  <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                    {member.social_url && (
                      <Button
                        component="a"
                        href={member.social_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        sx={{ color: CLUB_ACCENT, px: 0 }}
                      >
                        {t('community.social')}
                      </Button>
                    )}
                    {member.additional_url && (
                      <Button
                        component="a"
                        href={member.additional_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        sx={{ color: CLUB_ACCENT, px: 0 }}
                      >
                        {t('community.otherLink')}
                      </Button>
                    )}
                  </Stack>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {topicId && (
        <Box
          sx={{
            p: 3,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.03)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            {t('community.investigationTitle')}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
            {t('community.investigationBody')}
          </Typography>
          <Button
            variant="contained"
            component={RouterLink}
            to={`/club-de-lectura/${slug}/investigacion`}
            sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
          >
            {t('community.goInvestigation')}
          </Button>
        </Box>
      )}

    </Stack>
  );
};

export default BookClubCommunity;
