import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Link as MuiLink,
  Divider,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TablePagination,
  CircularProgress,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';

const DEFAULT_PAGE_SIZE = 25;

const LibrarySelectSingle = ({
  isOpen,
  onClose,
  onSelect,
  title,
  description,
  filterFunction,
  compact = false,
  isLoading = false,
}) => {
  const { t } = useTranslation('content');
  const heading = title ?? t('librarySelect.singleTitle');
  const filterRef = useRef(filterFunction);
  filterRef.current = filterFunction;

  const [userContent, setUserContent] = useState([]);
  const [selectedContentProfile, setSelectedContentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collections, setCollections] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchQuery.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [searchDebounced, selectedCollectionId, rowsPerPage]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCollections = async () => {
      try {
        const data = await contentApi.getUserCollections();
        setCollections(data || []);
      } catch (err) {
        console.error('LibrarySelectSingle: Error fetching collections:', err);
      }
    };
    fetchCollections();
  }, [isOpen]);

  const loadLibraryPage = useCallback(async () => {
    if (!isOpen) return;
    try {
      setLoading(true);
      setError(null);
      const data = await contentApi.getUserContentWithDetails({
        page: page + 1,
        page_size: rowsPerPage,
        search: searchDebounced,
        collection: selectedCollectionId || undefined,
      });
      const results = Array.isArray(data?.results)
        ? data.results.filter((item) => {
          if (!item?.content) return false;
          if (filterRef.current && !filterRef.current(item)) return false;
          return true;
        })
        : [];
      setUserContent(results);
      setTotalCount(typeof data?.count === 'number' ? data.count : 0);
    } catch (err) {
      console.error('LibrarySelectSingle: Error fetching content:', err);
      setError(
        err?.response?.data?.error
        || err?.error
        || t('librarySelect.loadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [isOpen, page, rowsPerPage, searchDebounced, selectedCollectionId, t]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedContentProfile(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    loadLibraryPage();
  }, [isOpen, loadLibraryPage]);

  const handleConfirm = () => {
    if (selectedContentProfile) {
      onSelect(selectedContentProfile);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedContentProfile(null);
    onClose();
  };

  const contentBody = (
    <Paper
      sx={{
        p: compact ? 2 : 3,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
      elevation={0}
    >
      <Box sx={{ mb: compact ? 1.5 : 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {heading}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box
        sx={{
          mb: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <TextField
          placeholder={t('common.searchContent')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            ),
          }}
          sx={{ flexGrow: 1, minWidth: 180 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('common.collection')}</InputLabel>
          <Select
            value={selectedCollectionId}
            label={t('common.collection')}
            onChange={(e) => setSelectedCollectionId(e.target.value)}
          >
            <MenuItem value="">
              <em>{t('common.allCollections')}</em>
            </MenuItem>
            {collections.map((collection) => (
              <MenuItem key={collection.id} value={String(collection.id)}>
                {collection.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('librarySelect.availableCount', { value: totalCount })}
      </Typography>

      {loading && userContent.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          <TableContainer
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>{t('common.title')}</TableCell>
                  <TableCell>{t('common.type')}</TableCell>
                  <TableCell>{t('common.author')}</TableCell>
                  <TableCell>{t('actions.view')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userContent.map((content) => (
                  <TableRow
                    key={content.id}
                    hover
                    onClick={() => setSelectedContentProfile(content)}
                    selected={selectedContentProfile?.id === content.id}
                    sx={{
                      cursor: 'pointer',
                      '&.Mui-selected': {
                        backgroundColor: 'action.selected',
                      },
                      '&.Mui-selected:hover': {
                        backgroundColor: 'action.selected',
                      },
                    }}
                  >
                    <TableCell>{content.title || t('common.untitled')}</TableCell>
                    <TableCell>
                      <Chip
                        label={content.content?.media_type || '-'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{content.author || t('common.unknownAuthor')}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <MuiLink
                        href={`/content/${content.content?.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          color: 'primary.main',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {t('actions.view')}
                        <OpenInNewIcon fontSize="small" />
                      </MuiLink>
                    </TableCell>
                  </TableRow>
                ))}
                {userContent.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      {searchDebounced || selectedCollectionId
                        ? t('librarySelect.emptyFiltered')
                        : t('librarySelect.empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(_event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage={t('pagination.rows')}
          />
        </>
      )}
    </Paper>
  );

  if (error && !loading && userContent.length === 0) {
    return (
      <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{heading}</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          <Button variant="contained" onClick={loadLibraryPage}>
            {t('actions.retry')}
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onClose={!isLoading ? handleClose : undefined}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogContent
        sx={{
          p: compact ? 2 : 3,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {contentBody}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary">
            {t('librarySelect.adding')}
          </Typography>
        ) : (
          <>
            <Button onClick={handleClose} color="inherit">
              {t('actions.cancel')}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleConfirm}
              disabled={!selectedContentProfile}
            >
              {t('librarySelect.choose')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default LibrarySelectSingle;
