import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../../api/bookClubsApi';
import { extractApiError, formatClubDate } from '../clubTheme';

const BookClubAdminMembers = () => {
  const { t } = useTranslation('bookClubs');
  const { slug } = useParams();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookClubsApi.listMembers(slug, { includeAll: true });
      setMembers(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(extractApiError(err, t('errors.loadMembers')));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('memberAdmin.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        {t('memberAdmin.intro')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : !members.length ? (
        <Typography color="text.secondary">{t('memberAdmin.empty')}</Typography>
      ) : (
        <Stack spacing={1.5}>
          {members.map((m) => (
            <Box
              key={m.id}
              sx={{
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Typography fontWeight={700}>
                @{m.username}
                {m.is_me ? t('you') : ''}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color={m.has_introduced ? 'success' : 'default'}
                  label={m.has_introduced ? t('memberAdmin.introduced') : t('memberAdmin.notIntroduced')}
                />
                <Typography variant="caption" color="text.secondary">
                  {t('memberAdmin.since', { date: formatClubDate(m.joined_at) || '—' })}
                </Typography>
              </Stack>
              {m.intro_description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}
                >
                  {m.intro_description}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default BookClubAdminMembers;
