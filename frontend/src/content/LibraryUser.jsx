import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  TablePagination,
} from "@mui/material";
import NoteIcon from "@mui/icons-material/Note";
import SearchIcon from "@mui/icons-material/Search";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import contentApi from "../api/contentApi";
import { useNavigate } from "react-router-dom";
import { resolveMediaUrl } from "../utils/fileUtils";
import { AuthContext } from "../context/AuthContext";
import ContentDisplay from "./ContentDisplay";

const DEFAULT_PAGE_SIZE = 12;

const LibraryUser = () => {
  const [userContent, setUserContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaFilter, setMediaFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const currentUser = authState.user;
  const isAuthenticated = authState.isAuthenticated;

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(searchQuery.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [mediaFilter, searchDebounced]);

  const loadLibraryPage = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      setError(null);
      const data = await contentApi.getUserContentWithDetails({
        page: page + 1,
        page_size: rowsPerPage,
        media_type: mediaFilter,
        search: searchDebounced,
      });
      const results = Array.isArray(data?.results)
        ? data.results.filter((item) => item && item.content)
        : [];
      setUserContent(results);
      setTotalCount(typeof data?.count === "number" ? data.count : 0);
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || "Error al obtener el contenido"
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, page, rowsPerPage, mediaFilter, searchDebounced]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadLibraryPage();
  }, [isAuthenticated, loadLibraryPage]);

  const handleFilterChange = (event, newFilter) => {
    setMediaFilter(newFilter || "ALL");
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading && userContent.length === 0 && !error)
    return <Typography color="text.primary">Cargando contenido...</Typography>;
  if (error)
    return (
      <Box sx={{ pt: 12, px: 3, textAlign: "center" }}>
        <Typography color="error" gutterBottom>
          {error}
        </Typography>
        <Button variant="contained" onClick={() => loadLibraryPage()}>
          Reintentar
        </Button>
      </Box>
    );
  if (!isAuthenticated)
    return (
      <Typography color="text.primary">
        Por favor inicia sesión para ver el contenido
      </Typography>
    );

  const emptyMessage = searchDebounced
    ? "No se encontró contenido con la búsqueda realizada."
    : "No se encontró contenido para el filtro seleccionado.";

  return (
    <Box
      sx={{
        pt: {
          xs: 2,
          md: 4,
        },
        px: {
          xs: 1,
          md: 3,
        },
        color: "text.primary",
      }}
    >
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          fontSize: {
            xs: "1.5rem",
            sm: "1.75rem",
            md: "2.125rem",
          },
          fontWeight: 600,
        }}
      >
        Biblioteca de Contenido
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            mb: 2,
            display: {
              xs: "block",
              md: "flex",
            },
            gap: 2,
          }}
        >
          <Button
            sx={{
              width: {
                xs: "100%",
                md: 280,
              },
              mb: {
                xs: 2,
                md: 0,
              },
            }}
            variant="contained"
            color="primary"
            onClick={() => navigate("/content/collections")}
          >
            Colecciones
          </Button>

          <Button
            sx={{
              width: {
                xs: "100%",
                md: 280,
              },
              mb: {
                xs: 2,
                md: 0,
              },
            }}
            variant="contained"
            color="primary"
            onClick={() =>
              navigate("/profiles/my_profile?section=knowledge-paths")
            }
          >
            Mis caminos de conocimiento
          </Button>

          <Button
            sx={{
              width: {
                xs: "100%",
                md: 280,
              },
              mb: {
                xs: 2,
                md: 0,
              },
            }}
            variant="contained"
            color="primary"
            startIcon={<UploadFileIcon />}
            onClick={() => navigate("/content/library_upload_content")}
          >
            Subir contenido
          </Button>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 3,
            mb: 2,
          }}
        >
          <TextField
            placeholder="Buscar en tu biblioteca..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              width: { xs: "100%", sm: 400 },
              "& .MuiOutlinedInput-root": {
                backgroundColor: "background.paper",
              },
            }}
          />

          <ToggleButtonGroup
            value={mediaFilter}
            exclusive
            onChange={handleFilterChange}
            aria-label="media type filter"
            sx={{
              "& .MuiToggleButton-root": {
                color: "text.primary",
                backgroundColor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                "&.Mui-selected": {
                  backgroundColor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": {
                    backgroundColor: "primary.dark",
                  },
                },
                "&:hover": {
                  backgroundColor: "action.hover",
                },
              },
            }}
          >
            <ToggleButton value="ALL">Todos</ToggleButton>
            <ToggleButton value="IMAGE">Imágenes</ToggleButton>
            <ToggleButton value="TEXT">Texto</ToggleButton>
            <ToggleButton value="VIDEO">Video</ToggleButton>
            <ToggleButton value="AUDIO">Audio</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {loading && userContent.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          Cargando…
        </Typography>
      ) : mediaFilter === "TEXT" ? (
        <Box sx={{ overflowX: "auto" }}>
          {userContent.length === 0 ? (
            <Typography
              variant="body1"
              color="text.secondary"
              align="center"
              sx={{ py: 4 }}
            >
              {emptyMessage}
            </Typography>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "12px", color: "inherit" }}>
                    Título
                  </th>
                  <th style={{ textAlign: "left", padding: "12px", color: "inherit" }}>
                    Autor
                  </th>
                  <th style={{ textAlign: "left", padding: "12px", color: "inherit" }}>
                    Notas
                  </th>
                  <th style={{ textAlign: "left", padding: "12px", color: "inherit" }}>
                    Archivo
                  </th>
                </tr>
              </thead>
              <tbody>
                {userContent.map((contentProfile) => (
                  <tr
                    key={contentProfile.id}
                    style={{
                      borderBottom: "1px solid #eee",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      navigate(
                        `/content/${contentProfile.content.id}/library?context=library&id=${currentUser.id}`
                      )
                    }
                  >
                    <td style={{ padding: "12px", color: "inherit" }}>
                      {contentProfile.title}
                    </td>
                    <td style={{ padding: "12px", color: "inherit" }}>
                      {contentProfile.author}
                    </td>
                    <td style={{ padding: "12px", color: "inherit" }}>
                      {contentProfile.personal_note && (
                        <IconButton size="small" title={contentProfile.personal_note}>
                          <NoteIcon color="primary" />
                        </IconButton>
                      )}
                    </td>
                    <td style={{ padding: "12px", color: "inherit" }}>
                      {(() => {
                        const dlUrl = resolveMediaUrl(
                          contentProfile.content.file_details?.url ??
                            contentProfile.content.file_details?.file
                        );
                        return dlUrl ? (
                          <a
                            href={dlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "inherit", textDecoration: "underline" }}
                          >
                            Descargar
                          </a>
                        ) : null;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Box>
      ) : (
        <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={3}>
          {userContent.map((contentProfile) => (
            <Box
              gridColumn={{ xs: "span 12", sm: "span 6", md: "span 4" }}
              key={contentProfile.id}
            >
              <ContentDisplay
                content={contentProfile}
                variant="card"
                showAuthor={true}
                onClick={() =>
                  navigate(
                    `/content/${contentProfile.content.id}/library?context=library&id=${currentUser.id}`
                  )
                }
              />
            </Box>
          ))}

          {userContent.length === 0 && (
            <Box gridColumn={{ xs: "span 12" }}>
              <Typography variant="body1" color="text.secondary" align="center">
                {emptyMessage}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[12, 24, 48]}
        labelRowsPerPage="Por página"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`
        }
        sx={{ mt: 2, borderTop: 1, borderColor: "divider" }}
      />
    </Box>
  );
};

export default LibraryUser;
