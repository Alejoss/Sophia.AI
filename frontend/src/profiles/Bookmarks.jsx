import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Stack,
} from "@mui/material";
import { getBookmarks, deleteBookmark } from "../api/bookmarkApi";
import SchoolIcon from "@mui/icons-material/School";
import ArticleIcon from "@mui/icons-material/Article";
import DeleteIcon from "@mui/icons-material/Delete";
import AddToLibraryModal from "../components/AddToLibraryModal";
import ContentDisplay from "../content/ContentDisplay";

const Bookmarks = () => {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchBookmarks = async () => {
    try {
      const bookmarksData = await getBookmarks();
      console.log("\n=== Bookmarks Data ===");
      console.log("Raw bookmarks:", bookmarksData);
      setBookmarks(bookmarksData);
    } catch (err) {
      console.error("Failed to load bookmarks:", err);
      setError("Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const handleBookmarkClick = (bookmark) => {
    console.log("\n=== Bookmark Click ===");
    console.log("Bookmark data:", bookmark);
    const { content_type_name, object_id, topic } = bookmark;

    if (content_type_name === "content") {
      if (topic) {
        navigate(`/content/${object_id}/topic/${topic.id}`);
      } else {
        navigate(`/content/${object_id}/library`);
      }
    } else if (content_type_name === "knowledgepath") {
      navigate(`/knowledge_path/${object_id}`);
    } else if (content_type_name === "publication") {
      navigate(`/publications/${object_id}`);
    }
  };

  const handleDelete = async (bookmarkId, event) => {
    event.stopPropagation();
    try {
      await deleteBookmark(bookmarkId);
      fetchBookmarks();
    } catch (error) {
      setError("Error al eliminar el marcador");
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 3, mt: 3 }}>
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
          Mis marcadores
        </Typography>

        {bookmarks.length === 0 ? (
          <Typography variant="body1" align="center" sx={{ py: 4 }}>
            No hay elementos guardados
          </Typography>
        ) : (
          <Box>
            {bookmarks.map((bookmark, index) => {
              console.log("\n=== Rendering Bookmark ===");
              console.log("Bookmark:", bookmark);
              console.log("Content type name:", bookmark.content_type_name);
              console.log("Content profile:", bookmark.content_profile);

              return (
                <Box key={bookmark.id}>
                  {bookmark.content_type_name === "content" && (
                    <Box
                      onClick={() => handleBookmarkClick(bookmark)}
                      sx={{
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                        p: 2,
                      }}
                    >
                      <ContentDisplay
                        content={bookmark.content_profile.content}
                        variant="simple"
                        showAuthor={true}
                        showActions={true}
                        additionalActions={
                          <Box sx={{ display: "flex", gap: 1 }}>
                            <AddToLibraryModal
                              content={bookmark.content_profile}
                              onSuccess={fetchBookmarks}
                            />
                            <Tooltip title="Eliminar marcador">
                              <IconButton
                                onClick={(e) => handleDelete(bookmark.id, e)}
                                color="error"
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        }
                      />
                    </Box>
                  )}

                  {bookmark.content_type_name === "knowledgepath" && (
                    <Box
                      onClick={() => handleBookmarkClick(bookmark)}
                      sx={{
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                        p: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 60,
                          height: 60,
                          backgroundColor: "background.paper",
                          borderRadius: 1,
                        }}
                      >
                        <SchoolIcon
                          sx={{ fontSize: 40, color: "primary.main" }}
                        />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" color="text.primary">
                          {bookmark.content_profile?.title ||
                            "Ruta de conocimiento sin título"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Ruta de conocimiento
                        </Typography>
                      </Box>
                      <Tooltip title="Delete bookmark">
                        <IconButton
                          onClick={(e) => handleDelete(bookmark.id, e)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}

                  {bookmark.content_type_name === "publication" && (
                    <Box
                      onClick={() => handleBookmarkClick(bookmark)}
                      sx={{
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                        p: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 60,
                          height: 60,
                          backgroundColor: "background.paper",
                          borderRadius: 1,
                        }}
                      >
                        <ArticleIcon
                          sx={{ fontSize: 40, color: "primary.main" }}
                        />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" color="text.primary">
                          {bookmark.content_profile?.title ||
                            "Publicación sin título"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Publicación
                        </Typography>
                      </Box>
                      <Tooltip title="Delete bookmark">
                        <IconButton
                          onClick={(e) => handleDelete(bookmark.id, e)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}

                  {index < bookmarks.length - 1 && <Divider />}
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default Bookmarks;
