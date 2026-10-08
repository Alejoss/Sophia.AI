import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  Stack } from
"@mui/material";
import { getBookmarks, deleteBookmark } from "../api/bookmarkApi";
import SchoolIcon from "@mui/icons-material/School";
import ArticleIcon from "@mui/icons-material/Article";
import DeleteIcon from "@mui/icons-material/Delete";
import AddToLibraryModal from "../components/AddToLibraryModal";
import ContentDisplay from "../content/ContentDisplay";
import { AuthContext } from "../context/AuthContext";

const Bookmarks = () => {
  const { t } = useTranslation('profiles');
  const { authState } = useContext(AuthContext);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchBookmarks = async () => {
    try {
      const bookmarksData = await getBookmarks();


      setBookmarks(bookmarksData);
    } catch (err) {
      console.error("Failed to load bookmarks:", err);
      setError(t("bookmarks.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const handleBookmarkClick = (bookmark) => {


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
      setError(t("bookmarks.deleteError"));
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px">
        
        <CircularProgress />
      </Box>);

  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Container>);

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
              md: "2.125rem" // ~34px on desktop (default h4)
            },
            fontWeight: 600
          }}>
          
          {t("bookmarks.title")}
        </Typography>

        {bookmarks.length === 0 ?
        <Typography variant="body1" align="center" sx={{ py: 4 }}>
            {t("bookmarks.empty")}
          </Typography> :

        <Box>
            {bookmarks.map((bookmark, index) => {


            return (
              <Box key={bookmark.id}>
                  {bookmark.content_type_name === "content" && bookmark.content_profile &&
                <Box
                  onClick={() => handleBookmarkClick(bookmark)}
                  sx={{
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: "action.hover"
                    },
                    p: 2
                  }}>
                  
                      <ContentDisplay
                    content={bookmark.content_profile}
                    variant="simple"
                    showAuthor={true}
                    showActions={true}
                    onClick={() => handleBookmarkClick(bookmark)}
                    additionalActions={
                    <Box sx={{ display: "flex", gap: 1 }}>
                            {(() => {
                        const profileUserId = bookmark.content_profile?.user;
                        const currentUserId = authState.user?.id;
                        const isOwnContent = profileUserId && currentUserId && parseInt(profileUserId) === parseInt(currentUserId);
                        return !isOwnContent ?
                        <AddToLibraryModal
                          content={bookmark.content_profile}
                          onSuccess={fetchBookmarks} /> :

                        null;
                      })()}
                            <Tooltip title={t("bookmarks.remove")}>
                              <IconButton
                          onClick={(e) => handleDelete(bookmark.id, e)}
                          color="error"
                          size="small">
                          
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                    } />
                  
                    </Box>
                }

                  {bookmark.content_type_name === "knowledgepath" &&
                <Box
                  onClick={() => handleBookmarkClick(bookmark)}
                  sx={{
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: "action.hover"
                    },
                    p: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 2
                  }}>
                  
                      <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 60,
                      height: 60,
                      backgroundColor: "background.paper",
                      borderRadius: 0.5
                    }}>
                    
                        <SchoolIcon
                      sx={{ fontSize: 40, color: "primary.main" }} />
                    
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" color="text.primary">
                          {bookmark.content_profile?.title ||
                      t("bookmarks.untitledPath")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t("bookmarks.path")}
                        </Typography>
                      </Box>
                      <Tooltip title={t("bookmarks.remove")}>
                        <IconButton
                      onClick={(e) => handleDelete(bookmark.id, e)}
                      color="error"
                      size="small">
                      
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                }

                  {bookmark.content_type_name === "publication" &&
                <Box
                  onClick={() => handleBookmarkClick(bookmark)}
                  sx={{
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: "action.hover"
                    },
                    p: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 2
                  }}>
                  
                      <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 60,
                      height: 60,
                      backgroundColor: "background.paper",
                      borderRadius: 0.5
                    }}>
                    
                        <ArticleIcon
                      sx={{ fontSize: 40, color: "primary.main" }} />
                    
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" color="text.primary">
                          {bookmark.content_profile?.title ||
                      t("bookmarks.untitledPublication")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t("bookmarks.publication")}
                        </Typography>
                      </Box>
                      <Tooltip title={t("bookmarks.remove")}>
                        <IconButton
                      onClick={(e) => handleDelete(bookmark.id, e)}
                      color="error"
                      size="small">
                      
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                }

                  {index < bookmarks.length - 1 && <Divider />}
                </Box>);

          })}
          </Box>
        }
      </Paper>
    </Container>);

};

export default Bookmarks;