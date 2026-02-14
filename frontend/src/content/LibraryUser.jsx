import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Button,
  TextField,
  InputAdornment,
} from "@mui/material";
import NoteIcon from "@mui/icons-material/Note";
import SearchIcon from "@mui/icons-material/Search";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import contentApi from "../api/contentApi";
import { useNavigate } from "react-router-dom";
import { resolveMediaUrl } from "../utils/fileUtils";
import { AuthContext } from "../context/AuthContext";
import ContentDisplay from "./ContentDisplay";

const fetchUserContentWithDetails = async () => {
  const data = await contentApi.getUserContentWithDetails();
  return Array.isArray(data) ? data.filter((item) => item && item.content) : [];
};

const LibraryUser = () => {
  const [userContent, setUserContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaFilter, setMediaFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const currentUser = authState.user;
  const isAuthenticated = authState.isAuthenticated;

  useEffect(() => {
    const loadContent = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const validContent = await fetchUserContentWithDetails();
        setUserContent(validContent);
      } catch (err) {
        setError(
          err.response?.data?.error || err.message || "Error al obtener el contenido"
        );
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, [isAuthenticated]);

  const handleFilterChange = (event, newFilter) => {
    setMediaFilter(newFilter || "ALL");
  };

  const filteredContent = useMemo(() => {
    let result = userContent.filter((contentProfile) => {
      if (!contentProfile || !contentProfile.content) return false;
      return (
        mediaFilter === "ALL" || contentProfile.content.media_type === mediaFilter
      );
    });

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((contentProfile) => {
        const title = (contentProfile.title || "").toLowerCase();
        const author = (contentProfile.author || "").toLowerCase();
        const note = (contentProfile.personal_note || "").toLowerCase();
        const originalTitle = (contentProfile.content?.original_title || "").toLowerCase();
        const mediaType = (contentProfile.content?.media_type || "").toLowerCase();
        return (
          title.includes(query) ||
          author.includes(query) ||
          note.includes(query) ||
          originalTitle.includes(query) ||
          mediaType.includes(query)
        );
      });
    }

    return result;
  }, [userContent, mediaFilter, searchQuery]);

  if (loading) return <Typography color="text.primary">Cargando contenido...</Typography>;
  if (error)
    return (
      <Box sx={{ pt: 12, px: 3, textAlign: "center" }}>
        <Typography color="error" gutterBottom>
          {error}
        </Typography>
        <Button
          variant="contained"
          onClick={async () => {
            if (!isAuthenticated) return;
            setError(null);
            setLoading(true);
            try {
              const validContent = await fetchUserContentWithDetails();
              setUserContent(validContent);
            } catch (err) {
              setError(
                err.response?.data?.error || err.message || "Error al obtener el contenido"
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          Reintentar
        </Button>
      </Box>
    );
  if (!isAuthenticated)
    return <Typography color="text.primary">Por favor inicia sesión para ver el contenido</Typography>;

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
            xs: "1.5rem", // ~24px on mobile
            sm: "1.75rem", // ~28px on small screens
            md: "2.125rem", // ~34px on desktop (default h4)
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
              xs: "block", // mobile → stacked
              md: "flex", // md and up → flex row
            },
            gap: 2,
          }}
        >
          <Button
            sx={{
              width: {
                xs: "100%", // full width on mobile
                md: 280, // fixed 280px on md+
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
                xs: "100%", // full width on mobile
                md: 280, // fixed 280px on md+
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
                xs: "100%", // full width on mobile
                md: 280, // fixed 280px on md+
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
            mb: 2,
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

      {mediaFilter === "TEXT" ? (
        // Table view for text files
        <Box sx={{ overflowX: "auto" }}>
          {filteredContent.length === 0 ? (
            <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
              {searchQuery.trim()
                ? "No se encontró contenido con la búsqueda realizada."
                : "No se encontró contenido para el filtro seleccionado."}
            </Typography>
          ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px", color: "inherit" }}>Título</th>
                <th style={{ textAlign: "left", padding: "12px", color: "inherit" }}>Autor</th>
                <th style={{ textAlign: "left", padding: "12px", color: "inherit" }}>Notas</th>
                <th style={{ textAlign: "left", padding: "12px", color: "inherit" }}>Archivo</th>
              </tr>
            </thead>
            <tbody>
              {filteredContent.map((contentProfile) => (
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
                  <td style={{ padding: "12px", color: "inherit" }}>{contentProfile.title}</td>
                  <td style={{ padding: "12px", color: "inherit" }}>{contentProfile.author}</td>
                  <td style={{ padding: "12px", color: "inherit" }}>
                    {contentProfile.personal_note && (
                      <IconButton
                        size="small"
                        title={contentProfile.personal_note}
                      >
                        <NoteIcon color="primary" />
                      </IconButton>
                    )}
                  </td>
                  <td style={{ padding: "12px", color: "inherit" }}>
                    {(() => {
                      const dlUrl = resolveMediaUrl(contentProfile.content.file_details?.url ?? contentProfile.content.file_details?.file);
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
        // Grid view using ContentDisplay in card mode
        <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={3}>
          {filteredContent.map((contentProfile) => (
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

          {filteredContent.length === 0 && (
            <Box gridColumn={{ xs: "span 12" }}>
              <Typography variant="body1" color="text.secondary" align="center">
                {searchQuery.trim()
                  ? "No se encontró contenido con la búsqueda realizada."
                  : "No se encontró contenido para el filtro seleccionado."}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default LibraryUser;
