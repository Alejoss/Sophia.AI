import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  CircularProgress,
  Alert,
} from '@mui/material';
import contentApi from '../api/contentApi';

const PAGE_SIZE = 24;

/**
 * Lists another user's public collections (same rules as /content/collections/public/?owner=).
 */
const ProfileSharedCollections = ({ userId, ownerUsername }) => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setCollections([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await contentApi.getPublicCollections({
          owner: userId,
          page: 1,
          page_size: PAGE_SIZE,
        });
        if (!cancelled) {
          setCollections(Array.isArray(data?.results) ? data.results : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error ||
              err.message ||
              'No se pudieron cargar las colecciones'
          );
          setCollections([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) {
    return null;
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" fontWeight={600} gutterBottom>
        Colecciones Compartidas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Colecciones que {ownerUsername || 'este usuario'} comparte públicamente con la comunidad.
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && collections.length === 0 && (
        <Typography variant="body1" color="text.secondary">
          Este usuario no tiene colecciones compartidas visibles todavía.
        </Typography>
      )}

      {!loading && !error && collections.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(auto-fill, minmax(260px, 1fr))',
            },
            gap: 2,
          }}
        >
          {collections.map((c) => (
            <Card key={c.id} variant="outlined" sx={{ bgcolor: 'background.paper' }}>
              <CardActionArea onClick={() => navigate(`/content/collections/${c.id}`)}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom component="div">
                    {c.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Por {c.owner_username}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    {c.visible_item_count}{' '}
                    {c.visible_item_count === 1 ? 'elemento visible' : 'elementos visibles'}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ProfileSharedCollections;
